import { NextRequest, NextResponse } from 'next/server'
import { verifySlackSignature, slack, PRIORITY_LABELS } from '@/lib/slack'
import sql from '@/lib/db'

async function processSubmission(payload: Record<string, unknown>) {
  const values = (payload.view as { state: { values: Record<string, Record<string, { selected_option?: { value: string }; value?: string }>> } }).state.values
  const product = values.product.value.selected_option?.value ?? ''
  const priority = values.priority.value.selected_option?.value ?? 'normal'
  const description = values.description.value.value ?? ''
  const boUrl = values.bo_url?.value?.value ?? null
  const hubspotUrl = values.hubspot_url?.value?.value ?? null
  const attachments = values.attachments?.value?.value ?? null
  const channelId = (payload.view as { private_metadata: string }).private_metadata
  const user = payload.user as { id: string; username: string }

  const [question] = await sql`
    INSERT INTO questions (product_type, description, bo_url, hubspot_url, attachments, priority, sales_slack_id, sales_name, slack_channel_id, status)
    VALUES (${product}, ${description}, ${boUrl}, ${hubspotUrl}, ${attachments}, ${priority}, ${user.id}, ${user.username}, ${channelId}, 'pending')
    RETURNING *
  `

  if (!question) {
    console.error('Failed to insert question')
    return
  }

  const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL}/questions/${question.id}`
  const priorityLabel = PRIORITY_LABELS[priority] ?? priority

  const blocks = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*✅ Demande bien reçue* — <@${user.id}>\n\n>${description.slice(0, 300)}${description.length > 300 ? '...' : ''}`,
      },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Produit*\n${product}` },
        { type: 'mrkdwn', text: `*Priorité*\n${priorityLabel}` },
        ...(boUrl ? [{ type: 'mrkdwn', text: `*Back-Office*\n<${boUrl}|Voir le dossier>` }] : []),
        ...(hubspotUrl ? [{ type: 'mrkdwn', text: `*HubSpot*\n<${hubspotUrl}|Voir le contact>` }] : []),
        ...(attachments ? [{ type: 'mrkdwn', text: `*Fichiers joints*\n${attachments}` }] : []),
      ],
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: '📋 Voir dans le dashboard' },
          url: dashboardUrl,
          style: 'primary',
        },
      ],
    },
  ]

  const msg = await slack.chat.postMessage({
    channel: channelId,
    blocks,
    text: `Nouvelle demande ${product} de ${user.username} — ${priorityLabel}`,
  })

  if (msg.ts) {
    await sql`UPDATE questions SET slack_thread_ts = ${msg.ts} WHERE id = ${question.id}`
  }

  const underwritingChannel = process.env.SLACK_UNDERWRITING_CHANNEL_ID
  if (underwritingChannel && underwritingChannel !== channelId) {
    const links = [
      boUrl ? `*Back-Office* <${boUrl}|Voir le dossier>` : null,
      hubspotUrl ? `*HubSpot* <${hubspotUrl}|Voir le contact>` : null,
    ].filter(Boolean).join('   |   ')

    await slack.chat.postMessage({
      channel: underwritingChannel,
      text: `🔔 Nouvelle demande *${priorityLabel}* — *${product}* de <@${user.id}>\n>${description.slice(0, 200)}${description.length > 200 ? '...' : ''}\n${links ? `${links}\n` : ''}<${dashboardUrl}|Voir dans le dashboard>`,
    })
  }
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const timestamp = req.headers.get('x-slack-request-timestamp') ?? ''
  const signature = req.headers.get('x-slack-signature') ?? ''

  if (!verifySlackSignature(rawBody, timestamp, signature)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const params = new URLSearchParams(rawBody)
  const payloadStr = params.get('payload')

  if (!payloadStr) {
    return new NextResponse(null, { status: 200 })
  }

  const payload = JSON.parse(payloadStr)

  if (
    payload.type === 'view_submission' &&
    payload.view.callback_id === 'ask_underwriter_submit'
  ) {
    await processSubmission(payload)
    return new NextResponse(null, { status: 200 })
  }

  return new NextResponse(null, { status: 200 })
}

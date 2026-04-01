import { NextRequest, NextResponse } from 'next/server'
import { verifySlackSignature, slack, PRIORITY_LABELS } from '@/lib/slack'
import { put } from '@vercel/blob'
import sql from '@/lib/db'

interface SlackFile {
  id: string
  name: string
  mimetype: string
  size: number
  url_private_download: string
}

async function uploadSlackFilesToBlob(
  slackFiles: SlackFile[],
  questionId: string
): Promise<void> {
  await Promise.all(
    slackFiles.map(async (file) => {
      try {
        // Download from Slack (private URL requires bot token auth)
        const res = await fetch(file.url_private_download, {
          headers: { Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}` },
        })
        if (!res.ok) throw new Error(`Failed to download Slack file ${file.id}`)

        const buffer = await res.arrayBuffer()

        // Upload to Vercel Blob
        const blob = await put(
          `questions/${questionId}/${Date.now()}-${file.name}`,
          buffer,
          { access: 'public', contentType: file.mimetype }
        )

        // Save to DB
        await sql`
          INSERT INTO attachments (question_id, file_name, file_type, file_size, blob_url, blob_pathname, slack_file_id)
          VALUES (${questionId}, ${file.name}, ${file.mimetype}, ${file.size}, ${blob.url}, ${blob.pathname}, ${file.id})
        `
      } catch (err) {
        console.error(`Failed to process Slack file ${file.name}:`, err)
      }
    })
  )
}

async function processSubmission(payload: Record<string, unknown>) {
  const values = (payload.view as { state: { values: Record<string, Record<string, { selected_option?: { value: string }; value?: string; files?: SlackFile[] }>> } }).state.values
  const product = values.product.value.selected_option?.value ?? ''
  const priority = values.priority.value.selected_option?.value ?? 'normal'
  const description = values.description.value.value ?? ''
  const boUrl = values.bo_url?.value?.value ?? null
  const hubspotUrl = values.hubspot_url?.value?.value ?? null
  const channelId = (payload.view as { private_metadata: string }).private_metadata
  const user = payload.user as { id: string; username: string }

  // Extract uploaded files from file_input
  const slackFiles: SlackFile[] = values.attachments?.value?.files ?? []

  const [question] = await sql`
    INSERT INTO questions (product_type, description, bo_url, hubspot_url, priority, sales_slack_id, sales_name, slack_channel_id, status)
    VALUES (${product}, ${description}, ${boUrl}, ${hubspotUrl}, ${priority}, ${user.id}, ${user.username}, ${channelId}, 'pending')
    RETURNING *
  `

  if (!question) {
    console.error('Failed to insert question')
    return
  }

  // Upload Slack files to Vercel Blob (non-blocking, don't fail the response)
  if (slackFiles.length > 0) {
    uploadSlackFilesToBlob(slackFiles, question.id).catch((err) =>
      console.error('File upload error:', err)
    )
  }

  const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL}/questions/${question.id}`
  const priorityLabel = PRIORITY_LABELS[priority] ?? priority

  const filesSummary = slackFiles.length > 0
    ? `\n📎 ${slackFiles.length} fichier${slackFiles.length > 1 ? 's' : ''} joint${slackFiles.length > 1 ? 's' : ''}`
    : ''

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
        ...(slackFiles.length > 0 ? [{ type: 'mrkdwn', text: `*Fichiers*\n${slackFiles.map(f => f.name).join(', ')}` }] : []),
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
    text: `Nouvelle demande ${product} de ${user.username} — ${priorityLabel}${filesSummary}`,
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
      text: `🔔 Nouvelle demande *${priorityLabel}* — *${product}* de <@${user.id}>\n>${description.slice(0, 200)}${description.length > 200 ? '...' : ''}\n${links ? `${links}\n` : ''}${filesSummary ? `${filesSummary}\n` : ''}<${dashboardUrl}|Voir dans le dashboard>`,
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

import { NextRequest, NextResponse } from 'next/server'
import { verifySlackSignature, slack, PRIORITY_LABELS } from '@/lib/slack'
import { getSupabaseAdmin } from '@/lib/supabase'

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
    const values = payload.view.state.values
    const product = values.product.value.selected_option?.value ?? ''
    const priority = values.priority.value.selected_option?.value ?? 'normal'
    const description = values.description.value.value ?? ''
    const boUrl = values.bo_url?.value?.value ?? null
    const hubspotUrl = values.hubspot_url?.value?.value ?? null
    const channelId = payload.view.private_metadata
    const user = payload.user

    const supabase = getSupabaseAdmin()

    const { data: question, error } = await supabase
      .from('questions')
      .insert({
        product_type: product,
        description,
        bo_url: boUrl || null,
        hubspot_url: hubspotUrl || null,
        priority,
        sales_slack_id: user.id,
        sales_name: user.username,
        slack_channel_id: channelId,
        status: 'pending',
      })
      .select()
      .single()

    if (error) {
      console.error('Failed to insert question:', error)
      return new NextResponse(null, { status: 200 })
    }

    if (question) {
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
            ...(boUrl
              ? [{ type: 'mrkdwn', text: `*Back-Office*\n<${boUrl}|Voir le dossier>` }]
              : []),
            ...(hubspotUrl
              ? [{ type: 'mrkdwn', text: `*HubSpot*\n<${hubspotUrl}|Voir le contact>` }]
              : []),
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
        await supabase.from('questions').update({ slack_thread_ts: msg.ts }).eq('id', question.id)
      }

      // Notify underwriting channel if different from source channel
      const underwritingChannel = process.env.SLACK_UNDERWRITING_CHANNEL_ID
      if (underwritingChannel && underwritingChannel !== channelId) {
        await slack.chat.postMessage({
          channel: underwritingChannel,
          text: `🔔 Nouvelle demande *${priorityLabel}* — *${product}* de <@${user.id}>\n<${dashboardUrl}|Voir dans le dashboard>`,
        })
      }
    }

    return new NextResponse(null, { status: 200 })
  }

  return new NextResponse(null, { status: 200 })
}

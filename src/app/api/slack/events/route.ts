import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import { verifySlackSignature, slack, PRIORITY_LABELS } from '@/lib/slack'
import { put } from '@vercel/blob'
import sql from '@/lib/db'

interface SlackFile {
  id: string
  name: string
  mimetype: string
  size: number
  url_private_download?: string
}

async function getSlackFileDownloadUrl(fileId: string): Promise<{ url: string; name: string; mimetype: string; size: number } | null> {
  try {
    const res = await fetch(`https://slack.com/api/files.info?file=${fileId}`, {
      headers: { Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}` },
    })
    const data = await res.json()
    if (!data.ok || !data.file) return null
    return {
      url: data.file.url_private_download,
      name: data.file.name,
      mimetype: data.file.mimetype,
      size: data.file.size,
    }
  } catch (err) {
    console.error('files.info failed for', fileId, err)
    return null
  }
}

async function uploadSlackFilesToBlob(slackFiles: SlackFile[], questionId: string): Promise<void> {
  await Promise.all(
    slackFiles.map(async (file) => {
      try {
        // Get download URL via files.info (more reliable than payload URL)
        const info = await getSlackFileDownloadUrl(file.id)
        if (!info) {
          console.error('Could not get file info for', file.id)
          return
        }

        // Download from Slack (requires files:read scope)
        const res = await fetch(info.url, {
          headers: { Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}` },
        })
        if (!res.ok) throw new Error(`HTTP ${res.status} downloading ${info.name}`)

        const buffer = await res.arrayBuffer()

        // Upload to Vercel Blob
        const blob = await put(
          `questions/${questionId}/${Date.now()}-${info.name}`,
          buffer,
          { access: 'public', contentType: info.mimetype }
        )

        // Save to DB
        await sql`
          INSERT INTO attachments (question_id, file_name, file_type, file_size, blob_url, blob_pathname, slack_file_id)
          VALUES (${questionId}, ${info.name}, ${info.mimetype}, ${info.size}, ${blob.url}, ${blob.pathname}, ${file.id})
        `
        console.log('Uploaded file', info.name, 'for question', questionId)
      } catch (err) {
        console.error(`Failed to process file ${file.id}:`, err)
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

  // Schedule file upload after response (avoids Slack 3s timeout)
  if (slackFiles.length > 0) {
    after(uploadSlackFilesToBlob(slackFiles, question.id))
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

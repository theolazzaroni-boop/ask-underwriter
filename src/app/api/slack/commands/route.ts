export const runtime = 'edge'

import { NextRequest, NextResponse } from 'next/server'
import { buildAskModal } from '@/lib/slack-modal'

async function verifySlackSignatureEdge(
  rawBody: string,
  timestamp: string,
  signature: string
): Promise<boolean> {
  const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 60 * 5
  if (parseInt(timestamp) < fiveMinutesAgo) return false

  const sigBase = `v0:${timestamp}:${rawBody}`
  const secret = process.env.SLACK_SIGNING_SECRET!
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sigBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(sigBase))
  const hex = Array.from(new Uint8Array(sigBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  const expected = `v0=${hex}`
  return expected === signature
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const timestamp = req.headers.get('x-slack-request-timestamp') ?? ''
  const signature = req.headers.get('x-slack-signature') ?? ''

  if (!(await verifySlackSignatureEdge(rawBody, timestamp, signature))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const params = new URLSearchParams(rawBody)
  const triggerId = params.get('trigger_id')
  const channelId = params.get('channel_id') ?? ''

  if (!triggerId) {
    return NextResponse.json({ error: 'Missing trigger_id' }, { status: 400 })
  }

  // Fire-and-forget — must respond to Slack within 3s
  fetch('https://slack.com/api/views.open', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
    },
    body: JSON.stringify({ trigger_id: triggerId, view: buildAskModal(channelId) }),
  }).catch(console.error)

  return new NextResponse(null, { status: 200 })
}

import { NextRequest, NextResponse } from 'next/server'
import { verifySlackSignature, slack } from '@/lib/slack'
import { buildAskModal } from '@/lib/slack-modal'

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const timestamp = req.headers.get('x-slack-request-timestamp') ?? ''
  const signature = req.headers.get('x-slack-signature') ?? ''

  if (!verifySlackSignature(rawBody, timestamp, signature)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const params = new URLSearchParams(rawBody)
  const triggerId = params.get('trigger_id')
  const channelId = params.get('channel_id') ?? ''

  if (!triggerId) {
    return NextResponse.json({ error: 'Missing trigger_id' }, { status: 400 })
  }

  // Open modal — must respond to Slack within 3s, so we don't await
  slack.views
    .open({ trigger_id: triggerId, view: buildAskModal(channelId) as never })
    .catch(console.error)

  return new NextResponse(null, { status: 200 })
}

import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'
import { createHmac } from 'crypto'

function verifySignature(secret: string, signature: string, timestamp: string, rawBody: string): boolean {
  const base = `v0:${timestamp}:${rawBody}`
  const hmac = createHmac('sha256', secret).update(base).digest('hex')
  const computed = `v0=${hmac}`
  try {
    if (computed.length !== signature.length) return false
    let diff = 0
    for (let i = 0; i < computed.length; i++) diff |= computed.charCodeAt(i) ^ signature.charCodeAt(i)
    return diff === 0
  } catch { return false }
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get('x-slack-signature') ?? ''
  const timestamp = req.headers.get('x-slack-request-timestamp') ?? ''

  const secret = process.env.SLACK_SIGNING_SECRET
  if (!secret || !verifySignature(secret, signature, timestamp, rawBody)) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const body = JSON.parse(rawBody)

  // Respond to Slack challenge
  if (body.type === 'url_verification') {
    return NextResponse.json({ challenge: body.challenge })
  }

  const event = body.event
  if (!event) return NextResponse.json({ ok: true })

  // Only handle plain new messages in threads (no subtypes, no bots)
  if (event.type !== 'message' || !event.thread_ts || event.subtype || event.bot_id) {
    return NextResponse.json({ ok: true })
  }

  // Process async to respond to Slack in < 3s
  ;(async () => {
    try {
      // Find the question by thread_ts
      const [question] = await sql`
        SELECT * FROM questions WHERE slack_thread_ts = ${event.thread_ts} LIMIT 1
      `
      if (!question) return

      // Dedup: check if we already have this slack message
      const [existing] = await sql`
        SELECT id FROM answers WHERE slack_message_ts = ${event.ts} LIMIT 1
      `
      if (existing) return

      // Resolve author name from Slack
      let authorName: string = event.user ?? 'Slack'
      try {
        const userRes = await fetch(`https://slack.com/api/users.info?user=${event.user}`, {
          headers: { 'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN}` }
        })
        const userData = await userRes.json()
        if (userData.ok && userData.user?.real_name) {
          authorName = userData.user.real_name
        }
      } catch {}

      await sql`
        INSERT INTO answers (question_id, underwriter_name, content, source, slack_message_ts, author_name, sent_to_slack)
        VALUES (${question.id}, ${authorName}, ${event.text}, 'slack', ${event.ts}, ${authorName}, true)
      `
    } catch (err) {
      console.error('Webhook processing error:', err)
    }
  })()

  return NextResponse.json({ ok: true })
}

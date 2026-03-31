import { WebClient } from '@slack/web-api'
import { createHmac, timingSafeEqual } from 'crypto'

export const slack = new WebClient(process.env.SLACK_BOT_TOKEN)

export function verifySlackSignature(
  rawBody: string,
  timestamp: string,
  signature: string
): boolean {
  const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 60 * 5
  if (parseInt(timestamp) < fiveMinutesAgo) return false

  const sigBase = `v0:${timestamp}:${rawBody}`
  const hmac = createHmac('sha256', process.env.SLACK_SIGNING_SECRET!)
  hmac.update(sigBase)
  const expectedSig = `v0=${hmac.digest('hex')}`

  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))
  } catch {
    return false
  }
}

export const PRIORITY_LABELS: Record<string, string> = {
  normal: '🟢 Normal',
  high: '🟡 Haute priorité',
  urgent: '🔴 Urgent',
}

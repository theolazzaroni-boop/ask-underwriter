import { NextRequest, NextResponse } from 'next/server'
import { slack } from '@/lib/slack'
import sql from '@/lib/db'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { content, underwriter_name } = await req.json()

  if (!content || !underwriter_name) {
    return NextResponse.json({ error: 'content and underwriter_name are required' }, { status: 400 })
  }

  const [question] = await sql`SELECT * FROM questions WHERE id = ${id}`

  if (!question) {
    return NextResponse.json({ error: 'Question not found' }, { status: 404 })
  }

  const [answer] = await sql`
    INSERT INTO answers (question_id, underwriter_name, content, sent_to_slack)
    VALUES (${id}, ${underwriter_name}, ${content}, false)
    RETURNING *
  `

  let sentToSlack = false
  if (question.slack_channel_id && question.slack_thread_ts) {
    const responseTimeMs = Date.now() - new Date(question.created_at).getTime()
    const responseTimeMin = Math.round(responseTimeMs / 60000)
    const timeLabel =
      responseTimeMin < 60
        ? `${responseTimeMin} min`
        : `${Math.round(responseTimeMin / 60)}h${responseTimeMin % 60 > 0 ? ` ${responseTimeMin % 60}min` : ''}`

    try {
      await slack.chat.postMessage({
        channel: question.slack_channel_id,
        thread_ts: question.slack_thread_ts,
        text: `Réponse de ${underwriter_name} pour <@${question.sales_slack_id}>`,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `<@${question.sales_slack_id}> voici la réponse de *${underwriter_name}* :\n\n${content}`,
            },
          },
          {
            type: 'context',
            elements: [{ type: 'mrkdwn', text: `⏱️ Traité en ${timeLabel}` }],
          },
        ],
      })
      sentToSlack = true
    } catch (err) {
      console.error('Failed to post to Slack:', err)
    }
  }

  await Promise.all([
    sql`UPDATE answers SET sent_to_slack = ${sentToSlack} WHERE id = ${answer.id}`,
    sql`UPDATE questions SET status = 'answered', assigned_to = ${underwriter_name} WHERE id = ${id}`,
  ])

  // Enrich knowledge base
  await sql`
    INSERT INTO knowledge_base (product, question_text, answer_text, source)
    VALUES (${question.product_type}, ${question.description}, ${content}, 'app')
  `.catch(() => {}) // non-blocking, don't fail the request

  return NextResponse.json({ success: true, answer })
}

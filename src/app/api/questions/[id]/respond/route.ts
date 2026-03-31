import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { slack } from '@/lib/slack'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { content, underwriter_name } = await req.json()

  if (!content || !underwriter_name) {
    return NextResponse.json({ error: 'content and underwriter_name are required' }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()

  // Get the question
  const { data: question, error: qError } = await supabase
    .from('questions')
    .select('*')
    .eq('id', id)
    .single()

  if (qError || !question) {
    return NextResponse.json({ error: 'Question not found' }, { status: 404 })
  }

  // Save the answer
  const { data: answer, error: aError } = await supabase
    .from('answers')
    .insert({
      question_id: id,
      underwriter_name,
      content,
      sent_to_slack: false,
    })
    .select()
    .single()

  if (aError) {
    return NextResponse.json({ error: aError.message }, { status: 500 })
  }

  // Post to Slack thread
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
            elements: [
              {
                type: 'mrkdwn',
                text: `⏱️ Traité en ${timeLabel}`,
              },
            ],
          },
        ],
      })
      sentToSlack = true
    } catch (err) {
      console.error('Failed to post to Slack:', err)
    }
  }

  // Update answer + question status
  await Promise.all([
    supabase.from('answers').update({ sent_to_slack: sentToSlack }).eq('id', answer.id),
    supabase
      .from('questions')
      .update({ status: 'answered', assigned_to: underwriter_name })
      .eq('id', id),
  ])

  return NextResponse.json({ success: true, answer })
}

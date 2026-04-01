import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'
import { ALLOWED_FILE_TYPES, MAX_FILE_SIZE } from '@/lib/attachments'

async function uploadFileToSlack(
  fileUrl: string,
  fileName: string,
  fileSize: number,
  channelId: string,
  threadTs: string
): Promise<string | null> {
  try {
    // Step 1: get upload URL
    const urlRes = await fetch('https://slack.com/api/files.getUploadURLExternal', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        filename: fileName,
        length: String(fileSize),
      }),
    })
    const { ok: urlOk, upload_url, file_id } = await urlRes.json()
    if (!urlOk || !upload_url) return null

    // Step 2: fetch the binary from Vercel Blob and upload to Slack
    const fileRes = await fetch(fileUrl)
    const fileBuffer = await fileRes.arrayBuffer()
    await fetch(upload_url, {
      method: 'POST',
      body: fileBuffer,
    })

    // Step 3: associate with thread
    await fetch('https://slack.com/api/files.completeUploadExternal', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        files: [{ id: file_id }],
        channel_id: channelId,
        thread_ts: threadTs,
        initial_comment: `📎 ${fileName}`,
      }),
    })

    return file_id
  } catch (err) {
    console.error('Slack file upload failed:', err)
    return null
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const { questionId } = JSON.parse(clientPayload || '{}')
        if (!questionId) throw new Error('questionId requis')

        // Check question exists and is not answered
        const [question] = await sql`SELECT id, status FROM questions WHERE id = ${questionId}`
        if (!question) throw new Error('Question introuvable')
        if (question.status === 'answered') throw new Error('Ce ticket est déjà traité')

        // Check attachment count
        const [{ count }] = await sql`SELECT count(*)::int FROM attachments WHERE question_id = ${questionId}`
        if (count >= 5) throw new Error('Maximum 5 fichiers par ticket')

        return {
          allowedContentTypes: ALLOWED_FILE_TYPES,
          maximumSizeInBytes: MAX_FILE_SIZE,
          tokenPayload: JSON.stringify({ questionId }),
        }
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        const { questionId } = JSON.parse(tokenPayload || '{}')

        // Save to DB
        const [attachment] = await sql`
          INSERT INTO attachments (question_id, file_name, file_type, file_size, blob_url, blob_pathname)
          VALUES (
            ${questionId},
            ${blob.pathname.split('/').pop() ?? blob.pathname},
            ${blob.contentType ?? 'application/octet-stream'},
            0,
            ${blob.url},
            ${blob.pathname}
          )
          RETURNING id
        `

        // Upload to Slack if thread exists
        const [question] = await sql`
          SELECT slack_channel_id, slack_thread_ts FROM questions WHERE id = ${questionId}
        `
        if (question?.slack_channel_id && question?.slack_thread_ts) {
          const fileName = blob.pathname.split('/').pop() ?? blob.pathname
          const slackFileId = await uploadFileToSlack(
            blob.url,
            fileName,
            0,
            question.slack_channel_id,
            question.slack_thread_ts
          )
          if (slackFileId && attachment) {
            await sql`UPDATE attachments SET slack_file_id = ${slackFileId} WHERE id = ${attachment.id}`
          }
        }
      },
    })

    return NextResponse.json(jsonResponse)
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 }
    )
  }
}

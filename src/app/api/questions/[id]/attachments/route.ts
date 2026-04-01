import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const attachments = await sql`
    SELECT * FROM attachments WHERE question_id = ${id} ORDER BY uploaded_at ASC
  `
  return NextResponse.json(attachments)
}

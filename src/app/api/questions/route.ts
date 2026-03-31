import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')

  const questions = status
    ? await sql`SELECT q.*, json_agg(a.*) FILTER (WHERE a.id IS NOT NULL) as answers FROM questions q LEFT JOIN answers a ON a.question_id = q.id WHERE q.status = ${status} GROUP BY q.id ORDER BY q.created_at DESC`
    : await sql`SELECT q.*, json_agg(a.*) FILTER (WHERE a.id IS NOT NULL) as answers FROM questions q LEFT JOIN answers a ON a.question_id = q.id GROUP BY q.id ORDER BY q.created_at DESC`

  return NextResponse.json(questions)
}

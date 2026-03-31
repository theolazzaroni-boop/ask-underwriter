import { NextResponse } from 'next/server'
import sql from '@/lib/db'

export async function GET() {
  const [row] = await sql`
    SELECT
      COUNT(*) FILTER (WHERE status = 'pending') as pending,
      COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
      COUNT(*) FILTER (WHERE status = 'answered') as answered
    FROM questions
  `
  return NextResponse.json({
    pending: Number(row.pending),
    in_progress: Number(row.in_progress),
    answered: Number(row.answered),
  })
}

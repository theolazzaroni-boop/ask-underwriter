import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [question] = await sql`
    SELECT q.*, json_agg(a.*) FILTER (WHERE a.id IS NOT NULL) as answers
    FROM questions q
    LEFT JOIN answers a ON a.question_id = q.id
    WHERE q.id = ${id}
    GROUP BY q.id
  `

  if (!question) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json(question)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()

  const allowed = ['status', 'assigned_to', 'priority']
  const updates = Object.fromEntries(Object.entries(body).filter(([k]) => allowed.includes(k)))

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields' }, { status: 400 })
  }

  const setClauses = Object.keys(updates).map((k, i) => `${k} = $${i + 2}`).join(', ')
  const values = [id, ...Object.values(updates)]

  const [question] = await sql.unsafe(
    `UPDATE questions SET ${setClauses} WHERE id = $1 RETURNING *`,
    values as string[]
  )

  return NextResponse.json(question)
}

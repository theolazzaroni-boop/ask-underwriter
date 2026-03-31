import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from') // ISO date string or null
  const dateFilter = from ? sql`AND created_at >= ${from}::timestamptz` : sql``

  const [demandesParJour, parProduit, parUnderwriter, tempsMoyen] = await Promise.all([
    // Demandes par jour
    sql`
      SELECT date_trunc('day', created_at)::date::text as day, count(*)::int as total
      FROM questions
      WHERE 1=1 ${dateFilter}
      GROUP BY day ORDER BY day ASC
    `,
    // Par produit
    sql`
      SELECT product_type as product, count(*)::int as total
      FROM questions
      WHERE 1=1 ${dateFilter}
      GROUP BY product_type ORDER BY total DESC
    `,
    // Par underwriter (answered only)
    sql`
      SELECT assigned_to as name, count(*)::int as total
      FROM questions
      WHERE status = 'answered' AND assigned_to IS NOT NULL ${dateFilter}
      GROUP BY assigned_to ORDER BY total DESC
    `,
    // Temps moyen par semaine
    sql`
      SELECT
        date_trunc('week', q.created_at)::date::text as week,
        round(avg(extract(epoch from (a.created_at - q.created_at)) / 3600)::numeric, 1)::float as avg_hours
      FROM questions q
      JOIN answers a ON a.question_id = q.id
      WHERE 1=1 ${dateFilter}
      GROUP BY week ORDER BY week ASC
    `,
  ])

  return NextResponse.json({
    demandes_par_jour: demandesParJour,
    par_produit: parProduit,
    par_underwriter: parUnderwriter,
    temps_moyen_par_semaine: tempsMoyen,
  })
}

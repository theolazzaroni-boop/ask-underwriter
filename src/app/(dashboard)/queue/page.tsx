import Link from 'next/link'
import sql from '@/lib/db'
import { QuestionWithAnswers, QuestionPriority, QuestionStatus } from '@/lib/types'
import { AlertCircle } from 'lucide-react'
import QuestionCard from './QuestionCard'
import SearchBar from './SearchBar'
import { Suspense } from 'react'

const PRIORITY_CONFIG: Record<QuestionPriority, { label: string; className: string; order: number }> = {
  urgent: { label: 'Urgent', className: 'bg-red-100 text-red-700', order: 0 },
  high: { label: 'Haute priorité', className: 'bg-yellow-100 text-yellow-700', order: 1 },
  normal: { label: 'Normal', className: 'bg-green-100 text-green-700', order: 2 },
}

const STATUS_TABS: { value: QuestionStatus; label: string }[] = [
  { value: 'pending', label: 'En attente' },
  { value: 'in_progress', label: 'En cours' },
  { value: 'answered', label: 'Traités' },
]

export default async function QueuePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; search?: string }>
}) {
  const { status: rawStatus, search } = await searchParams
  const status: QuestionStatus =
    rawStatus === 'in_progress' || rawStatus === 'answered' ? rawStatus : 'pending'

  const questions = await sql`
    SELECT q.*, json_agg(a.*) FILTER (WHERE a.id IS NOT NULL) as answers
    FROM questions q
    LEFT JOIN answers a ON a.question_id = q.id
    WHERE q.status = ${status}
    GROUP BY q.id
    ORDER BY q.created_at DESC
  `

  let sorted = (questions as unknown as QuestionWithAnswers[]).sort(
    (a, b) => PRIORITY_CONFIG[a.priority].order - PRIORITY_CONFIG[b.priority].order
  )

  // Server-side search filter
  if (search && search.trim()) {
    const term = search.trim().toLowerCase()
    sorted = sorted.filter(q =>
      q.description.toLowerCase().includes(term) ||
      q.sales_name.toLowerCase().includes(term) ||
      q.product_type.toLowerCase().includes(term) ||
      (q.assigned_to ?? '').toLowerCase().includes(term)
    )
  }

  const counts = await Promise.all(
    STATUS_TABS.map(async (tab) => {
      const [{ count }] = await sql`SELECT COUNT(*) as count FROM questions WHERE status = ${tab.value}`
      return { value: tab.value, count: Number(count) }
    })
  )
  const countMap = Object.fromEntries(counts.map((c) => [c.value, c.count]))

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Questions</h1>
        <p className="text-sm text-gray-500 mt-1">Demandes des sales à traiter</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit mb-6">
        {STATUS_TABS.map((tab) => (
          <Link
            key={tab.value}
            href={`/queue?status=${tab.value}`}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              status === tab.value
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
            {countMap[tab.value] > 0 && (
              <span
                className={`text-xs rounded-full px-1.5 py-0.5 ${
                  status === tab.value ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-600'
                }`}
              >
                {countMap[tab.value]}
              </span>
            )}
          </Link>
        ))}
      </div>

      {/* Search bar */}
      <Suspense>
        <SearchBar />
      </Suspense>

      {/* No search results message */}
      {search && search.trim() && sorted.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <AlertCircle className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Aucun résultat pour &laquo;{search}&raquo;</p>
        </div>
      )}

      {/* Questions list */}
      {(!search || !search.trim()) && sorted.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <AlertCircle className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Aucune demande dans cette catégorie</p>
        </div>
      ) : sorted.length > 0 ? (
        <div className="space-y-3">
          {sorted.map((q) => (
            <QuestionCard key={q.id} question={q} />
          ))}
        </div>
      ) : null}
    </div>
  )
}

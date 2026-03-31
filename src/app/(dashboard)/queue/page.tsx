import Link from 'next/link'
import { getSupabaseAdmin } from '@/lib/supabase'
import { QuestionWithAnswers, QuestionPriority, QuestionStatus } from '@/lib/types'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import { AlertCircle, Clock, ChevronRight } from 'lucide-react'

const PRIORITY_CONFIG: Record<QuestionPriority, { label: string; className: string; order: number }> = {
  urgent: { label: 'Urgent', className: 'bg-red-100 text-red-700', order: 0 },
  high: { label: 'Haute priorité', className: 'bg-yellow-100 text-yellow-700', order: 1 },
  normal: { label: 'Normal', className: 'bg-green-100 text-green-700', order: 2 },
}

const STATUS_CONFIG: Record<QuestionStatus, { label: string; className: string }> = {
  pending: { label: 'En attente', className: 'bg-orange-100 text-orange-700' },
  in_progress: { label: 'En cours', className: 'bg-blue-100 text-blue-700' },
  answered: { label: 'Traité', className: 'bg-green-100 text-green-700' },
}

const STATUS_TABS: { value: QuestionStatus; label: string }[] = [
  { value: 'pending', label: 'En attente' },
  { value: 'in_progress', label: 'En cours' },
  { value: 'answered', label: 'Traités' },
]

export default async function QueuePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { status: rawStatus } = await searchParams
  const status: QuestionStatus =
    rawStatus === 'in_progress' || rawStatus === 'answered' ? rawStatus : 'pending'

  const supabase = getSupabaseAdmin()
  const { data: questions } = await supabase
    .from('questions')
    .select('*, answers(*)')
    .eq('status', status)
    .order('created_at', { ascending: false })

  const sorted = ((questions as QuestionWithAnswers[]) ?? []).sort(
    (a, b) => PRIORITY_CONFIG[a.priority].order - PRIORITY_CONFIG[b.priority].order
  )

  const counts = await Promise.all(
    STATUS_TABS.map(async (tab) => {
      const { count } = await supabase
        .from('questions')
        .select('*', { count: 'exact', head: true })
        .eq('status', tab.value)
      return { value: tab.value, count: count ?? 0 }
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

      {/* Questions list */}
      {sorted.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <AlertCircle className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Aucune demande dans cette catégorie</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((q) => {
            const priority = PRIORITY_CONFIG[q.priority]
            const statusCfg = STATUS_CONFIG[q.status]
            const timeAgo = formatDistanceToNow(new Date(q.created_at), {
              addSuffix: true,
              locale: fr,
            })

            return (
              <Link
                key={q.id}
                href={`/questions/${q.id}`}
                className="flex items-start gap-4 p-4 bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs font-semibold text-gray-700 bg-gray-100 px-2 py-0.5 rounded">
                      {q.product_type}
                    </span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${priority.className}`}>
                      {priority.label}
                    </span>
                    {q.status !== 'pending' && (
                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${statusCfg.className}`}>
                        {statusCfg.label}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-800 line-clamp-2 mb-2">{q.description}</p>
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    <span className="font-medium text-gray-600">{q.sales_name}</span>
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {timeAgo}
                    </span>
                    {q.assigned_to && (
                      <>
                        <span>·</span>
                        <span>Pris en charge par {q.assigned_to}</span>
                      </>
                    )}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-blue-500 mt-1 shrink-0 transition-colors" />
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

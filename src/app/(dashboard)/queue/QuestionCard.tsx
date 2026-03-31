'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { QuestionWithAnswers, QuestionPriority, QuestionStatus } from '@/lib/types'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Clock, ChevronRight, UserCheck, CheckCheck } from 'lucide-react'

const PRIORITY_CONFIG: Record<QuestionPriority, { label: string; className: string }> = {
  urgent: { label: 'Urgent', className: 'bg-red-100 text-red-700' },
  high: { label: 'Haute priorité', className: 'bg-yellow-100 text-yellow-700' },
  normal: { label: 'Normal', className: 'bg-green-100 text-green-700' },
}

const STATUS_CONFIG: Record<QuestionStatus, { label: string; className: string }> = {
  pending: { label: 'En attente', className: 'bg-orange-100 text-orange-700' },
  in_progress: { label: 'En cours', className: 'bg-blue-100 text-blue-700' },
  answered: { label: 'Traité', className: 'bg-green-100 text-green-700' },
}

export default function QuestionCard({ question }: { question: QuestionWithAnswers }) {
  const router = useRouter()
  const [hidden, setHidden] = useState(false)
  const [loadingAction, setLoadingAction] = useState<'take' | 'done' | null>(null)

  if (hidden) return null

  const priority = PRIORITY_CONFIG[question.priority]
  const statusCfg = STATUS_CONFIG[question.status]
  const timeAgo = formatDistanceToNow(new Date(question.created_at), {
    addSuffix: true,
    locale: fr,
  })

  async function handleTakeCharge(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const name = localStorage.getItem('underwriter_name') ?? ''
    if (!name) return
    setLoadingAction('take')
    await fetch(`/api/questions/${question.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'in_progress', assigned_to: name }),
    })
    setHidden(true)
    router.refresh()
  }

  async function handleMarkDone(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setLoadingAction('done')
    await fetch(`/api/questions/${question.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'answered' }),
    })
    setHidden(true)
    router.refresh()
  }

  return (
    <div className="relative group">
      <Link
        href={`/questions/${question.id}`}
        className="flex items-start gap-4 p-4 bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all group"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-semibold text-gray-700 bg-gray-100 px-2 py-0.5 rounded">
              {question.product_type}
            </span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded ${priority.className}`}>
              {priority.label}
            </span>
            {question.status !== 'pending' && (
              <span className={`text-xs font-medium px-2 py-0.5 rounded ${statusCfg.className}`}>
                {statusCfg.label}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-800 line-clamp-2 mb-2">{question.description}</p>
          <div className="flex items-center gap-3 text-xs text-gray-400">
            <span className="font-medium text-gray-600">{question.sales_name}</span>
            <span>·</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {timeAgo}
            </span>
            {question.assigned_to && (
              <>
                <span>·</span>
                <span>Pris en charge par {question.assigned_to}</span>
              </>
            )}
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-blue-500 mt-1 shrink-0 transition-colors" />
      </Link>

      {/* Hover action buttons */}
      <div className="absolute right-10 top-1/2 -translate-y-1/2 flex items-center gap-2 opacity-0 group-hover:opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto">
        {question.status === 'pending' && (
          <button
            onClick={handleTakeCharge}
            disabled={loadingAction !== null}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg shadow-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <UserCheck className="w-3.5 h-3.5" />
            Prendre en charge
          </button>
        )}
        {question.status !== 'answered' && (
          <button
            onClick={handleMarkDone}
            disabled={loadingAction !== null}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg shadow-md hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            Marquer traité
          </button>
        )}
      </div>
    </div>
  )
}

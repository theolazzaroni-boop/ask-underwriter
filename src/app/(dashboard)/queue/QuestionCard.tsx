'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { QuestionWithAnswers, QuestionPriority } from '@/lib/types'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Clock, ChevronRight, UserCheck, CheckCheck } from 'lucide-react'

const PRIORITY_CONFIG: Record<QuestionPriority, { label: string; className: string; urgent: boolean }> = {
  urgent: { label: 'Urgent', className: 'text-red-600 font-semibold', urgent: true },
  high: { label: 'Haute priorité', className: 'text-gray-600', urgent: false },
  normal: { label: 'Normal', className: 'text-gray-400', urgent: false },
}

export default function QuestionCard({ question }: { question: QuestionWithAnswers }) {
  const router = useRouter()
  const [hidden, setHidden] = useState(false)
  const [loadingAction, setLoadingAction] = useState<'take' | 'done' | null>(null)

  if (hidden) return null

  const priority = PRIORITY_CONFIG[question.priority]
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
    <div className={`relative group rounded-xl border bg-white transition-all hover:shadow-sm ${
      priority.urgent ? 'border-l-[3px] border-l-red-500 border-gray-200' : 'border-gray-200 hover:border-gray-300'
    }`}>
      <Link href={`/questions/${question.id}`} className="flex items-start gap-4 p-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-semibold text-gray-700 bg-gray-100 px-2 py-0.5 rounded">
              {question.product_type}
            </span>
            {question.priority !== 'normal' && (
              <span className={`text-xs ${priority.className}`}>
                {priority.label}
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
                <span>{question.assigned_to}</span>
              </>
            )}
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 mt-1 shrink-0 transition-colors" />
      </Link>

      {/* Hover action buttons */}
      <div className="absolute right-10 top-1/2 -translate-y-1/2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto">
        {question.status === 'pending' && (
          <button
            onClick={handleTakeCharge}
            disabled={loadingAction !== null}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-lg shadow-md hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >
            <UserCheck className="w-3.5 h-3.5" />
            Prendre en charge
          </button>
        )}
        {question.status !== 'answered' && (
          <button
            onClick={handleMarkDone}
            disabled={loadingAction !== null}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 text-gray-700 text-xs font-medium rounded-lg shadow-md hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            Marquer traité
          </button>
        )}
      </div>
    </div>
  )
}

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getSupabaseAdmin } from '@/lib/supabase'
import { QuestionWithAnswers, QuestionPriority, QuestionStatus } from '@/lib/types'
import { format, formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import { ArrowLeft, ExternalLink, Clock, CheckCircle, AlertCircle } from 'lucide-react'
import ResponseForm from './ResponseForm'

const PRIORITY_CONFIG: Record<QuestionPriority, { label: string; className: string }> = {
  urgent: { label: '🔴 Urgent', className: 'bg-red-100 text-red-700' },
  high: { label: '🟡 Haute priorité', className: 'bg-yellow-100 text-yellow-700' },
  normal: { label: '🟢 Normal', className: 'bg-green-100 text-green-700' },
}

const STATUS_CONFIG: Record<QuestionStatus, { label: string; icon: React.ElementType; className: string }> = {
  pending: { label: 'En attente', icon: AlertCircle, className: 'text-orange-600' },
  in_progress: { label: 'En cours', icon: Clock, className: 'text-blue-600' },
  answered: { label: 'Traité', icon: CheckCircle, className: 'text-green-600' },
}

export default async function QuestionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = getSupabaseAdmin()

  const { data, error } = await supabase
    .from('questions')
    .select('*, answers(*)')
    .eq('id', id)
    .single()

  if (error || !data) notFound()

  const question = data as QuestionWithAnswers
  const priority = PRIORITY_CONFIG[question.priority]
  const statusCfg = STATUS_CONFIG[question.status]
  const StatusIcon = statusCfg.icon

  const timeAgo = formatDistanceToNow(new Date(question.created_at), {
    addSuffix: true,
    locale: fr,
  })
  const dateFormatted = format(new Date(question.created_at), "d MMM yyyy 'à' HH:mm", { locale: fr })

  const backStatus = question.status === 'answered' ? 'answered' : question.status === 'in_progress' ? 'in_progress' : 'pending'

  return (
    <div className="p-8 max-w-3xl">
      {/* Back */}
      <Link
        href={`/queue?status=${backStatus}`}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour à la queue
      </Link>

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-gray-700 bg-gray-100 px-2.5 py-1 rounded-lg">
              {question.product_type}
            </span>
            <span className={`text-xs font-medium px-2.5 py-1 rounded-lg ${priority.className}`}>
              {priority.label}
            </span>
          </div>
          <div className={`flex items-center gap-1.5 text-sm font-medium ${statusCfg.className}`}>
            <StatusIcon className="w-4 h-4" />
            {statusCfg.label}
          </div>
        </div>

        {/* Description */}
        <div className="mb-4">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Question
          </h2>
          <p className="text-gray-800 text-sm leading-relaxed whitespace-pre-wrap">
            {question.description}
          </p>
        </div>

        {/* Meta */}
        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Sales</p>
            <p className="text-sm font-medium text-gray-800">{question.sales_name}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Date</p>
            <p className="text-sm text-gray-600">
              {dateFormatted} <span className="text-gray-400">({timeAgo})</span>
            </p>
          </div>
          {question.assigned_to && (
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Pris en charge par</p>
              <p className="text-sm font-medium text-gray-800">{question.assigned_to}</p>
            </div>
          )}
          {question.bo_url && (
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Back-Office</p>
              <a
                href={question.bo_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                Voir le dossier
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Existing answers */}
      {question.answers && question.answers.length > 0 && (
        <div className="mb-4 space-y-3">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1">
            Réponses
          </h2>
          {question.answers.map((answer) => (
            <div key={answer.id} className="bg-green-50 border border-green-200 rounded-xl p-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-green-800">{answer.underwriter_name}</p>
                <div className="flex items-center gap-2">
                  {answer.sent_to_slack && (
                    <span className="text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded">
                      Envoyé dans Slack
                    </span>
                  )}
                  <span className="text-xs text-gray-400">
                    {format(new Date(answer.created_at), "d MMM 'à' HH:mm", { locale: fr })}
                  </span>
                </div>
              </div>
              <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                {answer.content}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Response form (only if not yet answered) */}
      {question.status !== 'answered' && (
        <ResponseForm questionId={question.id} currentStatus={question.status} />
      )}

      {question.status === 'answered' && (
        <div className="text-center py-6 text-sm text-gray-400 flex items-center justify-center gap-2">
          <CheckCircle className="w-4 h-4 text-green-500" />
          Cette demande a été traitée.
        </div>
      )}
    </div>
  )
}

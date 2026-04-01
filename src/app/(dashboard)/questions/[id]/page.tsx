import { notFound } from 'next/navigation'
import Link from 'next/link'
import sql from '@/lib/db'
import { QuestionWithAnswers, QuestionPriority, QuestionStatus } from '@/lib/types'
import { format, formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import { ArrowLeft, ExternalLink, CheckCircle } from 'lucide-react'
import ResponseForm from './ResponseForm'
import AttachmentsSection from './AttachmentsSection'
import MarkDoneButton, { ReopenButton } from './MarkDoneButton'

const PRIORITY_CONFIG: Record<QuestionPriority, { label: string; className: string }> = {
  urgent: { label: 'Urgent', className: 'text-red-600 font-semibold' },
  high: { label: 'Haute priorité', className: 'text-gray-500' },
  normal: { label: 'Normal', className: 'text-gray-400' },
}

const STATUS_CONFIG: Record<QuestionStatus, { label: string; className: string }> = {
  pending: { label: 'En attente', className: 'text-gray-400' },
  in_progress: { label: 'En cours', className: 'text-gray-600' },
  answered: { label: 'Traité', className: 'text-gray-400' },
}

export default async function QuestionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [data] = await sql`
    SELECT q.*, json_agg(a.* ORDER BY a.created_at ASC) FILTER (WHERE a.id IS NOT NULL) as answers
    FROM questions q
    LEFT JOIN answers a ON a.question_id = q.id
    WHERE q.id = ${id}
    GROUP BY q.id
  `

  if (!data) notFound()

  const question = data as QuestionWithAnswers
  const priority = PRIORITY_CONFIG[question.priority]
  const statusCfg = STATUS_CONFIG[question.status]

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
        className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 mb-5 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour
      </Link>

      {/* Header card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4">
        {/* Top row: tags + status + action */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-gray-700 bg-gray-100 px-2.5 py-1 rounded-lg">
              {question.product_type}
            </span>
            {question.priority !== 'normal' && (
              <span className={`text-xs ${priority.className}`}>
                {priority.label}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className={`text-xs font-medium ${statusCfg.className}`}>
              {statusCfg.label}
            </span>
            {question.status !== 'answered' && (
              <MarkDoneButton questionId={question.id} />
            )}
          </div>
        </div>

        {/* Description */}
        <p className="text-gray-800 text-sm leading-relaxed whitespace-pre-wrap mb-5">
          {question.description}
        </p>

        {/* Meta */}
        <div className="grid grid-cols-2 gap-3 pt-4 border-t border-gray-100 text-sm">
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Sales</p>
            <p className="font-medium text-gray-800">{question.sales_name}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Date</p>
            <p className="text-gray-600">
              {dateFormatted} <span className="text-gray-400">({timeAgo})</span>
            </p>
          </div>
          {question.assigned_to && (
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Pris en charge par</p>
              <p className="font-medium text-gray-800">{question.assigned_to}</p>
            </div>
          )}
          {question.bo_url && (
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Back-Office</p>
              <a href={question.bo_url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-gray-800 hover:text-gray-600 font-medium underline underline-offset-2">
                Voir le dossier <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
          {(question as unknown as Record<string, string>).hubspot_url && (
            <div>
              <p className="text-xs text-gray-400 mb-0.5">HubSpot</p>
              <a href={(question as unknown as Record<string, string>).hubspot_url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-gray-800 hover:text-gray-600 font-medium underline underline-offset-2">
                Voir le contact <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
        </div>

        {/* Attachments — embedded in context card */}
        <AttachmentsSection
          questionId={question.id}
          canAdd={question.status !== 'answered'}
          embedded
        />
      </div>

      {/* Answers */}
      {question.answers && question.answers.length > 0 && (
        <div className="mb-4 space-y-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1">
            Réponses
          </p>
          {question.answers.map((answer) => (
            <div key={answer.id} className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-gray-900">
                    {answer.author_name || answer.underwriter_name}
                  </p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    answer.source === 'slack'
                      ? 'bg-gray-100 text-gray-500'
                      : 'bg-gray-100 text-gray-500'
                  }`}>
                    {answer.source === 'slack' ? 'Slack' : 'Web app'}
                  </span>
                </div>
                <span className="text-xs text-gray-400">
                  {format(new Date(answer.created_at), "d MMM 'à' HH:mm", { locale: fr })}
                </span>
              </div>
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                {answer.content}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Response form */}
      {question.status !== 'answered' && (
        <ResponseForm
          questionId={question.id}
          currentStatus={question.status}
          productType={question.product_type}
          questionDescription={question.description}
        />
      )}

      {question.status === 'answered' && (
        <div className="flex items-center justify-center gap-3 py-6 text-sm text-gray-400">
          <CheckCircle className="w-4 h-4 text-green-500" />
          <span>Cette demande a été traitée.</span>
          <ReopenButton questionId={question.id} />
        </div>
      )}
    </div>
  )
}

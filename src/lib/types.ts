export type QuestionStatus = 'pending' | 'in_progress' | 'answered'
export type QuestionPriority = 'normal' | 'high' | 'urgent'

export const PRODUCT_TYPES = [
  'RCP / RCP réglementée',
  'MRPH',
  'MRPW',
  'TDMI',
  'SMRPH',
  'MRP Bureaux',
  'Autre',
] as const

export type ProductType = (typeof PRODUCT_TYPES)[number]

export interface Question {
  id: string
  created_at: string
  product_type: string
  description: string
  bo_url: string | null
  status: QuestionStatus
  priority: QuestionPriority
  sales_slack_id: string
  sales_name: string
  slack_channel_id: string
  slack_thread_ts: string | null
  assigned_to: string | null
}

export interface Answer {
  id: string
  created_at: string
  question_id: string
  underwriter_name: string
  content: string
  sent_to_slack: boolean
}

export interface QuestionWithAnswers extends Question {
  answers: Answer[]
}

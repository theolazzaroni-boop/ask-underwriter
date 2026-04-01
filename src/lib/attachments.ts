export const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
]

export const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB
export const MAX_FILES_PER_TICKET = 5

export interface Attachment {
  id: string
  question_id: string
  file_name: string
  file_type: string
  file_size: number
  blob_url: string
  blob_pathname: string
  slack_file_id: string | null
  uploaded_at: string
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function isImage(fileType: string): boolean {
  return fileType.startsWith('image/')
}

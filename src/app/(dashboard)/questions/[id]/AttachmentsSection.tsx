'use client'

import { useState, useEffect, useCallback } from 'react'
import { ExternalLink, Paperclip, Plus } from 'lucide-react'
import { Attachment, isImage } from '@/lib/attachments'
import FileUpload from './FileUpload'

interface AttachmentsSectionProps {
  questionId: string
  canAdd: boolean
  embedded?: boolean
}

export default function AttachmentsSection({ questionId, canAdd, embedded }: AttachmentsSectionProps) {
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [lightbox, setLightbox] = useState<string | null>(null)
  const [showUpload, setShowUpload] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`/api/questions/${questionId}/attachments`)
    if (res.ok) setAttachments(await res.json())
  }, [questionId])

  useEffect(() => { load() }, [load])

  const isEmpty = attachments.length === 0

  if (isEmpty && !canAdd) return null

  const inner = (
    <>
      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setLightbox(null)}
        >
          <img
            src={lightbox}
            alt=""
            className="max-w-full max-h-full rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Attachments grid */}
      {attachments.length > 0 && (
        <div className="grid grid-cols-2 gap-2 mb-3">
          {attachments.map((a) => (
            <div key={a.id} className="border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
              {isImage(a.file_type) ? (
                <div className="cursor-zoom-in" onClick={() => setLightbox(a.blob_url)}>
                  <img src={a.blob_url} alt={a.file_name} className="w-full h-24 object-cover" />
                  <div className="px-2.5 py-1.5">
                    <p className="text-xs text-gray-500 truncate">{a.file_name}</p>
                  </div>
                </div>
              ) : (
                <div className="p-3 flex items-center gap-2.5">
                  <div className="w-8 h-8 bg-gray-200 rounded flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-gray-600">PDF</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-700 truncate">{a.file_name}</p>
                  </div>
                  <a href={a.blob_url} target="_blank" rel="noopener noreferrer"
                    className="text-gray-400 hover:text-gray-700 shrink-0">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add button / Upload zone */}
      {canAdd && (
        showUpload ? (
          <FileUpload
            questionId={questionId}
            currentCount={attachments.length}
            onUploaded={() => { load(); setShowUpload(false) }}
          />
        ) : (
          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Ajouter un fichier
          </button>
        )
      )}
    </>
  )

  if (embedded) {
    if (isEmpty && !canAdd) return null
    return (
      <div className="pt-4 mt-4 border-t border-gray-100">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <Paperclip className="w-3.5 h-3.5" />
          Pièces jointes
          {attachments.length > 0 && (
            <span className="bg-gray-100 text-gray-500 rounded-full px-1.5 py-0.5 text-xs">
              {attachments.length}
            </span>
          )}
        </p>
        {inner}
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
        <Paperclip className="w-3.5 h-3.5" />
        Pièces jointes
      </p>
      {inner}
    </div>
  )
}

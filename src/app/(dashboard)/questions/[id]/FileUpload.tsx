'use client'

import { useRef, useState, useCallback } from 'react'
import { upload } from '@vercel/blob/client'
import { X, FileText, LoaderCircle, Upload } from 'lucide-react'
import { ALLOWED_FILE_TYPES, MAX_FILE_SIZE, MAX_FILES_PER_TICKET, formatFileSize } from '@/lib/attachments'

interface FileUploadProps {
  questionId: string
  currentCount: number
  onUploaded: () => void
}

interface FileEntry {
  file: File
  preview?: string
  error?: string
}

export default function FileUpload({ questionId, currentCount, onUploaded }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<FileEntry[]>([])
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const remaining = MAX_FILES_PER_TICKET - currentCount

  function validateFile(file: File): string | undefined {
    if (!ALLOWED_FILE_TYPES.includes(file.type)) return 'Type non accepté (PDF, PNG, JPG, WEBP)'
    if (file.size > MAX_FILE_SIZE) return `Max ${formatFileSize(MAX_FILE_SIZE)}`
  }

  function addFiles(incoming: File[]) {
    const slots = remaining - files.length
    if (slots <= 0) return
    const toAdd: FileEntry[] = incoming.slice(0, slots).map((file) => {
      const error = validateFile(file)
      const preview = !error && file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined
      return { file, preview, error }
    })
    setFiles((prev) => [...prev, ...toAdd])
  }

  function removeFile(index: number) {
    setFiles((prev) => {
      const entry = prev[index]
      if (entry?.preview) URL.revokeObjectURL(entry.preview)
      return prev.filter((_, i) => i !== index)
    })
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    addFiles(Array.from(e.dataTransfer.files))
  }, [files, remaining]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleUpload() {
    const valid = files.filter((f) => !f.error)
    if (!valid.length) return
    setUploading(true)
    try {
      await Promise.all(
        valid.map(({ file }) =>
          upload(`questions/${questionId}/${Date.now()}-${file.name}`, file, {
            access: 'public',
            handleUploadUrl: '/api/upload',
            clientPayload: JSON.stringify({ questionId }),
          })
        )
      )
      setFiles([])
      onUploaded()
    } catch (err) {
      console.error('Upload failed:', err)
    } finally {
      setUploading(false)
    }
  }

  const validCount = files.filter((f) => !f.error).length
  const canAdd = files.length + currentCount < MAX_FILES_PER_TICKET

  return (
    <div className="space-y-2">
      {canAdd && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`border border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors select-none ${
            dragOver ? 'border-gray-400 bg-gray-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
          }`}
        >
          <p className="text-xs text-gray-400">
            Glisse ou <span className="text-gray-700 font-medium">parcourir</span>
            {' '}— PDF, PNG, JPG, WEBP, max 10 MB
          </p>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            accept={ALLOWED_FILE_TYPES.join(',')}
            multiple
            onChange={(e) => addFiles(Array.from(e.target.files ?? []))}
          />
        </div>
      )}

      {files.length > 0 && (
        <div className="space-y-1.5">
          {files.map((entry, i) => (
            <div
              key={i}
              className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 ${
                entry.error ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'
              }`}
            >
              {entry.preview ? (
                <img src={entry.preview} alt="" className="w-7 h-7 rounded object-cover shrink-0" />
              ) : (
                <div className="w-7 h-7 rounded bg-gray-100 flex items-center justify-center shrink-0">
                  <FileText className="w-3.5 h-3.5 text-gray-400" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-700 truncate">{entry.file.name}</p>
                {entry.error
                  ? <p className="text-xs text-red-600">{entry.error}</p>
                  : <p className="text-xs text-gray-400">{formatFileSize(entry.file.size)}</p>
                }
              </div>
              <button onClick={() => removeFile(i)} className="text-gray-300 hover:text-gray-500 shrink-0">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {validCount > 0 && (
        <button
          onClick={handleUpload}
          disabled={uploading}
          className="inline-flex items-center gap-1.5 bg-gray-900 hover:bg-gray-800 disabled:opacity-60 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
        >
          {uploading ? (
            <><LoaderCircle className="w-3.5 h-3.5 animate-spin" />Envoi…</>
          ) : (
            <><Upload className="w-3.5 h-3.5" />Envoyer {validCount} fichier{validCount > 1 ? 's' : ''}</>
          )}
        </button>
      )}
    </div>
  )
}

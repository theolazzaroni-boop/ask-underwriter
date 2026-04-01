'use client'

import { useRef, useState, useCallback } from 'react'
import { upload } from '@vercel/blob/client'
import { Upload, X, FileText, Image, LoaderCircle } from 'lucide-react'
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
    if (!ALLOWED_FILE_TYPES.includes(file.type)) return 'Type non accepté (PDF, PNG, JPG, WEBP uniquement)'
    if (file.size > MAX_FILE_SIZE) return `Fichier trop lourd (max ${formatFileSize(MAX_FILE_SIZE)})`
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
    <div className="space-y-3">
      {/* Drop zone */}
      {canAdd && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors select-none ${
            dragOver
              ? 'border-blue-400 bg-blue-50'
              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
          }`}
        >
          <Upload className="w-5 h-5 text-gray-400 mx-auto mb-1.5" />
          <p className="text-sm text-gray-500">
            Glisse tes fichiers ici ou{' '}
            <span className="text-blue-600 font-medium">parcourir</span>
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            PDF, PNG, JPG, WEBP — max 10 MB — {remaining - files.length} emplacement{remaining - files.length > 1 ? 's' : ''} restant{remaining - files.length > 1 ? 's' : ''}
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

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((entry, i) => (
            <div
              key={i}
              className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${
                entry.error ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'
              }`}
            >
              {entry.preview ? (
                <img src={entry.preview} alt="" className="w-8 h-8 rounded object-cover shrink-0" />
              ) : (
                <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center shrink-0">
                  {entry.file.type === 'application/pdf' ? (
                    <FileText className="w-4 h-4 text-gray-500" />
                  ) : (
                    <Image className="w-4 h-4 text-gray-500" />
                  )}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{entry.file.name}</p>
                {entry.error ? (
                  <p className="text-xs text-red-600">{entry.error}</p>
                ) : (
                  <p className="text-xs text-gray-400">{formatFileSize(entry.file.size)}</p>
                )}
              </div>
              <button
                onClick={() => removeFile(i)}
                className="text-gray-400 hover:text-gray-600 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upload button */}
      {validCount > 0 && (
        <button
          onClick={handleUpload}
          disabled={uploading}
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          {uploading ? (
            <>
              <LoaderCircle className="w-4 h-4 animate-spin" />
              Envoi en cours…
            </>
          ) : (
            <>
              <Upload className="w-4 h-4" />
              Envoyer {validCount} fichier{validCount > 1 ? 's' : ''}
            </>
          )}
        </button>
      )}
    </div>
  )
}

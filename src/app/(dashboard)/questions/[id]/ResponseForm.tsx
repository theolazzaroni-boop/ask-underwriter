'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Send, Loader2, ChevronDown } from 'lucide-react'
import { getTemplates } from '@/lib/templates'

export default function ResponseForm({
  questionId,
  currentStatus,
  productType,
}: {
  questionId: string
  currentStatus: string
  productType: string
}) {
  const router = useRouter()
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [takingCharge, setTakingCharge] = useState(false)
  const [error, setError] = useState('')
  const [templatesOpen, setTemplatesOpen] = useState(false)
  const templatesRef = useRef<HTMLDivElement>(null)
  const templates = getTemplates(productType)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (templatesRef.current && !templatesRef.current.contains(e.target as Node)) {
        setTemplatesOpen(false)
      }
    }
    if (templatesOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [templatesOpen])

  function getUnderwriterName() {
    return localStorage.getItem('underwriter_name') ?? ''
  }

  async function handleTakeCharge() {
    const name = getUnderwriterName()
    if (!name) {
      setError('Définissez votre nom dans la sidebar avant de prendre en charge.')
      return
    }
    setTakingCharge(true)
    await fetch(`/api/questions/${questionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'in_progress', assigned_to: name }),
    })
    setTakingCharge(false)
    router.refresh()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const name = getUnderwriterName()
    if (!name) {
      setError('Définissez votre nom dans la sidebar avant de répondre.')
      return
    }
    if (!content.trim()) return
    setLoading(true)
    setError('')

    const res = await fetch(`/api/questions/${questionId}/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: content.trim(), underwriter_name: name }),
    })

    if (!res.ok) {
      setError('Erreur lors de l\'envoi. Réessayez.')
      setLoading(false)
      return
    }

    setContent('')
    setLoading(false)
    router.refresh()
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="text-sm font-semibold text-gray-900 mb-4">Répondre</h2>

      {currentStatus === 'pending' && (
        <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg flex items-center justify-between">
          <p className="text-sm text-orange-700">Cette demande n&apos;a pas encore été prise en charge.</p>
          <button
            onClick={handleTakeCharge}
            disabled={takingCharge}
            className="text-sm font-medium text-orange-700 hover:text-orange-900 underline disabled:opacity-50"
          >
            {takingCharge ? 'En cours...' : 'Prendre en charge'}
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Templates button */}
        <div className="relative" ref={templatesRef}>
          <button
            type="button"
            onClick={() => setTemplatesOpen(o => !o)}
            className="flex items-center gap-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors"
          >
            Templates
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${templatesOpen ? 'rotate-180' : ''}`} />
          </button>
          {templatesOpen && (
            <div className="absolute z-10 top-full left-0 mt-1 w-72 bg-white border border-gray-200 rounded-xl shadow-lg py-1">
              {templates.map((tpl) => (
                <button
                  key={tpl.label}
                  type="button"
                  onClick={() => {
                    setContent(tpl.content)
                    setTemplatesOpen(false)
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  {tpl.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Écris ta réponse ici..."
          rows={5}
          className="w-full text-sm border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading || !content.trim()}
            className="flex items-center gap-2 bg-blue-600 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            Envoyer dans Slack
          </button>
        </div>
      </form>
    </div>
  )
}

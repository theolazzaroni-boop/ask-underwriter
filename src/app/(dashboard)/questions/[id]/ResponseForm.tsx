'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Send, LoaderCircle, ChevronDown, Sparkles } from 'lucide-react'
import { getTemplates } from '@/lib/templates'

export default function ResponseForm({
  questionId,
  currentStatus,
  productType,
  questionDescription,
}: {
  questionId: string
  currentStatus: string
  productType: string
  questionDescription: string
}) {
  const router = useRouter()
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [takingCharge, setTakingCharge] = useState(false)
  const [error, setError] = useState('')
  const [templatesOpen, setTemplatesOpen] = useState(false)
  const templatesRef = useRef<HTMLDivElement>(null)
  const templates = getTemplates(productType)

  const [showAI, setShowAI] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [suggestion, setSuggestion] = useState('')
  const [basedOn, setBasedOn] = useState(0)
  const [generatingError, setGeneratingError] = useState('')

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

  async function handleGenerate() {
    setGenerating(true)
    setGeneratingError('')
    try {
      const res = await fetch('/api/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question_id: questionId,
          question_description: questionDescription,
          product: productType,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.suggestion) {
        setGeneratingError(data.message || 'Impossible de générer une suggestion')
        return
      }
      setSuggestion(data.suggestion)
      setBasedOn(data.based_on)
    } catch {
      setGeneratingError('Erreur réseau, réessaie')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-900">Répondre</h2>
        {currentStatus === 'pending' && (
          <button
            onClick={handleTakeCharge}
            disabled={takingCharge}
            className="text-xs text-gray-500 hover:text-gray-800 underline underline-offset-2 disabled:opacity-50"
          >
            {takingCharge ? 'En cours...' : 'Prendre en charge'}
          </button>
        )}
      </div>

      {/* AI Suggestion — hidden by default */}
      {showAI ? (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              Suggestion IA
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="text-xs font-medium px-2.5 py-1 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 flex items-center gap-1.5 transition-colors"
              >
                {generating && <LoaderCircle className="w-3 h-3 animate-spin" />}
                {suggestion ? 'Régénérer' : 'Générer'}
              </button>
              <button onClick={() => setShowAI(false)} className="text-xs text-gray-400 hover:text-gray-600">
                Fermer
              </button>
            </div>
          </div>

          {generatingError && <p className="text-xs text-red-500">{generatingError}</p>}

          {!generating && !suggestion && !generatingError && (
            <p className="text-xs text-gray-400 italic">Génère une suggestion basée sur les réponses passées.</p>
          )}

          {generating && !suggestion && (
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <LoaderCircle className="w-3 h-3 animate-spin" />
              Génération en cours...
            </div>
          )}

          {suggestion && (
            <>
              <div className="bg-white border border-gray-200 rounded-lg p-3 mb-2">
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{suggestion}</p>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-400">Basé sur {basedOn} réponse{basedOn !== 1 ? 's' : ''} similaire{basedOn !== 1 ? 's' : ''}</p>
                <button
                  onClick={() => setContent(suggestion)}
                  className="text-xs font-medium px-2.5 py-1 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
                >
                  Utiliser
                </button>
              </div>
            </>
          )}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Toolbar */}
        <div className="flex items-center gap-2">
          <div className="relative" ref={templatesRef}>
            <button
              type="button"
              onClick={() => setTemplatesOpen(o => !o)}
              className="flex items-center gap-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg px-2.5 py-1.5 hover:bg-gray-50 transition-colors"
            >
              Templates
              <ChevronDown className={`w-3 h-3 transition-transform ${templatesOpen ? 'rotate-180' : ''}`} />
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

          {!showAI && (
            <button
              type="button"
              onClick={() => { setShowAI(true); if (!suggestion) handleGenerate() }}
              className="flex items-center gap-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg px-2.5 py-1.5 hover:bg-gray-50 transition-colors"
            >
              <Sparkles className="w-3 h-3" />
              Suggestion IA
            </button>
          )}
        </div>

        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Écris ta réponse ici..."
          rows={5}
          className="w-full text-sm border border-gray-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading || !content.trim()}
            className="flex items-center gap-2 bg-gray-900 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <LoaderCircle className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            Répondre
          </button>
        </div>
      </form>
    </div>
  )
}

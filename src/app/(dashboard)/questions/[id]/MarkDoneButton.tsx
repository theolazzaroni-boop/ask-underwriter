'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCheck, LoaderCircle, RotateCcw } from 'lucide-react'

export function MarkDoneButton({ questionId }: { questionId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handle() {
    setLoading(true)
    await fetch(`/api/questions/${questionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'answered' }),
    })
    router.refresh()
  }

  return (
    <button
      onClick={handle}
      disabled={loading}
      className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
    >
      {loading ? <LoaderCircle className="w-3.5 h-3.5 animate-spin" /> : <CheckCheck className="w-3.5 h-3.5" />}
      Marquer traité
    </button>
  )
}

export function ReopenButton({ questionId }: { questionId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handle() {
    setLoading(true)
    await fetch(`/api/questions/${questionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'in_progress' }),
    })
    router.refresh()
  }

  return (
    <button
      onClick={handle}
      disabled={loading}
      className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-50 transition-colors"
    >
      {loading ? <LoaderCircle className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
      Repasser en cours
    </button>
  )
}

export default MarkDoneButton

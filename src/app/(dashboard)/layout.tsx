'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { MessageSquare, BarChart2, LogOut } from 'lucide-react'
import { useClerk, useUser } from '@clerk/nextjs'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { signOut } = useClerk()
  const { user } = useUser()
  const [underwriterName, setUnderwriterName] = useState('')
  const [editing, setEditing] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [counts, setCounts] = useState({ pending: 0, in_progress: 0, answered: 0 })

  useEffect(() => {
    const saved = localStorage.getItem('underwriter_name')
    if (saved) setUnderwriterName(saved)
    else setEditing(true)
  }, [])

  useEffect(() => {
    function fetchCounts() {
      fetch('/api/questions/counts')
        .then(r => r.json())
        .then(data => setCounts(data))
        .catch(() => {})
    }
    fetchCounts()
    const interval = setInterval(fetchCounts, 30000)
    return () => clearInterval(interval)
  }, [])

  function saveName() {
    if (!nameInput.trim()) return
    localStorage.setItem('underwriter_name', nameInput.trim())
    setUnderwriterName(nameInput.trim())
    setEditing(false)
  }

  const isQueueActive = pathname.startsWith('/queue') || pathname.startsWith('/questions')
  const isAnalysesActive = pathname.startsWith('/analyses') || pathname.startsWith('/dashboard')

  return (
    <div className="flex h-full min-h-screen bg-gray-50">
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col shrink-0">
        <div className="px-4 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-gray-900 rounded flex items-center justify-center">
              <MessageSquare className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-semibold text-gray-900 text-sm">Ask Underwriter</span>
          </div>
        </div>

        <nav className="flex-1 px-2 py-3 space-y-0.5">
          <Link
            href="/queue"
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
              isQueueActive
                ? 'bg-gray-900 text-white font-medium'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`}
          >
            <MessageSquare className="w-4 h-4 shrink-0" />
            <span className="flex-1">Questions</span>
            {counts.pending > 0 && (
              <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                isQueueActive ? 'bg-white text-gray-900' : 'bg-red-100 text-red-700'
              }`}>
                {counts.pending}
              </span>
            )}
          </Link>

          <Link
            href="/analyses"
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
              isAnalysesActive
                ? 'bg-gray-900 text-white font-medium'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`}
          >
            <BarChart2 className="w-4 h-4 shrink-0" />
            <span>Analyses</span>
          </Link>
        </nav>

        <div className="px-3 py-3 border-t border-gray-200 space-y-2">
          {/* Underwriter name */}
          {editing ? (
            <div className="space-y-2">
              <p className="text-xs text-gray-500 px-1">Votre prénom (pour les réponses)</p>
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && saveName()}
                placeholder="Prénom et nom"
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-gray-900"
                autoFocus
              />
              <button
                onClick={saveName}
                className="w-full text-sm bg-gray-900 text-white rounded-lg px-3 py-1.5 hover:bg-gray-800 transition-colors"
              >
                Confirmer
              </button>
            </div>
          ) : (
            <button
              onClick={() => { setNameInput(underwriterName); setEditing(true) }}
              className="flex items-center gap-2 w-full text-left group px-1"
            >
              <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center shrink-0 text-xs font-bold text-gray-600">
                {(underwriterName || user?.firstName || '?')[0].toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-gray-900 truncate">{underwriterName || user?.fullName || user?.primaryEmailAddress?.emailAddress}</p>
                <p className="text-xs text-gray-400 group-hover:text-gray-600">Changer</p>
              </div>
            </button>
          )}

          {/* Sign out */}
          <button
            onClick={() => signOut({ redirectUrl: '/' })}
            className="flex items-center gap-2 w-full px-1 py-1 text-xs text-gray-400 hover:text-gray-700 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Se déconnecter
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}

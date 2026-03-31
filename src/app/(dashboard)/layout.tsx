'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { MessageSquare, User, BarChart2 } from 'lucide-react'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
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

  const isQueueActive = pathname.startsWith('/queue')
  const isAnalysesActive = pathname.startsWith('/analyses') || pathname.startsWith('/dashboard')

  return (
    <div className="flex h-full min-h-screen">
      {/* Sidebar */}
      <aside className="w-60 bg-white border-r border-gray-200 flex flex-col shrink-0">
        <div className="px-5 py-5 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-gray-900 text-sm">Ask Underwriter</span>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          <p className="px-3 mb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">Navigation</p>

          {/* Questions link */}
          <Link
            href="/queue"
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
              isQueueActive ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`}
          >
            <MessageSquare className="w-4 h-4 shrink-0" />
            <span className="flex-1">Questions</span>
            {counts.pending > 0 ? (
              <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">
                {counts.pending}
              </span>
            ) : (
              <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">
                0
              </span>
            )}
          </Link>

          {/* Analyses link */}
          <Link
            href="/analyses"
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
              isAnalysesActive ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`}
          >
            <BarChart2 className="w-4 h-4 shrink-0" />
            <span className="flex-1">Analyses</span>
          </Link>
        </nav>

        {/* Underwriter identity */}
        <div className="px-4 py-4 border-t border-gray-200">
          {editing ? (
            <div className="space-y-2">
              <p className="text-xs text-gray-500">Qui êtes-vous ?</p>
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && saveName()}
                placeholder="Votre prénom et nom"
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
              <button
                onClick={saveName}
                className="w-full text-sm bg-blue-600 text-white rounded-lg px-3 py-1.5 hover:bg-blue-700 transition-colors"
              >
                Confirmer
              </button>
            </div>
          ) : (
            <button
              onClick={() => { setNameInput(underwriterName); setEditing(true) }}
              className="flex items-center gap-2 w-full text-left group"
            >
              <div className="w-7 h-7 bg-gray-200 rounded-full flex items-center justify-center shrink-0">
                <User className="w-4 h-4 text-gray-500" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-900 truncate">{underwriterName}</p>
                <p className="text-xs text-gray-400 group-hover:text-gray-500">Changer</p>
              </div>
            </button>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}

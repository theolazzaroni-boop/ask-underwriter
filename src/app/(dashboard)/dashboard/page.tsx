'use client'

import { useState, useEffect, useMemo } from 'react'
import { Download } from 'lucide-react'
import { format, subDays, startOfDay } from 'date-fns'
import { QuestionWithAnswers } from '@/lib/types'

const PRODUCT_TYPES = ['RCPH', 'RCPHes', 'RCPA', 'RCPAxa', 'MRPH', 'MRPW', 'MRPW-es', 'MRPA', 'MUTA']

const PRIORITY_LABELS: Record<string, string> = { normal: 'Normal', high: 'Haute', urgent: 'Urgent' }
const STATUS_LABELS: Record<string, string> = { pending: 'En attente', in_progress: 'En cours', answered: 'Traité' }

const PERIOD_OPTIONS = [
  { value: 'all', label: 'Toute la période' },
  { value: '7', label: '7 derniers jours' },
  { value: '30', label: '30 derniers jours' },
  { value: '90', label: '90 derniers jours' },
]

export default function DashboardPage() {
  const [questions, setQuestions] = useState<QuestionWithAnswers[]>([])
  const [loading, setLoading] = useState(true)

  const [period, setPeriod] = useState('all')
  const [product, setProduct] = useState('all')
  const [underwriter, setUnderwriter] = useState('all')
  const [sales, setSales] = useState('all')
  const [status, setStatus] = useState('all')

  useEffect(() => {
    fetch('/api/questions')
      .then(r => r.json())
      .then(data => { setQuestions(data); setLoading(false) })
  }, [])

  const underwriters = useMemo(() => {
    const set = new Set(questions.map(q => q.assigned_to).filter(Boolean))
    return Array.from(set) as string[]
  }, [questions])

  const salesPeople = useMemo(() => {
    return Array.from(new Set(questions.map(q => q.sales_name)))
  }, [questions])

  const filtered = useMemo(() => {
    return questions.filter(q => {
      if (period !== 'all') {
        const cutoff = startOfDay(subDays(new Date(), parseInt(period)))
        if (new Date(q.created_at) < cutoff) return false
      }
      if (product !== 'all' && q.product_type !== product) return false
      if (underwriter !== 'all' && q.assigned_to !== underwriter) return false
      if (sales !== 'all' && q.sales_name !== sales) return false
      if (status !== 'all' && q.status !== status) return false
      return true
    })
  }, [questions, period, product, underwriter, sales, status])

  const stats = useMemo(() => {
    const total = filtered.length
    const answered = filtered.filter(q => q.status === 'answered').length
    const pending = filtered.filter(q => q.status === 'pending').length

    const responseTimes = filtered
      .filter(q => q.status === 'answered' && q.answers?.length > 0)
      .map(q => new Date(q.answers[0].created_at).getTime() - new Date(q.created_at).getTime())

    const avgHours = responseTimes.length > 0
      ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length / (1000 * 60 * 60))
      : null

    const byProduct: Record<string, number> = {}
    filtered.forEach(q => { byProduct[q.product_type] = (byProduct[q.product_type] || 0) + 1 })

    const byUnderwriter: Record<string, number> = {}
    filtered.forEach(q => {
      if (q.assigned_to) byUnderwriter[q.assigned_to] = (byUnderwriter[q.assigned_to] || 0) + 1
    })

    return { total, answered, pending, avgHours, byProduct, byUnderwriter }
  }, [filtered])

  function exportCSV() {
    const headers = ['Date', 'Commercial', 'Produit', 'Priorité', 'Statut', 'Underwriter', 'Description', 'Temps de réponse (h)']
    const rows = filtered.map(q => {
      const firstAnswer = q.answers?.[0]
      const responseHours = firstAnswer
        ? Math.round((new Date(firstAnswer.created_at).getTime() - new Date(q.created_at).getTime()) / (1000 * 60 * 60))
        : ''
      return [
        format(new Date(q.created_at), 'dd/MM/yyyy HH:mm'),
        q.sales_name,
        q.product_type,
        PRIORITY_LABELS[q.priority] || q.priority,
        STATUS_LABELS[q.status] || q.status,
        q.assigned_to || '',
        `"${q.description.replace(/"/g, '""')}"`,
        responseHours,
      ]
    })
    const csv = [headers, ...rows].map(r => r.join(';')).join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ask-underwriter-${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return <div className="p-8 text-sm text-gray-500">Chargement...</div>
  }

  const selectClass = "text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-700"

  return (
    <div className="p-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Analyse des demandes underwriting</p>
        </div>
        <button
          onClick={exportCSV}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <Download className="w-4 h-4" />
          Exporter CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6 p-4 bg-white rounded-xl border border-gray-200">
        <select value={period} onChange={e => setPeriod(e.target.value)} className={selectClass}>
          {PERIOD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select value={status} onChange={e => setStatus(e.target.value)} className={selectClass}>
          <option value="all">Tous les statuts</option>
          <option value="pending">En attente</option>
          <option value="in_progress">En cours</option>
          <option value="answered">Traités</option>
        </select>
        <select value={product} onChange={e => setProduct(e.target.value)} className={selectClass}>
          <option value="all">Tous les produits</option>
          {PRODUCT_TYPES.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={underwriter} onChange={e => setUnderwriter(e.target.value)} className={selectClass}>
          <option value="all">Tous les underwriters</option>
          {underwriters.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
        <select value={sales} onChange={e => setSales(e.target.value)} className={selectClass}>
          <option value="all">Tous les commerciaux</option>
          {salesPeople.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total demandes', value: stats.total, color: 'text-gray-900' },
          { label: 'En attente', value: stats.pending, color: 'text-orange-600' },
          { label: 'Traitées', value: stats.answered, color: 'text-green-600' },
          { label: 'Temps moyen', value: stats.avgHours !== null ? `${stats.avgHours}h` : '—', color: 'text-blue-600' },
        ].map(card => (
          <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500 mb-1">{card.label}</p>
            <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Breakdowns */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Par produit</h3>
          {Object.keys(stats.byProduct).length === 0 ? (
            <p className="text-sm text-gray-400">Aucune donnée</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(stats.byProduct).sort((a, b) => b[1] - a[1]).map(([prod, count]) => (
                <div key={prod} className="flex items-center gap-3">
                  <span className="w-20 text-xs text-gray-600 shrink-0">{prod}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2">
                    <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${(count / stats.total) * 100}%` }} />
                  </div>
                  <span className="text-xs font-medium text-gray-900 w-5 text-right">{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Par underwriter</h3>
          {Object.keys(stats.byUnderwriter).length === 0 ? (
            <p className="text-sm text-gray-400">Aucune donnée</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(stats.byUnderwriter).sort((a, b) => b[1] - a[1]).map(([uw, count]) => (
                <div key={uw} className="flex items-center gap-3">
                  <span className="w-28 text-xs text-gray-600 shrink-0 truncate">{uw}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2">
                    <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${(count / stats.total) * 100}%` }} />
                  </div>
                  <span className="text-xs font-medium text-gray-900 w-5 text-right">{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900">{filtered.length} demande{filtered.length !== 1 ? 's' : ''}</h3>
        </div>
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">Aucune demande pour ces filtres</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  {['Date', 'Commercial', 'Produit', 'Priorité', 'Statut', 'Underwriter', 'Tps réponse'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((q, i) => {
                  const firstAnswer = q.answers?.[0]
                  const responseHours = firstAnswer
                    ? Math.round((new Date(firstAnswer.created_at).getTime() - new Date(q.created_at).getTime()) / (1000 * 60 * 60))
                    : null
                  return (
                    <tr key={q.id} className={`border-b border-gray-100 hover:bg-gray-50 ${i === filtered.length - 1 ? 'border-b-0' : ''}`}>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">{format(new Date(q.created_at), 'dd/MM/yy HH:mm')}</td>
                      <td className="px-4 py-3 text-gray-900 whitespace-nowrap">{q.sales_name}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">{q.product_type}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium ${q.priority === 'urgent' ? 'text-red-600' : q.priority === 'high' ? 'text-yellow-600' : 'text-green-600'}`}>
                          {PRIORITY_LABELS[q.priority]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium ${q.status === 'answered' ? 'text-green-600' : q.status === 'in_progress' ? 'text-blue-600' : 'text-orange-600'}`}>
                          {STATUS_LABELS[q.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{q.assigned_to || '—'}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{responseHours !== null ? `${responseHours}h` : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

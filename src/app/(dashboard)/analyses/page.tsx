'use client'

import { useState, useEffect, useMemo } from 'react'
import { Download } from 'lucide-react'
import { format, subDays, startOfDay } from 'date-fns'
import { fr } from 'date-fns/locale'
import { QuestionWithAnswers } from '@/lib/types'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
  Legend,
  CartesianGrid,
} from 'recharts'

const PRODUCT_TYPES = ['RCPH', 'RCPHes', 'RCPA', 'RCPAxa', 'MRPH', 'MRPW', 'MRPW-es', 'MRPA', 'MUTA']

const PRIORITY_LABELS: Record<string, string> = { normal: 'Normal', high: 'Haute', urgent: 'Urgent' }
const STATUS_LABELS: Record<string, string> = { pending: 'En attente', in_progress: 'En cours', answered: 'Traité' }

const PERIOD_OPTIONS = [
  { value: 'all', label: 'Toute la période' },
  { value: '7', label: '7 derniers jours' },
  { value: '30', label: '30 derniers jours' },
  { value: '90', label: '90 derniers jours' },
]

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#84cc16']

interface AnalyticsData {
  demandes_par_jour: { day: string; total: number }[]
  par_produit: { product: string; total: number }[]
  par_underwriter: { name: string; total: number }[]
  temps_moyen_par_semaine: { week: string; avg_hours: number }[]
}

function EmptyChart() {
  return (
    <div className="flex items-center justify-center h-full text-sm text-gray-400">
      Aucune donnée sur cette période
    </div>
  )
}

export default function AnalysesPage() {
  const [questions, setQuestions] = useState<QuestionWithAnswers[]>([])
  const [loading, setLoading] = useState(true)
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null)

  const [period, setPeriod] = useState('all')
  const [product, setProduct] = useState('all')
  const [underwriter, setUnderwriter] = useState('all')
  const [sales, setSales] = useState('all')
  const [status, setStatus] = useState('all')

  useEffect(() => {
    fetch('/api/questions')
      .then(r => r.json())
      .then((data: QuestionWithAnswers[]) => { setQuestions(data); setLoading(false) })
  }, [])

  useEffect(() => {
    const from = period === 'all' ? null : subDays(new Date(), parseInt(period)).toISOString()
    const url = from ? `/api/analytics?from=${from}` : '/api/analytics'
    fetch(url).then(r => r.json()).then(setAnalyticsData)
  }, [period])

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

  const prevFiltered = useMemo(() => {
    if (period === 'all') return []
    const days = parseInt(period)
    const periodStart = startOfDay(subDays(new Date(), days))
    const prevStart = startOfDay(subDays(new Date(), days * 2))
    return questions.filter(q => {
      const date = new Date(q.created_at)
      if (date < prevStart || date >= periodStart) return false
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

    const avgMs = responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : null
    const avgHours = avgMs !== null ? avgMs / (1000 * 60 * 60) : null
    const avgHoursDisplay = avgHours !== null
      ? (avgHours < 1 ? '< 1h' : `${Math.round(avgHours)}h`)
      : null

    const byProduct: Record<string, number> = {}
    filtered.forEach(q => { byProduct[q.product_type] = (byProduct[q.product_type] || 0) + 1 })

    const byUnderwriter: Record<string, number> = {}
    filtered.forEach(q => {
      if (q.assigned_to) byUnderwriter[q.assigned_to] = (byUnderwriter[q.assigned_to] || 0) + 1
    })

    // Previous period stats for trends
    const prevTotal = prevFiltered.length
    const prevAnswered = prevFiltered.filter(q => q.status === 'answered').length
    const prevPending = prevFiltered.filter(q => q.status === 'pending').length
    const prevResponseTimes = prevFiltered
      .filter(q => q.status === 'answered' && q.answers?.length > 0)
      .map(q => new Date(q.answers[0].created_at).getTime() - new Date(q.created_at).getTime())
    const prevAvgMs = prevResponseTimes.length > 0
      ? prevResponseTimes.reduce((a, b) => a + b, 0) / prevResponseTimes.length
      : null
    const prevAvgHours = prevAvgMs !== null ? prevAvgMs / (1000 * 60 * 60) : null

    return { total, answered, pending, avgHours, avgHoursDisplay, byProduct, byUnderwriter, prevTotal, prevAnswered, prevPending, prevAvgHours }
  }, [filtered, prevFiltered])

  function exportCSV() {
    const headers = ['Date', 'Commercial', 'Produit', 'Priorité', 'Statut', 'Underwriter', 'Description', 'Temps de réponse (h)']
    const rows = filtered.map(q => {
      const firstAnswer = q.answers?.[0]
      const responseMs = firstAnswer
        ? (new Date(firstAnswer.created_at).getTime() - new Date(q.created_at).getTime())
        : null
      const responseHours = responseMs !== null ? Math.round(responseMs / (1000 * 60 * 60)) : ''
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
          <h1 className="text-2xl font-bold text-gray-900">Analyses</h1>
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
          {
            label: 'Total demandes',
            value: stats.total,
            color: 'text-gray-900',
            prev: stats.prevTotal,
            trendPositive: (diff: number) => diff > 0,
          },
          {
            label: 'En attente',
            value: stats.pending,
            color: 'text-orange-600',
            prev: stats.prevPending,
            trendPositive: (diff: number) => diff < 0,
          },
          {
            label: 'Traitées',
            value: stats.answered,
            color: 'text-green-600',
            prev: stats.prevAnswered,
            trendPositive: (diff: number) => diff > 0,
          },
          {
            label: 'Temps moyen',
            value: stats.avgHoursDisplay ?? '—',
            color: 'text-blue-600',
            prev: stats.prevAvgHours !== null && stats.avgHours !== null ? Math.round(stats.prevAvgHours) : null,
            trendPositive: (diff: number) => diff < 0,
            customDiff: stats.avgHours !== null && stats.prevAvgHours !== null
              ? Math.round(stats.avgHours) - Math.round(stats.prevAvgHours)
              : null,
          },
        ].map(card => {
          const hasTrend = period !== 'all' && card.prev !== null && card.prev !== undefined
          const diff = hasTrend
            ? (card.customDiff !== undefined ? card.customDiff : (typeof card.value === 'number' ? card.value - (card.prev as number) : null))
            : null
          const isPositive = diff !== null ? card.trendPositive(diff) : false
          return (
            <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 mb-1">{card.label}</p>
              <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
              {hasTrend && diff !== null && (
                <p className={`text-xs mt-1 font-medium ${isPositive ? 'text-green-600' : diff === 0 ? 'text-gray-400' : 'text-red-500'}`}>
                  {diff > 0 ? '+' : ''}{card.label === 'Temps moyen' ? `${diff}h` : diff} vs période préc.
                </p>
              )}
            </div>
          )
        })}
      </div>

      {/* Chart 1 — Demandes dans le temps (full width) */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Demandes dans le temps</h3>
        <div className="h-56">
          {(analyticsData?.demandes_par_jour ?? []).length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={analyticsData?.demandes_par_jour ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => format(new Date(v), 'dd/MM')}
                />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  formatter={(v) => [v, 'Demandes']}
                  labelFormatter={(l) => format(new Date(l), 'dd MMM yyyy', { locale: fr })}
                />
                <Line type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Charts row — Pie + Bar */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* Chart 2 — Par produit */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Par produit</h3>
          <div className="h-56">
            {(analyticsData?.par_produit ?? []).length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={analyticsData?.par_produit ?? []}
                    dataKey="total"
                    nameKey="product"
                    cx="40%"
                    outerRadius={80}
                    label={false}
                  >
                    {(analyticsData?.par_produit ?? []).map((_: unknown, i: number) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v, n) => [v, n]} />
                  <Legend layout="vertical" align="right" verticalAlign="middle" formatter={(v) => v} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Chart 3 — Par underwriter */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Par underwriter</h3>
          <div className="h-56">
            {(analyticsData?.par_underwriter ?? []).length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={analyticsData?.par_underwriter ?? []} layout="vertical" margin={{ left: 80 }}>
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
                  <Tooltip formatter={(v) => [v, 'Demandes traitées']} />
                  <Bar dataKey="total" fill="#10b981" radius={[0, 4, 4, 0]}>
                    {(analyticsData?.par_underwriter ?? []).map((_: unknown, i: number) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Chart 4 — Temps moyen par semaine (full width) */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Temps moyen de réponse par semaine</h3>
        <div className="h-56">
          {(analyticsData?.temps_moyen_par_semaine ?? []).length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={analyticsData?.temps_moyen_par_semaine ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="week"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => format(new Date(v), 'dd/MM')}
                />
                <YAxis tick={{ fontSize: 11 }} unit="h" />
                <Tooltip
                  // @ts-expect-error recharts ValueType includes undefined but we know it's a number here
                  formatter={(v: number) => [v < 1 ? `${Math.round(v * 60)}min` : `${v}h`, 'Temps moyen']}
                  labelFormatter={(l) => `Semaine du ${format(new Date(l), 'dd MMM', { locale: fr })}`}
                />
                <Bar dataKey="avg_hours" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
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
                  const responseMs = firstAnswer
                    ? (new Date(firstAnswer.created_at).getTime() - new Date(q.created_at).getTime())
                    : null
                  const responseHoursRaw = responseMs !== null ? responseMs / (1000 * 60 * 60) : null
                  const responseHours = responseHoursRaw !== null
                    ? (responseHoursRaw < 1 ? '< 1h' : `${Math.round(responseHoursRaw)}h`)
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
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{responseHours !== null ? responseHours : '—'}</td>
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

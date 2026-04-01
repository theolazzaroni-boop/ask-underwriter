'use client'

import { useState, useEffect, useMemo } from 'react'
import { Download } from 'lucide-react'
import { format, subDays, startOfDay } from 'date-fns'
import { fr } from 'date-fns/locale'
import { QuestionWithAnswers } from '@/lib/types'
import Link from 'next/link'
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

const PRODUCT_COLORS: Record<string, string> = {
  RCPH:      '#3b82f6',
  RCPHes:    '#6366f1',
  RCPA:      '#10b981',
  RCPAxa:    '#059669',
  MRPH:      '#f59e0b',
  MRPW:      '#f97316',
  'MRPW-es': '#ef4444',
  MRPA:      '#8b5cf6',
  MUTA:      '#06b6d4',
}

function productColor(name: string, index: number) {
  return PRODUCT_COLORS[name] ?? `hsl(${index * 47}, 65%, 50%)`
}

const UNDERWRITER_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316']

const PRIORITY_LABELS: Record<string, string> = { normal: 'Normal', high: 'Haute', urgent: 'Urgent' }
const STATUS_LABELS: Record<string, string> = { pending: 'En attente', in_progress: 'En cours', answered: 'Traité' }

const PERIOD_OPTIONS = [
  { value: 'all', label: 'Toute la période' },
  { value: '7', label: '7 derniers jours' },
  { value: '30', label: '30 derniers jours' },
  { value: '90', label: '90 derniers jours' },
]

interface AnalyticsData {
  demandes_par_jour: { day: string; total: number }[]
  par_produit: { product: string; total: number }[]
  par_underwriter: { name: string; total: number }[]
  temps_moyen_par_semaine: { week: string; avg_hours: number }[]
}

function formatDuration(hours: number) {
  if (hours < 1 / 60) return `${Math.round(hours * 3600)}s`
  if (hours < 1) return `${Math.round(hours * 60)}min`
  return `${Math.round(hours)}h`
}

function computeMA7(data: { day: string; total: number }[]) {
  return data.map((item, i) => {
    const slice = data.slice(Math.max(0, i - 6), i + 1)
    const avg = slice.reduce((s, d) => s + d.total, 0) / slice.length
    return { ...item, ma7: Math.round(avg * 10) / 10 }
  })
}

function EmptyChart({ message }: { message?: string }) {
  return (
    <div className="flex items-center justify-center h-full text-sm text-gray-400">
      {message ?? 'Aucune donnée sur cette période'}
    </div>
  )
}

export default function AnalysesPage() {
  const [questions, setQuestions] = useState<QuestionWithAnswers[]>([])
  const [loading, setLoading] = useState(true)
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null)

  const [period, setPeriod] = useState('30')
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

  const underwriters = useMemo(() => Array.from(new Set(questions.map(q => q.assigned_to).filter(Boolean))) as string[], [questions])
  const salesPeople = useMemo(() => Array.from(new Set(questions.map(q => q.sales_name))), [questions])

  const filtered = useMemo(() => questions.filter(q => {
    if (period !== 'all') {
      if (new Date(q.created_at) < startOfDay(subDays(new Date(), parseInt(period)))) return false
    }
    if (product !== 'all' && q.product_type !== product) return false
    if (underwriter !== 'all' && q.assigned_to !== underwriter) return false
    if (sales !== 'all' && q.sales_name !== sales) return false
    if (status !== 'all' && q.status !== status) return false
    return true
  }), [questions, period, product, underwriter, sales, status])

  const prevFiltered = useMemo(() => {
    if (period === 'all') return []
    const days = parseInt(period)
    const periodStart = startOfDay(subDays(new Date(), days))
    const prevStart = startOfDay(subDays(new Date(), days * 2))
    return questions.filter(q => {
      const d = new Date(q.created_at)
      if (d < prevStart || d >= periodStart) return false
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
      .map(q => (new Date(q.answers[0].created_at).getTime() - new Date(q.created_at).getTime()) / 3600000)

    const avgHours = responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : null

    // SLA: % answered within 4h
    const slaTarget = 4
    const slaCount = responseTimes.filter(h => h <= slaTarget).length
    const slaRate = responseTimes.length > 0 ? Math.round((slaCount / responseTimes.length) * 100) : null

    // Prev period
    const prevTotal = prevFiltered.length
    const prevAnswered = prevFiltered.filter(q => q.status === 'answered').length
    const prevResponseTimes = prevFiltered
      .filter(q => q.status === 'answered' && q.answers?.length > 0)
      .map(q => (new Date(q.answers[0].created_at).getTime() - new Date(q.created_at).getTime()) / 3600000)
    const prevAvgHours = prevResponseTimes.length > 0
      ? prevResponseTimes.reduce((a, b) => a + b, 0) / prevResponseTimes.length
      : null

    // Real-time load per underwriter
    const openByUnderwriter: Record<string, number> = {}
    questions
      .filter(q => q.status !== 'answered' && q.assigned_to)
      .forEach(q => {
        openByUnderwriter[q.assigned_to!] = (openByUnderwriter[q.assigned_to!] || 0) + 1
      })

    return { total, answered, pending, avgHours, slaRate, prevTotal, prevAnswered, prevAvgHours, openByUnderwriter }
  }, [filtered, prevFiltered, questions])

  function exportCSV() {
    const headers = ['Date', 'Commercial', 'Produit', 'Priorité', 'Statut', 'Underwriter', 'Description', 'Temps de réponse']
    const rows = filtered.map(q => {
      const firstAnswer = q.answers?.[0]
      const responseMs = firstAnswer ? new Date(firstAnswer.created_at).getTime() - new Date(q.created_at).getTime() : null
      const responseHours = responseMs !== null ? responseMs / 3600000 : null
      return [
        format(new Date(q.created_at), 'dd/MM/yyyy HH:mm'),
        q.sales_name, q.product_type,
        PRIORITY_LABELS[q.priority] || q.priority,
        STATUS_LABELS[q.status] || q.status,
        q.assigned_to || '',
        `"${q.description.replace(/"/g, '""')}"`,
        responseHours !== null ? formatDuration(responseHours) : '',
      ]
    })
    const csv = [headers, ...rows].map(r => r.join(';')).join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = `ask-underwriter-${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  if (loading) return <div className="p-8 text-sm text-gray-400">Chargement...</div>

  const selectClass = "text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white text-gray-700"
  const demandesAvecMA = computeMA7(analyticsData?.demandes_par_jour ?? [])
  const hasTrend = period !== 'all'

  return (
    <div className="p-8 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analyses</h1>
          <p className="text-sm text-gray-400 mt-0.5">Analyse des demandes underwriting</p>
        </div>
        <button onClick={exportCSV} className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">
          <Download className="w-4 h-4" />
          Exporter CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-6 p-4 bg-white rounded-xl border border-gray-200">
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

      {/* KPI cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {/* Total */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-400 mb-1">Total demandes</p>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          {hasTrend && stats.prevTotal > 0 && (() => {
            const diff = stats.total - stats.prevTotal
            return <p className={`text-xs mt-1 font-medium ${diff > 0 ? 'text-gray-600' : diff < 0 ? 'text-red-500' : 'text-gray-400'}`}>{diff > 0 ? '+' : ''}{diff} vs période préc.</p>
          })()}
        </div>
        {/* Traitées */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-400 mb-1">Traitées</p>
          <p className="text-2xl font-bold text-gray-900">{stats.answered}</p>
          {stats.total > 0 && <p className="text-xs mt-1 text-gray-400">{Math.round((stats.answered / stats.total) * 100)}% du total</p>}
        </div>
        {/* Temps moyen */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-400 mb-1">Temps moyen de réponse</p>
          <p className="text-2xl font-bold text-gray-900">{stats.avgHours !== null ? formatDuration(stats.avgHours) : '—'}</p>
          {hasTrend && stats.prevAvgHours !== null && stats.avgHours !== null && (() => {
            const diff = stats.avgHours - stats.prevAvgHours!
            return <p className={`text-xs mt-1 font-medium ${diff < 0 ? 'text-gray-600' : diff > 0 ? 'text-red-500' : 'text-gray-400'}`}>{diff > 0 ? '+' : ''}{formatDuration(Math.abs(diff))} vs période préc.</p>
          })()}
        </div>
        {/* SLA */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-400 mb-1">SLA — traité en moins de 4h</p>
          <p className="text-2xl font-bold text-gray-900">{stats.slaRate !== null ? `${stats.slaRate}%` : '—'}</p>
          <p className="text-xs mt-1 text-gray-400">cible 95%</p>
        </div>
      </div>

      {/* Charge temps réel par underwriter */}
      {Object.keys(stats.openByUnderwriter).length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Charge en cours par underwriter</h3>
          <div className="flex flex-wrap gap-3">
            {Object.entries(stats.openByUnderwriter).sort((a, b) => b[1] - a[1]).map(([name, count]) => (
              <div key={name} className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                <div className="w-5 h-5 rounded-full bg-gray-900 flex items-center justify-center text-white text-xs font-bold shrink-0">
                  {name[0].toUpperCase()}
                </div>
                <span className="text-sm text-gray-700">{name}</span>
                <span className={`text-sm font-bold ${count >= 5 ? 'text-red-600' : count >= 3 ? 'text-amber-600' : 'text-gray-900'}`}>{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chart 1 — Demandes dans le temps + moyenne mobile */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900">Demandes dans le temps</h3>
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-gray-300 inline-block" />Quotidien</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-gray-900 inline-block" />Moy. 7j</span>
          </div>
        </div>
        <div className="h-56">
          {demandesAvecMA.length === 0 ? (
            <EmptyChart message="Pas encore assez de données" />
          ) : demandesAvecMA.length === 1 ? (
            <EmptyChart message="Pas encore assez de données pour afficher une tendance" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={demandesAvecMA}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} tickFormatter={(v) => format(new Date(v), 'dd/MM')} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip formatter={(v, n) => [v, n === 'total' ? 'Demandes' : 'Moy. 7j']} labelFormatter={(l) => format(new Date(l), 'dd MMM yyyy', { locale: fr })} />
                <Line type="monotone" dataKey="total" stroke="#d1d5db" strokeWidth={1} dot={false} />
                <Line type="monotone" dataKey="ma7" stroke="#111827" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Charts row — Pie + Bar */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Par produit</h3>
          <div className="h-56">
            {(analyticsData?.par_produit ?? []).length === 0 ? <EmptyChart /> : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={analyticsData?.par_produit ?? []} dataKey="total" nameKey="product" cx="40%" outerRadius={80} label={false}>
                    {(analyticsData?.par_produit ?? []).map((entry: { product: string }, i: number) => (
                      <Cell key={i} fill={productColor(entry.product, i)} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v, n) => [v, n]} />
                  <Legend layout="vertical" align="right" verticalAlign="middle" />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Par underwriter</h3>
          <div className="h-56">
            {(analyticsData?.par_underwriter ?? []).length === 0 ? <EmptyChart /> : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={analyticsData?.par_underwriter ?? []} layout="vertical" margin={{ left: 80 }}>
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
                  <Tooltip formatter={(v) => [v, 'Demandes traitées']} />
                  <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                    {(analyticsData?.par_underwriter ?? []).map((_: unknown, i: number) => (
                      <Cell key={i} fill={UNDERWRITER_COLORS[i % UNDERWRITER_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Chart — Temps moyen par semaine */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Temps moyen de réponse par semaine</h3>
        <div className="h-56">
          {(analyticsData?.temps_moyen_par_semaine ?? []).length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={analyticsData?.temps_moyen_par_semaine ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} tickFormatter={(v) => format(new Date(v), 'dd/MM')} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => formatDuration(v)}
                />
                <Tooltip
                  // @ts-expect-error recharts ValueType
                  formatter={(v: number) => [formatDuration(v), 'Temps moyen']}
                  labelFormatter={(l) => `Semaine du ${format(new Date(l), 'dd MMM', { locale: fr })}`}
                />
                <Bar dataKey="avg_hours" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Table — cliquable */}
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
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((q, i) => {
                  const firstAnswer = q.answers?.[0]
                  const responseMs = firstAnswer ? new Date(firstAnswer.created_at).getTime() - new Date(q.created_at).getTime() : null
                  const responseHours = responseMs !== null ? responseMs / 3600000 : null
                  return (
                    <tr key={q.id} className={`border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${i === filtered.length - 1 ? 'border-b-0' : ''}`}>
                      <td className="px-4 py-3 text-gray-400 whitespace-nowrap text-xs">
                        <Link href={`/questions/${q.id}`} className="block">{format(new Date(q.created_at), 'dd/MM/yy HH:mm')}</Link>
                      </td>
                      <td className="px-4 py-3 text-gray-900 whitespace-nowrap"><Link href={`/questions/${q.id}`} className="block">{q.sales_name}</Link></td>
                      <td className="px-4 py-3">
                        <Link href={`/questions/${q.id}`} className="block">
                          <span className="px-2 py-0.5 rounded text-xs font-medium text-white" style={{ backgroundColor: productColor(q.product_type, 0) }}>{q.product_type}</span>
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/questions/${q.id}`} className="block">
                          <span className={`text-xs font-medium ${q.priority === 'urgent' ? 'text-red-600' : 'text-gray-500'}`}>{PRIORITY_LABELS[q.priority]}</span>
                        </Link>
                      </td>
                      <td className="px-4 py-3"><Link href={`/questions/${q.id}`} className="block text-xs text-gray-500">{STATUS_LABELS[q.status]}</Link></td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap"><Link href={`/questions/${q.id}`} className="block">{q.assigned_to || '—'}</Link></td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap"><Link href={`/questions/${q.id}`} className="block">{responseHours !== null ? formatDuration(responseHours) : '—'}</Link></td>
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

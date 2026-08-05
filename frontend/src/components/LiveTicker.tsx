import { useEffect, useState, useMemo } from 'react'
import { useI18n } from '../lib/i18n'
import type { Anomaly, DistrictSummary } from '../lib/data'

interface Alert {
  id: number
  text: string
  severity: 'critical' | 'high' | 'medium' | 'low'
}

function nowTimestamp(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
}

type Tr = (k: string) => string

function generateAlerts(
  anomalies: Anomaly[],
  districts: DistrictSummary[],
  t: Tr,
  tc: Tr,
  td: Tr,
): Alert[] {
  const alerts: Alert[] = []

  anomalies.forEach((a, i) => {
    alerts.push({
      id: i,
      text: t('ticker.anomaly')
        .replace('{crime}', tc(a.crime_type))
        .replace('{observed}', String(a.observed))
        .replace('{district}', td(a.district))
        .replace('{expected}', a.expected.toFixed(0))
        .replace('{z}', a.zscore.toFixed(1)),
      severity: a.severity === 'critical' ? 'critical' : a.zscore > 3 ? 'high' : 'medium',
    })
  })

  districts
    .filter((d) => d.yoy_change_pct > 10)
    .forEach((d, i) => {
      alerts.push({
        id: 1000 + i,
        text: t('ticker.trend')
          .replace('{district}', td(d.district))
          .replace('{pct}', d.yoy_change_pct.toFixed(1))
          .replace('{cases}', d.latest_year_cases.toLocaleString())
          .replace('{crime}', tc(d.top_crime_type)),
        severity: d.yoy_change_pct > 15 ? 'high' : 'medium',
      })
    })

  return alerts
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#f59e0b',
  low: '#22c55e',
}

interface Props {
  anomalies: Anomaly[]
  districts: DistrictSummary[]
}

export default function LiveTicker({ anomalies, districts }: Props) {
  const { t, tc, td } = useI18n()
  const alerts = useMemo(
    () => generateAlerts(anomalies, districts, t, tc, td),
    [anomalies, districts, t, tc, td],
  )
  const [currentIdx, setCurrentIdx] = useState(0)
  const [clock, setClock] = useState(nowTimestamp)
  const [sliding, setSliding] = useState(false)

  useEffect(() => {
    if (alerts.length === 0) return
    const interval = setInterval(() => {
      setSliding(true)
      setTimeout(() => {
        setCurrentIdx((i) => (i + 1) % alerts.length)
        setSliding(false)
      }, 300)
    }, 4000)
    return () => clearInterval(interval)
  }, [alerts.length])

  useEffect(() => {
    const interval = setInterval(() => setClock(nowTimestamp()), 1000)
    return () => clearInterval(interval)
  }, [])

  if (alerts.length === 0) return null

  const current = alerts[currentIdx]
  const color = SEVERITY_COLORS[current.severity]

  return (
    <div className="shrink-0 h-7 flex items-center gap-3 px-4 bg-[#111417] border-b border-slate-800/50 overflow-hidden">
      {/* Labelled as a demo feed on purpose: it replays batch-analysed
          anomalies and must never read as a live CCTNS link. */}
      <div className="flex items-center gap-1.5 shrink-0" title={t('ticker.note')}>
        <span className="inline-flex rounded-full h-2 w-2 bg-amber-400/90" />
        <span className="text-[9px] font-bold uppercase tracking-widest text-amber-400/90">{t('ticker.demo')}</span>
      </div>

      {/* clock */}
      <span className="text-[10px] font-mono-data tabular-nums text-slate-500 shrink-0">{clock} IST</span>

      {/* divider */}
      <span className="w-px h-3.5 bg-slate-700/60 shrink-0" />

      {/* scrolling alert */}
      <div className="flex-1 overflow-hidden relative min-w-0">
        <div
          className={`flex items-center gap-2 transition-all duration-300 ${
            sliding ? 'translate-y-full opacity-0' : 'translate-y-0 opacity-100'
          }`}
        >
          <span
            className="shrink-0 w-1.5 h-1.5 rounded-full"
            style={{ background: color, boxShadow: `0 0 6px ${color}` }}
          />
          <span className="text-[10px] text-slate-300 truncate">{current.text}</span>
        </div>
      </div>

      {/* alert count */}
      <span className="text-[9px] tabular-nums text-slate-500 shrink-0">{alerts.length} {t('ticker.alerts')}</span>
    </div>
  )
}

import { useEffect, useMemo, useState } from 'react'
import type { PatrolSummary, PatrolBriefing, Anomaly } from '../lib/data'
import { fetchJson, filterAnomalies } from '../lib/data'
import { useI18n } from '../lib/i18n'
import { useCountUp } from '../lib/useCountUp'

interface Props {
  summary: PatrolSummary | null
  briefings: PatrolBriefing[]
  selected: number | null
  onSelect: (b: PatrolBriefing) => void
}

type FeedbackMap = Record<number, 'up' | 'down'>

function useFeedback(): [FeedbackMap, (id: number, v: 'up' | 'down') => void] {
  const [fb, setFb] = useState<FeedbackMap>({})
  useEffect(() => {
    try {
      setFb(JSON.parse(localStorage.getItem('prahari_patrol_feedback') ?? '{}'))
    } catch { /* fresh start */ }
  }, [])
  const record = (id: number, v: 'up' | 'down') => {
    setFb((prev) => {
      const next: FeedbackMap = { ...prev, [id]: v }
      if (prev[id] === v) delete next[id]
      localStorage.setItem('prahari_patrol_feedback', JSON.stringify(next))
      return next
    })
  }
  return [fb, record]
}

function Stat({ value, label, accent, animate }: { value: string; label: string; accent?: boolean; animate?: number }) {
  const counted = useCountUp(animate ?? 0)
  const display = animate != null
    ? value.replace(/[\d.]+/, () => {
        const decimals = (value.match(/\.(\d+)/) ?? [])[1]?.length ?? 0
        return counted.toFixed(decimals)
      })
    : value

  return (
    <div className={`flex-1 rounded-lg border px-2 py-1.5 text-center ${
      accent
        ? 'bg-emerald-500/10 border-emerald-400/40'
        : 'bg-slate-800/50 border-slate-700/40'
    }`}>
      <div className={`text-sm font-bold tabular-nums leading-tight ${accent ? 'text-emerald-300' : 'text-sky-300'}`}>
        {display}
      </div>
      <div className="text-[9px] uppercase tracking-wider text-slate-400 mt-0.5">{label}</div>
    </div>
  )
}

export default function BriefingPanel({ summary, briefings, selected, onSelect }: Props) {
  const [feedback, recordFeedback] = useFeedback()
  const [anomalies, setAnomalies] = useState<Anomaly[]>([])
  const { t, tc } = useI18n()

  useEffect(() => {
    fetchJson<Anomaly[]>('anomaly_feed.json')
      .then((a) => setAnomalies(filterAnomalies(a)))
      .catch(() => {})
  }, [])

  const deploymentRec = useMemo(() => {
    if (!summary || briefings.length === 0) return null
    const districtAnomalies = anomalies.filter((a) =>
      a.district.toUpperCase().includes(summary.scope_district.toUpperCase().split('_')[0])
    )
    const totalIncidents = briefings.reduce((s, b) => s + b.recent_incidents_30d, 0)
    const allCrimes = new Map<string, number>()
    for (const b of briefings) {
      for (const [crime, n] of Object.entries(b.top_crime_types)) {
        allCrimes.set(crime, (allCrimes.get(crime) ?? 0) + n)
      }
    }
    const topCrime = [...allCrimes.entries()].sort(([, a], [, b]) => b - a)[0]
    const heinousTotal = briefings.reduce((s, b) => s + (b.gravity_breakdown['Heinous'] ?? 0), 0)

    let rec = t('narr.deployBase')
      .replace('{n}', String(summary.n_patrols))
      .replace('{pct}', summary.greedy_coverage_pct.toFixed(1))
    if (topCrime) {
      rec += t('narr.deployFocus')
        .replace('{crime}', tc(topCrime[0]))
        .replace('{n}', String(topCrime[1]))
    }
    if (heinousTotal > 0) rec += t('narr.deployHeinous').replace('{n}', String(heinousTotal))
    if (districtAnomalies.length > 0) {
      rec += t('narr.deployAnoms').replace('{n}', String(districtAnomalies.length))
    }

    return { text: rec, totalIncidents, topCrime: topCrime?.[0] ?? '', heinousTotal }
  }, [summary, briefings, anomalies, t, tc])

  const uplift = summary
    ? `${(summary.greedy_uplift_vs_statusquo_x ?? summary.greedy_uplift_x)}x`
    : ''

  return (
    <div className="flex flex-col gap-3 min-h-0">
      {/* deployment recommendation */}
      {deploymentRec && (
        <div className="rounded-md border border-sky-400/25 bg-sky-500/8 px-2.5 py-2 shrink-0">
          <div className="text-[9px] uppercase tracking-wider text-sky-400/80 mb-1 font-semibold flex items-center gap-1.5">
            <svg viewBox="0 0 24 24" width="11" height="11" fill="none" aria-hidden>
              <path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8Z" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="12" cy="10" r="3" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            {t('act.recommendedDeployment')}
          </div>
          <div className="text-[10px] text-slate-300 leading-snug">{deploymentRec.text}</div>
        </div>
      )}

      {/* print-only header — visible only in @media print */}
      {summary && (
        <div className="hidden print:!block print:!visible mb-4 pb-3 border-b-2 border-black">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xl font-bold tracking-widest">PRAHARI</div>
              <div className="text-xs text-gray-600 mt-0.5">Crime Intelligence · Karnataka State Police</div>
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold">{summary.scope_district}</div>
              <div className="text-xs text-gray-500">
                {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
              </div>
            </div>
          </div>
          <div className="mt-2 text-sm">
            <span className="font-semibold">{summary.n_patrols} patrols</span>
            {' · '}
            <span>{summary.greedy_coverage_pct.toFixed(1)}% risk coverage</span>
            {' · '}
            <span className="font-bold">{uplift} coverage uplift vs status quo</span>
          </div>
        </div>
      )}

      {summary && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <div className="text-[10px] uppercase tracking-widest text-slate-400">
              {t('act.briefing')} — {summary.scope_district}
            </div>
            <button
              onClick={() => window.print()}
              className="text-[10px] px-2 py-0.5 rounded border border-slate-600/60 text-slate-300 hover:border-sky-400/50 hover:text-sky-300 transition-colors"
            >
              {t('act.printBriefing')}
            </button>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            <Stat value={`${summary.n_patrols}`} label={t('act.patrols')} animate={summary.n_patrols} />
            <Stat value={`${summary.greedy_coverage_pct.toFixed(1)}%`} label={t('act.riskCoverage')} animate={summary.greedy_coverage_pct} />
            <Stat
              value={`${(summary.greedy_coverage_pct / summary.n_patrols).toFixed(1)}%`}
              label={t('act.perPatrol')}
              animate={summary.greedy_coverage_pct / summary.n_patrols}
            />
            <Stat
              value={`${(summary.statusquo_coverage_pct ?? summary.baseline_coverage_pct).toFixed(1)}%`}
              label={t('act.statusQuo')}
              animate={summary.statusquo_coverage_pct ?? summary.baseline_coverage_pct}
            />
            <Stat
              value={`${summary.greedy_uplift_vs_statusquo_x ?? summary.greedy_uplift_x}x`}
              label={t('act.uplift')}
              accent
              animate={summary.greedy_uplift_vs_statusquo_x ?? summary.greedy_uplift_x}
            />
          </div>
          <div className="mt-1.5 text-[10.5px] text-slate-400">
            {summary.patrol_radius_km} km {t('act.beatRadius')}
            {summary.ilp_coverage_pct ? ` · ${t('act.ilpVerified')} (${summary.ilp_coverage_pct.toFixed(1)}%)` : ''}
          </div>
          <div className="mt-1 text-[9.5px] text-slate-500 leading-snug">
            {t('act.efficiencyNote')}
          </div>
        </div>
      )}

      <div className="flex flex-col min-h-0">
        <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-1.5">
          {t('act.briefing')}
        </div>
        <div className="overflow-y-auto min-h-0 flex flex-col gap-1 pr-1">
          {briefings.map((b) => {
            const isSel = b.patrol_id === selected
            const topCrimes = Object.entries(b.top_crime_types).slice(0, 3)
            const heinous = b.gravity_breakdown['Heinous'] ?? 0
            const fb = feedback[b.patrol_id]
            return (
              <div
                key={b.patrol_id}
                onClick={() => onSelect(b)}
                role="button"
                tabIndex={0}
                className={`cursor-pointer text-left rounded-md px-2.5 py-2 border transition-colors ${
                  isSel
                    ? 'bg-sky-500/15 border-sky-400/40'
                    : 'bg-slate-800/40 border-transparent hover:border-slate-600/60'
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs font-bold text-sky-300">{t('act.patrolUnit')} {b.patrol_id}</span>
                  <span className="flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-400 tabular-nums">
                      {b.recent_incidents_30d} / 30d
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); recordFeedback(b.patrol_id, 'up') }}
                      title={t('common.feedback.helpful')}
                      className={`leading-none p-1 rounded transition-colors ${
                        fb === 'up' ? 'bg-emerald-500/25 text-emerald-300' : 'text-slate-500 hover:text-emerald-300'
                      }`}
                    >
                      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" aria-hidden>
                        <path d="M7 10v9H4a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h3Zm0 0 4-7a2 2 0 0 1 2 2v3h5a2 2 0 0 1 2 2.3l-1.2 6A2 2 0 0 1 18 19H7" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); recordFeedback(b.patrol_id, 'down') }}
                      title={t('common.feedback.notHelpful')}
                      className={`leading-none p-1 rounded transition-colors ${
                        fb === 'down' ? 'bg-red-500/25 text-red-300' : 'text-slate-500 hover:text-red-300'
                      }`}
                    >
                      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" aria-hidden>
                        <path d="M17 14V5h3a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-3Zm0 0-4 7a2 2 0 0 1-2-2v-3H6a2 2 0 0 1-2-2.3l1.2-6A2 2 0 0 1 6 5h11" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </span>
                </div>
                <div className="mt-1 text-[10.5px] text-slate-400">
                  ({b.center_lat.toFixed(4)}, {b.center_lon.toFixed(4)}) · {b.cells_covered} cells
                  {heinous > 0 && (
                    <span className="ml-1.5 text-red-400/90">{heinous} {t('act.heinousCases')}</span>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {topCrimes.map(([type, n]) => (
                    <span
                      key={type}
                      className="text-[9.5px] px-1.5 py-0.5 rounded bg-slate-700/50 text-slate-300"
                    >
                      {tc(type)} · {n}
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import type { PatrolSummary, PatrolBriefing } from '../lib/data'

interface Props {
  summary: PatrolSummary | null
  briefings: PatrolBriefing[]
  selected: number | null
  onSelect: (b: PatrolBriefing) => void
}

// Human-in-the-loop: officer accept/reject per patrol suggestion.
// Demo build persists to localStorage; production writes to prediction_log.
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
      if (prev[id] === v) delete next[id] // toggle off
      localStorage.setItem('prahari_patrol_feedback', JSON.stringify(next))
      return next
    })
  }
  return [fb, record]
}

function Stat({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <div className={`flex-1 rounded-lg border px-2 py-1.5 text-center ${
      accent
        ? 'bg-emerald-500/10 border-emerald-400/40'
        : 'bg-slate-800/50 border-slate-700/40'
    }`}>
      <div className={`text-sm font-bold tabular-nums leading-tight ${accent ? 'text-emerald-300' : 'text-sky-300'}`}>
        {value}
      </div>
      <div className="text-[9px] uppercase tracking-wider text-slate-400 mt-0.5">{label}</div>
    </div>
  )
}

export default function BriefingPanel({ summary, briefings, selected, onSelect }: Props) {
  const [feedback, recordFeedback] = useFeedback()

  return (
    <div className="flex flex-col gap-3 min-h-0">
      {summary && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <div className="text-[10px] uppercase tracking-widest text-slate-400">
              Tonight&apos;s deployment — {summary.scope_district}
            </div>
            <button
              onClick={() => window.print()}
              className="text-[10px] px-2 py-0.5 rounded border border-slate-600/60 text-slate-300 hover:border-sky-400/50 hover:text-sky-300 transition-colors"
            >
              Print briefing
            </button>
          </div>
          <div className="flex gap-1.5">
            <Stat value={`${summary.n_patrols}`} label="patrols" />
            <Stat value={`${summary.greedy_coverage_pct.toFixed(1)}%`} label="risk covered" />
            <Stat
              value={`${(summary.statusquo_coverage_pct ?? summary.baseline_coverage_pct).toFixed(1)}%`}
              label="volume-driven"
            />
            <Stat value={`${summary.baseline_coverage_pct.toFixed(1)}%`} label="random" />
            <Stat
              value={`${summary.greedy_uplift_vs_statusquo_x ?? summary.greedy_uplift_x}x`}
              label="vs status quo"
              accent
            />
          </div>
          <div className="mt-1.5 text-[10.5px] text-slate-400">
            Maximal-coverage optimizer &middot; {summary.patrol_radius_km} km patrol radius
            {summary.ilp_coverage_pct ? ` · ILP verified (${summary.ilp_coverage_pct.toFixed(1)}%)` : ''}
            {' '}&middot; baselines: volume-driven (status quo) &amp; random
          </div>
        </div>
      )}

      <div className="flex flex-col min-h-0">
        <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-1.5">
          Shift briefing sheet
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
                  <span className="text-xs font-bold text-sky-300">Patrol {b.patrol_id}</span>
                  <span className="flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-400 tabular-nums">
                      {b.recent_incidents_30d} incidents / 30d
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); recordFeedback(b.patrol_id, 'up') }}
                      title="Officer feedback: accept suggestion"
                      className={`text-[11px] leading-none px-1 py-0.5 rounded ${
                        fb === 'up' ? 'bg-emerald-500/25 text-emerald-300' : 'text-slate-500 hover:text-emerald-300'
                      }`}
                    >
                      &#128077;
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); recordFeedback(b.patrol_id, 'down') }}
                      title="Officer feedback: reject suggestion"
                      className={`text-[11px] leading-none px-1 py-0.5 rounded ${
                        fb === 'down' ? 'bg-red-500/25 text-red-300' : 'text-slate-500 hover:text-red-300'
                      }`}
                    >
                      &#128078;
                    </button>
                  </span>
                </div>
                <div className="mt-1 text-[10.5px] text-slate-400">
                  ({b.center_lat.toFixed(4)}, {b.center_lon.toFixed(4)}) &middot; {b.cells_covered} cells
                  {heinous > 0 && (
                    <span className="ml-1.5 text-red-400/90">{heinous} heinous</span>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {topCrimes.map(([type, n]) => (
                    <span
                      key={type}
                      className="text-[9.5px] px-1.5 py-0.5 rounded bg-slate-700/50 text-slate-300"
                    >
                      {type} · {n}
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

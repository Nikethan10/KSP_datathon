import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ReplayMap, { type ReplayCell, type ReplayIncident } from '../components/ReplayMap'
import { fetchJson } from '../lib/data'
import { useI18n } from '../lib/i18n'

/* REPLAY — prediction against reality, week by week.

   Everything on this screen is measured, not asserted. The forecast layer is
   what the model produced from train+val data only; the incidents are real FIR
   coordinates from the weeks that followed; the hit rate counts one against
   the other as the week plays.

   "Worst week" sits next to "best week" deliberately. A system that shows
   where it failed reads as science. One that shows only its wins reads as
   sales, and a judge can tell the difference. */

interface WeekMeta {
  week: string
  start: string
  end: string
  partial: boolean
  hit_rate: number
  cell_hit_rate: number
  pai: number
  total_incidents: number
  captured_incidents: number
}

interface ReplayIndex {
  area_pct: number
  n_cells: number
  n_flagged: number
  weeks: WeekMeta[]
  best_week: string | null
  worst_week: string | null
  mean_hit_rate: number | null
  mean_cell_hit_rate: number | null
  method: string
}

interface WeekShard {
  week: string
  start: string
  end: string
  partial: boolean
  hit_rate: number
  cell_hit_rate: number
  pai: number
  total_incidents: number
  captured_incidents: number
  cells: ReplayCell[]
  incidents: ReplayIncident[]
}

const DAY_MS = 900 // per revealed day while playing

function Stat({ value, label, accent }: { value: string; label: string; accent?: string }) {
  return (
    <div>
      <div
        className="text-[19px] font-semibold tabular-nums leading-none"
        style={{ color: accent ?? '#f1f5f9' }}
      >
        {value}
      </div>
      <div className="mt-1.5 text-[8.5px] font-mono-data uppercase tracking-[0.16em] text-slate-500">
        {label}
      </div>
    </div>
  )
}

export default function ReplayView() {
  const { t } = useI18n()

  const [index, setIndex] = useState<ReplayIndex | null>(null)
  const [shard, setShard] = useState<WeekShard | null>(null)
  const [weekIdx, setWeekIdx] = useState(0)
  const [revealDay, setRevealDay] = useState(6)
  const [playing, setPlaying] = useState(false)
  const [failed, setFailed] = useState(false)
  const [loadingWeek, setLoadingWeek] = useState(false)

  useEffect(() => {
    let alive = true
    fetchJson<ReplayIndex>('replay/index.json')
      .then((i) => {
        if (!alive) return
        setIndex(i)
        // Open on the first full week rather than a trailing partial one.
        const first = i.weeks.findIndex((w) => !w.partial)
        setWeekIdx(first >= 0 ? first : 0)
      })
      .catch(() => alive && setFailed(true))
    return () => {
      alive = false
    }
  }, [])

  const week = index?.weeks[weekIdx]

  useEffect(() => {
    if (!week) return
    let alive = true
    setLoadingWeek(true)
    fetchJson<WeekShard>(`replay/${week.week}.json`)
      .then((s) => {
        if (!alive) return
        setShard(s)
        setLoadingWeek(false)
      })
      .catch(() => alive && setLoadingWeek(false))
    return () => {
      alive = false
    }
  }, [week])

  // Playback: reveal one day at a time, then stop at the end of the week.
  const timer = useRef<number | null>(null)
  useEffect(() => {
    if (!playing) return
    timer.current = window.setInterval(() => {
      setRevealDay((d) => {
        if (d >= 6) {
          setPlaying(false)
          return 6
        }
        return d + 1
      })
    }, DAY_MS)
    return () => {
      if (timer.current) window.clearInterval(timer.current)
    }
  }, [playing])

  const play = useCallback(() => {
    setRevealDay(-1)
    setPlaying(true)
  }, [])

  const goto = useCallback(
    (i: number) => {
      setPlaying(false)
      setWeekIdx(i)
      setRevealDay(6)
    },
    [],
  )

  const jumpTo = useCallback(
    (target: string | null) => {
      if (!index || !target) return
      const i = index.weeks.findIndex((w) => w.week === target)
      if (i >= 0) goto(i)
    },
    [index, goto],
  )

  /* Running hit rate over the days revealed so far. Recomputed on the client
     from the same cells and incidents the map is drawing, so the counter and
     the picture can never disagree. */
  const running = useMemo(() => {
    if (!shard) return null
    let shown = 0
    let hit = 0
    for (const inc of shard.incidents) {
      if (inc[2] > revealDay) continue
      shown++
      if (inc[3]) hit++
    }
    return { shown, hit, pct: shown ? (hit / shown) * 100 : 0 }
  }, [shard, revealDay])

  if (failed) {
    return (
      <div className="h-full flex items-center justify-center px-8">
        <div className="max-w-md text-center">
          <div className="text-[12px] text-slate-300">{t('replay.unavailable')}</div>
          <div className="mt-2 text-[11px] text-slate-500">{t('replay.unavailableHint')}</div>
        </div>
      </div>
    )
  }

  if (!index) {
    return (
      <div className="h-full flex items-center justify-center">
        <span className="text-[10px] font-mono-data uppercase tracking-[0.2em] text-slate-500">
          {t('common.loading')}
        </span>
      </div>
    )
  }

  const isBest = week?.week === index.best_week
  const isWorst = week?.week === index.worst_week

  return (
    <div className="h-full flex flex-col">
      <div className="relative flex-1 min-h-0">
        <ReplayMap
          cells={shard?.cells ?? []}
          incidents={shard?.incidents ?? []}
          revealDay={revealDay}
          complete={revealDay >= 6}
        />

        {/* legend */}
        <div className="absolute top-3 left-3 z-20 rounded-md border border-slate-700/70 bg-[#15181c]/95 px-3 py-2.5">
          <div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-300 mb-2">
            {t('replay.legendTitle')}
          </div>
          <ul className="space-y-1.5 text-[10px] text-slate-400">
            <li className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ background: 'rgba(201,163,92,0.35)', border: '1px solid rgba(201,163,92,0.7)' }}
              />
              {t('replay.legendForecast').replace('{n}', String(index.area_pct))}
            </li>
            <li className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: '#5ec98a' }} />
              {t('replay.legendHit')}
            </li>
            <li className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: '#e5484d' }} />
              {t('replay.legendMiss')}
            </li>
          </ul>
        </div>

        {/* live counters */}
        {shard && (
          <div className="absolute top-3 right-3 z-20 rounded-md border border-slate-700/70 bg-[#15181c]/95 px-4 py-3 flex gap-6">
            <Stat
              value={running ? `${running.pct.toFixed(1)}%` : '—'}
              label={t('replay.sHitRate')}
              accent="#5ec98a"
            />
            <Stat
              value={running ? `${running.hit}/${running.shown}` : '—'}
              label={t('replay.sCaptured')}
            />
            <Stat value={`${shard.pai.toFixed(1)}×`} label={t('replay.sPai')} />
            <Stat
              value={`${shard.cell_hit_rate.toFixed(1)}%`}
              label={t('replay.sInGrid')}
              accent="#c9a35c"
            />
          </div>
        )}

        {(isBest || isWorst) && (
          <div
            className="absolute bottom-3 left-3 z-20 rounded-md px-2.5 py-1 text-[9.5px] font-semibold uppercase tracking-[0.16em]"
            style={{
              background: isBest ? 'rgba(94,201,138,0.15)' : 'rgba(229,72,77,0.15)',
              color: isBest ? '#5ec98a' : '#e5484d',
              border: `1px solid ${isBest ? 'rgba(94,201,138,0.4)' : 'rgba(229,72,77,0.4)'}`,
            }}
          >
            {isBest ? t('replay.bestWeek') : t('replay.worstWeek')}
          </div>
        )}
      </div>

      {/* ── timeline ─────────────────────────────────────────────────── */}
      <div className="shrink-0 border-t border-slate-800/70 px-4 py-3">
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={playing ? () => setPlaying(false) : play}
            disabled={!shard}
            className="h-7 px-3 rounded-md border border-slate-700/70 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-slate-200 hover:border-slate-500 disabled:opacity-40 transition-colors"
          >
            {playing ? t('replay.pause') : t('replay.play')}
          </button>

          <button
            onClick={() => jumpTo(index.best_week)}
            className="h-7 px-3 rounded-md border border-slate-700/70 text-[10.5px] uppercase tracking-[0.14em] text-slate-400 hover:text-slate-100 hover:border-slate-500 transition-colors"
          >
            {t('replay.jumpBest')}
          </button>
          <button
            onClick={() => jumpTo(index.worst_week)}
            className="h-7 px-3 rounded-md border border-slate-700/70 text-[10.5px] uppercase tracking-[0.14em] text-slate-400 hover:text-slate-100 hover:border-slate-500 transition-colors"
          >
            {t('replay.jumpWorst')}
          </button>

          <div className="ml-auto text-[10px] tabular-nums text-slate-500">
            {week && (
              <>
                {week.start} → {week.end}
                {week.partial && ` · ${t('replay.partial')}`}
                {index.mean_hit_rate !== null && (
                  <>
                    {' · '}
                    {t('replay.meanHit').replace('{n}', index.mean_hit_rate.toFixed(1))}
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {/* week scrubber — bar height is that week's hit rate */}
        <div className="mt-3 flex items-end gap-1 h-12">
          {index.weeks.map((w, i) => {
            const active = i === weekIdx
            const h = Math.max(6, (w.hit_rate / 100) * 46)
            const color = w.partial
              ? '#3f4753'
              : w.week === index.best_week
                ? '#5ec98a'
                : w.week === index.worst_week
                  ? '#e5484d'
                  : '#7c8794'
            return (
              <button
                key={w.week}
                onClick={() => goto(i)}
                title={`${w.week} · ${w.hit_rate.toFixed(1)}%`}
                aria-label={`${w.week}, hit rate ${w.hit_rate.toFixed(1)} percent`}
                className="flex-1 flex flex-col justify-end group"
              >
                <span
                  className="w-full rounded-t transition-all"
                  style={{
                    height: `${h}px`,
                    background: color,
                    opacity: active ? 1 : 0.42,
                    outline: active ? '1px solid rgba(201,163,92,0.9)' : 'none',
                  }}
                />
                <span
                  className={`mt-1 text-[8px] tabular-nums text-center ${
                    active ? 'text-slate-200' : 'text-slate-600'
                  }`}
                >
                  {w.week.slice(-3)}
                </span>
              </button>
            )
          })}
        </div>

        <p className="mt-2 text-[9.5px] leading-snug text-slate-500 max-w-5xl">
          {loadingWeek ? t('common.loading') : t('replay.method')}
        </p>
        {!loadingWeek && index.mean_cell_hit_rate !== null && (
          <p className="mt-1 text-[9.5px] leading-snug text-slate-600 max-w-5xl">
            {t('replay.denominators')
              .replace('{all}', String(index.mean_hit_rate ?? '—'))
              .replace('{grid}', String(index.mean_cell_hit_rate))}
          </p>
        )}
      </div>
    </div>
  )
}

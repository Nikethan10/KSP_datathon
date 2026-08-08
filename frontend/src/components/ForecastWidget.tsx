import type { ForecastItem } from '../lib/insights'
import { useI18n } from '../lib/i18n'

interface Props {
  items: ForecastItem[]
}

const DIR: Record<ForecastItem['direction'], { arrow: string; color: string }> = {
  up: { arrow: '↑', color: '#ef4444' },
  down: { arrow: '↓', color: '#22c55e' },
  stable: { arrow: '→', color: '#f59e0b' },
}

const sign = (n: number) => `${n >= 0 ? '+' : ''}${Math.round(n)}`

export default function ForecastWidget({ items }: Props) {
  const { t, tc } = useI18n()
  if (items.length === 0) return null

  // Bars are scaled to the largest departure in view, so the width encodes
  // magnitude relative to its peers rather than a fabricated percentage.
  const peak = Math.max(...items.map((i) => Math.abs(i.excess)), 1)

  return (
    <div className="shrink-0">
      <div className="text-[9.5px] uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
        <svg viewBox="0 0 24 24" width="11" height="11" fill="none" aria-hidden>
          <path
            d="M3 17l6-6 4 4 8-8"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {t('forecast.title')}
      </div>

      <div className="flex flex-col gap-1">
        {items.map((item) => {
          const { arrow, color } = DIR[item.direction]
          return (
            <div
              key={item.crimeType}
              className="flex items-center gap-2 text-[10px]"
              title={item.detail}
            >
              <span className="font-bold text-sm" style={{ color }} aria-hidden>
                {arrow}
              </span>
              <span className="text-slate-300 truncate flex-1 min-w-0">
                {tc(item.crimeType).replace('Crimes Against ', '')}
              </span>
              <div className="w-16 h-1.5 rounded bg-slate-700/50 overflow-hidden shrink-0">
                <div
                  className="h-full rounded"
                  style={{
                    width: `${Math.min(100, (Math.abs(item.excess) / peak) * 100)}%`,
                    background: color,
                  }}
                />
              </div>
              <span className="text-slate-500 tabular-nums w-9 text-right shrink-0">
                {sign(item.excess)}
              </span>
            </div>
          )
        })}
      </div>

      <div className="mt-1 text-[9.5px] text-slate-500 leading-snug">
        {t('forecast.note')}
      </div>
    </div>
  )
}

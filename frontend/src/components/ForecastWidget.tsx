import type { ForecastItem } from '../lib/insights'

interface Props {
  items: ForecastItem[]
}

const DIR_ICON: Record<string, { arrow: string; color: string }> = {
  up: { arrow: '↑', color: '#ef4444' },
  down: { arrow: '↓', color: '#22c55e' },
  stable: { arrow: '→', color: '#f59e0b' },
}

export default function ForecastWidget({ items }: Props) {
  if (items.length === 0) return null

  return (
    <div>
      <div className="text-[9.5px] uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
        <svg viewBox="0 0 24 24" width="11" height="11" fill="none" aria-hidden>
          <path d="M3 17l6-6 4 4 8-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        7-Day Crime Forecast
      </div>
      <div className="flex flex-col gap-1">
        {items.map((item) => {
          const { arrow, color } = DIR_ICON[item.direction]
          return (
            <div key={item.crimeType} className="flex items-center gap-2 text-[10px]">
              <span className="font-bold text-sm" style={{ color }}>{arrow}</span>
              <span className="text-slate-300 truncate flex-1 min-w-0">
                {item.crimeType.replace('Crimes Against ', '')}
              </span>
              <div className="w-16 h-1.5 rounded bg-slate-700/50 overflow-hidden shrink-0">
                <div
                  className="h-full rounded"
                  style={{ width: `${item.confidence}%`, background: color }}
                />
              </div>
              <span className="text-slate-500 tabular-nums w-7 text-right shrink-0">
                {item.confidence}%
              </span>
            </div>
          )
        })}
      </div>
      <div className="mt-1 text-[8.5px] text-slate-500">
        Based on anomaly detection and trend analysis
      </div>
    </div>
  )
}

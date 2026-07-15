import type { Anomaly } from '../lib/data'

interface Props {
  anomalies: Anomaly[]
  onSelect: (a: Anomaly) => void
}

export default function AnomalyFeed({ anomalies, onSelect }: Props) {
  // an alert feed reads newest-first; spikes before drops, severity breaks ties
  const sorted = [...anomalies].sort((a, b) => {
    const spikeA = a.observed > a.expected ? 1 : 0
    const spikeB = b.observed > b.expected ? 1 : 0
    if (spikeA !== spikeB) return spikeB - spikeA
    const dateCmp = b.date.localeCompare(a.date)
    if (dateCmp !== 0) return dateCmp
    return Math.abs(b.zscore) - Math.abs(a.zscore)
  })

  return (
    <div className="flex flex-col min-h-0">
      <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-1.5">
        Anomaly alerts — newest first · STL residual z-score
      </div>
      <div className="overflow-y-auto min-h-0 flex flex-col gap-1 pr-1">
        {sorted.map((a, i) => {
          const isSpike = a.observed > a.expected
          const date = a.date.slice(0, 10)
          return (
            <button
              key={i}
              onClick={() => onSelect(a)}
              className="text-left rounded-md px-2.5 py-2 bg-slate-800/40 border border-transparent hover:border-slate-600/60 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span
                  className={`shrink-0 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                    isSpike
                      ? 'bg-red-500/20 text-red-300'
                      : 'bg-sky-500/15 text-sky-300'
                  }`}
                >
                  {isSpike ? 'spike' : 'drop'}
                </span>
                <span className="text-xs font-semibold text-slate-200 truncate">
                  {a.crime_type}
                </span>
                <span className="ml-auto shrink-0 text-[10px] text-slate-500 tabular-nums">
                  {date}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between text-[10.5px] text-slate-400">
                <span className="truncate">{a.district}</span>
                <span className="shrink-0 ml-2 tabular-nums">
                  {a.observed} vs {a.expected.toFixed(1)} exp · z {a.zscore.toFixed(1)}
                </span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

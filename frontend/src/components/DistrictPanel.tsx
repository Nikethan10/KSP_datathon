import type { DistrictSummary } from '../lib/data'

interface Props {
  districts: DistrictSummary[]
  selected: string | null
  onSelect: (d: DistrictSummary) => void
}

export default function DistrictPanel({ districts, selected, onSelect }: Props) {
  const total = districts.reduce((s, d) => s + d.total_cases, 0)
  const sorted = [...districts].sort((a, b) => b.total_cases - a.total_cases)

  return (
    <div className="flex flex-col min-h-0">
      <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-1.5">
        Districts — ranked by case volume
      </div>
      <div className="overflow-y-auto min-h-0 flex flex-col gap-1 pr-1">
        {sorted.map((d, i) => {
          const share = (d.total_cases / total) * 100
          const isSel = d.district === selected
          return (
            <button
              key={d.district}
              onClick={() => onSelect(d)}
              className={`text-left rounded-md px-2.5 py-2 border transition-colors ${
                isSel
                  ? 'bg-sky-500/15 border-sky-400/40'
                  : 'bg-slate-800/40 border-transparent hover:border-slate-600/60'
              }`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-semibold text-slate-200 truncate">
                  <span className="text-slate-500 font-normal mr-1.5">{i + 1}</span>
                  {d.district}
                </span>
                <span className="text-xs text-sky-300 tabular-nums shrink-0">
                  {d.total_cases.toLocaleString()}
                </span>
              </div>
              <div className="mt-1 h-1 rounded bg-slate-700/50 overflow-hidden">
                <div
                  className="h-full bg-sky-400/70"
                  style={{ width: `${Math.max(1.5, share)}%` }}
                />
              </div>
              <div className="mt-1 flex justify-between text-[10px] text-slate-400">
                <span className="truncate">{d.top_crime_type}</span>
                <span className="shrink-0 ml-2">
                  {d.heinous_pct.toFixed(0)}% heinous
                </span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

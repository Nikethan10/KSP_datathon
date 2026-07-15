import type { DistrictSummary } from '../lib/data'
import { useI18n } from '../lib/i18n'

interface Props {
  districts: DistrictSummary[]
  selected: string | null
  onSelect: (d: DistrictSummary) => void
}

export default function DistrictPanel({ districts, selected, onSelect }: Props) {
  const { t, td, tc } = useI18n()
  const total = districts.reduce((s, d) => s + d.total_cases, 0)
  const sorted = [...districts].sort((a, b) => b.total_cases - a.total_cases)
  const max = sorted[0]?.total_cases ?? 1

  return (
    <div className="flex flex-col min-h-0">
      <div className="mb-1.5">
        <div className="text-[10px] uppercase tracking-widest text-slate-400">
          {t('sense.districts')}
        </div>
        <div className="text-[9.5px] text-slate-500">{t('sense.rankedByFirs')}</div>
      </div>
      <div className="overflow-y-auto min-h-0 flex flex-col gap-0.5 pr-1">
        {sorted.map((d, i) => {
          const share = (d.total_cases / total) * 100
          const barW = (d.total_cases / max) * 100
          const isSel = d.district === selected
          return (
            <button
              key={d.district}
              onClick={() => onSelect(d)}
              className={`text-left rounded-md px-2.5 py-1.5 border transition-colors ${
                isSel
                  ? 'bg-sky-500/15 border-sky-400/40'
                  : 'border-transparent hover:bg-slate-800/50'
              }`}
            >
              {/* one clean line: rank · district · count · share */}
              <div className="flex items-baseline gap-2">
                <span className="text-[10px] text-slate-500 tabular-nums w-4 shrink-0 text-right">{i + 1}</span>
                <span className="text-xs font-semibold text-slate-200 truncate flex-1">
                  {td(d.district)}
                </span>
                <span className="text-xs text-sky-300 tabular-nums shrink-0">
                  {d.total_cases.toLocaleString()}
                </span>
                <span className="text-[10px] text-slate-500 tabular-nums shrink-0 w-9 text-right">
                  {share.toFixed(1)}%
                </span>
              </div>
              <div className="mt-1 ml-6 h-1 rounded bg-slate-700/40 overflow-hidden">
                <div
                  className={`h-full ${isSel ? 'bg-sky-400' : 'bg-sky-400/45'}`}
                  style={{ width: `${Math.max(2, barW)}%` }}
                />
              </div>
              {/* details only for the selected district — keeps the list scannable */}
              {isSel && (
                <div className="mt-1.5 ml-6 flex items-center gap-3 text-[10px] text-slate-400">
                  <span className="truncate">
                    <span className="text-slate-500">{t('sense.topCrime')}: </span>
                    {tc(d.top_crime_type)}
                  </span>
                  <span className="shrink-0 text-red-400/90">
                    {d.heinous_pct.toFixed(0)}% {t('sense.heinous')}
                  </span>
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

import type { SpreeData, CorridorData, Spree } from '../lib/data'
import { useI18n } from '../lib/i18n'

interface Props {
  spreeData: SpreeData | null
  corridorData: CorridorData | null
  selectedSpree: number | null
  onSelectSpree: (s: Spree) => void
}

export default function PatternsPanel({
  spreeData, corridorData, selectedSpree, onSelectSpree,
}: Props) {
  const { t, td, tc } = useI18n()
  const cs = corridorData?.summary

  return (
    <div className="flex flex-col gap-3 min-h-0 overflow-y-auto pr-1">
      {cs && (
        <div>
          <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-1.5">
            {t('patterns.corridors')}
          </div>
          <div className="flex gap-1.5 mb-2">
            <div className="flex-1 rounded-lg bg-slate-800/50 border border-slate-700/40 px-2 py-1.5 text-center">
              <div className="text-sm font-bold text-fuchsia-300 tabular-nums">
                {cs.multi_district_offenders.toLocaleString()}
              </div>
              <div className="text-[9px] uppercase tracking-wider text-slate-400 mt-0.5">
                {t('patterns.multiDistrict')}
              </div>
            </div>
            <div className="flex-1 rounded-lg bg-slate-800/50 border border-slate-700/40 px-2 py-1.5 text-center">
              <div className="text-sm font-bold text-sky-300 tabular-nums">
                {cs.multi_district_pct}%
              </div>
              <div className="text-[9px] uppercase tracking-wider text-slate-400 mt-0.5">
                {t('patterns.ofAllOffenders')}
              </div>
            </div>
          </div>
          <div className="text-[10px] text-slate-500 mb-2">{t('patterns.corridorsMethod')}</div>
          <div className="flex flex-col gap-1">
            {corridorData!.corridors.slice(0, 8).map((c, i) => (
              <div
                key={i}
                className="rounded-md bg-slate-800/40 px-2.5 py-1.5 text-[10.5px] text-slate-300 flex items-center justify-between gap-2"
              >
                <span className="truncate">
                  {td(c.from_district)} ↔ {td(c.to_district)}
                </span>
                <span className="shrink-0 text-fuchsia-300 tabular-nums font-semibold">
                  {c.n_offenders} {t('patterns.offenders')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {spreeData && (
        <div>
          <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-1.5">
            {t('patterns.sprees')} ({spreeData.sprees.length})
          </div>
          <div className="text-[10px] text-slate-500 mb-2">{t('patterns.spreesMethod')}</div>
          <div className="flex flex-col gap-1">
            {spreeData.sprees.map((s) => {
              const isSel = s.spree_id === selectedSpree
              return (
                <div
                  key={s.spree_id}
                  onClick={() => onSelectSpree(s)}
                  role="button"
                  tabIndex={0}
                  className={`cursor-pointer rounded-md px-2.5 py-2 border transition-colors ${
                    isSel
                      ? 'bg-orange-500/15 border-orange-400/40'
                      : 'bg-slate-800/40 border-transparent hover:border-slate-600/60'
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs font-bold text-orange-300">
                      {t('patterns.spree')} #{s.spree_id}
                    </span>
                    <span className="text-[10px] text-slate-400 tabular-nums">
                      {s.n_cases} {t('patterns.cases')} · {s.span_days} {t('patterns.days')}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[10.5px] text-slate-400">
                    {tc(s.crime_type)} · {td(s.district)}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {s.start_date} → {s.end_date}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {corridorData && corridorData.top_offenders.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-1.5">
            {t('patterns.topMobile')}
          </div>
          <div className="flex flex-col gap-1">
            {corridorData.top_offenders.slice(0, 5).map((o) => (
              <div
                key={o.offender_id}
                className="rounded-md bg-slate-800/40 px-2.5 py-1.5 text-[10.5px] text-slate-300 flex items-center justify-between gap-2"
              >
                <span className="truncate">{o.name}</span>
                <span className="shrink-0 text-slate-400 tabular-nums">
                  {o.n_districts} {t('patterns.districts')} · {o.n_cases} {t('patterns.cases')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

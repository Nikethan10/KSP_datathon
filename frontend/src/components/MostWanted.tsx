import type { OffenderDossier } from '../lib/data'
import { THREAT_COLORS } from '../lib/data'
import { useI18n } from '../lib/i18n'

interface Props {
  offenders: OffenderDossier[]
  onSelect: (d: OffenderDossier) => void
}

export default function MostWanted({ offenders, onSelect }: Props) {
  const { t, tc } = useI18n()

  return (
    <div className="flex flex-col min-h-0">
      <div className="mb-1.5">
        <div className="text-[10px] uppercase tracking-widest text-slate-400">{t('war.mostWanted')}</div>
        <div className="text-[9.5px] text-slate-500">{t('war.wantedNote')}</div>
      </div>
      <div className="overflow-y-auto min-h-0 flex flex-col gap-1 pr-1">
        {offenders.map((d) => {
          const tier = d.threat_tier
          const color = tier ? THREAT_COLORS[tier] : '#8aa0b8'
          const initials = d.name.split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase()
          return (
            <button
              key={d.offender_id}
              onClick={() => onSelect(d)}
              className="text-left rounded-md px-2 py-1.5 bg-slate-800/40 border border-transparent hover:border-slate-600/60 hover:bg-slate-700/40 transition-colors flex items-center gap-2.5"
            >
              <span className="text-[11px] font-bold text-slate-500 tabular-nums w-5 text-right shrink-0">{d.wanted_rank}</span>
              {/* mugshot */}
              <span
                className="relative w-9 h-9 shrink-0 rounded grid place-items-center overflow-hidden"
                style={{ background: `linear-gradient(160deg, ${color}22, rgba(9,13,20,0.5))`, border: `1px solid ${color}55` }}
              >
                <svg viewBox="0 0 24 24" width="22" height="22" className="opacity-30" style={{ color }} aria-hidden>
                  <circle cx="12" cy="8" r="4" fill="currentColor" />
                  <path d="M4 20c0-4 3.6-6.5 8-6.5S20 16 20 20" fill="currentColor" />
                </svg>
                <span className="absolute bottom-0 right-0.5 text-[7px] font-bold" style={{ color }}>{initials}</span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-slate-200 truncate">{d.name}</span>
                  {tier && (
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
                  )}
                </span>
                <span className="flex items-center gap-2 text-[9.5px] text-slate-500 mt-0.5">
                  <span className="text-slate-400 tabular-nums">{d.total_cases}</span> {t('war.cases')}
                  <span className="truncate">· {tc(d.top_crime)}</span>
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block text-[11px] font-bold tabular-nums" style={{ color }}>{d.wanted_score.toFixed(0)}</span>
                <span className="block text-[8px] uppercase tracking-wider text-slate-500">{d.n_districts} {t('war.districts')}</span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

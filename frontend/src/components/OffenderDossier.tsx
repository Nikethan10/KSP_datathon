import type { OffenderDossier as Dossier } from '../lib/data'
import { THREAT_COLORS } from '../lib/data'
import { useI18n } from '../lib/i18n'

interface Props {
  dossier: Dossier
  onBack: () => void
  onSelectAssociate: (offenderId: string) => void
  hideBack?: boolean
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const [y, m] = iso.split('-')
  const mi = Number(m) - 1
  return mi >= 0 && mi < 12 ? `${MONTHS[mi]} ${y}` : iso
}

// silhouette "mugshot" avatar with a tier-colored ring
function Avatar({ color, initials }: { color: string; initials: string }) {
  return (
    <div
      className="relative w-14 h-14 shrink-0 rounded-lg grid place-items-center overflow-hidden"
      style={{ background: `linear-gradient(160deg, ${color}22, rgba(9,13,20,0.6))`, border: `1px solid ${color}66` }}
    >
      <svg viewBox="0 0 24 24" width="34" height="34" className="opacity-30" style={{ color }} aria-hidden>
        <circle cx="12" cy="8" r="4" fill="currentColor" />
        <path d="M4 20c0-4 3.6-6.5 8-6.5S20 16 20 20" fill="currentColor" />
      </svg>
      <span className="absolute bottom-0.5 right-1 text-[9px] font-bold tabular-nums" style={{ color }}>
        {initials}
      </span>
    </div>
  )
}

function StatCell({ value, label, accent }: { value: string; label: string; accent?: string }) {
  return (
    <div className="flex-1 rounded-lg bg-slate-800/50 border border-slate-700/40 px-2 py-1.5 text-center">
      <div className="text-base font-bold tabular-nums leading-tight" style={{ color: accent ?? '#c9a35c' }}>{value}</div>
      <div className="text-[9.5px] uppercase tracking-wider text-slate-400 mt-0.5">{label}</div>
    </div>
  )
}

export default function OffenderDossier({ dossier: d, onBack, onSelectAssociate, hideBack }: Props) {
  const { t, tc, td } = useI18n()
  const tier = d.threat_tier
  const color = tier ? THREAT_COLORS[tier] : '#8aa0b8'
  const initials = d.name.split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase()
  const maxCt = d.crime_types[0]?.count ?? 1

  return (
    <div className="flex flex-col gap-3 min-h-0 overflow-y-auto pr-1">
      {/* back + case-file tag */}
      {!hideBack && (
        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 transition-colors"
          >
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" aria-hidden>
              <path d="M14 6l-6 6 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {t('war.back')}
          </button>
          <span className="text-[9px] uppercase tracking-[0.2em] text-slate-500">{t('war.dossier')}</span>
        </div>
      )}

      {/* header */}
      <div className="flex items-start gap-3">
        <Avatar color={color} initials={initials} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-base font-bold text-slate-100 leading-tight">{d.name}</span>
            {tier && (
              <span
                className="text-[9.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                style={{ background: `${color}22`, color }}
              >
                {t(`threat.${tier}`)}
              </span>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-[10px] text-slate-500 font-mono-data">
            <span>#{d.offender_id.slice(0, 8).toUpperCase()}</span>
            {d.age != null && <span>· {t('war.age')} {d.age}</span>}

          </div>
        </div>
      </div>

      {/* stat row */}
      <div className="flex gap-1.5">
        <StatCell value={d.total_cases.toLocaleString()} label={t('war.cases')} />
        <StatCell value={d.arrest_records.toLocaleString()} label={t('war.arrestRecords')} accent="#f4a5a8" />
        <StatCell value={String(d.n_districts)} label={t('war.districts')} />
        <StatCell value={d.career_years.toFixed(1)} label={t('war.years')} accent="#a5d6c1" />
      </div>

      {/* crime profile */}
      <div>
        <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-1.5 flex items-center justify-between">
          <span>{t('war.crimeProfile')}</span>
          <span className="text-red-400/90 normal-case tracking-normal">{d.heinous_pct.toFixed(0)}% {t('war.heinousShare')}</span>
        </div>
        <div className="flex flex-col gap-1">
          {d.crime_types.map((c) => (
            <div key={c.type} className="flex items-center gap-2">
              <span className="w-40 shrink-0 text-[10.5px] text-slate-300 truncate">{tc(c.type)}</span>
              <div className="flex-1 h-2 rounded bg-slate-700/40 overflow-hidden">
                <div className="h-full rounded" style={{ width: `${(c.count / maxCt) * 100}%`, background: color }} />
              </div>
              <span className="w-5 text-right text-[10px] text-slate-500 tabular-nums">{c.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* operating area */}
      <div>
        <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-1.5">{t('war.operatingArea')}</div>
        <div className="flex flex-wrap gap-1">
          {d.districts.map((dd) => (
            <span key={dd.district} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800/60 border border-slate-700/50 text-slate-300">
              {td(dd.district)} <span className="text-slate-500 tabular-nums">{dd.count}</span>
            </span>
          ))}
        </div>
      </div>

      {/* criminal career */}
      <div>
        <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-1.5">{t('war.career')}</div>
        <div className="flex items-center gap-2 text-[10.5px]">
          <span className="text-slate-300 font-mono-data">{fmtDate(d.first_incident)}</span>
          <div className="flex-1 h-[3px] rounded bg-slate-600" />
          <span className="text-slate-300 font-mono-data">{fmtDate(d.last_incident)}</span>
        </div>
        {d.last_arrest && (
          <div className="mt-1 text-[10px] text-slate-500">
            {t('war.lastArrest')}: <span className="text-slate-400 font-mono-data">{fmtDate(d.last_arrest)}</span>
          </div>
        )}
      </div>

      {/* gang affiliation */}
      <div>
        <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-1.5">{t('war.gangAffiliation')}</div>
        {d.gang_rank ? (
          <div className="rounded-lg bg-slate-800/50 border px-2.5 py-2" style={{ borderColor: `${color}44` }}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-200">
                {t('predict.gangs')} #{d.gang_rank}
                {tier && <span className="ml-1.5 text-[10px]" style={{ color }}>· {t(`threat.${tier}`)}</span>}
              </span>
              {d.is_articulation && (
                <span className="text-[9.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300">
                  ◆ {t('war.keyPlayer')}
                </span>
              )}
            </div>
            {d.is_articulation && (
              <div className="mt-1 text-[9.5px] text-slate-500">{t('war.keyPlayerNote')}</div>
            )}
          </div>
        ) : (
          <div className="text-[10.5px] text-slate-500 italic">{t('war.solo')}</div>
        )}
      </div>

      {/* known associates */}
      <div>
        <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-1.5">
          {t('war.knownAssociates')}
          {d.n_associates > d.associates.length && (
            <span className="ml-1 text-slate-500 normal-case tracking-normal">({d.n_associates})</span>
          )}
        </div>
        {d.associates.length === 0 ? (
          <div className="text-[10.5px] text-slate-500 italic">{t('war.noAssociates')}</div>
        ) : (
          <div className="flex flex-col gap-1">
            {d.associates.map((a) => (
              <button
                key={a.offender_id}
                onClick={() => onSelectAssociate(a.offender_id)}
                className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 bg-slate-800/40 hover:bg-slate-700/50 border border-transparent hover:border-slate-600/60 transition-colors text-left"
              >
                <span className="flex items-center gap-1.5 min-w-0">
                  <svg viewBox="0 0 24 24" width="12" height="12" className="text-slate-500 shrink-0" aria-hidden>
                    <circle cx="12" cy="8" r="3.4" fill="currentColor" />
                    <path d="M5 20c0-3.6 3.1-5.5 7-5.5s7 1.9 7 5.5" fill="currentColor" />
                  </svg>
                  <span className="text-[11px] text-slate-300 truncate">{a.name}</span>
                </span>
                <span className="text-[9.5px] text-slate-500 tabular-nums shrink-0">
                  {a.shared_cases} {t('war.sharedCases')}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

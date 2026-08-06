import type { HotspotScope } from '../lib/data'
import { useI18n } from '../lib/i18n'

interface Props {
  crimeTypes: string[]
  crimeType: string | null
  onCrimeType: (t: string | null) => void
  scope: HotspotScope
  onScope: (s: HotspotScope) => void
  demographics: boolean
  onDemographics: (v: boolean) => void
}

export default function FilterBar({
  crimeTypes, crimeType, onCrimeType,
  scope, onScope,
  demographics, onDemographics,
}: Props) {
  const { t, tc, tcg } = useI18n()
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <select
        value={crimeType ?? ''}
        onChange={(e) => onCrimeType(e.target.value || null)}
        className="glass rounded-md px-3 py-1.5 text-xs text-slate-200 outline-none cursor-pointer max-w-56 disabled:opacity-40"
      >
        <option value="">{t('sense.allCrimes')}</option>
        {crimeTypes.map((ct) => (
          <option key={ct} value={ct} title={tcg(ct)}>{tc(ct)}</option>
        ))}
      </select>
      <div
        className="glass rounded-md flex overflow-hidden"
        title={t('sense.scopeTooltip')}
      >
        {(['state', 'district'] as HotspotScope[]).map((s) => (
          <button
            key={s}
            onClick={() => onScope(s)}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              scope === s
                ? 'bg-sky-500/25 text-sky-300'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {s === 'state' ? t('sense.stateView') : t('sense.districtView')}
          </button>
        ))}
      </div>
      <button
        onClick={() => onDemographics(!demographics)}
        className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors border flex items-center gap-1.5 ${
          demographics
            ? 'bg-amber-500/20 border-amber-400/50 text-amber-300'
            : 'bg-transparent border-slate-600/50 text-slate-400 hover:border-amber-400/40 hover:text-amber-300'
        }`}
      >
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" aria-hidden>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        {t('socio.demographics')}
      </button>
    </div>
  )
}

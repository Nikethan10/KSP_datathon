import { SIG_COLORS, SIG_LABELS, EMERGING_COLORS } from '../lib/data'
import type { Significance, EmergingCategory } from '../lib/data'
import { useI18n } from '../lib/i18n'

const ORDER: Significance[] = ['hot_99', 'hot_95', 'hot_90', 'not_sig', 'cold_90', 'cold_95', 'cold_99']
const EMERGING_ORDER: EmergingCategory[] = ['new', 'intensifying', 'persistent', 'cooling']

export default function Legend({ emerging = false }: { emerging?: boolean }) {
  const { t } = useI18n()

  if (emerging) {
    return (
      <div className="glass rounded-lg px-3 py-2.5">
        <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-1.5">
          {t('sense.lifecycleTitle')}
        </div>
        <div className="flex flex-col gap-1">
          {EMERGING_ORDER.map((c) => {
            const [r, g, b] = EMERGING_COLORS[c]
            return (
              <div key={c} className="flex items-center gap-2 text-[11px] text-slate-300">
                <span
                  className="inline-block w-3 h-3 rounded-full"
                  style={{ background: `rgb(${r},${g},${b})` }}
                />
                {t(`emerging.${c}`)}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="glass rounded-lg px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-1.5">
        Getis-Ord Gi* significance
      </div>
      <div className="flex flex-col gap-1">
        {ORDER.map((s) => {
          const [r, g, b] = SIG_COLORS[s]
          return (
            <div key={s} className="flex items-center gap-2 text-[11px] text-slate-300">
              <span
                className="inline-block w-3 h-3 rounded-sm"
                style={{ background: `rgb(${r},${g},${b})` }}
              />
              {SIG_LABELS[s]}
            </div>
          )
        })}
      </div>
    </div>
  )
}

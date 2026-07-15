import { EMERGING_COLORS } from '../lib/data'
import { useI18n } from '../lib/i18n'
import type { EmergingCell, EmergingCategory } from '../lib/data'

interface Props {
  cells: EmergingCell[]
  onSelect: (c: EmergingCell) => void
}

const rgba = (c: [number, number, number, number]) => `rgba(${c[0]},${c[1]},${c[2]},1)`
// surface the areas an SP should act on first: brand-new + intensifying
const ACTIONABLE: EmergingCategory[] = ['new', 'intensifying']

export default function EmergingPanel({ cells, onSelect }: Props) {
  const { t, td } = useI18n()

  const ranked = cells
    .filter((c) => ACTIONABLE.includes(c.category))
    .sort((a, b) => {
      // new before intensifying, then by how hot it is right now
      if (a.category !== b.category) return a.category === 'new' ? -1 : 1
      return b.recent_monthly - a.recent_monthly
    })
    .slice(0, 12)

  return (
    <div className="flex flex-col min-h-0">
      <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-1.5">
        {t('emerging.topAreas')} ({ranked.length})
      </div>
      <div className="overflow-y-auto min-h-0 flex flex-col gap-1 pr-1">
        {ranked.map((c) => {
          const color = rgba(EMERGING_COLORS[c.category])
          return (
            <div
              key={c.cell_id}
              onClick={() => onSelect(c)}
              role="button"
              tabIndex={0}
              className="cursor-pointer rounded-md px-2.5 py-2 border border-transparent bg-slate-800/40 hover:border-slate-600/60 transition-colors"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 min-w-0">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                  <span className="text-[11px] font-semibold text-slate-200 truncate">
                    {c.district ? td(c.district) : `cell ${c.cell_id}`}
                  </span>
                </span>
                <span
                  className="shrink-0 text-[8.5px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded"
                  style={{ background: `${color.replace('1)', '0.16)')}`, color }}
                >
                  {t(`emerging.${c.category}`)}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-400">
                <span className="tabular-nums" style={{ color }}>
                  {c.hist_monthly} → {c.recent_monthly}
                </span>
                <span className="text-slate-500">{t('emerging.nowVsBefore')} ({t('emerging.perMonth').replace('/', '')})</span>
                <span className="ml-auto text-slate-500 tabular-nums">τ {c.tau.toFixed(2)}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

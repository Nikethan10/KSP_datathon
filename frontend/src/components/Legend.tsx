import { SIG_COLORS, SIG_LABELS } from '../lib/data'
import type { Significance } from '../lib/data'

const ORDER: Significance[] = ['hot_99', 'hot_95', 'hot_90', 'not_sig', 'cold_90', 'cold_95', 'cold_99']

export default function Legend() {
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

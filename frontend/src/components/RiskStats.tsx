import { featureName } from '../lib/data'
import type { RiskSummary } from '../lib/data'

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex-1 rounded-lg bg-slate-800/50 border border-slate-700/40 px-2.5 py-2 text-center">
      <div className="text-lg font-bold text-sky-300 tabular-nums leading-tight">{value}</div>
      <div className="text-[9.5px] uppercase tracking-wider text-slate-400 mt-0.5">{label}</div>
    </div>
  )
}

export default function RiskStats({ summary }: { summary: RiskSummary }) {
  const top = summary.feature_importance.slice(0, 7)
  const maxImp = top[0]?.importance ?? 1

  return (
    <div className="flex flex-col gap-3">
      <div>
        <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-1.5">
          Model performance — LightGBM, temporal holdout
        </div>
        <div className="flex gap-2">
          <Stat value={`${summary.pai.hit_rate_5pct.toFixed(0)}%`} label="crimes in top 5% area" />
          <Stat value={summary.pai.pai_5pct.toFixed(1)} label="PAI @ 5%" />
          <Stat value={summary.test_auc.toFixed(2)} label="test AUC" />
        </div>
      </div>

      <div>
        <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-1.5">
          Top risk drivers
        </div>
        <div className="flex flex-col gap-1">
          {top.map((f) => (
            <div key={f.feature} className="flex items-center gap-2">
              <div className="w-44 shrink-0 text-[10.5px] text-slate-300 truncate" title={featureName(f.feature)}>
                {featureName(f.feature)}
              </div>
              <div className="flex-1 h-1.5 rounded bg-slate-700/50 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-sky-500 to-sky-300"
                  style={{ width: `${(f.importance / maxImp) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

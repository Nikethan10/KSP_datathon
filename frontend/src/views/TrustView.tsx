import { useEffect, useState } from 'react'
import { fetchJson, featureName } from '../lib/data'
import type { ShapData, FairnessReport, BenchmarkReport } from '../lib/data'

function Headline({ value, label, sub }: { value: string; label: string; sub: string }) {
  return (
    <div className="flex-1 rounded-xl bg-slate-800/50 border border-sky-400/20 px-4 py-3.5 text-center">
      <div className="text-2xl font-bold text-sky-300 tabular-nums">{value}</div>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-200 mt-1">{label}</div>
      <div className="text-[10.5px] text-slate-400 mt-0.5">{sub}</div>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-2">{children}</div>
  )
}

export default function TrustView() {
  const [shap, setShap] = useState<ShapData | null>(null)
  const [fairness, setFairness] = useState<FairnessReport | null>(null)
  const [benchmark, setBenchmark] = useState<BenchmarkReport | null>(null)

  useEffect(() => {
    Promise.all([
      fetchJson<ShapData>('shap_explanations.json'),
      fetchJson<FairnessReport>('fairness_report.json'),
      fetchJson<BenchmarkReport>('benchmark_report.json'),
    ]).then(([s, f, b]) => {
      setShap(s)
      setFairness(f)
      setBenchmark(b)
    }).catch((e) => console.error('trust data load failed:', e))
  }, [])

  const hn = benchmark?.headline_numbers
  const dm = fairness?.disparity_metrics
  const shapTop = shap?.global_feature_importance.slice(0, 9) ?? []
  const shapMax = shapTop[0]?.mean_abs_shap ?? 1
  const samples = shap?.sample_explanations.slice(0, 8) ?? []

  if (!benchmark && !shap && !fairness) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <span className="glass rounded-md px-4 py-2 text-sm text-sky-300 animate-pulse">
          loading audit&hellip;
        </span>
      </div>
    )
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-4 py-4 flex flex-col gap-4">

        {hn && (
          <div>
            <SectionTitle>Benchmark — the three numbers</SectionTitle>
            <div className="flex gap-3">
              <Headline
                value={`${hn.hit_rate_5pct.toFixed(0)}%`}
                label="crimes in 5% of area"
                sub={`PAI ${hn.pai_5pct.toFixed(1)} — prediction accuracy index`}
              />
              <Headline
                value={`${(hn.coverage_uplift_pct / 100 + 1).toFixed(1)}x`}
                label="patrol coverage uplift"
                sub={`${hn.optimized_coverage_pct.toFixed(1)}% risk covered vs random & volume-driven baselines`}
              />
              <Headline
                value={`−${hn.best_gang_fragmentation_pct.toFixed(0)}%`}
                label="gang fragmentation"
                sub={`${hn.best_gang_size.toLocaleString()}-member gang, 3 arrests → ${hn.best_gang_pieces} pieces`}
              />
            </div>
            <div className="mt-2 rounded-lg border border-amber-400/20 bg-amber-500/5 px-3 py-2 text-[10.5px] text-slate-400 leading-relaxed">
              <span className="font-semibold text-amber-300/90">Benchmark methodology:</span>{' '}
              these numbers are measured on a synthetic FIR corpus with planted spatio-temporal
              patterns — a ground-truth benchmark that proves the pipeline recovers known structure
              (planted-pattern recovery). The identical evaluation harness (PAI/PEI, temporal holdout,
              coverage uplift) runs unchanged on live CCTNS data; real-world scores will differ.
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          {/* SHAP global importance */}
          <div className="glass rounded-xl p-3.5">
            <SectionTitle>Why the model predicts — SHAP feature attribution</SectionTitle>
            <div className="flex flex-col gap-1.5">
              {shapTop.map((f) => (
                <div key={f.feature} className="flex items-center gap-2">
                  <div className="w-48 shrink-0 text-[10.5px] text-slate-300 truncate" title={featureName(f.feature)}>
                    {featureName(f.feature)}
                  </div>
                  <div className="flex-1 h-2 rounded bg-slate-700/50 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-sky-500 to-sky-300"
                      style={{ width: `${(f.mean_abs_shap / shapMax) * 100}%` }}
                    />
                  </div>
                  <div className="w-12 shrink-0 text-right text-[10px] text-slate-500 tabular-nums">
                    {f.mean_abs_shap.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2 text-[10px] text-slate-500">
              Near-repeat features dominate — the model has learned crime clusters in space and time,
              not just historical averages.
            </div>
          </div>

          {/* Fairness */}
          <div className="glass rounded-xl p-3.5">
            <SectionTitle>Fairness audit — geographic disparity</SectionTitle>
            {dm && (
              <>
                <div className="flex gap-2 mb-3">
                  <div className="flex-1 rounded-lg bg-slate-800/50 border border-slate-700/40 px-2 py-1.5 text-center">
                    <div className="text-sm font-bold text-emerald-300 tabular-nums">{dm.gini_coefficient.toFixed(3)}</div>
                    <div className="text-[9px] uppercase tracking-wider text-slate-400 mt-0.5">risk Gini (0 = equal)</div>
                  </div>
                  <div className="flex-1 rounded-lg bg-slate-800/50 border border-slate-700/40 px-2 py-1.5 text-center">
                    <div className="text-sm font-bold text-sky-300 tabular-nums">{dm.max_min_ratio.toFixed(1)}x</div>
                    <div className="text-[9px] uppercase tracking-wider text-slate-400 mt-0.5">max/min district</div>
                  </div>
                  <div className="flex-1 rounded-lg bg-slate-800/50 border border-slate-700/40 px-2 py-1.5 text-center">
                    <div className="text-sm font-bold text-sky-300 tabular-nums">{fairness.reporting_bias.districts_below_median}</div>
                    <div className="text-[9px] uppercase tracking-wider text-slate-400 mt-0.5">low-clearance flags</div>
                  </div>
                </div>
                <div className="text-[10.5px] text-slate-400 leading-relaxed">
                  {fairness.fairness_statement}
                </div>
              </>
            )}
          </div>
        </div>

        {/* sample explanations */}
        <div className="glass rounded-xl p-3.5">
          <SectionTitle>Every score explained — top-risk predictions with plain-language why</SectionTitle>
          <div className="grid grid-cols-2 gap-1.5">
            {samples.map((s, i) => (
              <div key={i} className="rounded-md bg-slate-800/40 px-2.5 py-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-sky-300 tabular-nums">
                    risk {s.risk_score.toFixed(3)}
                  </span>
                  <span className="text-[9.5px] text-slate-500">
                    cell {s.cell_id} · {String(s.date).slice(0, 10)} · shift {s.shift}
                    {s.has_crime === 1 && <span className="ml-1.5 text-emerald-400">✓ crime occurred</span>}
                  </span>
                </div>
                <div className="mt-1 text-[10.5px] text-slate-300 leading-snug">
                  {s.explanation.replace(/^Risk score: [\d.]+\. /, '')}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}

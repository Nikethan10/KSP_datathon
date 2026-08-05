import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchJson, featureName } from '../lib/data'
import { composeModelSummary } from '../lib/insights'
import { useI18n } from '../lib/i18n'
import type {
  ShapData, ShapExplanation, FairnessReport, BenchmarkReport, CalibrationData, ReliabilityPoint,
} from '../lib/data'

const PCTS = [1, 2, 5, 10, 20]

function Tile({ value, label, sub, accent }: { value: string; label: string; sub: string; accent?: string }) {
  return (
    <div className="flex-1 rounded-xl bg-slate-800/50 border border-slate-700/50 px-3 py-3 text-center">
      <div className="text-2xl font-bold tabular-nums" style={{ color: accent ?? '#c9a35c' }}>{value}</div>
      <div className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-200 mt-1">{label}</div>
      <div className="text-[10px] text-slate-400 mt-0.5">{sub}</div>
    </div>
  )
}

/** Reliability diagram: predicted risk (x) vs how often crime actually happened (y).
 *  Points are measured on the held-out test period — the dashed line is perfect. */
function ReliabilityDiagram({ raw, cal, labels }: {
  raw: ReliabilityPoint[]
  cal: ReliabilityPoint[]
  labels: { perfect: string; calibrated: string; before: string; x: string; y: string }
}) {
  const W = 300, H = 210, L = 34, B = 26, T = 8, R = 10
  const all = [...raw, ...cal]
  const max = Math.max(0.02, ...all.map((p) => Math.max(p.conf, p.acc))) * 1.08
  const sx = (v: number) => L + (v / max) * (W - L - R)
  const sy = (v: number) => H - B - (v / max) * (H - B - T)
  const pct = (v: number) => `${(v * 100).toFixed(0)}%`

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 230 }}>
        {/* axes */}
        <line x1={L} y1={T} x2={L} y2={H - B} stroke="#353b43" strokeWidth="1" />
        <line x1={L} y1={H - B} x2={W - R} y2={H - B} stroke="#353b43" strokeWidth="1" />
        {/* perfect-calibration diagonal */}
        <line x1={sx(0)} y1={sy(0)} x2={sx(max)} y2={sy(max)}
          stroke="#8a939e" strokeWidth="1.2" strokeDasharray="4 3" opacity="0.7" />
        {/* raw (before calibration) */}
        {raw.map((p, i) => (
          <circle key={`r${i}`} cx={sx(p.conf)} cy={sy(p.acc)} r="3" fill="#d99a3c" opacity="0.5" />
        ))}
        {/* calibrated */}
        {cal.map((p, i) => (
          <circle key={`c${i}`} cx={sx(p.conf)} cy={sy(p.acc)} r="3.4" fill="#c9a35c" />
        ))}
        {/* ticks */}
        <text x={L} y={H - B + 12} fontSize="8" fill="#6b7480" textAnchor="middle">0</text>
        <text x={W - R} y={H - B + 12} fontSize="8" fill="#6b7480" textAnchor="end">{pct(max)}</text>
        <text x={L - 5} y={H - B} fontSize="8" fill="#6b7480" textAnchor="end">0</text>
        <text x={L - 5} y={T + 8} fontSize="8" fill="#6b7480" textAnchor="end">{pct(max)}</text>
        {/* axis labels */}
        <text x={(L + W) / 2} y={H - 4} fontSize="8.5" fill="#8a939e" textAnchor="middle">{labels.x}</text>
        <text x={10} y={(H - B) / 2} fontSize="8.5" fill="#8a939e" textAnchor="middle"
          transform={`rotate(-90 10 ${(H - B) / 2})`}>{labels.y}</text>
      </svg>
      <div className="flex items-center gap-3 text-[9.5px] text-slate-400 justify-center -mt-1">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: '#c9a35c' }} />{labels.calibrated}</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: '#d99a3c', opacity: 0.6 }} />{labels.before}</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 border-t border-dashed border-slate-400" />{labels.perfect}</span>
      </div>
    </div>
  )
}

export default function TrustView() {
  const [shap, setShap] = useState<ShapData | null>(null)
  const [fairness, setFairness] = useState<FairnessReport | null>(null)
  const [benchmark, setBenchmark] = useState<BenchmarkReport | null>(null)
  const [calib, setCalib] = useState<CalibrationData | null>(null)
  const [showSamples, setShowSamples] = useState(false)
  /* Layer 1 answers "can I trust this?" in four figures and the hard limits.
     Layer 2 is the full technical evidence, folded until asked for — the
     same charts and tables, nothing removed. */
  const [showEvidence, setShowEvidence] = useState(false)
  const { t } = useI18n()

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

    fetchJson<CalibrationData>('calibration.json').then(setCalib).catch(() => {})
  }, [])

  const rm = benchmark?.risk_model
  const dm = fairness?.disparity_metrics
  const shapTop = shap?.global_feature_importance.slice(0, 6) ?? []
  const shapMax = shapTop[0]?.mean_abs_shap ?? 1
  const samples = shap?.sample_explanations.slice(0, 4) ?? []

  /* shap_explanations.json ships a pre-built English sentence. The same
     record also carries top_features, so the sentence is rebuilt here from
     translated feature names rather than shown in whatever language the
     pipeline happened to write. */
  const explain = useCallback((sx: ShapExplanation) => {
    const entries = Object.entries(sx.top_features ?? {})
    const up = entries.filter(([, v]) => v > 0).map(([k]) => featureName(k, t))
    const down = entries.filter(([, v]) => v < 0).map(([k]) => featureName(k, t))
    let out = ''
    if (up.length) out += t('shap.elevated').replace('{factors}', up.join(', '))
    if (down.length) out += t('shap.mitigating').replace('{factors}', down.join(', '))
    return out || sx.explanation
  }, [t])

  const aiSummary = useMemo(() => {
    if (!rm) return null
    return composeModelSummary(rm, t)
  }, [rm, t])

  if (!benchmark && !shap && !fairness) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <span className="glass rounded-md px-4 py-2 text-sm text-sky-300 animate-pulse">
          {t('common.loading')}
        </span>
      </div>
    )
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-4 py-4 flex flex-col gap-4">

        {/* ── 0. AI intelligence summary ─────────────────────────────── */}
        {aiSummary && (
          <div className="rounded-xl border border-sky-400/20 bg-sky-500/5 px-4 py-3">
            <div className="flex items-center gap-2 mb-1.5">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" aria-hidden>
                <path d="M12 2a7 7 0 0 1 7 7c0 2.4-1.2 4.5-3 5.7V17a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2.3A7 7 0 0 1 12 2Z" stroke="#c9a35c" strokeWidth="1.5" />
                <path d="M9 21h6" stroke="#c9a35c" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <span className="text-[10px] uppercase tracking-widest text-sky-400 font-semibold">{t('trust.modelSummary')}</span>
            </div>
            <div className="text-[11px] text-slate-300 leading-relaxed">{aiSummary}</div>
          </div>
        )}

        {/* ── 1. reliability at a glance ─────────────────────────────── */}
        <div>
          <div className="text-[11px] uppercase tracking-widest text-slate-300 font-semibold">
            {t('trust.reliabilityTitle')}
          </div>
          <div className="text-[10px] text-slate-500 mb-2">{t('trust.reliabilitySub')}</div>
          <div className="flex gap-2.5">
            {rm?.pai && (
              <Tile
                value={`${rm.pai.hit_rate_5pct.toFixed(1)}%`}
                label={t('trust.hitRateTile')}
                sub={t('trust.hitRateSub')}
              />
            )}
            {calib && (
              <Tile
                value={`${(calib.ece_calibrated * 100).toFixed(1)}%`}
                label={t('trust.calibTile')}
                sub={t('trust.calibTileSub')}
                accent="#5ec98a"
              />
            )}
            {rm?.pei && (
              <Tile
                value={`${(rm.pei.pei_5pct * 100).toFixed(0)}%`}
                label={t('trust.peiTile')}
                sub={t('trust.peiSub')}
              />
            )}
            {calib && (
              <Tile
                value={calib.n_test.toLocaleString()}
                label={t('trust.evidenceTile')}
                sub={`${(calib.pos_rate * 100).toFixed(1)}% base rate · ${t('trust.evidenceSub')}`}
                accent="#b6bec7"
              />
            )}
          </div>
        </div>

        {/* ── 4. known limitations (honest) — two columns to stay compact ── */}
        <div className="glass rounded-xl p-3.5 border border-red-400/15">
          <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-2">{t('trust.limitsTitle')}</div>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            {[t('trust.limitCorpus'), t('trust.limitGeo'), t('trust.limitIdentity'), t('trust.limitState'), t('trust.limitOutcome')].map((txt, i) => (
              <li key={i} className="flex gap-1.5 text-[10px] text-slate-400 leading-snug">
                <span className="text-red-400/70 shrink-0">•</span>
                <span>{txt}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* ── layer 2: the full technical evidence, folded ───────── */}
        <button
          onClick={() => setShowEvidence((v) => !v)}
          className="glass rounded-xl px-4 py-3 flex items-center justify-between text-left transition-colors"
        >
          <span>
            <span className="block text-[11px] font-semibold uppercase tracking-widest text-slate-200">
              {showEvidence ? t('trust.hideEvidence') : t('trust.showEvidence')}
            </span>
            <span className="block text-[10px] text-slate-500 mt-0.5">{t('trust.evidenceHint')}</span>
          </span>
          <span className="text-slate-400 text-sm shrink-0 ml-4">{showEvidence ? '−' : '+'}</span>
        </button>

        {showEvidence && (<>
        {/* ── 2. calibration + accuracy ─────────────────────────────── */}
        <div className="grid grid-cols-2 gap-4">
          {calib && (
            <div className="glass rounded-xl p-3.5">
              <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-1">
                {t('trust.calibTitle')}
              </div>
              <div className="text-[10px] text-slate-500 mb-1.5 leading-snug">{t('trust.plainCalib')}</div>
              <ReliabilityDiagram
                raw={calib.reliability_raw}
                cal={calib.reliability_calibrated}
                labels={{
                  perfect: t('trust.perfect'),
                  calibrated: t('trust.calibrated'),
                  before: t('trust.beforeCal'),
                  x: t('trust.predictedRisk'),
                  y: t('trust.actualRate'),
                }}
              />
              <div className="flex gap-2 mt-2">
                <div className="flex-1 rounded-lg bg-slate-800/50 border border-slate-700/40 px-2 py-1.5 text-center">
                  <div className="text-[11px] font-bold tabular-nums text-slate-300">
                    <span className="text-slate-500">{(calib.ece_raw * 100).toFixed(2)}%</span>
                    <span className="mx-1 text-slate-400">→</span>
                    <span className="text-emerald-300">{(calib.ece_calibrated * 100).toFixed(2)}%</span>
                  </div>
                  <div className="text-[9px] uppercase tracking-wider text-slate-400 mt-0.5">{t('trust.ece')}</div>
                </div>
                <div className="flex-1 rounded-lg bg-slate-800/50 border border-slate-700/40 px-2 py-1.5 text-center">
                  <div className="text-[11px] font-bold tabular-nums text-slate-300">
                    <span className="text-slate-500">{calib.brier_raw.toFixed(3)}</span>
                    <span className="mx-1 text-slate-400">→</span>
                    <span className="text-emerald-300">{calib.brier_calibrated.toFixed(3)}</span>
                  </div>
                  <div className="text-[9px] uppercase tracking-wider text-slate-400 mt-0.5">{t('trust.brier')}</div>
                </div>
              </div>
              <div className="mt-1.5 text-[9.5px] text-slate-500 leading-snug">{t('trust.calibNote')}</div>
            </div>
          )}

          {rm?.pai && (
            <div className="glass rounded-xl p-3.5">
              <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-2">
                {t('trust.accuracyTitle')}
              </div>
              <table className="w-full text-[10.5px]">
                <thead>
                  <tr className="text-slate-400 text-[9px] uppercase tracking-wider">
                    <th className="text-left font-medium pb-1">{t('trust.colArea')}</th>
                    <th className="text-right font-medium pb-1">{t('trust.colCaptured')}</th>
                    <th className="text-right font-medium pb-1">{t('trust.colPai')}</th>
                    <th className="text-right font-medium pb-1">{t('trust.colPei')}</th>
                  </tr>
                </thead>
                <tbody>
                  {PCTS.map((p) => {
                    const hit = rm.pai[`hit_rate_${p}pct`]
                    const pai = rm.pai[`pai_${p}pct`]
                    const pei = rm.pei[`pei_${p}pct`]
                    if (hit == null) return null
                    const key5 = p === 5
                    return (
                      <tr key={p} className={`border-t border-slate-700/40 ${key5 ? 'bg-sky-500/10' : ''}`}>
                        <td className="py-1 text-slate-300 tabular-nums">{p}%</td>
                        <td className="py-1 text-right font-semibold text-sky-300 tabular-nums">{hit.toFixed(1)}%</td>
                        <td className="py-1 text-right text-slate-300 tabular-nums">{pai?.toFixed(1)}×</td>
                        <td className="py-1 text-right text-slate-400 tabular-nums">
                          {pei != null ? `${(pei * 100).toFixed(0)}%` : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <div className="mt-2 rounded-lg border border-amber-400/20 bg-amber-500/5 px-2.5 py-1.5 text-[9.5px] text-slate-400 leading-snug">
                <span className="font-semibold text-amber-300/90">{t('trust.testedTitle')}:</span>{' '}
                {t('trust.testedText')}
              </div>
            </div>
          )}
        </div>

        {/* ── 3. explainability + fairness ──────────────────────────── */}
        <div className="grid grid-cols-2 gap-4">
          <div className="glass rounded-xl p-3.5">
            <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-2">{t('trust.shapTitle')}</div>
            <div className="flex flex-col gap-1.5">
              {shapTop.map((f) => (
                <div key={f.feature} className="flex items-center gap-2">
                  <div className="w-48 shrink-0 text-[10.5px] text-slate-300 truncate" title={featureName(f.feature, t)}>
                    {featureName(f.feature, t)}
                  </div>
                  <div className="flex-1 h-2 rounded bg-slate-700/50 overflow-hidden">
                    <div
                      className="h-full bg-sky-400"
                      style={{ width: `${(f.mean_abs_shap / shapMax) * 100}%` }}
                    />
                  </div>
                  <div className="w-12 shrink-0 text-right text-[10px] text-slate-500 tabular-nums">
                    {f.mean_abs_shap.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2 text-[10px] text-slate-500">{t('trust.shapNote')}</div>
          </div>

          <div className="glass rounded-xl p-3.5">
            <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-2">{t('trust.fairnessTitle')}</div>
            {dm && (
              <>
                <div className="flex gap-2 mb-3">
                  <div className="flex-1 rounded-lg bg-slate-800/50 border border-slate-700/40 px-2 py-1.5 text-center">
                    <div className="text-sm font-bold text-emerald-300 tabular-nums">{dm.gini_coefficient.toFixed(3)}</div>
                    <div className="text-[9px] uppercase tracking-wider text-slate-400 mt-0.5">{t('trust.riskGini')}</div>
                  </div>
                  <div className="flex-1 rounded-lg bg-slate-800/50 border border-slate-700/40 px-2 py-1.5 text-center">
                    <div className="text-sm font-bold text-sky-300 tabular-nums">{dm.max_min_ratio.toFixed(1)}x</div>
                    <div className="text-[9px] uppercase tracking-wider text-slate-400 mt-0.5">{t('trust.maxMinDistrict')}</div>
                  </div>
                  <div className="flex-1 rounded-lg bg-slate-800/50 border border-slate-700/40 px-2 py-1.5 text-center">
                    <div className="text-sm font-bold text-sky-300 tabular-nums">{fairness!.reporting_bias.districts_below_median}</div>
                    <div className="text-[9px] uppercase tracking-wider text-slate-400 mt-0.5">{t('trust.lowClearance')}</div>
                  </div>
                </div>
                <div className="text-[10.5px] text-slate-400 leading-relaxed">{t('trust.fairnessStatement')}</div>
              </>
            )}
          </div>
        </div>

        {/* ── 5. worked examples — collapsed by default ─────────────── */}
        <div className="glass rounded-xl p-3.5">
          <button
            onClick={() => setShowSamples((v) => !v)}
            className="w-full flex items-center justify-between text-left"
          >
            <span className="text-[10px] uppercase tracking-widest text-slate-400">{t('trust.sampleTitle')}</span>
            <span className="text-[10px] text-sky-300 shrink-0 ml-3">
              {showSamples ? t('trust.hideExamples') : t('trust.showExamples')}
            </span>
          </button>
          {showSamples && (
            <div className="grid grid-cols-2 gap-1.5 mt-2">
              {samples.map((s, i) => (
                <div key={i} className="rounded-md bg-slate-800/40 px-2.5 py-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-sky-300 tabular-nums">
                      {t('trust.risk')} {s.risk_score.toFixed(3)}
                    </span>
                    <span className="text-[9.5px] text-slate-500">
                      cell {s.cell_id} · {String(s.date).slice(0, 10)} · shift {s.shift}
                      {s.has_crime === 1 && <span className="ml-1.5 text-emerald-400">✓ {t('trust.crimeOccurred')}</span>}
                    </span>
                  </div>
                  <div className="mt-1 text-[10.5px] text-slate-300 leading-snug">
                    {explain(s)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        </>)}

      </div>
    </div>
  )
}

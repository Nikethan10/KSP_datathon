import type { Gang, NetworkSummary, ThreatTier } from '../lib/data'
import { THREAT_COLORS } from '../lib/data'
import { useI18n } from '../lib/i18n'

interface Props {
  gangs: Gang[]
  summary: NetworkSummary | null
  selected: Gang | null
  onSelect: (g: Gang) => void
  hideStats?: boolean
}

const TIER_RANK: Record<ThreatTier, number> = { high: 0, medium: 1, low: 2 }

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex-1 rounded-lg bg-slate-800/50 border border-slate-700/40 px-2 py-1.5 text-center">
      <div className="text-sm font-bold text-sky-300 tabular-nums leading-tight">{value}</div>
      <div className="text-[9px] uppercase tracking-wider text-slate-400 mt-0.5">{label}</div>
    </div>
  )
}

export default function GangPanel({ gangs, summary, selected, onSelect, hideStats }: Props) {
  const { t, tc } = useI18n()
  // most dangerous first: by threat tier, then by threat score
  const ranked = [...gangs].sort(
    (a, b) => TIER_RANK[a.threat_tier] - TIER_RANK[b.threat_tier] || b.threat_score - a.threat_score,
  )

  return (
    <div className="flex flex-col gap-3 min-h-0">
      {!hideStats && summary && (
        <div>
          <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-1.5">
            {t('predict.networkStats')}
          </div>
          <div className="flex gap-1.5">
            <Stat value={(summary.graph_nodes / 1000).toFixed(0) + 'k'} label={t('predict.offenders')} />
            <Stat value={(summary.graph_edges / 1e6).toFixed(1) + 'M'} label={t('predict.connections')} />
            <Stat value={summary.n_communities.toLocaleString()} label={t('predict.gangs')} />
            <Stat value={summary.modularity.toFixed(2)} label={t('predict.modularity')} />
          </div>
        </div>
      )}

      <div className="flex flex-col min-h-0">
        <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-1.5">
          {t('predict.threatRanking')}
        </div>
        <div className="overflow-y-auto min-h-0 flex flex-col gap-1 pr-1">
          {ranked.map((g) => {
            const isSel = selected?.gang_rank === g.gang_rank
            const color = THREAT_COLORS[g.threat_tier]
            return (
              <button
                key={g.gang_rank}
                onClick={() => onSelect(g)}
                className={`text-left rounded-md px-2.5 py-2 border transition-colors ${
                  isSel ? 'bg-slate-700/40' : 'bg-slate-800/40 border-transparent hover:border-slate-600/60'
                }`}
                style={isSel ? { borderColor: `${color}88` } : undefined}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 min-w-0">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                    <span className="text-xs font-semibold text-slate-200">
                      {t('predict.gangs')} #{g.gang_rank}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {g.gang_size.toLocaleString()} {t('predict.members')}
                    </span>
                  </span>
                  <span
                    className="shrink-0 text-[9.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                    style={{ background: `${color}22`, color }}
                  >
                    {t(`threat.${g.threat_tier}`)}
                  </span>
                </div>

                <div className="mt-1.5 flex items-center gap-3 text-[10px] text-slate-400">
                  <span title={t('threat.heinousShare')}>
                    <span className="text-slate-300 tabular-nums font-semibold">{g.heinous_pct.toFixed(0)}%</span> {t('sense.heinous')}
                  </span>
                  <span title={t('threat.reachTip')}>
                    <span className="text-slate-300 tabular-nums font-semibold">{g.n_districts}</span> {t('patterns.districts')}
                  </span>
                  <span className="ml-auto truncate text-slate-500">{tc(g.top_crime)}</span>
                </div>

                {isSel && (
                  <div className="mt-2 border-t border-slate-700/60 pt-1.5 flex flex-col gap-1">
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span>{g.total_cases.toLocaleString()} {t('sense.cases')} · {g.n_districts} {t('patterns.districts')}</span>
                      <span className="text-slate-500">{t('predict.threatScore')} {g.threat_score.toFixed(0)}</span>
                    </div>
                    <div className="text-[9px] uppercase tracking-wider text-slate-400 mt-0.5">{t('predict.keyMembers')}</div>
                    {g.key_members.slice(0, 5).map((m) => (
                      <div key={m.offender_id} className="flex justify-between text-[10px]">
                        <span className="text-slate-300">
                          {m.name}
                          {m.is_articulation && (
                            <span className="ml-1.5 text-amber-400/90" title="articulation point">◆</span>
                          )}
                        </span>
                        <span className="text-slate-500 tabular-nums">
                          {m.gang_degree} {t('predict.connections')} · {m.total_cases} {t('sense.cases')}
                        </span>
                      </div>
                    ))}
                    <div className="mt-1 text-[10px] text-slate-400">
                      {t('predict.arrestImpact')}: {g.removed_top3.join(', ')} &rarr; −{g.fragmentation_drop_pct.toFixed(0)}% ({g.components_after_top3_removed} {t('predict.pieces')})
                    </div>
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

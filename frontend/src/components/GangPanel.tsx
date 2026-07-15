import type { Gang, NetworkSummary } from '../lib/data'

interface Props {
  gangs: Gang[]
  summary: NetworkSummary | null
  selected: Gang | null
  onSelect: (g: Gang) => void
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex-1 rounded-lg bg-slate-800/50 border border-slate-700/40 px-2 py-1.5 text-center">
      <div className="text-sm font-bold text-sky-300 tabular-nums leading-tight">{value}</div>
      <div className="text-[9px] uppercase tracking-wider text-slate-400 mt-0.5">{label}</div>
    </div>
  )
}

export default function GangPanel({ gangs, summary, selected, onSelect }: Props) {
  const ranked = [...gangs].sort((a, b) => b.fragmentation_drop_pct - a.fragmentation_drop_pct)

  return (
    <div className="flex flex-col gap-3 min-h-0">
      {summary && (
        <div>
          <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-1.5">
            Co-offending network — from shared FIRs
          </div>
          <div className="flex gap-1.5">
            <Stat value={(summary.graph_nodes / 1000).toFixed(0) + 'k'} label="offenders" />
            <Stat value={(summary.graph_edges / 1e6).toFixed(1) + 'M'} label="links" />
            <Stat value={summary.n_communities.toLocaleString()} label="groups" />
            <Stat value={summary.modularity.toFixed(2)} label="modularity" />
          </div>
        </div>
      )}

      <div className="flex flex-col min-h-0">
        <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-1.5">
          Gang disruption — remove 3 key members
        </div>
        <div className="overflow-y-auto min-h-0 flex flex-col gap-1 pr-1">
          {ranked.map((g) => {
            const isSel = selected?.gang_rank === g.gang_rank
            return (
              <button
                key={g.gang_rank}
                onClick={() => onSelect(g)}
                className={`text-left rounded-md px-2.5 py-2 border transition-colors ${
                  isSel
                    ? 'bg-amber-500/10 border-amber-400/40'
                    : 'bg-slate-800/40 border-transparent hover:border-slate-600/60'
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-200">
                    Gang #{g.gang_rank}
                    <span className="ml-2 font-normal text-slate-400">
                      {g.gang_size.toLocaleString()} members
                    </span>
                  </span>
                  <span className="text-xs font-bold text-amber-300 tabular-nums shrink-0">
                    −{g.fragmentation_drop_pct.toFixed(0)}%
                  </span>
                </div>
                <div className="mt-1 h-1 rounded bg-slate-700/50 overflow-hidden">
                  <div
                    className="h-full bg-amber-400/80"
                    style={{ width: `${g.fragmentation_drop_pct}%` }}
                  />
                </div>
                <div className="mt-1 text-[10px] text-slate-400 truncate">
                  arrest {g.removed_top3.join(', ')} &rarr; {g.components_after_top3_removed} fragments
                </div>
                {isSel && (
                  <div className="mt-2 border-t border-slate-700/60 pt-1.5 flex flex-col gap-0.5">
                    {g.key_members.slice(0, 5).map((m) => (
                      <div key={m.offender_id} className="flex justify-between text-[10px]">
                        <span className="text-slate-300">
                          {m.name}
                          {m.is_articulation && (
                            <span className="ml-1.5 text-amber-400/90" title="articulation point — removal splits the gang">
                              ◆ cut-point
                            </span>
                          )}
                        </span>
                        <span className="text-slate-500 tabular-nums">
                          {m.gang_degree} links · {m.total_cases} cases
                        </span>
                      </div>
                    ))}
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

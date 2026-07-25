import type { GangNetwork, ThreatTier } from '../lib/data'
import { THREAT_COLORS } from '../lib/data'
import { rosterFor } from '../lib/gang'
import type { GangRole } from '../lib/gang'
import { useI18n } from '../lib/i18n'

interface Props {
  rank: number | null
  tier: ThreatTier | null
  network: GangNetwork | null
  onSelect: (offenderId: string) => void
}

export default function GangRoster({ rank, tier, network, onSelect }: Props) {
  const { t } = useI18n()
  const members = rosterFor(network, rank)
  const color = tier ? THREAT_COLORS[tier] : '#c9a24a'
  const roleLabel: Record<GangRole, string> = {
    boss: t('board.boss'), lieutenant: t('board.lieutenant'), soldier: t('board.soldier'),
  }

  if (members.length === 0) {
    return <div className="text-[11px] text-slate-500 px-1">{t('board.pick')}</div>
  }

  return (
    <div className="flex flex-col min-h-0">
      <div className="mb-1.5">
        <div className="text-[10px] uppercase tracking-widest text-slate-400">
          {t('war.roster')} · {t('predict.gangs').replace(/s$/, '')} #{rank}
        </div>
        <div className="text-[9.5px] text-slate-500">
          {members.length} {t('board.members')} · {t('war.rosterNote')}
        </div>
      </div>
      <div className="overflow-y-auto min-h-0 flex flex-col gap-1 pr-1">
        {members.map((m, i) => {
          const initials = m.name.split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase()
          const isBoss = m.role === 'boss'
          return (
            <button
              key={m.id}
              onClick={() => onSelect(m.id)}
              className="text-left rounded-md px-2 py-1.5 bg-slate-800/40 border border-transparent hover:border-slate-600/60 hover:bg-slate-700/40 transition-colors flex items-center gap-2.5"
            >
              <span className="text-[11px] font-bold text-slate-500 tabular-nums w-4 text-right shrink-0">{i + 1}</span>
              <span
                className="relative w-7 h-7 shrink-0 rounded grid place-items-center overflow-hidden"
                style={{ background: `linear-gradient(160deg, ${color}22, rgba(9,13,20,0.5))`, border: `1px solid ${color}55` }}
              >
                <span className="text-[8px] font-bold" style={{ color }}>{initials}</span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-slate-200 truncate">{m.name}</span>
                  {m.role !== 'soldier' && (
                    <span className="text-[8px] font-bold uppercase tracking-wider px-1 py-[1px] rounded shrink-0"
                      style={{ background: isBoss ? color : `${color}22`, color: isBoss ? '#15181c' : color }}>
                      {roleLabel[m.role]}
                    </span>
                  )}
                </span>
                <span className="block text-[9.5px] text-slate-500 mt-0.5">
                  {m.deg} {t('predict.connections')} · {m.size} {t('war.cases')}
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

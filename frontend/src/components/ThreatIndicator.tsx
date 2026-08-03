import type { ThreatLevel } from '../lib/insights'
import { THREAT_LEVEL_COLORS } from '../lib/insights'

interface Props {
  level: ThreatLevel
  compact?: boolean
}

export default function ThreatIndicator({ level, compact }: Props) {
  const color = THREAT_LEVEL_COLORS[level]

  if (compact) {
    return (
      <span
        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border"
        style={{ color, borderColor: `${color}40`, background: `${color}15` }}
      >
        <span className="w-1.5 h-1.5 rounded-full pulse-glow" style={{ background: color }} />
        {level}
      </span>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <span
          className="block w-2.5 h-2.5 rounded-full pulse-glow"
          style={{ background: color }}
        />
      </div>
      <div className="flex flex-col leading-none">
        <span className="text-[9px] uppercase tracking-widest text-slate-500">Threat Level</span>
        <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color }}>
          {level}
        </span>
      </div>
    </div>
  )
}

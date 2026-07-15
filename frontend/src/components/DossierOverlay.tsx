import { useEffect } from 'react'
import OffenderDossier from './OffenderDossier'
import { THREAT_COLORS } from '../lib/data'
import type { OffenderDossier as Dossier } from '../lib/data'

interface Props {
  dossier: Dossier
  onClose: () => void
  onSelectAssociate: (offenderId: string) => void
}

export default function DossierOverlay({ dossier, onClose, onSelectAssociate }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const tierColor = dossier.threat_tier ? THREAT_COLORS[dossier.threat_tier] : '#8aa0b8'

  return (
    <div className="absolute inset-0 z-40">
      <button
        aria-label="close"
        onClick={onClose}
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px] cursor-default"
      />
      <div className="slide-over absolute right-0 top-0 bottom-0 w-[400px] max-w-[90vw] glass border-l border-slate-700/60 flex flex-col min-h-0">
        {/* dossier header strip */}
        <div className="shrink-0 px-3.5 pt-3 pb-2 border-b border-slate-700/40" style={{ borderLeftColor: tierColor, borderLeftWidth: 3 }}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-full grid place-items-center text-sm font-bold shrink-0"
                style={{ background: `${tierColor}20`, color: tierColor, border: `1.5px solid ${tierColor}50` }}>
                {dossier.name.charAt(0)}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-100 truncate">{dossier.name}</div>
                <div className="text-[9px] text-slate-500 font-mono-data">ID: {dossier.offender_id}</div>
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="close dossier"
              className="w-7 h-7 rounded-md grid place-items-center text-slate-400 hover:text-slate-100 hover:bg-slate-700/60 transition-colors shrink-0"
            >
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" aria-hidden>
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          {/* threat score bar */}
          {dossier.threat_score != null && (
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[8px] uppercase tracking-wider text-slate-500">Threat</span>
              <div className="flex-1 h-1.5 rounded bg-slate-700/50 overflow-hidden">
                <div className="h-full rounded" style={{ width: `${Math.min(100, dossier.threat_score * 10)}%`, background: tierColor }} />
              </div>
              <span className="text-[10px] font-bold tabular-nums" style={{ color: tierColor }}>
                {dossier.threat_score.toFixed(1)}
              </span>
            </div>
          )}
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-3.5 pt-2">
          <OffenderDossier dossier={dossier} onBack={onClose} onSelectAssociate={onSelectAssociate} hideBack />
        </div>
      </div>
    </div>
  )
}

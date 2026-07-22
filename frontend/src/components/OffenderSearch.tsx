import { useEffect, useMemo, useRef, useState } from 'react'
import type { OffenderDossier } from '../lib/data'
import { useI18n } from '../lib/i18n'
import { matchesName } from '../lib/districtSearch'

interface Props {
  offenders: OffenderDossier[]
  onSelect: (d: OffenderDossier) => void
}

export default function OffenderSearch({ offenders, onSelect }: Props) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [hi, setHi] = useState(0)
  const { t } = useI18n()
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  const matches = useMemo(() => {
    const query = q.trim().toLowerCase()
    if (!query) return []
    return offenders
      .filter((o) => matchesName(o.name, query))
      .sort((a, b) => b.total_cases - a.total_cases)
      .slice(0, 8)
  }, [q, offenders])

  useEffect(() => setHi(0), [q])

  const choose = (d: OffenderDossier) => {
    onSelect(d)
    setQ('')
    setOpen(false)
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (!open || matches.length === 0) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => Math.min(h + 1, matches.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); choose(matches[hi]) }
    else if (e.key === 'Escape') { setOpen(false) }
  }

  return (
    <div ref={boxRef} className="relative">
      <div className="glass flex items-center gap-2 h-8 px-2.5 rounded-md border border-slate-700/70 focus-within:border-sky-500/60 transition-colors">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" className="text-slate-500 shrink-0" aria-hidden>
          <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.6" />
          <path d="M20 20 L16 16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKey}
          placeholder={t('war.searchSuspect')}
          className="w-52 bg-transparent text-[12px] text-slate-200 placeholder:text-slate-500 outline-none"
        />
      </div>

      {open && q.trim() && (
        <div className="absolute top-full left-0 mt-1 w-72 z-30 glass rounded-md overflow-hidden py-1">
          {matches.length === 0 ? (
            <div className="px-3 py-1.5 text-[11px] text-slate-500">{t('war.noSuspect')}</div>
          ) : (
            matches.map((d, i) => {
              return (
                <button
                  key={d.offender_id}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(d)}
                  onMouseEnter={() => setHi(i)}
                  className={`w-full text-left px-3 py-1.5 flex items-center gap-2 transition-colors ${
                    i === hi ? 'bg-slate-700/50' : ''
                  }`}
                >
                                    <span className="text-[11.5px] text-slate-200 truncate flex-1">{d.name}</span>
                  <span className="text-[9.5px] text-slate-500 tabular-nums shrink-0">
                    {d.total_cases} {t('war.cases')}
                  </span>
                </button>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

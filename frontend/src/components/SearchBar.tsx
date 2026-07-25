import { useEffect, useMemo, useRef, useState } from 'react'
import { fetchJson } from '../lib/data'
import { useFocus } from '../lib/focus'
import { useI18n } from '../lib/i18n'
import type { DistrictCentroid } from '../lib/data'

export default function SearchBar({ className = '' }: { className?: string }) {
  const [districts, setDistricts] = useState<DistrictCentroid[]>([])
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [hi, setHi] = useState(0)
  const { setFocus } = useFocus()
  const { t, td } = useI18n()
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchJson<DistrictCentroid[]>('district_centroids.json').then(setDistricts).catch(() => {})
  }, [])

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
    return districts
      .filter(
        (d) =>
          d.district.toLowerCase().includes(query) ||
          td(d.district).toLowerCase().includes(query),
      )
      .slice(0, 8)
  }, [q, districts, td])

  useEffect(() => setHi(0), [q])

  const choose = (d: DistrictCentroid) => {
    setFocus({ lat: d.lat, lon: d.lon, zoom: 9.5, district: d.district })
    setQ(td(d.district))
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
    <div ref={boxRef} className={`relative ${className}`}>
      <div className="flex items-center gap-2 h-7 px-2.5 rounded-md border border-slate-700/70 bg-slate-900/40 focus-within:border-slate-500 transition-colors">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" className="text-slate-500 shrink-0" aria-hidden>
          <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.6" />
          <path d="M20 20 L16 16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKey}
          placeholder={t('search.placeholder')}
          className="w-40 bg-transparent text-[12px] text-slate-200 placeholder:text-slate-500 outline-none"
        />
      </div>

      {open && q.trim() && (
        <div className="absolute top-full left-0 mt-1 w-56 z-30 glass rounded-md overflow-hidden py-1">
          {matches.length === 0 ? (
            <div className="px-3 py-1.5 text-[11px] text-slate-500">{t('search.noResults')}</div>
          ) : (
            matches.map((d, i) => (
              <button
                key={d.district}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(d)}
                onMouseEnter={() => setHi(i)}
                className={`w-full text-left px-3 py-1.5 text-[11.5px] flex items-center justify-between gap-2 transition-colors ${
                  i === hi ? 'bg-slate-700/50 text-slate-100' : 'text-slate-300'
                }`}
              >
                <span className="truncate">{td(d.district)}</span>
                <svg viewBox="0 0 24 24" width="11" height="11" fill="none" className="text-slate-500 shrink-0" aria-hidden>
                  <path d="M12 21c4-4 6.5-7.2 6.5-10.5A6.5 6.5 0 0 0 5.5 10.5C5.5 13.8 8 17 12 21Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
                  <circle cx="12" cy="10.5" r="1.8" stroke="currentColor" strokeWidth="1.4" />
                </svg>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

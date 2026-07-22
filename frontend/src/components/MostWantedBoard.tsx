import { useEffect, useMemo, useRef, useState } from 'react'
import type { OffenderDossier, ThreatTier } from '../lib/data'
import { THREAT_COLORS } from '../lib/data'
import { useI18n } from '../lib/i18n'

interface Props {
  offenders: OffenderDossier[]
  onSelect: (offenderId: string) => void
}

interface PNode {
  id: string
  name: string
  rank: number
  score: number
  tier: ThreatTier
  x: number // % of board width
  y: number // % of board height
  rot: number
}
interface PEdge { a: string; b: string; weight: number }
interface View { scale: number; tx: number; ty: number }

const STRING = '#e0483d'
const MIN_SCALE = 0.55
const MAX_SCALE = 3.5
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
function tilt(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  return ((h % 9) - 4) * 0.8
}

// rows, apex first (highest caseload on top)
const ROWS = [2, 4, 6, 8, 10, 10]
const ROW_Y = [12, 27, 43, 59, 74, 89]
const ROW_CARD = [86, 76, 66, 60, 58, 58]

export default function MostWantedBoard({ offenders, onSelect }: Props) {
  const { t } = useI18n()
  const [hover, setHover] = useState<string | null>(null)
  const [view, setView] = useState<View>({ scale: 1, tx: 0, ty: 0 })
  const [panning, setPanning] = useState(false)
  const vpRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; y: number; tx: number; ty: number; moved: boolean } | null>(null)

  const { nodes, edges, adj, cardOf } = useMemo(() => {
    const list = [...offenders]
      .sort((a, b) => b.total_cases - a.total_cases || b.n_districts - a.n_districts)
      .slice(0, 40)
    const n = list.length
    const t1 = Math.ceil(n / 3)
    const t2 = Math.ceil((2 * n) / 3)
    const tierOf = (rankIdx: number): ThreatTier => (rankIdx < t1 ? 'high' : rankIdx < t2 ? 'medium' : 'low')
    const cardMap = new Map<string, number>()

    const nd: PNode[] = list.map((o, i) => {
      // find row + position
      let acc = 0, row = 0
      for (let r = 0; r < ROWS.length; r++) { if (i < acc + ROWS[r]) { row = r; break } acc += ROWS[r] }
      const inRow = i - acc
      const count = Math.min(ROWS[row], n - acc)
      const span = clamp(16 + (count - 1) * 8, 20, 88)
      const x = count === 1 ? 50 : 50 - span / 2 + (span * inRow) / (count - 1)
      cardMap.set(o.offender_id, ROW_CARD[row])
      return {
        id: o.offender_id, name: o.name, rank: i + 1, score: o.total_cases,
        tier: tierOf(i), x, y: ROW_Y[row], rot: tilt(o.offender_id),
      }
    })

    // real connections among the 40: co-offense + shared gang
    const ids = new Set(list.map((o) => o.offender_id))
    const seen = new Set<string>()
    const es: PEdge[] = []
    const add = (a: string, b: string, w: number) => {
      const k = a < b ? `${a}|${b}` : `${b}|${a}`
      if (seen.has(k)) return
      seen.add(k); es.push({ a, b, weight: w })
    }
    for (const o of list) {
      for (const as of o.associates || []) if (ids.has(as.offender_id)) add(o.offender_id, as.offender_id, as.shared_cases)
    }
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        if (list[i].gang_rank && list[i].gang_rank === list[j].gang_rank) add(list[i].offender_id, list[j].offender_id, 1)
      }
    }
    const a = new Map<string, Set<string>>()
    for (const e of es) {
      if (!a.has(e.a)) a.set(e.a, new Set()); if (!a.has(e.b)) a.set(e.b, new Set())
      a.get(e.a)!.add(e.b); a.get(e.b)!.add(e.a)
    }
    return { nodes: nd, edges: es, adj: a, cardOf: cardMap }
  }, [offenders])

  useEffect(() => {
    const el = vpRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const px = e.clientX - rect.left, py = e.clientY - rect.top
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12
      setView((v) => {
        const s = clamp(v.scale * factor, MIN_SCALE, MAX_SCALE); const k = s / v.scale
        return { scale: s, tx: px - (px - v.tx) * k, ty: py - (py - v.ty) * k }
      })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const zoomBy = (factor: number) => {
    const el = vpRef.current
    const w = el ? el.clientWidth : 600, h = el ? el.clientHeight : 400
    setView((v) => {
      const s = clamp(v.scale * factor, MIN_SCALE, MAX_SCALE); const k = s / v.scale
      return { scale: s, tx: w / 2 - (w / 2 - v.tx) * k, ty: h / 2 - (h / 2 - v.ty) * k }
    })
  }
  const resetView = () => setView({ scale: 1, tx: 0, ty: 0 })

  const onDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return
    drag.current = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty, moved: false }
    setPanning(true)
  }
  const onMove = (e: React.MouseEvent) => {
    const d = drag.current
    if (!d) return
    const dx = e.clientX - d.x, dy = e.clientY - d.y
    if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true
    setView((v) => ({ ...v, tx: d.tx + dx, ty: d.ty + dy }))
  }
  const endPan = () => { drag.current = null; setPanning(false) }

  const posById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes])
  const isLit = (id: string) => !hover || hover === id || adj.get(hover)?.has(id)
  const edgeLit = (e: PEdge) => !hover || e.a === hover || e.b === hover

  if (nodes.length === 0) {
    return <div className="absolute inset-0 grid place-items-center"><div className="text-sm text-slate-500">{t('common.loading')}</div></div>
  }

  return (
    <div
      ref={vpRef}
      className="absolute inset-0 overflow-hidden select-none"
      onMouseDown={onDown} onMouseMove={onMove} onMouseUp={endPan} onMouseLeave={endPan}
      style={{
        cursor: panning ? 'grabbing' : 'grab',
        background: 'radial-gradient(ellipse 78% 68% at 50% 22%, #2b3138 0%, #21262c 42%, #191d22 74%, #121519 100%)',
      }}
    >
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: 'radial-gradient(ellipse 46% 34% at 50% 6%, rgba(230,180,120,0.11), transparent 60%), radial-gradient(rgba(255,255,255,0.025) 1px, transparent 1px)',
        backgroundSize: 'auto, 4px 4px', boxShadow: 'inset 0 0 240px rgba(0,0,0,0.8)',
      }} />

      {/* MOST WANTED header stencil */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 text-center pointer-events-none">
        <div className="text-[11px] font-bold tracking-[0.35em] text-slate-300">{t('war.mostWanted').toUpperCase()}</div>
        <div className="text-[9px] text-slate-500">{t('war.wantedNote')}</div>
      </div>

      {/* pan + zoom camera */}
      <div className="absolute inset-0" style={{ transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.scale})`, transformOrigin: '0 0' }}>
        <div className="absolute inset-0" style={{ perspective: '1500px' }}>
          <div className="absolute inset-0" style={{ transformStyle: 'preserve-3d', transform: 'rotateX(6deg)' }}>
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 1000 640" preserveAspectRatio="none" style={{ transform: 'translateZ(2px)' }}>
              {edges.map((e, i) => {
                const a = posById.get(e.a), b = posById.get(e.b)
                if (!a || !b) return null
                const x1 = (a.x / 100) * 1000, y1 = (a.y / 100) * 640
                const x2 = (b.x / 100) * 1000, y2 = (b.y / 100) * 640
                const mx = (x1 + x2) / 2, my = (y1 + y2) / 2 + 20
                const lit = edgeLit(e)
                return <path key={i} d={`M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`} fill="none" stroke={STRING}
                  strokeOpacity={lit ? 0.85 : 0.14} strokeWidth={lit ? 1.4 + Math.min(2.5, e.weight) : 1} />
              })}
            </svg>

            {nodes.map((n) => {
              const lit = isLit(n.id)
              const w = cardOf.get(n.id) ?? 60
              const h = w * 1.28
              const color = THREAT_COLORS[n.tier]
              const initials = n.name.split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase()
              const hovered = hover === n.id
              const isApex = n.rank === 1
              const baseZ = isApex ? 40 : n.tier === 'high' ? 22 : n.tier === 'medium' ? 12 : 6
              return (
                <button
                  key={n.id}
                  onMouseEnter={() => setHover(n.id)} onMouseLeave={() => setHover(null)}
                  onClick={() => { if (!drag.current?.moved) onSelect(n.id) }}
                  className="absolute focus:outline-none"
                  style={{
                    left: `${n.x}%`, top: `${n.y}%`, width: w, transformStyle: 'preserve-3d',
                    transform: `translate(-50%,-50%) rotate(${n.rot}deg) translateZ(${hovered ? 82 : baseZ}px) scale(${hovered ? 1.09 : 1})`,
                    transition: 'transform 180ms cubic-bezier(.2,.7,.3,1), opacity 160ms',
                    opacity: lit ? 1 : 0.26, zIndex: hovered ? 60 : isApex ? 40 : 10, cursor: 'pointer',
                  }}
                >
                  {isApex && (
                    <svg viewBox="0 0 24 24" width={20} height={20} className="absolute left-1/2 -translate-x-1/2 -top-6" style={{ color }} aria-hidden>
                      <path d="M3 8l4 4 5-7 5 7 4-4-2 11H5L3 8z" fill="currentColor" stroke="rgba(0,0,0,0.35)" strokeWidth="0.6" />
                    </svg>
                  )}
                  <span className="absolute left-1/2 -translate-x-1/2 -top-1.5 rounded-full" style={{
                    width: 10, height: 10, background: `radial-gradient(circle at 35% 30%, #ff8a80, ${STRING} 60%, #7f1d16)`, boxShadow: '0 2px 3px rgba(0,0,0,0.6)',
                  }} />
                  <div className="rounded-[3px] p-[3px] pb-0" style={{
                    background: 'linear-gradient(180deg,#efe9df,#d9d2c4)',
                    boxShadow: hovered ? `0 26px 40px -10px rgba(0,0,0,0.85), 0 0 0 2px ${color}`
                      : isApex ? `0 16px 26px -10px rgba(0,0,0,0.8), 0 0 0 1.5px ${color}` : '0 12px 22px -10px rgba(0,0,0,0.75)',
                  }}>
                    <div className="relative overflow-hidden" style={{ height: h * 0.7, background: 'linear-gradient(160deg,#4a4f57,#23262c 70%,#15171b)' }}>
                      <svg viewBox="0 0 24 24" className="absolute left-1/2 -translate-x-1/2 bottom-0" width={w * 0.72} height={w * 0.72} style={{ color: '#8b93a1' }} aria-hidden>
                        <circle cx="12" cy="8.5" r="4.2" fill="currentColor" />
                        <path d="M3.5 22c0-4.4 3.8-7 8.5-7s8.5 2.6 8.5 7" fill="currentColor" />
                      </svg>
                      <div className="absolute inset-0" style={{ backgroundImage: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.18) 0 1px, transparent 1px 3px)' }} />
                      <span className="absolute top-0 left-0 text-[7px] font-bold px-1 py-[1px]" style={{ background: color, color: '#15181c' }}>#{n.rank}</span>
                      <span className="absolute top-0 right-0 text-[7px] font-bold px-1 py-[1px] text-slate-200" style={{ background: 'rgba(0,0,0,0.55)' }}>{initials}</span>
                    </div>
                    <div className="px-1 py-[3px] text-center">
                      <div className="text-[8px] font-semibold leading-tight text-[#2a2620] truncate">{n.name}</div>
                      <div className="text-[6.5px] leading-tight" style={{ color }}>{n.score.toFixed(0)} {t('war.cases')}</div>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* zoom controls */}
      <div className="absolute bottom-3 right-3 z-20 flex flex-col gap-1">
        <button onClick={() => zoomBy(1.25)} className="glass w-8 h-8 rounded-md grid place-items-center text-slate-200 hover:text-sky-300 text-lg leading-none" aria-label="zoom in">+</button>
        <button onClick={() => zoomBy(1 / 1.25)} className="glass w-8 h-8 rounded-md grid place-items-center text-slate-200 hover:text-sky-300 text-lg leading-none" aria-label="zoom out">−</button>
        <button onClick={resetView} className="glass w-8 h-8 rounded-md grid place-items-center text-slate-300 hover:text-sky-300" aria-label="reset view">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" aria-hidden><path d="M4 9V5h4M20 9V5h-4M4 15v4h4M20 15v4h-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </div>
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 text-[10px] text-slate-500 pointer-events-none">{t('board.nav')}</div>
    </div>
  )
}

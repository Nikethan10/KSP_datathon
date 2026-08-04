import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { GangNetwork, ThreatTier } from '../lib/data'
import { THREAT_COLORS } from '../lib/data'
import { rosterFor } from '../lib/gang'
import type { GangRole } from '../lib/gang'
import { useI18n } from '../lib/i18n'

interface Props {
  rank: number | null
  tier: ThreatTier | null
  network: GangNetwork | null
  onSelectNode: (offenderId: string) => void
}

type Role = GangRole
interface PNode {
  id: string
  name: string
  size: number
  deg: number
  role: Role
  x: number // virtual-board pixels (centre of the card)
  y: number // virtual-board pixels (centre of the card)
  rot: number // deterministic tilt for the "pinned photo" look
}
interface PEdge { a: string; b: string; weight: number }
interface View { scale: number; tx: number; ty: number }

// deterministic small rotation from an id string
function tilt(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  return ((h % 9) - 4) * 0.9 // ~ -3.6 .. 3.6 deg
}
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const STRING = '#e0483d' // evidence-board red string
const dimsFor = (role: Role) => (role === 'boss' ? 110 : role === 'lieutenant' ? 96 : 84)
const CARD_RATIO = 1.32
const MIN_SCALE = 0.4
const MAX_SCALE = 3.5

export default function GangBoard({ rank, tier, network, onSelectNode }: Props) {
  const { t } = useI18n()
  const [hover, setHover] = useState<string | null>(null)
  const [view, setView] = useState<View>({ scale: 1, tx: 0, ty: 0 })
  const [panning, setPanning] = useState(false)
  const vpRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ w: 1000, h: 620 })
  const drag = useRef<{ x: number; y: number; tx: number; ty: number; moved: boolean } | null>(null)

  const { nodes, edges, adj, extent } = useMemo(() => {
    if (!network || rank == null) {
      return { nodes: [] as PNode[], edges: [] as PEdge[], adj: new Map<string, Set<string>>(), extent: { x: 0, y: 0, w: 1, h: 1 } }
    }
    const members = rosterFor(network, rank)
    const ids = new Set(members.map((m) => m.id))
    const es: PEdge[] = network.edges
      .filter((e) => ids.has(e.data.source) && ids.has(e.data.target))
      .map((e) => ({ a: e.data.source, b: e.data.target, weight: e.data.weight }))

    // same ranked members/roles as the side roster, plus layout coordinates
    const nd: PNode[] = members.map((m) => ({
      id: m.id, name: m.name, size: m.size, deg: m.deg, role: m.role, x: 0, y: 0, rot: tilt(m.id),
    }))

    const boss = nd[0]
    const lts = nd.filter((n) => n !== boss && n.role === 'lieutenant')
    const sol = nd.filter((n) => n !== boss && n.role !== 'lieutenant')

    /* Hierarchy layout in virtual pixels.

       Cards are a fixed pixel size but used to be positioned as a percentage
       of the board, so the gap between rows shrank with the viewport while the
       cards did not - on a short console the rows simply sat on top of each
       other. Laying out in a virtual space with real card dimensions makes the
       spacing a property of the layout instead of the window, and fitView
       scales the whole board to fit whatever room it actually has. */
    const GAP_X = 30
    const GAP_Y = 52

    /* How many per row is not a fixed number: a wide, short console wants long
       rows, a narrow one wants more of them. Try each shape and keep whichever
       lets the cards render largest, so the board fills the room it has instead
       of being scaled down to fit a guess. */
    const head = [...(boss ? [boss] : []), ...lts]
    const solW = dimsFor('soldier'), solH = solW * CARD_RATIO
    const ltW = dimsFor('lieutenant'), ltH = ltW * CARD_RATIO
    const bossH = dimsFor('boss') * CARD_RATIO
    let perRow = Math.max(1, sol.length)
    if (sol.length > 1) {
      let best = -Infinity
      for (let cand = 3; cand <= Math.min(12, sol.length); cand++) {
        const r = Math.ceil(sol.length / cand)
        const headW = head.length
          ? (boss ? dimsFor('boss') : 0) + lts.length * ltW + (head.length - 1) * GAP_X
          : 0
        const w = Math.max(cand * solW + (cand - 1) * GAP_X, headW)
        const headH = head.length ? Math.max(boss ? bossH : 0, lts.length ? ltH : 0) + GAP_Y : 0
        const h = headH + r * solH + (r - 1) * GAP_Y
        const fit = Math.min(box.w / (w + 80), box.h / (h + 80))
        if (fit > best) { best = fit; perRow = cand }
      }
    }

    const rows: PNode[][] = []
    if (head.length) {
      // most-connected in the middle, lieutenants fanned either side
      const ordered: PNode[] = []
      lts.forEach((n, i) => (i % 2 === 0 ? ordered.push(n) : ordered.unshift(n)))
      if (boss) ordered.splice(Math.floor(ordered.length / 2), 0, boss)
      rows.push(ordered)
    }
    for (let i = 0; i < sol.length; i += perRow) rows.push(sol.slice(i, i + perRow))

    let cursorY = 0
    for (const row of rows) {
      const widths = row.map((n) => dimsFor(n.role))
      const rowH = Math.max(...widths) * CARD_RATIO
      const rowW = widths.reduce((a, b) => a + b, 0) + (row.length - 1) * GAP_X
      let x = -rowW / 2
      row.forEach((n, i) => {
        n.x = x + widths[i] / 2
        n.y = cursorY + rowH / 2
        x += widths[i] + GAP_X
      })
      cursorY += rowH + GAP_Y
    }

    const a = new Map<string, Set<string>>()
    for (const e of es) {
      if (!a.has(e.a)) a.set(e.a, new Set())
      if (!a.has(e.b)) a.set(e.b, new Set())
      a.get(e.a)!.add(e.b)
      a.get(e.b)!.add(e.a)
    }
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    for (const n of nd) {
      const cw = dimsFor(n.role), ch = cw * CARD_RATIO
      minX = Math.min(minX, n.x - cw / 2); maxX = Math.max(maxX, n.x + cw / 2)
      minY = Math.min(minY, n.y - ch / 2); maxY = Math.max(maxY, n.y + ch / 2)
    }
    const PAD = 40
    const extent = nd.length
      ? { x: minX - PAD, y: minY - PAD, w: maxX - minX + PAD * 2, h: maxY - minY + PAD * 2 }
      : { x: 0, y: 0, w: 1, h: 1 }
    // shift so the content starts at the origin of the virtual board
    for (const n of nd) { n.x -= extent.x; n.y -= extent.y }

    return { nodes: nd, edges: es, adj: a, extent }
  }, [network, rank, box.w, box.h])

  /* Frame the whole network whenever the gang changes. Opening at scale 1
     assumed the layout fits the viewport; on a short console it did not, and
     the lower rows were simply unreachable. */
  const fitView = useCallback(() => {
    const el = vpRef.current
    if (!el || nodes.length === 0) return { scale: 1, tx: 0, ty: 0 }
    const w = el.clientWidth, h = el.clientHeight
    if (!w || !h) return { scale: 1, tx: 0, ty: 0 }
    // the stage as laid out, not as remembered
    const sw = stageRef.current?.offsetWidth || extent.w
    const sh = stageRef.current?.offsetHeight || extent.h
    const scale = clamp(Math.min(w / sw, h / sh), MIN_SCALE, MAX_SCALE)
    return { scale, tx: (w - sw * scale) / 2, ty: (h - sh * scale) / 2 }
  }, [nodes, extent])

  useLayoutEffect(() => { setView(fitView()); setHover(null) }, [rank, fitView])

  // the sidebar and window change the room available; re-shape and re-frame
  useEffect(() => {
    const el = vpRef.current
    if (!el) return
    const measure = () => {
      const w = el.clientWidth, h = el.clientHeight
      if (w > 0 && h > 0) setBox((b) => (b.w === w && b.h === h ? b : { w, h }))
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    /* A window resize is listened for as well as observed. The observer covers
       the panel changing shape around a still window (the sidebar, a lens
       switch); the event covers the window itself, which does not always reach
       the observer. Either way measure() is idempotent, so both firing is
       harmless and only one needs to arrive. */
    window.addEventListener('resize', measure)
    return () => { ro.disconnect(); window.removeEventListener('resize', measure) }
    /* Keyed on the node count for the same reason as the wheel listener: the
       board early-returns a placeholder until the network arrives, so on the
       first mount vpRef is null and an effect keyed on [] would observe
       nothing and never re-run - leaving the board frozen at whatever zoom it
       opened with while the window changed size around it. */
  }, [nodes.length])

  useLayoutEffect(() => { setView(fitView()) }, [box.w, box.h, fitView])

  // wheel-to-zoom toward the cursor (native listener so we can preventDefault)
  useEffect(() => {
    const el = vpRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const px = e.clientX - rect.left
      const py = e.clientY - rect.top
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12
      setView((v) => {
        const s = clamp(v.scale * factor, MIN_SCALE, MAX_SCALE)
        const k = s / v.scale
        return { scale: s, tx: px - (px - v.tx) * k, ty: py - (py - v.ty) * k }
      })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
    /* Depends on the node count because the board early-returns a placeholder
       while the network loads: on first mount vpRef is null, so an effect keyed
       on [] attached nothing and scroll-to-zoom was dead for the whole session. */
  }, [nodes.length])

  const zoomBy = (factor: number) => {
    const el = vpRef.current
    const w = el ? el.clientWidth : 600
    const h = el ? el.clientHeight : 400
    setView((v) => {
      const s = clamp(v.scale * factor, MIN_SCALE, MAX_SCALE)
      const k = s / v.scale
      return { scale: s, tx: w / 2 - (w / 2 - v.tx) * k, ty: h / 2 - (h / 2 - v.ty) * k }
    })
  }
  const resetView = () => setView(fitView())

  // drag-to-pan (ignores drags that start on a card)
  const onDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return
    drag.current = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty, moved: false }
    setPanning(true)
  }
  const onMove = (e: React.MouseEvent) => {
    const d = drag.current
    if (!d) return
    const dx = e.clientX - d.x
    const dy = e.clientY - d.y
    if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true
    setView((v) => ({ ...v, tx: d.tx + dx, ty: d.ty + dy }))
  }
  const endPan = () => { drag.current = null; setPanning(false) }

  const color = tier ? THREAT_COLORS[tier] : '#c9a24a'
  const posById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes])
  const isLit = (id: string) => !hover || hover === id || adj.get(hover)?.has(id)
  const edgeLit = (e: PEdge) => !hover || e.a === hover || e.b === hover

  if (rank == null || nodes.length === 0) {
    return (
      <div className="absolute inset-0 grid place-items-center">
        <div className="text-sm text-slate-500">{t('board.pick')}</div>
      </div>
    )
  }

  const roleLabel: Record<Role, string> = {
    boss: t('board.boss'), lieutenant: t('board.lieutenant'), soldier: t('board.soldier'),
  }

  return (
    <div
      ref={vpRef}
      className="absolute inset-0 overflow-hidden select-none"
      onMouseDown={onDown}
      onMouseMove={onMove}
      onMouseUp={endPan}
      onMouseLeave={endPan}
      style={{
        cursor: panning ? 'grabbing' : 'grab',
        background:
          'radial-gradient(ellipse 75% 65% at 50% 30%, #2b3138 0%, #21262c 42%, #191d22 74%, #121519 100%)',
      }}
    >
      {/* fixed wall texture + vignette + warm spotlight from the top */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(ellipse 44% 40% at 50% 8%, rgba(230,180,120,0.10), transparent 60%), radial-gradient(rgba(255,255,255,0.025) 1px, transparent 1px)',
          backgroundSize: 'auto, 4px 4px',
          boxShadow: 'inset 0 0 240px rgba(0,0,0,0.8)',
        }}
      />

      {/* pan + zoom camera over a stage sized to the layout itself */}
      <div
        ref={stageRef}
        className="absolute top-0 left-0"
        style={{
          width: extent.w,
          height: extent.h,
          transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.scale})`,
          transformOrigin: '0 0',
        }}
      >
        {/* perspective + tilted board plane for real depth */}
        <div className="absolute inset-0" style={{ perspective: '1500px' }}>
          <div
            className="absolute inset-0"
            style={{ transformStyle: 'preserve-3d', transform: 'rotateX(7deg)' }}
          >
            {/* red-string connection layer */}
            <svg
              className="absolute inset-0 w-full h-full"
              viewBox={`0 0 ${extent.w} ${extent.h}`}
              style={{ transform: 'translateZ(2px)' }}
            >
              {edges.map((e, i) => {
                const a = posById.get(e.a); const b = posById.get(e.b)
                if (!a || !b) return null
                const x1 = a.x, y1 = a.y
                const x2 = b.x, y2 = b.y
                const mx = (x1 + x2) / 2, my = (y1 + y2) / 2 + 22
                const lit = edgeLit(e)
                return (
                  <path
                    key={i}
                    d={`M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`}
                    fill="none"
                    stroke={STRING}
                    strokeOpacity={lit ? 0.85 : 0.12}
                    strokeWidth={lit ? 1.4 + Math.min(2.5, e.weight) : 0.9}
                  />
                )
              })}
            </svg>

            {/* mugshot cards */}
            {nodes.map((n) => {
              const lit = isLit(n.id)
              const w = dimsFor(n.role)
              const h = w * CARD_RATIO
              const initials = n.name.split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase()
              const hovered = hover === n.id
              const isBoss = n.role === 'boss'
              const baseZ = isBoss ? 34 : n.role === 'lieutenant' ? 18 : 6
              return (
                <button
                  key={n.id}
                  onMouseEnter={() => setHover(n.id)}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => { if (!drag.current?.moved) onSelectNode(n.id) }}
                  className="absolute focus:outline-none"
                  style={{
                    left: n.x,
                    top: n.y,
                    width: w,
                    transformStyle: 'preserve-3d',
                    transform: `translate(-50%,-50%) rotate(${n.rot}deg) translateZ(${hovered ? 78 : baseZ}px) scale(${hovered ? 1.08 : 1})`,
                    transition: 'transform 180ms cubic-bezier(.2,.7,.3,1), opacity 160ms',
                    opacity: lit ? 1 : 0.26,
                    zIndex: hovered ? 60 : isBoss ? 30 : 10,
                    cursor: 'pointer',
                  }}
                >
                  {/* boss crown */}
                  {isBoss && (
                    <svg viewBox="0 0 24 24" width={20} height={20} className="absolute left-1/2 -translate-x-1/2 -top-6" style={{ color }} aria-hidden>
                      <path d="M3 8l4 4 5-7 5 7 4-4-2 11H5L3 8z" fill="currentColor" stroke="rgba(0,0,0,0.35)" strokeWidth="0.6" />
                    </svg>
                  )}
                  {/* red pushpin */}
                  <span
                    className="absolute left-1/2 -translate-x-1/2 -top-1.5 rounded-full"
                    style={{
                      width: 10, height: 10, background: `radial-gradient(circle at 35% 30%, #ff8a80, ${STRING} 60%, #7f1d16)`,
                      boxShadow: '0 2px 3px rgba(0,0,0,0.6)',
                    }}
                  />
                  {/* photo frame */}
                  <div
                    className="rounded-[3px] p-[3px] pb-0"
                    style={{
                      background: 'linear-gradient(180deg,#efe9df,#d9d2c4)',
                      boxShadow: hovered
                        ? `0 26px 40px -10px rgba(0,0,0,0.85), 0 0 0 2px ${color}`
                        : isBoss
                          ? `0 16px 26px -10px rgba(0,0,0,0.8), 0 0 0 1.5px ${color}aa`
                          : '0 12px 22px -10px rgba(0,0,0,0.75)',
                    }}
                  >
                    {/* grayscale mugshot */}
                    <div
                      className="relative overflow-hidden"
                      style={{ height: h * 0.5, background: 'linear-gradient(160deg,#4a4f57,#23262c 70%,#15171b)' }}
                    >
                      <svg viewBox="0 0 24 24" className="absolute left-1/2 -translate-x-1/2 bottom-0" width={w * 0.72} height={w * 0.72} style={{ color: '#8b93a1' }} aria-hidden>
                        <circle cx="12" cy="8.5" r="4.2" fill="currentColor" />
                        <path d="M3.5 22c0-4.4 3.8-7 8.5-7s8.5 2.6 8.5 7" fill="currentColor" />
                      </svg>
                      <div className="absolute inset-0" style={{ backgroundImage: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.18) 0 1px, transparent 1px 3px)' }} />
                      <span className="absolute top-0 right-0 text-[9px] font-bold px-1 py-[1px]" style={{ background: color, color: '#15181c' }}>
                        {initials}
                      </span>
                      {n.role !== 'soldier' && (
                        <span className="absolute bottom-0 left-0 text-[9px] font-bold tracking-wide px-1 py-[1px] max-w-full truncate"
                          style={{ background: 'rgba(0,0,0,0.6)', color }}>
                          {roleLabel[n.role]}
                        </span>
                      )}
                    </div>
                    {/* name plate */}
                    <div className="px-1 pt-[4px] pb-[5px] text-center">
                      <div className="text-[11.5px] font-semibold leading-[1.3] text-[#2a2620] truncate">{n.name}</div>
                      <div className="mt-[2px] text-[10px] leading-[1.3] text-[#5c564a] truncate">{t('board.links').replace('{n}', String(n.deg))}</div>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* zoom controls (fixed — not affected by pan/zoom) */}
      <div className="absolute bottom-3 right-3 z-20 flex flex-col items-stretch gap-1">
        <button onClick={() => zoomBy(1.25)} className="glass w-8 h-8 rounded-md grid place-items-center text-slate-200 hover:text-sky-300 text-lg leading-none" aria-label="zoom in">+</button>
        <button onClick={() => zoomBy(1 / 1.25)} className="glass w-8 h-8 rounded-md grid place-items-center text-slate-200 hover:text-sky-300 text-lg leading-none" aria-label="zoom out">−</button>
        <button onClick={resetView} className="glass w-8 h-8 rounded-md grid place-items-center text-slate-300 hover:text-sky-300" aria-label="reset view">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" aria-hidden>
            <path d="M4 9V5h4M20 9V5h-4M4 15v4h4M20 15v4h-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* nav hint */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 text-[10px] text-slate-500 pointer-events-none">
        {t('board.nav')}
      </div>
    </div>
  )
}

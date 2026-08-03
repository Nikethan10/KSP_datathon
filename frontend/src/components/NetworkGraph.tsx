import { useEffect, useRef } from 'react'
import ForceGraph3D from '3d-force-graph'
import * as THREE from 'three'
import { THREAT_COLORS } from '../lib/data'
import type { GangNetwork, ThreatTier } from '../lib/data'

interface GraphNode {
  id: string
  name: string
  val: number
  gang: number
  tier: ThreatTier
  threat: number
  deg: number
}
type LinkEnd = string | { id: string }

interface Props {
  gangNetwork: GangNetwork | null
  highlightGang: number | null // gang_rank to spotlight
  focusOffenderId?: string | null // spotlight + fly to a single offender node
  onNodeSelect?: (offenderId: string) => void // click a node -> open dossier
}

const DIM = '#1c2431'       // fully dimmed (non-focused on hover)
const DIM_SOFT = '#33404f'  // softly dimmed (other gangs when one is selected)

const endId = (e: LinkEnd): string => (typeof e === 'object' ? e.id : e)

interface Vec3 { x: number; y: number; z: number }

// Give each gang its own anchor point spread over a (flattened) sphere so the
// crews separate into distinct constellations instead of collapsing into one
// uniform ball — the scattered "evidence board" look.
function gangAnchors(gangIds: number[], radius: number): Map<number, Vec3> {
  const m = new Map<number, Vec3>()
  const n = gangIds.length
  const golden = Math.PI * (3 - Math.sqrt(5)) // golden angle
  gangIds.forEach((g, i) => {
    const y = n > 1 ? 1 - (i / (n - 1)) * 2 : 0 // 1 .. -1
    const rad = Math.sqrt(Math.max(0, 1 - y * y))
    const theta = golden * i
    m.set(g, {
      x: Math.cos(theta) * rad * radius,
      y: y * radius * 0.55, // flatten vertically -> reads more like a board
      z: Math.sin(theta) * rad * radius,
    })
  })
  return m
}

// Custom d3 force: nudge every node toward its gang's anchor each tick.
function clusterForce(anchors: Map<number, Vec3>, strength: number) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let nodes: any[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const force: any = (alpha: number) => {
    for (const nd of nodes) {
      const a = anchors.get(nd.gang)
      if (!a) continue
      const k = strength * alpha
      nd.vx += (a.x - nd.x) * k
      nd.vy += (a.y - nd.y) * k
      nd.vz += (a.z - nd.z) * k
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  force.initialize = (n: any[]) => { nodes = n }
  return force
}

export default function NetworkGraph({ gangNetwork, highlightGang, focusOffenderId, onNodeSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const graphRef = useRef<any>(null)
  const hoveredRef = useRef<string | null>(null)
  const hlGangRef = useRef<number | null>(highlightGang)
  const focusRef = useRef<string | null>(focusOffenderId ?? null)
  const onSelectRef = useRef(onNodeSelect)
  const fittedRef = useRef(false)
  const adjRef = useRef<Map<string, Set<string>>>(new Map())
  hlGangRef.current = highlightGang
  onSelectRef.current = onNodeSelect

  useEffect(() => {
    const el = containerRef.current
    if (!el || graphRef.current) return

    // active spotlight = whichever of hover / persistent focus is set (hover wins)
    const activeSpot = (): string | null => hoveredRef.current ?? focusRef.current
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nodeColor = (n: any): string => {
      const g = n as GraphNode
      const spot = activeSpot()
      if (spot) return spot === g.id || adjRef.current.get(spot)?.has(g.id) ? THREAT_COLORS[g.tier] : DIM
      const hl = hlGangRef.current
      if (hl != null && g.gang !== hl) return DIM_SOFT
      return THREAT_COLORS[g.tier]
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const isIncident = (l: any): boolean => {
      const spot = activeSpot()
      return !!spot && (endId(l.source) === spot || endId(l.target) === spot)
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const linkColor = (l: any): string => {
      if (activeSpot()) return isIncident(l) ? 'rgba(226,240,255,0.75)' : 'rgba(120,140,165,0.04)'
      const hl = hlGangRef.current
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (hl != null) return (l.source as any).gang === hl ? 'rgba(148,178,210,0.4)' : 'rgba(120,140,165,0.05)'
      return 'rgba(130,150,175,0.18)'
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const linkWidth = (l: any): number => (isIncident(l) ? 1.4 : 0.5)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const linkParticles = (l: any): number => (activeSpot() ? (isIncident(l) ? 3 : 0) : 0)

    const fg = new ForceGraph3D(el)
      .backgroundColor('rgba(0,0,0,0)') // transparent -> CSS gradient shows through
      .showNavInfo(false)
      .nodeRelSize(7)
      .nodeResolution(16)
      .nodeOpacity(0.94)
      // bigger floor size so every node is easy to hover/click, big offenders still stand out
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .nodeVal((n: any) => Math.max(3, (n as GraphNode).val))
      .nodeColor(nodeColor)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .nodeLabel((n: any) => {
        const g = n as GraphNode
        const tierTxt = { high: 'HIGH THREAT', medium: 'MEDIUM THREAT', low: 'LOW THREAT' }[g.tier]
        return `<div style="font-family:ui-sans-serif,system-ui;font-size:12px;background:rgba(9,13,20,0.95);color:#e6edf3;padding:6px 9px;border-radius:7px;border:1px solid ${THREAT_COLORS[g.tier]}66;box-shadow:0 4px 16px rgba(0,0,0,0.55)">
          <div style="font-weight:600">${g.name}</div>
          <div style="font-size:10px;color:${THREAT_COLORS[g.tier]};font-weight:600;letter-spacing:0.04em">GANG #${g.gang} · ${tierTxt}</div>
          <div style="color:#8a939e;font-size:10.5px">${g.val} case${g.val === 1 ? '' : 's'} · ${g.deg} link${g.deg === 1 ? '' : 's'}</div>
        </div>`
      })
      .linkColor(linkColor)
      .linkWidth(linkWidth)
      .linkOpacity(0.5)
      .linkDirectionalParticles(linkParticles)
      .linkDirectionalParticleWidth(1.1)
      .linkDirectionalParticleSpeed(0.006)
      .linkDirectionalParticleColor(() => '#cfe3f5')
      .warmupTicks(90)
      .cooldownTicks(200)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .onNodeHover((node: any) => {
        hoveredRef.current = node ? (node as GraphNode).id : null
        el.style.cursor = node ? 'pointer' : 'grab'
        fg.nodeColor(nodeColor).linkColor(linkColor).linkWidth(linkWidth).linkDirectionalParticles(linkParticles)
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .onNodeClick((node: any) => {
        const d = 80
        const r = 1 + d / Math.hypot(node.x || 1, node.y || 1, node.z || 1)
        fg.cameraPosition({ x: node.x * r, y: node.y * r, z: node.z * r }, node, 1100)
        onSelectRef.current?.((node as GraphNode).id)
      })

    // tighter crews (short links, gentle repulsion) so each cluster stays
    // compact while the cluster force spreads the crews apart
    fg.d3Force('charge')?.strength(-34)
    fg.d3Force('link')?.distance(14)
    el.style.cursor = 'grab'

    // very soft bloom for depth — subtle, not the neon look
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const composer = (fg as any).postProcessingComposer?.()
      if (composer) {
        import('three/examples/jsm/postprocessing/UnrealBloomPass.js')
          .then(({ UnrealBloomPass }) => {
            const res = new THREE.Vector2(el.clientWidth, el.clientHeight)
            composer.addPass(new UnrealBloomPass(res, 0.35, 0.5, 0.2))
          })
          .catch(() => { /* optional */ })
      }
    } catch { /* optional */ }

    // once the layout settles, frame the whole spread of clusters
    fg.onEngineStop(() => {
      if (fittedRef.current) return
      fittedRef.current = true
      fg.zoomToFit(600, 90)
    })

    graphRef.current = fg

    const resize = () => fg.width(el.clientWidth).height(el.clientHeight)
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(el)

    return () => {
      ro.disconnect()
      fg._destructor?.()
      graphRef.current = null
    }
  }, [])

  // load gang network
  useEffect(() => {
    const fg = graphRef.current
    if (!fg || !gangNetwork) return

    const nodes: GraphNode[] = gangNetwork.nodes.map((n) => ({
      id: n.data.id,
      name: n.data.label,
      val: n.data.size,
      gang: n.data.gang,
      tier: n.data.tier,
      threat: n.data.threat,
      deg: n.data.degree,
    }))
    const links = gangNetwork.edges.map((e) => ({
      source: e.data.source,
      target: e.data.target,
      weight: e.data.weight,
    }))

    const adj = new Map<string, Set<string>>()
    for (const l of links) {
      if (!adj.has(l.source)) adj.set(l.source, new Set())
      if (!adj.has(l.target)) adj.set(l.target, new Set())
      adj.get(l.source)!.add(l.target)
      adj.get(l.target)!.add(l.source)
    }
    adjRef.current = adj

    fg.graphData({ nodes, links })

    // spread the gangs into separate constellations (evidence-board look)
    const gangIds = [...new Set(nodes.map((n) => n.gang))].sort((a, b) => a - b)
    const anchors = gangAnchors(gangIds, 190)
    fg.d3Force('cluster', clusterForce(anchors, 0.6))
    fittedRef.current = false
    // pull the camera back so the (now wide) spread is in frame immediately;
    // onEngineStop refines the framing once it settles
    fg.cameraPosition({ x: 0, y: 0, z: 560 })
    fg.d3ReheatSimulation?.()
  }, [gangNetwork])

  // spotlight + fly to a single offender node when selected from search/dossier
  useEffect(() => {
    focusRef.current = focusOffenderId ?? null
    const fg = graphRef.current
    if (!fg) return
    // re-apply colour accessors so the spotlight redraws
    fg.nodeColor(fg.nodeColor()).linkColor(fg.linkColor()).linkWidth(fg.linkWidth())
      .linkDirectionalParticles(fg.linkDirectionalParticles())
    if (focusOffenderId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const node = (fg.graphData().nodes as any[]).find((n) => n.id === focusOffenderId)
      if (node) {
        const dist = 90
        const r = 1 + dist / (Math.hypot(node.x || 1, node.y || 1, node.z || 1) || 1)
        fg.cameraPosition({ x: (node.x || 0) * r, y: (node.y || 0) * r, z: (node.z || 0) * r }, node, 1100)
      }
    }
  }, [focusOffenderId])

  // spotlight the selected gang + fly to it
  useEffect(() => {
    const fg = graphRef.current
    if (!fg) return
    fg.nodeColor(fg.nodeColor()).linkColor(fg.linkColor())
    if (highlightGang != null) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const gangNodes = (fg.graphData().nodes as any[]).filter((n) => n.gang === highlightGang)
      if (gangNodes.length) {
        const cx = gangNodes.reduce((s, n) => s + (n.x || 0), 0) / gangNodes.length
        const cy = gangNodes.reduce((s, n) => s + (n.y || 0), 0) / gangNodes.length
        const cz = gangNodes.reduce((s, n) => s + (n.z || 0), 0) / gangNodes.length
        const dist = 140
        const r = 1 + dist / (Math.hypot(cx, cy, cz) || 1)
        fg.cameraPosition({ x: cx * r, y: cy * r, z: cz * r }, { x: cx, y: cy, z: cz }, 1200)
      }
    }
  }, [highlightGang])

  return (
    <div
      className="absolute inset-0"
      style={{
        background:
          'radial-gradient(ellipse 90% 85% at 50% 32%, #2b3138 0%, #21262c 42%, #191d22 74%, #121519 100%)',
      }}
    >
      <div ref={containerRef} className="absolute inset-0" />
    </div>
  )
}

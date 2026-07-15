import { useEffect, useRef } from 'react'
import ForceGraph3D from '3d-force-graph'
import { COMMUNITY_COLORS } from '../lib/data'
import type { CytoNetwork } from '../lib/data'

interface GraphNode {
  id: string
  name: string
  val: number
  community: number
}

interface Props {
  network: CytoNetwork | null
  highlightIds: Set<string>
}

export default function NetworkGraph({ network, highlightIds }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const graphRef = useRef<any>(null)
  const highlightRef = useRef<Set<string>>(highlightIds)
  highlightRef.current = highlightIds

  useEffect(() => {
    const el = containerRef.current
    if (!el || graphRef.current) return

    const fg = new ForceGraph3D(el)
      .backgroundColor('#0a0e14')
      .showNavInfo(false)
      .nodeLabel((n) => {
        const g = n as unknown as GraphNode
        return `<div style="font-family:ui-sans-serif,system-ui;font-size:12px;background:rgba(13,17,23,0.92);color:#e6edf3;padding:4px 8px;border-radius:6px;border:1px solid rgba(56,189,248,0.25)">${g.name} &middot; ${g.val} case(s)</div>`
      })
      .nodeVal((n) => Math.max(1, (n as unknown as GraphNode).val))
      .nodeColor((n) => {
        const g = n as unknown as GraphNode
        return highlightRef.current.has(g.id)
          ? '#f59e0b'
          : COMMUNITY_COLORS[Math.abs(g.community) % COMMUNITY_COLORS.length]
      })
      .nodeOpacity(0.85)
      .linkColor(() => '#7dd3fc')
      .linkOpacity(0.08)
      .linkWidth(0)
      .warmupTicks(80)
      .cooldownTicks(160)

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

  // load / swap data
  useEffect(() => {
    const fg = graphRef.current
    if (!fg || !network) return
    const nodes: GraphNode[] = network.nodes.map((n) => ({
      id: n.data.id,
      name: n.data.label,
      val: n.data.size,
      community: n.data.community,
    }))
    const links = network.edges.map((e) => ({
      source: e.data.source,
      target: e.data.target,
      weight: e.data.weight,
    }))
    fg.graphData({ nodes, links })
  }, [network])

  // re-evaluate node colors when highlight changes
  useEffect(() => {
    const fg = graphRef.current
    if (!fg) return
    fg.nodeColor(fg.nodeColor())
  }, [highlightIds])

  return <div ref={containerRef} className="absolute inset-0" />
}

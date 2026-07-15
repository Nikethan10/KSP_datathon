import type { GangNetwork } from './data'

export type GangRole = 'boss' | 'lieutenant' | 'soldier'

export interface RosterMember {
  id: string
  name: string
  size: number // total cases
  deg: number // connections within the shown core
  role: GangRole
}

// Single source of truth for a gang's shown "core" members and their roles.
// Both the board (GangBoard) and the side roster (GangRoster) use this so the
// two views always show the exact same people in the same order.
export function rosterFor(network: GangNetwork | null, rank: number | null): RosterMember[] {
  if (!network || rank == null) return []
  const mine = network.nodes.filter((n) => n.data.gang === rank)
  const sorted = [...mine].sort((a, b) => b.data.degree - a.data.degree)
  const nLt = Math.min(5, Math.max(2, Math.round((sorted.length - 1) / 5)))
  return sorted.map((n, i) => ({
    id: n.data.id,
    name: n.data.label,
    size: n.data.size,
    deg: n.data.degree,
    role: i === 0 ? 'boss' : i <= nLt ? 'lieutenant' : 'soldier',
  }))
}

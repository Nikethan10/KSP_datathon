import { useEffect, useState } from 'react'
import PatrolMap from '../components/PatrolMap'
import BriefingPanel from '../components/BriefingPanel'
import { fetchJson } from '../lib/data'
import type { RiskCell, PatrolSummary, PatrolAllocation, PatrolBriefing } from '../lib/data'

interface AllocationFile {
  allocations: PatrolAllocation[]
  coverage_pct: number
}

export default function ActView() {
  const [cells, setCells] = useState<RiskCell[]>([])
  const [summary, setSummary] = useState<PatrolSummary | null>(null)
  const [patrols, setPatrols] = useState<PatrolAllocation[]>([])
  const [briefings, setBriefings] = useState<PatrolBriefing[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lon: number; zoom?: number } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetchJson<RiskCell[]>('risk_map.json'),
      fetchJson<PatrolSummary>('patrol_summary.json'),
      fetchJson<AllocationFile>('patrol_allocations.json'),
      fetchJson<PatrolBriefing[]>('patrol_briefings.json'),
    ]).then(([rc, s, a, b]) => {
      setCells(rc)
      setSummary(s)
      setPatrols(a.allocations)
      setBriefings(b)
      setLoading(false)
    }).catch((e) => console.error('act data load failed:', e))
  }, [])

  const handleSelect = (b: PatrolBriefing) => {
    setSelected(b.patrol_id)
    setFlyTarget({ lat: b.center_lat, lon: b.center_lon, zoom: 12.8 })
  }

  return (
    <div className="relative flex-1 min-h-0">
      <PatrolMap
        cells={cells}
        patrols={patrols}
        radiusKm={summary?.patrol_radius_km ?? 2}
        flyTarget={flyTarget}
      />

      <div className="absolute top-3 left-3 z-10">
        <div className="glass rounded-md px-3 py-1.5 text-[11px] text-slate-300">
          <span className="font-semibold text-sky-300">Patrol Optimizer</span>
          {' '}&middot; risk surface + optimal deployment &middot; click a patrol card to inspect
        </div>
        {loading && (
          <span className="glass rounded-md px-3 py-1.5 text-xs text-sky-300 animate-pulse mt-2 inline-block">
            loading analytics…
          </span>
        )}
      </div>

      <div className="absolute top-3 right-3 bottom-8 z-10 w-[360px] max-w-[calc(100vw-340px)] glass rounded-xl p-3.5 flex flex-col gap-3 min-h-0 overflow-hidden print-briefing">
        <BriefingPanel
          summary={summary}
          briefings={briefings}
          selected={selected}
          onSelect={handleSelect}
        />
      </div>
    </div>
  )
}

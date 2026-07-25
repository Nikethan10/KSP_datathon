import { useEffect, useRef, useState } from 'react'
import PatrolMap from '../components/PatrolMap'
import BriefingPanel from '../components/BriefingPanel'
import { fetchJson } from '../lib/data'
import { useI18n } from '../lib/i18n'
import { useFocus } from '../lib/focus'
import { useNav } from '../lib/nav'
import type {
  RiskCell, PatrolSummary, PatrolAllocation, PatrolBriefing, PatrolDistrict,
} from '../lib/data'

interface AllocationFile {
  allocations: PatrolAllocation[]
  coverage_pct: number
}

/* All patrol scenarios arrive as one bundle. Previously this tree was 444
   tiny files (37 districts x 4 unit-counts x 3 files); that exceeded
   Catalyst's ~500-file client-ZIP cap, so the deploy excluded it and the
   ACT tab shipped with no patrol data at all. See bundle_patrol.py. */
interface Scenario {
  patrol_summary: PatrolSummary
  patrol_allocations: AllocationFile
  patrol_briefings: PatrolBriefing[]
}
type PatrolBundle = Record<string, Record<string, Scenario>>

const FALLBACK_KEY = '_scenarios'

const PATROL_OPTIONS = [4, 6, 8, 10]

export default function ActView() {
  const [cells, setCells] = useState<RiskCell[]>([])
  const [summary, setSummary] = useState<PatrolSummary | null>(null)
  const [patrols, setPatrols] = useState<PatrolAllocation[]>([])
  const [briefings, setBriefings] = useState<PatrolBriefing[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lon: number; zoom?: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [numPatrols, setNumPatrols] = useState(6)
  const [hasScenarios, setHasScenarios] = useState(false)
  const [bundle, setBundle] = useState<PatrolBundle | null>(null)
  const [districts, setDistricts] = useState<PatrolDistrict[]>([])
  const [districtSafe, setDistrictSafe] = useState<string | null>(null)
  const prevDistrictRef = useRef<string | null>(null)
  const { t, td } = useI18n()
  const { focus } = useFocus()
  const { pending, consumePending } = useNav()

  // header search -> fly the patrol map there
  useEffect(() => {
    if (!focus) return
    setFlyTarget({ lat: focus.lat, lon: focus.lon, zoom: focus.zoom ?? 9.5 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus])

  useEffect(() => {
    fetchJson<RiskCell[]>('risk_map.json').then(setCells).catch(() => {})

    fetchJson<PatrolBundle>('patrol_bundle.json')
      .then((b) => {
        setBundle(b)
        setHasScenarios(FALLBACK_KEY in b)
      })
      .catch((e) => console.error('patrol bundle load failed:', e))

    // per-district scenarios — absent until the multi-district precompute has run
    fetchJson<PatrolDistrict[]>('patrol_districts.json')
      .then((d) => {
        if (!d.length) return
        setDistricts(d)
        const nav = consumePending()
        const target = nav?.district
          ? d.find((x) => x.district === nav.district)
          : null
        const initial = target ?? d[0]
        setDistrictSafe(initial.safe)
        if (!target) prevDistrictRef.current = initial.safe
      })
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // handle cross-tab navigation (e.g. deploy button from SENSE)
  useEffect(() => {
    if (!pending || pending.tab !== 'ACT' || !pending.district || districts.length === 0) return
    const target = districts.find((x) => x.district === pending.district)
    if (target) {
      setDistrictSafe(target.safe)
    }
    consumePending()
  }, [pending, districts, consumePending])

  // pick the scenario for the current district + unit count out of the bundle
  useEffect(() => {
    if (!bundle) return
    setLoading(true)

    const key = districtSafe && districtSafe in bundle ? districtSafe : FALLBACK_KEY
    const scenario = bundle[key]?.[`p${numPatrols}`]
    if (!scenario) {
      console.error('no patrol scenario for', key, `p${numPatrols}`)
      setLoading(false)
      return
    }

    const { patrol_summary: s, patrol_allocations: a, patrol_briefings: b } = scenario
    setSummary(s)
    setPatrols(a.allocations)
    setBriefings(b)
    setSelected(null)
    setLoading(false)

    // fly to the new district's patrol cluster when the district changes
    if (districtSafe && districtSafe !== prevDistrictRef.current && a.allocations.length) {
      const n = a.allocations.length
      const lat = a.allocations.reduce((s2, p) => s2 + p.center_lat, 0) / n
      const lon = a.allocations.reduce((s2, p) => s2 + p.center_lon, 0) / n
      setFlyTarget({ lat, lon, zoom: 10.6 })
      prevDistrictRef.current = districtSafe
    }
  }, [numPatrols, districtSafe, bundle])

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

      <div className="absolute top-3 left-3 z-10 flex flex-col gap-2">
        <div className="glass rounded-md px-3 py-1.5 text-[11px] text-slate-300">
          <span className="font-semibold text-sky-300">{t('act.patrolDeployment')}</span>
        </div>

        {districts.length > 1 && (
          <div className="glass rounded-md px-3 py-2 flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider text-slate-400">{t('act.district')}</span>
            <select
              value={districtSafe ?? ''}
              onChange={(e) => setDistrictSafe(e.target.value)}
              className="bg-transparent text-xs text-slate-200 outline-none cursor-pointer max-w-[190px]"
            >
              {districts.map((d) => (
                <option key={d.safe} value={d.safe} className="bg-slate-900">
                  {td(d.district)}
                </option>
              ))}
            </select>
          </div>
        )}

        {(hasScenarios || districts.length > 0) && (
          <div className="glass rounded-md px-3 py-2 flex items-center gap-3">
            <span className="text-[10px] uppercase tracking-wider text-slate-400">{t('act.numPatrols')}</span>
            <div className="flex items-center gap-1.5">
              {PATROL_OPTIONS.map((n) => (
                <button
                  key={n}
                  onClick={() => setNumPatrols(n)}
                  className={`w-8 h-7 rounded text-xs font-bold transition-colors ${
                    numPatrols === n
                      ? 'bg-sky-500/25 text-sky-300 border border-sky-400/40'
                      : 'text-slate-400 hover:text-slate-200 border border-slate-600/50'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        )}
        {loading && (
          <span className="glass rounded-md px-3 py-1.5 text-xs text-sky-300 animate-pulse">
            {t('common.loading')}
          </span>
        )}
      </div>

      <div className="absolute top-3 right-3 bottom-8 z-10 w-[360px] max-w-[calc(100vw-340px)] glass rounded-xl p-3.5 flex flex-col gap-3 min-h-0 overflow-hidden print-briefing">
        <div className="flex items-center justify-between shrink-0 pb-1 border-b border-slate-700/30 print:hidden">
          <div className="flex items-center gap-1.5">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" className="text-emerald-400" aria-hidden>
              <path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8Z" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="12" cy="10" r="3" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            <span className="text-[10px] uppercase tracking-widest text-slate-300 font-semibold">Deployment Center</span>
          </div>
          <span className="text-[8px] uppercase tracking-wider text-slate-500">Patrol Optimizer</span>
        </div>
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

import { useCallback, useEffect, useMemo, useState } from 'react'
import MapView from '../components/MapView'
import FilterBar from '../components/FilterBar'
import DistrictPanel from '../components/DistrictPanel'
import EmergingPanel from '../components/EmergingPanel'
import SocioEconomicPanel from '../components/SocioEconomicPanel'
import TrendChart from '../components/TrendChart'
import Legend from '../components/Legend'
import DossierOverlay from '../components/DossierOverlay'
import IntelFeed from '../components/IntelFeed'
import ThreatIndicator from '../components/ThreatIndicator'
import {
  fetchJson, loadHotspots, matchBoundaryToDataset, filterAnomalies,
  KARNATAKA_CENTER, KARNATAKA_ZOOM,
} from '../lib/data'
import {
  generateFeedItems, generateDistrictBrief,
  THREAT_LEVEL_COLORS,
} from '../lib/insights'
import { useFocus } from '../lib/focus'
import { useI18n } from '../lib/i18n'
import { useNav } from '../lib/nav'
import { useCountUp } from '../lib/useCountUp'
import type {
  HotspotPoint, DistrictSummary, TrendData, CrimeTypeBreakdown, DistrictCentroid,
  HotspotScope, EmergingData, EmergingCell, DistrictTrends, Anomaly,
  OffenderDossier as Dossier, OffenderIndex,
} from '../lib/data'

export default function SenseView() {
  const [hotspots, setHotspots] = useState<HotspotPoint[]>([])
  // cells the Gi* test covered — larger than hotspots.length, which now
  // holds only the significant ones actually drawn
  const [analysedCells, setAnalysedCells] = useState(0)
  const [districts, setDistricts] = useState<DistrictSummary[]>([])
  const [trends, setTrends] = useState<TrendData | null>(null)
  const [crimeTypes, setCrimeTypes] = useState<string[]>([])
  const [centroids, setCentroids] = useState<DistrictCentroid[]>([])
  const [boundaries, setBoundaries] = useState<GeoJSON.FeatureCollection | null>(null)
  const [emergingData, setEmergingData] = useState<EmergingData | null>(null)
  const [districtTrends, setDistrictTrends] = useState<DistrictTrends | null>(null)
  const [offenders, setOffenders] = useState<Dossier[]>([])
  const [anomalies, setAnomalies] = useState<Anomaly[]>([])
  const [selectedOffender, setSelectedOffender] = useState<Dossier | null>(null)

  const [crimeType, setCrimeType] = useState<string | null>(null)
  const [scope, setScope] = useState<HotspotScope>('state')
  const [showEmerging, setShowEmerging] = useState(false)
  const [showDemographics, setShowDemographics] = useState(false)
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null)
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lon: number; zoom?: number; pitch?: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const { focus } = useFocus()
  const { t, tc, td } = useI18n()
  const { navigateTo, pending, consumePending } = useNav()

  // header search -> fly the map + highlight the district
  useEffect(() => {
    if (!focus) return
    setFlyTarget({ lat: focus.lat, lon: focus.lon, zoom: focus.zoom ?? 9.5 })
    if (focus.district) setSelectedDistrict(focus.district)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus])

  // static data
  useEffect(() => {
    Promise.all([
      fetchJson<DistrictSummary[]>('district_summary.json'),
      fetchJson<TrendData>('trend_monthly.json'),
      fetchJson<CrimeTypeBreakdown[]>('crime_type_breakdown.json'),
      fetchJson<DistrictCentroid[]>('district_centroids.json'),
      fetchJson<GeoJSON.FeatureCollection>('karnataka_districts.json'),
    ]).then(([ds, tr, ct, cen, bd]) => {
      setDistricts(ds)
      setTrends(tr)
      setCrimeTypes(ct.map((c) => c.crime_type).sort())
      setCentroids(cen)
      setBoundaries(bd)
    }).catch((e) => console.error('static data load failed:', e))

    // optional novelty layer — absent until precompute_novelty.py has run
    fetchJson<EmergingData>('emerging_hotspots.json')
      .then(setEmergingData)
      .catch(() => {})

    // per-district × per-crime trends — absent until precompute_district_trends.py has run
    fetchJson<DistrictTrends>('district_trends.json')
      .then(setDistrictTrends)
      .catch(() => {})

    // offender dossiers — for "most dangerous here" (absent until precompute_offenders.py)
    fetchJson<OffenderIndex>('offender_index.json')
      .then((d) => setOffenders(d.offenders))
      .catch(() => {})

    // anomaly feed for intelligence panel
    fetchJson<Anomaly[]>('anomaly_feed.json')
      .then((a) => setAnomalies(filterAnomalies(a)))
      .catch(() => {})
  }, [])

  // hotspot layer follows the crime-type filter + comparison scope
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    loadHotspots(crimeType, scope)
      .then((set) => {
        if (cancelled) return
        setHotspots(set.points)
        setAnalysedCells(set.analysed)
      })
      .catch((e) => console.error('hotspot load failed:', e))
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [crimeType, scope])

  // the trend for the selected district (+ crime), if we have it
  const districtTrend = useMemo(() => {
    if (!selectedDistrict || !districtTrends) return null
    const d = districtTrends.districts[selectedDistrict]
    if (!d) return null
    return d[crimeType ?? 'ALL'] ?? d.ALL ?? null
  }, [selectedDistrict, crimeType, districtTrends])

  // trend chart series: district-specific when a district is picked, else state-wide
  const trendData = useMemo(() => {
    if (districtTrend) return districtTrend.monthly
    if (!trends) return []
    if (crimeType && trends.by_crime_type[crimeType]) return trends.by_crime_type[crimeType]
    return trends.overall
  }, [districtTrend, trends, crimeType])

  const trendLabel = useMemo(() => {
    const crime = crimeType ? tc(crimeType) : t('sense.allCrime')
    return selectedDistrict && districtTrend ? `${td(selectedDistrict)} — ${crime}` : crime
  }, [selectedDistrict, districtTrend, crimeType, tc, td, t])

  // which crimes are highest in the selected district (clickable to filter)
  const topCrimesHere = useMemo(() => {
    if (!selectedDistrict || !districtTrends) return []
    const d = districtTrends.districts[selectedDistrict]
    if (!d) return []
    return Object.entries(d)
      .filter(([k]) => k !== 'ALL')
      .map(([crime, v]) => ({ crime, total: v.total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6)
  }, [selectedDistrict, districtTrends])

  // most dangerous offenders operating in the selected district: ranked by how
  // many of their cases fall here, then by overall threat
  const topOffendersHere = useMemo(() => {
    if (!selectedDistrict || offenders.length === 0) return []
    return offenders
      .map((o) => ({
        offender: o,
        here: o.districts.find((d) => d.district === selectedDistrict)?.count ?? 0,
      }))
      .filter((x) => x.here > 0)
      .sort((a, b) => b.here - a.here || b.offender.total_cases - a.offender.total_cases)
      .slice(0, 5)
  }, [selectedDistrict, offenders])

  const feedItems = useMemo(
    () => generateFeedItems(anomalies, districts),
    [anomalies, districts],
  )

  const districtBrief = useMemo(() => {
    if (!selectedDistrict) return null
    const summary = districts.find((d) => d.district === selectedDistrict)
    return generateDistrictBrief(selectedDistrict, summary, anomalies)
  }, [selectedDistrict, districts, anomalies])

  const offenderById = useMemo(() => {
    const m = new Map<string, Dossier>()
    for (const o of offenders) m.set(o.offender_id, o)
    return m
  }, [offenders])

  const totalFIRs = useMemo(
    () => districts.reduce((s, d) => s + d.latest_year_cases, 0),
    [districts],
  )
  const activeHotspots = useMemo(
    () => hotspots.filter((h) => h.sig.startsWith('hot')).length,
    [hotspots],
  )
  const districtsAtRisk = useMemo(
    () => districts.filter((d) => d.yoy_change_pct > 5).length,
    [districts],
  )

  const handleDistrictSelect = useCallback((d: DistrictSummary) => {
    setSelectedDistrict(d.district)
    const c = centroids.find((x) => x.district === d.district)
    if (c) setFlyTarget({ lat: c.lat, lon: c.lon, zoom: 10.2 })
  }, [centroids])

  // closing the briefing pulls the camera back out to the whole state
  const clearDistrict = useCallback(() => {
    setSelectedDistrict(null)
    setFlyTarget({
      lat: KARNATAKA_CENTER[1],
      lon: KARNATAKA_CENTER[0],
      zoom: KARNATAKA_ZOOM,
      pitch: 0,
    })
  }, [])

  // a district handed over from COMMAND's card opens focused here
  useEffect(() => {
    if (!pending || pending.tab !== 'FORECAST' || !pending.district || districts.length === 0) return
    const d = districts.find((x) => x.district === pending.district)
    if (d) handleDistrictSelect(d)
    consumePending()
  }, [pending, districts, handleDistrictSelect, consumePending])

  const handleEmergingSelect = useCallback((c: EmergingCell) => {
    setFlyTarget({ lat: c.lat, lon: c.lon, zoom: 11.5 })
  }, [])

  const handleBoundaryClick = useCallback((boundaryName: string) => {
    const match = matchBoundaryToDataset(boundaryName, districts.map((d) => d.district))
    if (match) {
      const d = districts.find((x) => x.district === match)
      if (d) handleDistrictSelect(d)
    }
  }, [districts, handleDistrictSelect])

  return (
    <div className="relative flex-1 min-h-0">
      <MapView
        hotspots={hotspots}
        boundaries={boundaries}
        view3D
        sigOnly
        emerging={showEmerging && emergingData ? emergingData.cells : null}
        flyTarget={flyTarget}
        onDistrictClick={handleBoundaryClick}
      />

      {/* top-left: filters */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
        <FilterBar
          crimeTypes={crimeTypes}
          crimeType={crimeType}
          onCrimeType={setCrimeType}
          scope={scope}
          onScope={setScope}
          emerging={showEmerging && !!emergingData}
          onEmerging={(v) => { if (emergingData) { setShowEmerging(v); if (v) setShowDemographics(false) } }}
          demographics={showDemographics}
          onDemographics={(v) => { setShowDemographics(v); if (v) setShowEmerging(false) }}
        />
        {loading && (
          <span className="glass rounded-md px-3 py-1.5 text-xs text-sky-300 animate-pulse">
            loading layer…
          </span>
        )}
      </div>

      {/* bottom-left: legend + layer stats */}
      <div className="absolute bottom-8 left-3 z-10 flex flex-col gap-2">
        <Legend emerging={showEmerging && !!emergingData} />
        <div className="glass rounded-lg px-3 py-2 text-[11px] text-slate-300">
          {showEmerging && emergingData ? (
            <>
              {(emergingData.summary.counts.new ?? 0).toLocaleString()} new ·{' '}
              {(emergingData.summary.counts.intensifying ?? 0).toLocaleString()} intensifying ·{' '}
              {(emergingData.summary.counts.cooling ?? 0).toLocaleString()} cooling
            </>
          ) : (
            <>{activeHotspots.toLocaleString()} hot cells / {analysedCells.toLocaleString()} analysed</>
          )}
        </div>
      </div>

      {/* right: intelligence panel */}
      <div className="absolute top-3 right-3 bottom-8 z-10 w-[360px] max-w-[calc(100vw-340px)] glass rounded-xl p-3.5 flex flex-col gap-2 min-h-0">
        {/* command center header */}
        <div className="flex items-center justify-between shrink-0 pb-1 border-b border-slate-700/30 mb-0.5">
          <div className="flex items-center gap-1.5">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" className="text-sky-300" aria-hidden>
              <path d="M2 12C2 6.5 6.5 2 12 2a10 10 0 0 1 10 10c0 5.5-4.5 10-10 10a10 10 0 0 1-10-10Z" stroke="currentColor" strokeWidth="1.5" />
              <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <span className="text-[10px] uppercase tracking-widest text-slate-300 font-semibold">Situation Room</span>
          </div>
          <span className="text-[8px] uppercase tracking-wider text-slate-500">Karnataka State Police</span>
        </div>

        {/* quick stats bar */}
        <div className="flex gap-1.5 shrink-0">
          <QuickStat label={t('sense.firsLatest')} value={totalFIRs} />
          <QuickStat label="Hotspots" value={activeHotspots} />
          <QuickStat label="Anomalies" value={anomalies.length} accent={anomalies.length > 0} />
          <QuickStat label="At Risk" value={districtsAtRisk} accent={districtsAtRisk > 3} />
        </div>

        {trends && <TrendChart data={trendData} label={trendLabel} />}

        {/* district intelligence briefing */}
        {selectedDistrict && districtBrief && !showEmerging && !showDemographics && (
          <div className="rounded-lg border px-2.5 py-2 flex-1 min-h-0 overflow-y-auto"
            style={{ borderColor: `${THREAT_LEVEL_COLORS[districtBrief.threatLevel]}30`, background: 'rgba(39,44,51,0.5)' }}>
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-semibold text-slate-100 truncate">{td(selectedDistrict)}</span>
                <ThreatIndicator level={districtBrief.threatLevel} compact />
              </div>
              <button
                onClick={clearDistrict}
                className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-100 transition-colors shrink-0"
              >
                <svg viewBox="0 0 24 24" width="11" height="11" fill="none" aria-hidden>
                  <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                {t('sense.backToDistricts')}
              </button>
            </div>

            {/* key metrics row */}
            <div className="flex gap-1.5 mb-2">
              <div className="flex-1 rounded bg-slate-800/60 px-1.5 py-1 text-center">
                <div className="text-[10px] font-bold tabular-nums" style={{ color: districtBrief.trend === 'increasing' ? '#ef4444' : districtBrief.trend === 'decreasing' ? '#22c55e' : '#f59e0b' }}>
                  {districtBrief.trend === 'increasing' ? '↑' : districtBrief.trend === 'decreasing' ? '↓' : '→'} {Math.abs(districtBrief.trendPct).toFixed(1)}%
                </div>
                <div className="text-[7.5px] uppercase tracking-wider text-slate-500">Trend</div>
              </div>
              <div className="flex-1 rounded bg-slate-800/60 px-1.5 py-1 text-center">
                <div className="text-[10px] font-bold text-sky-300 tabular-nums">{districtBrief.heinousPct.toFixed(1)}%</div>
                <div className="text-[7.5px] uppercase tracking-wider text-slate-500">Heinous</div>
              </div>
              <div className="flex-1 rounded bg-slate-800/60 px-1.5 py-1 text-center">
                <div className="text-[10px] font-bold text-slate-300 tabular-nums">{districtBrief.clearancePct.toFixed(1)}%</div>
                <div className="text-[7.5px] uppercase tracking-wider text-slate-500">Clearance</div>
              </div>
              {districtBrief.anomalyCount > 0 && (
                <div className="flex-1 rounded bg-red-500/10 border border-red-400/20 px-1.5 py-1 text-center">
                  <div className="text-[10px] font-bold text-red-400 tabular-nums">{districtBrief.anomalyCount}</div>
                  <div className="text-[7.5px] uppercase tracking-wider text-slate-500">Alerts</div>
                </div>
              )}
            </div>

            {/* AI narrative */}
            <div className="text-[10px] text-slate-400 leading-snug mb-2">{districtBrief.narrative}</div>

            {/* top crimes chips */}
            <div className="text-[9.5px] uppercase tracking-wider text-slate-400 mb-1">
              {t('sense.topCrimesHere')}
            </div>
            <div className="flex flex-wrap gap-1 mb-2">
              {topCrimesHere.map(({ crime, total }) => {
                const active = crimeType === crime
                return (
                  <button
                    key={crime}
                    onClick={() => setCrimeType(active ? null : crime)}
                    className={`text-[9.5px] px-1.5 py-0.5 rounded border transition-colors ${
                      active
                        ? 'bg-sky-500/25 border-sky-400/50 text-sky-200'
                        : 'bg-slate-700/40 border-transparent text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    {tc(crime)} <span className="tabular-nums text-slate-400">{total.toLocaleString()}</span>
                  </button>
                )
              })}
            </div>

            {/* where crime happens */}
            {districtTrend && (
              <>
                <div className="mb-1">
                  <div className="text-[9.5px] uppercase tracking-wider text-slate-400">
                    {t('sense.topPlaces')}{crimeType ? ` · ${tc(crimeType)}` : ''}
                  </div>
                </div>
                <div className="flex flex-col gap-0.5 mb-2">
                  {districtTrend.top_places.slice(0, 5).map((p) => (
                    <div key={p.place} className="flex items-center justify-between text-[10px]">
                      <span className="text-slate-300 truncate">{p.place}</span>
                      <span className="tabular-nums text-slate-400 shrink-0 ml-2">{p.count.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* dangerous offenders */}
            {topOffendersHere.length > 0 && (
              <>
                <div className="text-[9.5px] uppercase tracking-wider text-slate-400 mb-1">
                  {t('sense.dangerousHere')}
                </div>
                <div className="flex flex-col gap-0.5 mb-2">
                  {topOffendersHere.map(({ offender: o, here }) => (
                    <button
                      key={o.offender_id}
                      onClick={() => setSelectedOffender(o)}
                      className="flex items-center justify-between gap-2 rounded px-1 py-0.5 -mx-1 hover:bg-slate-700/40 transition-colors text-left"
                    >
                      <span className="flex items-center gap-1.5 min-w-0">
                        <span className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ background: '#8aa0b8' }} />
                        <span className="text-[10px] text-slate-300 truncate">{o.name}</span>
                        {o.heinous_pct >= 50 && (
                          <span className="text-[8px] text-red-400/90 shrink-0">{o.heinous_pct.toFixed(0)}%H</span>
                        )}
                      </span>
                      <span className="tabular-nums text-slate-400 text-[9.5px] shrink-0">
                        {here} {t('sense.casesHere')}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* recommended action */}
            <div className="rounded-md border border-sky-400/25 bg-sky-500/8 px-2.5 py-2 mb-2">
              <div className="text-[9px] uppercase tracking-wider text-sky-400/80 mb-1 font-semibold">Recommended Action</div>
              <div className="text-[10px] text-slate-300 leading-snug">{districtBrief.recommendation}</div>
            </div>

            {/* deploy patrol button */}
            <button
              onClick={() => navigateTo({ tab: 'ACT', district: selectedDistrict! })}
              className="w-full flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-[10.5px] font-semibold uppercase tracking-wider bg-sky-500/15 border border-sky-400/30 text-sky-300 hover:bg-sky-500/25 transition-colors"
            >
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" aria-hidden>
                <path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8Z" stroke="currentColor" strokeWidth="1.5" />
                <circle cx="12" cy="10" r="3" stroke="currentColor" strokeWidth="1.5" />
              </svg>
              {t('sense.deployPatrol')}
            </button>
          </div>
        )}

        {showDemographics ? (
          <SocioEconomicPanel />
        ) : showEmerging && emergingData ? (
          <EmergingPanel cells={emergingData.cells} onSelect={handleEmergingSelect} />
        ) : !(selectedDistrict && districtBrief) ? (
          <>
            <IntelFeed
              items={feedItems}
              onDistrictClick={(d) => {
                const ds = districts.find((x) => x.district === d)
                if (ds) handleDistrictSelect(ds)
              }}
            />
            <DistrictPanel
              districts={districts}
              selected={selectedDistrict}
              onSelect={handleDistrictSelect}
            />
          </>
        ) : null}
      </div>

      {/* full suspect dossier — same slide-over used in the Crime Network tab */}
      {selectedOffender && (
        <DossierOverlay
          dossier={selectedOffender}
          onClose={() => setSelectedOffender(null)}
          onSelectAssociate={(id) => {
            const d = offenderById.get(id)
            if (d) setSelectedOffender(d)
          }}
        />
      )}
    </div>
  )
}

function QuickStat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  const counted = useCountUp(value)
  return (
    <div className={`flex-1 rounded-lg px-1.5 py-1.5 text-center border ${
      accent ? 'bg-red-500/8 border-red-400/20' : 'bg-slate-800/50 border-slate-700/40'
    }`}>
      <div className={`text-sm font-bold tabular-nums leading-tight ${accent ? 'text-red-400' : 'text-sky-300'}`}>
        {counted >= 1000 ? `${(counted / 1000).toFixed(1)}k` : counted}
      </div>
      <div className="text-[7.5px] uppercase tracking-wider text-slate-500">{label}</div>
    </div>
  )
}

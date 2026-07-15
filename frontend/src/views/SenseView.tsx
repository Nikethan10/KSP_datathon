import { useCallback, useEffect, useMemo, useState } from 'react'
import MapView from '../components/MapView'
import FilterBar from '../components/FilterBar'
import DistrictPanel from '../components/DistrictPanel'
import TrendChart from '../components/TrendChart'
import Legend from '../components/Legend'
import {
  fetchJson, loadHotspots, matchBoundaryToDataset,
} from '../lib/data'
import type {
  HotspotPoint, DistrictSummary, TrendData, CrimeTypeBreakdown, DistrictCentroid,
  HotspotScope,
} from '../lib/data'

export default function SenseView() {
  const [hotspots, setHotspots] = useState<HotspotPoint[]>([])
  const [districts, setDistricts] = useState<DistrictSummary[]>([])
  const [trends, setTrends] = useState<TrendData | null>(null)
  const [crimeTypes, setCrimeTypes] = useState<string[]>([])
  const [centroids, setCentroids] = useState<DistrictCentroid[]>([])
  const [boundaries, setBoundaries] = useState<GeoJSON.FeatureCollection | null>(null)

  const [crimeType, setCrimeType] = useState<string | null>(null)
  const [scope, setScope] = useState<HotspotScope>('state')
  const [view3D, setView3D] = useState(true)
  const [sigOnly, setSigOnly] = useState(true)
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null)
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lon: number; zoom?: number } | null>(null)
  const [loading, setLoading] = useState(true)

  // static data
  useEffect(() => {
    Promise.all([
      fetchJson<DistrictSummary[]>('district_summary.json'),
      fetchJson<TrendData>('trend_monthly.json'),
      fetchJson<CrimeTypeBreakdown[]>('crime_type_breakdown.json'),
      fetchJson<DistrictCentroid[]>('district_centroids.json'),
      fetchJson<GeoJSON.FeatureCollection>('karnataka_districts.geojson'),
    ]).then(([ds, tr, ct, cen, bd]) => {
      setDistricts(ds)
      setTrends(tr)
      setCrimeTypes(ct.map((c) => c.crime_type).sort())
      setCentroids(cen)
      setBoundaries(bd)
    }).catch((e) => console.error('static data load failed:', e))
  }, [])

  // hotspot layer follows the crime-type filter + comparison scope
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    loadHotspots(crimeType, scope)
      .then((pts) => { if (!cancelled) setHotspots(pts) })
      .catch((e) => console.error('hotspot load failed:', e))
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [crimeType, scope])

  const trendData = useMemo(() => {
    if (!trends) return []
    if (crimeType && trends.by_crime_type[crimeType]) return trends.by_crime_type[crimeType]
    return trends.overall
  }, [trends, crimeType])

  const handleDistrictSelect = useCallback((d: DistrictSummary) => {
    setSelectedDistrict(d.district)
    const c = centroids.find((x) => x.district === d.district)
    if (c) setFlyTarget({ lat: c.lat, lon: c.lon, zoom: 9.5 })
  }, [centroids])

  const handleBoundaryClick = useCallback((boundaryName: string) => {
    const match = matchBoundaryToDataset(boundaryName, districts.map((d) => d.district))
    if (match) {
      const d = districts.find((x) => x.district === match)
      if (d) handleDistrictSelect(d)
    }
  }, [districts, handleDistrictSelect])

  const stats = useMemo(() => {
    const sig = hotspots.filter((h) => h.sig.startsWith('hot')).length
    return { total: hotspots.length, hot: sig }
  }, [hotspots])

  return (
    <div className="relative flex-1 min-h-0">
      <MapView
        hotspots={hotspots}
        boundaries={boundaries}
        view3D={view3D}
        sigOnly={sigOnly}
        flyTarget={flyTarget}
        onDistrictClick={handleBoundaryClick}
      />

      {/* top-left: filters */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
        <FilterBar
          crimeTypes={crimeTypes}
          crimeType={crimeType}
          onCrimeType={setCrimeType}
          view3D={view3D}
          onView3D={setView3D}
          sigOnly={sigOnly}
          onSigOnly={setSigOnly}
          scope={scope}
          onScope={setScope}
        />
        {loading && (
          <span className="glass rounded-md px-3 py-1.5 text-xs text-sky-300 animate-pulse">
            loading layer…
          </span>
        )}
      </div>

      {/* bottom-left: legend + layer stats */}
      <div className="absolute bottom-8 left-3 z-10 flex flex-col gap-2">
        <Legend />
        <div className="glass rounded-lg px-3 py-2 text-[11px] text-slate-300">
          {stats.hot.toLocaleString()} hot cells / {stats.total.toLocaleString()} analysed
        </div>
      </div>

      {/* right: side panel */}
      <div className="absolute top-3 right-3 bottom-8 z-10 w-[360px] max-w-[calc(100vw-340px)] glass rounded-xl p-3.5 flex flex-col gap-3 min-h-0">
        {trends && <TrendChart data={trendData} label={crimeType ?? 'All crime'} />}
        <DistrictPanel
          districts={districts}
          selected={selectedDistrict}
          onSelect={handleDistrictSelect}
        />
      </div>
    </div>
  )
}

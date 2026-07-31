import { useEffect, useMemo, useState } from 'react'
import MapView from '../components/MapView'
import { useI18n } from '../lib/i18n'
import { useNav } from '../lib/nav'
import { useStats, stat } from '../lib/useStats'
import {
  fetchJson,
  filterAnomalies,
  loadHotspots,
  matchBoundaryToDataset,
  type Anomaly,
  type DistrictSummary,
  type HotspotPoint,
  type NetworkSummary,
  type StationSummaryFile,
} from '../lib/data'
import { generateForecast, type ForecastItem } from '../lib/insights'

/* COMMAND — the state-wide operational picture.

   Hierarchy is deliberate and in this order: map first, intelligence second,
   raw metrics third. An officer opening the console should see where things
   are happening before they see a number, and see what it means before they
   see a benchmark. */

function Panel({
  title,
  meta,
  children,
}: {
  title: string
  meta?: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col min-h-0 border-t border-slate-800/70 first:border-t-0">
      <header className="shrink-0 flex items-baseline justify-between px-3 pt-2.5 pb-1.5">
        <h2 className="text-[9.5px] font-semibold uppercase tracking-[0.18em] text-slate-300">
          {title}
        </h2>
        {meta && <span className="text-[9px] tabular-nums text-slate-500">{meta}</span>}
      </header>
      <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-3">{children}</div>
    </section>
  )
}

/** A figure that never invents itself. */
function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="px-3 py-2">
      <div className="text-[17px] font-semibold tabular-nums text-slate-50 leading-none">
        {value}
      </div>
      <div className="mt-1.5 text-[8.5px] font-mono-data uppercase tracking-[0.16em] text-slate-500">
        {label}
      </div>
    </div>
  )
}

const SEVERITY_COLOR: Record<string, string> = {
  HIGH: '#e5484d',
  MEDIUM: '#d99a3c',
  LOW: '#5b7a8c',
}

export default function CommandView() {
  const { t, tc, td } = useI18n()
  const { navigateTo } = useNav()
  const stats = useStats()

  const [hotspots, setHotspots] = useState<HotspotPoint[]>([])
  const [anomalies, setAnomalies] = useState<Anomaly[]>([])
  const [districts, setDistricts] = useState<DistrictSummary[]>([])
  const [network, setNetwork] = useState<NetworkSummary | null>(null)
  const [boundaries, setBoundaries] = useState<GeoJSON.FeatureCollection | null>(null)
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null)
  const [stations, setStations] = useState<StationSummaryFile | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    Promise.all([
      loadHotspots(null, 'state'),
      fetchJson<Anomaly[]>('anomaly_feed.json'),
      fetchJson<DistrictSummary[]>('district_summary.json'),
    ])
      .then(([hs, a, ds]) => {
        if (!alive) return
        setHotspots(hs.points)
        setAnomalies(filterAnomalies(a))
        setDistricts(ds)
        setLoading(false)
      })
      .catch(() => {
        if (!alive) return
        setFailed(true)
        setLoading(false)
      })

    // Secondary: absent on a partial deploy, so neither must fail the screen.
    fetchJson<NetworkSummary>('network_summary.json')
      .then((n) => alive && setNetwork(n))
      .catch(() => {})
    fetchJson<GeoJSON.FeatureCollection>('karnataka_districts.json')
      .then((b) => alive && setBoundaries(b))
      .catch(() => {})
    fetchJson<StationSummaryFile>('station_summary.json')
      .then((st) => alive && setStations(st))
      .catch(() => {})

    return () => {
      alive = false
    }
  }, [])

  const forecast: ForecastItem[] = useMemo(
    () => generateForecast(anomalies, districts),
    [anomalies, districts],
  )

  /* The single most useful sentence on the screen, composed from the largest
     real departure from baseline. Deterministic — no model wrote this. */
  const headline = useMemo(() => {
    const top = forecast[0]
    if (!top) return null
    const where = anomalies
      .filter((a) => a.crime_type === top.crimeType)
      .sort((a, b) => Math.abs(b.zscore) - Math.abs(a.zscore))[0]
    if (!where) return null
    return {
      crime: tc(top.crimeType),
      district: td(where.district),
      excess: Math.round(top.excess),
      lo: Math.round(top.lo),
      hi: Math.round(top.hi),
      districts: top.nDistricts,
    }
  }, [forecast, anomalies, tc, td])

  const topDistricts = useMemo(
    () => [...districts].sort((a, b) => b.total_cases - a.total_cases).slice(0, 5),
    [districts],
  )

  /* The card a click on the map opens: what is happening in that district,
     and the two things an officer can do about it from here. */
  const districtCard = useMemo(() => {
    if (!selectedDistrict) return null
    const d = districts.find((x) => x.district === selectedDistrict)
    if (!d) return null
    const anoms = anomalies.filter((a) => a.district === selectedDistrict)
    const topStations = stations?.districts[selectedDistrict]?.slice(0, 3) ?? []
    return { d, anoms, topStations }
  }, [selectedDistrict, districts, anomalies, stations])

  const handleDistrictClick = (boundaryName: string) => {
    const match = matchBoundaryToDataset(boundaryName, districts.map((x) => x.district))
    if (match) setSelectedDistrict(match)
  }

  if (failed) {
    return (
      <div className="h-full flex items-center justify-center px-6">
        <div className="max-w-sm text-center">
          <div className="text-[12px] text-slate-300">{t('command.loadFailed')}</div>
          <div className="mt-2 text-[11px] text-slate-500">{t('command.loadFailedHint')}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full grid grid-rows-[minmax(0,1.55fr)_minmax(0,1fr)]">
      {/* ── 1. The map, given the most room ─────────────────────────── */}
      <div className="relative min-h-0 border-b border-slate-800/70">
        <MapView
          hotspots={hotspots}
          boundaries={boundaries}
          view3D={false}
          sigOnly
          emerging={null}
          flyTarget={null}
          onDistrictClick={handleDistrictClick}
        />

        {districtCard && (
          <div className="absolute top-3 right-3 z-20 w-[290px] rounded-md border border-slate-700/70 bg-[#15181c]/95 overflow-hidden">
            <div className="flex items-start justify-between gap-2 px-3.5 pt-3 pb-2">
              <div>
                <div className="text-[13px] font-semibold text-slate-50 leading-tight">
                  {td(districtCard.d.district)}
                </div>
                <div className="mt-0.5 text-[9px] uppercase tracking-[0.14em] text-slate-500">
                  {t('command.cardKicker')}
                </div>
              </div>
              <button
                onClick={() => setSelectedDistrict(null)}
                aria-label={t('common.close')}
                className="text-slate-500 hover:text-slate-200 text-[13px] leading-none px-1 transition-colors"
              >
                &#x2715;
              </button>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-2 px-3.5 pb-2.5">
              <div>
                <div className="text-[15px] font-semibold tabular-nums text-slate-50 leading-none">
                  {districtCard.d.latest_year_cases.toLocaleString('en-IN')}
                </div>
                <div className="mt-1 text-[8px] font-mono-data uppercase tracking-[0.14em] text-slate-500">
                  {t('command.cardFirs')}
                </div>
              </div>
              <div>
                <div
                  className="text-[15px] font-semibold tabular-nums leading-none"
                  style={{ color: districtCard.d.yoy_change_pct > 0 ? '#e5484d' : '#5ec98a' }}
                >
                  {districtCard.d.yoy_change_pct > 0 ? '+' : ''}
                  {districtCard.d.yoy_change_pct.toFixed(1)}%
                </div>
                <div className="mt-1 text-[8px] font-mono-data uppercase tracking-[0.14em] text-slate-500">
                  {t('command.cardYoY')}
                </div>
              </div>
              <div className="col-span-2 text-[10.5px] text-slate-300">
                <span className="text-slate-500">{t('command.cardTopCrime')}: </span>
                {tc(districtCard.d.top_crime_type)}
              </div>
              {districtCard.anoms.length > 0 && (
                <div className="col-span-2 text-[10.5px] text-slate-300">
                  <span className="text-slate-500">{t('command.cardAnoms')}: </span>
                  <span className="tabular-nums">{districtCard.anoms.length}</span>
                  {' · '}
                  {tc(districtCard.anoms[0].crime_type)}
                </div>
              )}
              {districtCard.topStations.length > 0 && (
                <div className="col-span-2">
                  <div className="text-[8px] font-mono-data uppercase tracking-[0.14em] text-slate-500 mb-1">
                    {t('command.cardStations')}
                  </div>
                  <ul className="space-y-0.5">
                    {districtCard.topStations.map((st) => (
                      <li key={st.station} className="flex items-baseline gap-2 text-[10px]">
                        <span className="flex-1 truncate text-slate-300">{st.station}</span>
                        <span className="tabular-nums text-slate-400">
                          {st.latest.toLocaleString('en-IN')}
                        </span>
                        <span
                          className="w-12 text-right tabular-nums"
                          style={{
                            color:
                              st.yoy_pct === null
                                ? '#6b7480'
                                : st.yoy_pct > 0
                                  ? '#e5484d'
                                  : '#5ec98a',
                          }}
                        >
                          {st.yoy_pct === null
                            ? '—'
                            : `${st.yoy_pct > 0 ? '+' : ''}${st.yoy_pct.toFixed(0)}%`}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="flex divide-x divide-slate-800/70 border-t border-slate-800/70">
              <button
                onClick={() => navigateTo({ tab: 'FORECAST', district: districtCard.d.district })}
                className="flex-1 px-3 py-2 text-[9.5px] font-semibold uppercase tracking-[0.12em] text-slate-300 hover:text-slate-50 hover:bg-slate-800/40 transition-colors text-left"
              >
                {t('command.cardForecast')} →
              </button>
              <button
                onClick={() => navigateTo({ tab: 'ACT', district: districtCard.d.district })}
                className="flex-1 px-3 py-2 text-[9.5px] font-semibold uppercase tracking-[0.12em] text-slate-300 hover:text-slate-50 hover:bg-slate-800/40 transition-colors text-left"
              >
                {t('command.cardDeploy')} →
              </button>
            </div>
          </div>
        )}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-[10px] font-mono-data uppercase tracking-[0.2em] text-slate-500">
              {t('common.loading')}
            </span>
          </div>
        )}
      </div>

      {/* ── 2. Intelligence, then 3. metrics ────────────────────────── */}
      <div className="min-h-0 grid grid-cols-1 lg:grid-cols-[1.2fr_1fr_0.9fr] divide-x divide-slate-800/70">
        <Panel title={t('command.intelligence')}>
          {headline ? (
            <div className="space-y-3">
              <p className="text-[12px] leading-relaxed text-slate-300">
                {t('command.headline')
                  .replace('{crime}', headline.crime)
                  .replace('{district}', headline.district)
                  .replace('{excess}', String(headline.excess))
                  .replace('{lo}', String(headline.lo))
                  .replace('{hi}', String(headline.hi))
                  .replace('{n}', String(headline.districts))}
              </p>
              <button
                onClick={() => navigateTo({ tab: 'FORECAST' })}
                className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-slate-400 hover:text-slate-100 transition-colors"
              >
                {t('command.openForecast')}
              </button>
            </div>
          ) : (
            <div className="text-[11px] text-slate-500">
              {loading ? t('common.loading') : t('command.noSignal')}
            </div>
          )}
        </Panel>

        <Panel title={t('command.alerts')} meta={anomalies.length ? String(anomalies.length) : undefined}>
          {anomalies.length === 0 ? (
            <div className="text-[11px] text-slate-500">
              {loading ? t('common.loading') : t('command.noAlerts')}
            </div>
          ) : (
            <ul className="space-y-1.5">
              {anomalies.slice(0, 6).map((a, i) => (
                <li key={`${a.district}-${a.crime_type}-${a.date}-${i}`} className="flex gap-2">
                  <span
                    className="mt-[5px] w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: SEVERITY_COLOR[a.severity] ?? '#5b7a8c' }}
                  />
                  <div className="min-w-0">
                    <div className="text-[11px] text-slate-200 truncate">{tc(a.crime_type)}</div>
                    <div className="text-[9.5px] text-slate-500 tabular-nums">
                      {td(a.district)} · {a.observed} vs {a.expected.toFixed(1)} · z {a.zscore.toFixed(1)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <div className="flex flex-col divide-y divide-slate-800/70">
          <div className="grid grid-cols-2">
            <Metric value={stat(stats.firs)} label={t('command.mFirs')} />
            <Metric value={stat(stats.districts)} label={t('command.mDistricts')} />
            <Metric
              value={loading ? '—' : hotspots.length.toLocaleString('en-IN')}
              label={t('command.mHotCells')}
            />
            <Metric
              value={network ? network.n_communities.toLocaleString('en-IN') : '—'}
              label={t('command.mNetworks')}
            />
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="px-3 pt-2.5 pb-1.5 text-[9.5px] font-semibold uppercase tracking-[0.18em] text-slate-300">
              {t('command.topDistricts')}
            </div>
            <ul className="px-3 pb-3 space-y-1">
              {topDistricts.map((d, i) => (
                <li key={d.district} className="flex items-baseline gap-2 text-[10.5px]">
                  <span className="w-3 tabular-nums text-slate-600">{i + 1}</span>
                  <span className="flex-1 truncate text-slate-300">{td(d.district)}</span>
                  <span className="tabular-nums text-slate-500">
                    {d.total_cases.toLocaleString('en-IN')}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

import { useEffect, useMemo, useState } from 'react'
import RiskMap from '../components/RiskMap'
import RiskStats from '../components/RiskStats'
import AnomalyFeed from '../components/AnomalyFeed'
import NetworkGraph from '../components/NetworkGraph'
import GangPanel from '../components/GangPanel'
import { fetchJson } from '../lib/data'
import type {
  RiskCell, RiskSummary, Anomaly, Gang, NetworkSummary, CytoNetwork, DistrictCentroid,
} from '../lib/data'

type Mode = 'risk' | 'network'

export default function PredictView() {
  const [mode, setMode] = useState<Mode>('risk')

  const [cells, setCells] = useState<RiskCell[]>([])
  const [riskSummary, setRiskSummary] = useState<RiskSummary | null>(null)
  const [anomalies, setAnomalies] = useState<Anomaly[]>([])
  const [centroids, setCentroids] = useState<DistrictCentroid[]>([])
  const [network, setNetwork] = useState<CytoNetwork | null>(null)
  const [gangs, setGangs] = useState<Gang[]>([])
  const [netSummary, setNetSummary] = useState<NetworkSummary | null>(null)

  const [showPriority, setShowPriority] = useState(true)
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lon: number; zoom?: number } | null>(null)
  const [selectedGang, setSelectedGang] = useState<Gang | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetchJson<RiskCell[]>('risk_map.json'),
      fetchJson<RiskSummary>('risk_summary.json'),
      fetchJson<Anomaly[]>('anomaly_feed.json'),
      fetchJson<DistrictCentroid[]>('district_centroids.json'),
      fetchJson<CytoNetwork>('cooffending_network.json'),
      fetchJson<Gang[]>('gang_disruption.json'),
      fetchJson<NetworkSummary>('network_summary.json'),
    ]).then(([rc, rs, an, cen, net, gd, ns]) => {
      setCells(rc)
      setRiskSummary(rs)
      // drop non-territorial units and STL artifacts (observed 0 / non-positive baseline)
      const NON_GEO = new Set(['CID', 'COASTAL SECURITY POLICE', 'KARNATAKA RAILWAYS', 'ISD BENGALURU'])
      setAnomalies(an.filter((a) => !NON_GEO.has(a.district) && a.observed > 0 && a.expected > 0))
      setCentroids(cen)
      setNetwork(net)
      setGangs(gd)
      setNetSummary(ns)
      setLoading(false)
    }).catch((e) => console.error('predict data load failed:', e))
  }, [])

  const highlightIds = useMemo(() => {
    if (!selectedGang) return new Set<string>()
    return new Set(selectedGang.key_members.map((m) => m.offender_id))
  }, [selectedGang])

  const handleAnomalySelect = (a: Anomaly) => {
    const c = centroids.find((x) => x.district === a.district)
    if (c) setFlyTarget({ lat: c.lat, lon: c.lon, zoom: 9 })
  }

  return (
    <div className="relative flex-1 min-h-0">
      {mode === 'risk' ? (
        <RiskMap cells={cells} showPriority={showPriority} flyTarget={flyTarget} />
      ) : (
        <NetworkGraph network={network} highlightIds={highlightIds} />
      )}

      {/* top-left: mode switch + controls */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
        <div className="glass rounded-md flex overflow-hidden">
          {(['risk', 'network'] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3.5 py-1.5 text-xs font-semibold tracking-wider transition-colors ${
                mode === m
                  ? 'bg-sky-500/25 text-sky-300'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {m === 'risk' ? 'RISK FORECAST' : 'CRIME NETWORK'}
            </button>
          ))}
        </div>
        {mode === 'risk' && (
          <button
            onClick={() => setShowPriority(!showPriority)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors border ${
              showPriority
                ? 'bg-sky-500/20 border-sky-400/40 text-sky-300'
                : 'bg-transparent border-slate-600/50 text-slate-400 hover:border-slate-500'
            }`}
          >
            Top-5% priority cells
          </button>
        )}
        {mode === 'network' && (
          <span className="glass rounded-md px-3 py-1.5 text-[11px] text-slate-400">
            top 500 offenders by connectivity · drag to rotate · scroll to zoom
          </span>
        )}
        {loading && (
          <span className="glass rounded-md px-3 py-1.5 text-xs text-sky-300 animate-pulse">
            loading analytics…
          </span>
        )}
      </div>

      {/* right panel */}
      <div className="absolute top-3 right-3 bottom-8 z-10 w-[360px] max-w-[calc(100vw-340px)] glass rounded-xl p-3.5 flex flex-col gap-3 min-h-0 overflow-hidden">
        {mode === 'risk' ? (
          <>
            {riskSummary && <RiskStats summary={riskSummary} />}
            <AnomalyFeed anomalies={anomalies} onSelect={handleAnomalySelect} />
          </>
        ) : (
          <GangPanel
            gangs={gangs}
            summary={netSummary}
            selected={selectedGang}
            onSelect={(g) => setSelectedGang(selectedGang?.gang_rank === g.gang_rank ? null : g)}
          />
        )}
      </div>
    </div>
  )
}

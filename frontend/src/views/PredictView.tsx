import { useEffect, useMemo, useState } from 'react'
import RiskMap from '../components/RiskMap'
import RiskStats from '../components/RiskStats'
import AnomalyFeed from '../components/AnomalyFeed'
import GangBoard from '../components/GangBoard'
import MostWantedBoard from '../components/MostWantedBoard'
import DossierOverlay from '../components/DossierOverlay'
import OffenderSearch from '../components/OffenderSearch'
import ForecastWidget from '../components/ForecastWidget'
import { fetchJson, filterAnomalies, THREAT_COLORS, THREAT_ORDER } from '../lib/data'
import { generateForecast, generatePredictionNarrative } from '../lib/insights'
import { useI18n } from '../lib/i18n'
import { useStats, stat } from '../lib/useStats'
import { useFocus } from '../lib/focus'
import type {
  RiskCell, RiskSummary, Anomaly, Gang, NetworkSummary, GangNetwork, DistrictCentroid,
  OffenderDossier as Dossier, OffenderIndex, MostWantedData, ThreatTier, ShapData,
} from '../lib/data'

type Mode = 'risk' | 'network'
type NetSub = 'gangs' | 'wanted'

const TIER_RANK: Record<ThreatTier, number> = { high: 0, medium: 1, low: 2 }

function NetStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center px-2">
      <div className="text-sm font-bold text-sky-300 tabular-nums leading-tight">{value}</div>
      <div className="mt-0.5 text-[9.5px] uppercase tracking-wider text-slate-400">{label}</div>
    </div>
  )
}

interface PredictViewProps {
  /** Which lens to open on. CONNECT mounts 'network', FORECAST mounts 'risk'. */
  initialMode?: Mode
  /** Hide the internal mode switch when the section already implies the lens. */
  lockMode?: boolean
}

export default function PredictView({ initialMode = 'risk', lockMode = false }: PredictViewProps) {
  const [mode, setMode] = useState<Mode>(initialMode)
  const [netSub, setNetSub] = useState<NetSub>('gangs')

  const [cells, setCells] = useState<RiskCell[]>([])
  const [riskSummary, setRiskSummary] = useState<RiskSummary | null>(null)
  const [anomalies, setAnomalies] = useState<Anomaly[]>([])
  const [centroids, setCentroids] = useState<DistrictCentroid[]>([])
  const [netSummary, setNetSummary] = useState<NetworkSummary | null>(null)
  const [gangNetwork, setGangNetwork] = useState<GangNetwork | null>(null)
  const [gangs, setGangs] = useState<Gang[]>([])

  const [offenderIndex, setOffenderIndex] = useState<Dossier[]>([])
  const [mostWanted, setMostWanted] = useState<Dossier[]>([])
  const [shapData, setShapData] = useState<ShapData | null>(null)
  const [selectedOffender, setSelectedOffender] = useState<Dossier | null>(null)
  const [selectedGang, setSelectedGang] = useState<Gang | null>(null)

  const [showPriority, setShowPriority] = useState(true)
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lon: number; zoom?: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const { t } = useI18n()
  const stats = useStats()
  const { focus } = useFocus()

  // header (district) search -> switch to the risk map and fly there
  useEffect(() => {
    if (!focus) return
    setMode('risk')
    setFlyTarget({ lat: focus.lat, lon: focus.lon, zoom: focus.zoom ?? 9.5 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus])

  useEffect(() => {
    Promise.all([
      fetchJson<RiskCell[]>('risk_map.json'),
      fetchJson<RiskSummary>('risk_summary.json'),
      fetchJson<Anomaly[]>('anomaly_feed.json'),
      fetchJson<DistrictCentroid[]>('district_centroids.json'),
      fetchJson<GangNetwork>('gang_network.json'),
      fetchJson<Gang[]>('gang_disruption.json'),
      fetchJson<NetworkSummary>('network_summary.json'),
    ]).then(([rc, rs, an, cen, net, gd, ns]) => {
      setCells(rc)
      setRiskSummary(rs)
      setAnomalies(filterAnomalies(an))
      setCentroids(cen)
      setGangNetwork(net)
      setGangs(gd)
      setNetSummary(ns)
      setLoading(false)
    }).catch((e) => console.error('predict data load failed:', e))

    // offender dossiers — absent until precompute_offenders.py has run
    fetchJson<OffenderIndex>('offender_index.json').then((d) => setOffenderIndex(d.offenders)).catch(() => {})
    fetchJson<MostWantedData>('most_wanted.json').then((d) => setMostWanted(d.offenders)).catch(() => {})
    fetchJson<ShapData>('shap_explanations.json').then(setShapData).catch(() => {})
  }, [])

  const offenderById = useMemo(() => {
    const m = new Map<string, Dossier>()
    for (const o of offenderIndex) m.set(o.offender_id, o)
    return m
  }, [offenderIndex])

  const board40 = useMemo(() => {
    if (mostWanted.length) return mostWanted
    // by record volume, not by a predicted score on the person
    return [...offenderIndex]
      .sort((a, b) => b.total_cases - a.total_cases || b.n_districts - a.n_districts)
      .slice(0, 40)
  }, [mostWanted, offenderIndex])

  // most-dangerous gang first — drives the default gang board
  const rankedGangs = useMemo(
    () => [...gangs].sort(
      (a, b) => TIER_RANK[a.threat_tier] - TIER_RANK[b.threat_tier] || b.threat_score - a.threat_score,
    ),
    [gangs],
  )
  const activeGang = selectedGang ?? rankedGangs[0] ?? null

  const forecastItems = useMemo(
    () => generateForecast(anomalies, []),
    [anomalies],
  )

  const predictionNarrative = useMemo(() => {
    if (!shapData || !riskSummary) return null
    return generatePredictionNarrative(shapData.global_feature_importance, riskSummary)
  }, [shapData, riskSummary])

  const handleAnomalySelect = (a: Anomaly) => {
    const c = centroids.find((x) => x.district === a.district)
    if (c) setFlyTarget({ lat: c.lat, lon: c.lon, zoom: 9 })
  }

  const openOffender = (d: Dossier) => setSelectedOffender(d)
  const openOffenderById = (id: string) => {
    const d = offenderById.get(id)
    if (d) setSelectedOffender(d)
  }
  const closeDossier = () => setSelectedOffender(null)

  const modes: Mode[] = ['risk', 'network']
  const MODE_LABELS: Record<Mode, string> = {
    risk: t('predict.riskForecast'),
    network: t('predict.crimeNetwork'),
  }
  const hasOffenders = offenderIndex.length > 0

  /* CONNECT used to be one full-bleed board with four glass panels floating on
     top of it - two of them stacked against the same left edge. The controls
     covered the very graph they described, and nothing had room to breathe.
     Network mode now docks: a toolbar for what you switch, a sidebar for what
     you read, and the board keeps the rest to itself. Risk mode is unchanged. */
  const networkAside = (
    <aside className="shrink-0 w-[272px] border-l border-slate-800/70 flex flex-col min-h-0 overflow-y-auto">
      {netSummary && (
        <section className="shrink-0 px-3 py-3 border-b border-slate-800/70">
          <h3 className="text-[9.5px] font-semibold uppercase tracking-[0.18em] text-slate-300 mb-2.5">
            {t('predict.crimeNetwork')}
          </h3>
          <div className="grid grid-cols-3 gap-2">
            <NetStat value={(netSummary.graph_nodes / 1000).toFixed(0) + 'k'} label={t('predict.persons')} />
            <NetStat value={netSummary.n_communities.toLocaleString()} label={t('predict.gangs')} />
            <NetStat value={(netSummary.graph_edges / 1e6).toFixed(1) + 'M'} label={t('predict.connections')} />
          </div>
          <p className="mt-2.5 text-[9.5px] leading-snug text-slate-400">
            {t('predict.netScope').replace('{firs}', stat(stats.firs))}
          </p>
        </section>
      )}

      {netSub === 'gangs' && activeGang && (
        <section className="shrink-0 px-3 py-3 border-b border-slate-800/70">
          <h3 className="text-[9.5px] font-semibold uppercase tracking-[0.18em] text-slate-300 mb-2">
            {t('predict.gangs')}
          </h3>
          <select
            value={activeGang.gang_rank}
            onChange={(e) => {
              const r = Number(e.target.value)
              setSelectedGang(gangs.find((g) => g.gang_rank === r) ?? null)
            }}
            className="w-full h-8 px-2 rounded-md border border-slate-700/70 bg-slate-900/40 text-[11.5px] text-slate-100 outline-none cursor-pointer focus:border-slate-500 transition-colors"
          >
            {rankedGangs.map((g) => (
              <option key={g.gang_rank} value={g.gang_rank}>
                {t('predict.gangs').replace(/s$/, '')} #{g.gang_rank} · {t(`threat.${g.threat_tier}`)} · {g.gang_size.toLocaleString()} {t('board.members')}
              </option>
            ))}
          </select>
          <div className="mt-2 text-[10px] leading-snug text-slate-400">
            {activeGang.total_cases.toLocaleString()} {t('war.cases')} · {activeGang.n_districts} {t('war.districts')} · {t('board.core')}
          </div>
        </section>
      )}

      {netSub === 'gangs' && (
        <section className="shrink-0 px-3 py-3">
          <h3 className="text-[9.5px] font-semibold uppercase tracking-[0.18em] text-slate-300 mb-2">
            {t('threat.title')}
          </h3>
          <div className="flex flex-col gap-1.5">
            {THREAT_ORDER.map((tier) => (
              <div key={tier} className="flex items-center gap-2 text-[10.5px] text-slate-300">
                <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ background: THREAT_COLORS[tier] }} />
                {t(`threat.${tier}`)}
              </div>
            ))}
          </div>
        </section>
      )}
    </aside>
  )

  if (mode === 'network') {
    return (
      <div className="flex-1 min-h-0 flex flex-col">
        {/* what you switch */}
        <div className="shrink-0 flex items-center gap-2 px-3 h-11 border-b border-slate-800/70 bg-[#15181c]">
          {!lockMode && (
            <div className="rounded-md border border-slate-700/70 flex overflow-hidden">
              {modes.map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`px-3 h-7 text-[11px] font-semibold tracking-wider transition-colors ${
                    mode === m ? 'bg-slate-700/60 text-slate-50' : 'text-slate-400 hover:text-slate-100'
                  }`}
                >
                  {MODE_LABELS[m]}
                </button>
              ))}
            </div>
          )}

          <div className="rounded-md border border-slate-700/70 flex overflow-hidden">
            {(['gangs', 'wanted'] as NetSub[]).map((sub) => (
              <button
                key={sub}
                onClick={() => setNetSub(sub)}
                aria-pressed={netSub === sub}
                className={`px-3 h-7 text-[11px] font-semibold tracking-wider transition-colors ${
                  netSub === sub ? 'bg-slate-700/60 text-slate-50' : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                {sub === 'gangs' ? t('war.gangConnections') : t('war.highProfile')}
              </button>
            ))}
          </div>

          {hasOffenders && <OffenderSearch offenders={offenderIndex} onSelect={openOffender} />}

          {loading && <span className="text-[10.5px] text-slate-400">{t('common.loading')}</span>}

          <span className="ml-auto hidden lg:block text-[9.5px] text-slate-400">
            {t('predict.boardHint')}
          </span>
        </div>

        {/* what you look at, and what you read beside it */}
        <div className="flex-1 min-h-0 flex">
          <div className="relative flex-1 min-w-0">
            {netSub === 'gangs' ? (
              <GangBoard
                rank={activeGang?.gang_rank ?? null}
                tier={activeGang?.threat_tier ?? null}
                network={gangNetwork}
                onSelectNode={openOffenderById}
              />
            ) : (
              <MostWantedBoard offenders={board40} onSelect={openOffenderById} />
            )}
          </div>
          {networkAside}
        </div>

        {selectedOffender && (
          <DossierOverlay dossier={selectedOffender} onClose={closeDossier} onSelectAssociate={openOffenderById} />
        )}
      </div>
    )
  }

  return (
    <div className="relative flex-1 min-h-0">
      <RiskMap cells={cells} showPriority={showPriority} flyTarget={flyTarget} />

      {/* top-left: mode switch + controls */}
      <div className="absolute top-3 left-3 z-30 flex items-center gap-2">
        {!lockMode && (
          <div className="glass rounded-md flex overflow-hidden">
            {modes.map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-3.5 py-1.5 text-xs font-semibold tracking-wider transition-colors ${
                  mode === m ? 'bg-sky-500/25 text-sky-300' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {MODE_LABELS[m]}
              </button>
            ))}
          </div>
        )}

        <button
          onClick={() => setShowPriority(!showPriority)}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors border ${
            showPriority
              ? 'bg-sky-500/20 border-sky-400/40 text-sky-300'
              : 'bg-transparent border-slate-600/50 text-slate-400 hover:border-slate-500'
          }`}
        >
          {t('predict.priorityCells')}
        </button>
        {loading && (
          <span className="glass rounded-md px-3 py-1.5 text-xs text-sky-300 animate-pulse">
            {t('common.loading')}
          </span>
        )}
      </div>

      {/* right panel — risk mode only */}
      {mode === 'risk' && (
        <div className="absolute top-3 right-3 bottom-8 z-10 w-[360px] max-w-[calc(100vw-340px)] glass rounded-xl p-3.5 flex flex-col gap-3 min-h-0 overflow-hidden">
          <div className="flex items-center justify-between shrink-0 pb-1 border-b border-slate-700/30">
            <div className="flex items-center gap-1.5">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" className="text-sky-300" aria-hidden>
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="text-[10px] uppercase tracking-widest text-slate-300 font-semibold">Week-ahead Risk</span>
            </div>
            <span className="text-[9px] uppercase tracking-wider text-slate-500">LightGBM · held-out test</span>
          </div>
          {riskSummary && <RiskStats summary={riskSummary} />}
          {predictionNarrative && (
            <div className="rounded-md border border-sky-400/20 bg-sky-500/5 px-2.5 py-2">
              <div className="text-[9px] uppercase tracking-wider text-sky-400/80 mb-1 font-semibold flex items-center gap-1.5">
                <svg viewBox="0 0 24 24" width="10" height="10" fill="none" aria-hidden>
                  <path d="M12 2a7 7 0 0 0-7 7c0 3 2 5.5 5.5 8.5L12 19l1.5-1.5C17 14.5 19 12 19 9a7 7 0 0 0-7-7Z" stroke="currentColor" strokeWidth="1.5" />
                </svg>
                {t('intel.aiInsight')}
              </div>
              <div className="text-[10px] text-slate-400 leading-snug">{predictionNarrative}</div>
            </div>
          )}
          <ForecastWidget items={forecastItems} />
          <AnomalyFeed anomalies={anomalies} onSelect={handleAnomalySelect} />
        </div>
      )}
    </div>
  )
}

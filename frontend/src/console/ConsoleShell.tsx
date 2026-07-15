import { useEffect, useState } from 'react'
import SenseView from '../views/SenseView'
import PredictView from '../views/PredictView'
import ActView from '../views/ActView'
import TrustView from '../views/TrustView'
import IntroOverlay from '../components/IntroOverlay'
import ErrorBoundary from '../components/ErrorBoundary'
import SentinelMark from '../components/SentinelMark'
import SearchBar from '../components/SearchBar'
import { fetchJson, filterAnomalies } from '../lib/data'
import { getThreatLevel } from '../lib/insights'
import ThreatIndicator from '../components/ThreatIndicator'
import LiveTicker from '../components/LiveTicker'
import { useI18n } from '../lib/i18n'
import { useFocus } from '../lib/focus'
import { useNav } from '../lib/nav'
import { useRoute, SLUG_BY_TAB } from '../lib/route'
import type { Tab } from '../lib/nav'
import type { Anomaly, DistrictSummary } from '../lib/data'
import type { ThreatLevel } from '../lib/insights'

const TABS: Tab[] = ['SENSE', 'PREDICT', 'ACT', 'TRUST']
const TAB_KEYS: Record<Tab, string> = { SENSE: 'tab.sense', PREDICT: 'tab.predict', ACT: 'tab.act', TRUST: 'tab.trust' }

const THREAT_HEX: Record<ThreatLevel, string> = {
  CRITICAL: '#ef4444',
  HIGH: '#f97316',
  MEDIUM: '#f59e0b',
  LOW: '#22c55e',
}

export default function ConsoleShell() {
  const { activeTab: tab, setActiveTab: setTab } = useNav()
  const { tab: routeTab, navigate } = useRoute()
  const [computedAt, setComputedAt] = useState<string | null>(null)
  const [anomalies, setAnomalies] = useState<Anomaly[]>([])
  const [districtSummaries, setDistrictSummaries] = useState<DistrictSummary[]>([])
  const [threatLevel, setThreatLevel] = useState<ThreatLevel>('LOW')
  const [districtCount, setDistrictCount] = useState(0)
  const [stationCount, setStationCount] = useState(0)
  const [showHelp, setShowHelp] = useState(false)
  const { lang, setLang, t } = useI18n()
  const { focus } = useFocus()

  // #/console/predict deep-links a tab; the landing page now handles the
  // first-run explanation, so nothing auto-opens here.
  useEffect(() => {
    if (routeTab && routeTab !== tab) setTab(routeTab)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeTab])

  const goTab = (tb: Tab) => {
    setTab(tb)
    navigate(`/console/${SLUG_BY_TAB[tb]}`)
  }

  useEffect(() => {
    fetchJson<{ computed_at: string }>('meta.json')
      .then((m) => setComputedAt(m.computed_at.slice(0, 10)))
      .catch(() => {})
    Promise.all([
      fetchJson<Anomaly[]>('anomaly_feed.json'),
      fetchJson<DistrictSummary[]>('district_summary.json'),
    ]).then(([a, ds]) => {
      const filtered = filterAnomalies(a)
      setAnomalies(filtered)
      setDistrictSummaries(ds)
      setDistrictCount(ds.length)
      setStationCount(1074)
      const avgYoY = ds.reduce((s, d) => s + d.yoy_change_pct, 0) / (ds.length || 1)
      setThreatLevel(getThreatLevel(filtered.length, avgYoY))
    }).catch(() => {})
  }, [])

  // a search from the map-less TRUST tab jumps to SENSE and flies there
  useEffect(() => {
    if (focus && tab === 'TRUST') goTab('SENSE')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus])

  // keyboard shortcuts: 1-4 switch tabs
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return
      const idx = Number(e.key) - 1
      if (idx >= 0 && idx < TABS.length) goTab(TABS[idx])
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const threatHex = THREAT_HEX[threatLevel]

  return (
    <div className="h-full flex flex-col">
      <header className="shrink-0 z-20 flex items-center gap-5 px-4 h-14 border-b border-slate-800/70 bg-[#15181c]">
        <a
          href="#/"
          title={t('site.backHome')}
          className="flex items-center gap-3 group"
        >
          <SentinelMark />
          <div className="flex flex-col leading-none">
            <span className="text-[17px] font-bold tracking-[0.14em] text-slate-100 group-hover:text-white transition-colors">
              PRAHARI <span className="brand-accent font-semibold">ಪ್ರಹರಿ</span>
            </span>
            <span className="hidden md:inline mt-1 text-[9px] font-mono-data uppercase tracking-[0.22em] text-slate-500">
              {districtCount} Districts · {stationCount.toLocaleString()} Stations{computedAt ? ` · Updated ${computedAt}` : ''}
            </span>
          </div>
        </a>

        <div
          className="hidden md:flex ml-4 px-3 py-1 rounded-md border"
          style={{ borderColor: `${threatHex}30`, background: `${threatHex}08` }}
        >
          <ThreatIndicator level={threatLevel} />
        </div>

        <div className="hidden lg:flex items-center gap-1.5 ml-3">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]" />
          <span className="text-[9px] uppercase tracking-widest text-emerald-400/80 font-semibold">ONLINE</span>
        </div>

        <SearchBar className="hidden sm:block ml-5" />

        <nav className="flex items-stretch gap-0.5 ml-auto h-full">
          {TABS.map((tb) => {
            const active = tab === tb
            return (
              <button
                key={tb}
                onClick={() => goTab(tb)}
                className={`relative px-4 h-full flex items-center text-[11px] font-semibold uppercase tracking-[0.16em] transition-colors ${
                  active ? 'text-slate-50' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {t(TAB_KEYS[tb])}
                {tb === 'PREDICT' && anomalies.length > 0 && (
                  <span className="ml-1.5 min-w-[15px] h-[15px] rounded-[3px] bg-red-500/90 text-[9px] text-white font-bold flex items-center justify-center px-1 tabular-nums">
                    {anomalies.length}
                  </span>
                )}
                {active && (
                  <span
                    className="absolute left-2.5 right-2.5 bottom-0 h-[2px] rounded-full"
                    style={{ background: 'var(--brand)', boxShadow: '0 0 10px rgba(201,163,92,0.55)' }}
                  />
                )}
              </button>
            )
          })}
          <div className="flex items-center gap-1.5 ml-3 pl-3 border-l border-slate-800/70">
            <button
              onClick={() => setLang(lang === 'en' ? 'kn' : 'en')}
              title={lang === 'en' ? 'ಕನ್ನಡಕ್ಕೆ ಬದಲಿಸಿ' : 'Switch to English'}
              className="w-7 h-7 rounded-md border border-slate-700/70 text-slate-300 text-[11px] font-semibold hover:text-slate-50 hover:border-slate-500 transition-colors"
            >
              {lang === 'en' ? 'ಕ' : 'En'}
            </button>
            <button
              onClick={() => setShowHelp(true)}
              title="What am I looking at?"
              className="w-7 h-7 rounded-md border border-slate-700/70 text-slate-400 text-xs font-mono-data hover:text-slate-50 hover:border-slate-500 transition-colors"
            >
              ?
            </button>
          </div>
        </nav>
      </header>

      {showHelp && <IntroOverlay onClose={() => setShowHelp(false)} />}

      <LiveTicker anomalies={anomalies} districts={districtSummaries} />

      <main className="flex-1 flex flex-col min-h-0 relative">
        <ErrorBoundary>
          {tab === 'SENSE' ? <SenseView />
            : tab === 'PREDICT' ? <PredictView />
            : tab === 'ACT' ? <ActView />
            : <TrustView />}
        </ErrorBoundary>
      </main>

      <footer className="shrink-0 z-20 flex items-center justify-between px-4 h-7 text-[10px] font-mono-data text-slate-500 border-t border-slate-800/70 bg-[#15181c]">
        <span className="tracking-tight">{t('footer.stats')}</span>
        <span className="flex items-center gap-3">
          {computedAt && (
            <span className="flex items-center gap-1.5 text-slate-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]" />
              {t('common.analyticsComputed')} {computedAt} · {t('common.nightlyRecompute')}
            </span>
          )}
          <span className="hidden lg:inline tracking-tight">{t('footer.hotspots')}</span>
        </span>
      </footer>
    </div>
  )
}

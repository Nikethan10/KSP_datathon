import { useEffect, useState, lazy, Suspense } from 'react'

/* Each section is split out. Loading COMMAND used to pull in 3d-force-graph
   and three (~700 KB) because every view was imported eagerly, for a graph
   most sessions never open. */
const CommandView = lazy(() => import('../views/CommandView'))
const InvestigateView = lazy(() => import('../views/InvestigateView'))
const ConnectView = lazy(() => import('../views/PredictView'))
const ForecastView = lazy(() => import('../views/ForecastView'))
const ActView = lazy(() => import('../views/ActView'))
const ReplayView = lazy(() => import('../views/ReplayView'))
const TrustView = lazy(() => import('../views/TrustView'))
import IntroOverlay from '../components/IntroOverlay'
import ErrorBoundary from '../components/ErrorBoundary'
import SentinelMark from '../components/SentinelMark'
import SearchBar from '../components/SearchBar'
import { fetchJson, filterAnomalies } from '../lib/data'
import LiveTicker from '../components/LiveTicker'
import { useI18n } from '../lib/i18n'
import { useStats, stat } from '../lib/useStats'
import { useFocus } from '../lib/focus'
import { useNav } from '../lib/nav'
import { useRoute, SLUG_BY_TAB } from '../lib/route'
import type { Tab } from '../lib/nav'
import type { Anomaly, DistrictSummary } from '../lib/data'

const TABS: Tab[] = [
  'COMMAND', 'INVESTIGATE', 'CONNECT', 'FORECAST', 'ACT', 'REPLAY', 'TRUST',
]
const TAB_KEYS: Record<Tab, string> = {
  COMMAND: 'tab.command',
  INVESTIGATE: 'tab.investigate',
  CONNECT: 'tab.connect',
  FORECAST: 'tab.forecast',
  ACT: 'tab.act',
  REPLAY: 'tab.replay',
  TRUST: 'tab.trust',
}
/* Numbered so the navigation reads as a workflow rather than a set of
   interchangeable dashboards. */
const TAB_NO: Record<Tab, string> = {
  COMMAND: '01', INVESTIGATE: '02', CONNECT: '03',
  FORECAST: '04', ACT: '05', REPLAY: '06', TRUST: '07',
}

/* Matches the console's shape so a section switch does not collapse the
   layout and reflow everything behind it. */
function SectionSkeleton() {
  return (
    <div className="h-full grid grid-rows-[minmax(0,1.55fr)_minmax(0,1fr)] animate-pulse">
      <div className="border-b border-slate-800/70 bg-slate-900/20" />
      <div className="grid grid-cols-1 lg:grid-cols-3 divide-x divide-slate-800/70">
        <div className="bg-slate-900/10" />
        <div className="bg-slate-900/10" />
        <div className="bg-slate-900/10" />
      </div>
    </div>
  )
}

export default function ConsoleShell() {
  const { activeTab: tab, setActiveTab: setTab } = useNav()
  const { tab: routeTab, navigate } = useRoute()
  const [anomalies, setAnomalies] = useState<Anomaly[]>([])
  const [districtSummaries, setDistrictSummaries] = useState<DistrictSummary[]>([])
  const [showHelp, setShowHelp] = useState(false)
  const stats = useStats()
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
    Promise.all([
      fetchJson<Anomaly[]>('anomaly_feed.json'),
      fetchJson<DistrictSummary[]>('district_summary.json'),
    ]).then(([a, ds]) => {
      setAnomalies(filterAnomalies(a))
      setDistrictSummaries(ds)
    }).catch(() => {})
  }, [])

  // a search from the map-less TRUST tab jumps to SENSE and flies there
  useEffect(() => {
    if (focus && tab === 'TRUST') goTab('FORECAST')
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

  const districtsRising = districtSummaries.filter((d) => d.yoy_change_pct > 10).length

  return (
    <div className="h-full flex flex-col">
      <header className="shrink-0 z-20 flex items-center gap-6 px-4 h-14 border-b border-slate-800/70 bg-[#15181c]">
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
            <span className="hidden 2xl:block mt-1 text-[9px] font-mono-data uppercase tracking-[0.14em] whitespace-nowrap text-slate-500">
              {t('product.tagline')}
            </span>
          </div>
        </a>

        {/* What "critical" never said: the actual counts, and a way in. */}
        <button
          onClick={() => goTab('COMMAND')}
          className="hidden md:flex flex-col items-start ml-4 px-3 py-1 rounded-md border border-slate-700/70 hover:border-slate-500 transition-colors text-left"
        >
          <span className="text-[9px] uppercase tracking-[0.16em] text-slate-500">{t('shell.situation')}</span>
          <span className="mt-0.5 text-[10px] font-semibold text-slate-200 tabular-nums leading-tight">
            {districtSummaries.length === 0
              ? '—'
              : anomalies.length === 0 && districtsRising === 0
                ? t('shell.situationQuiet')
                : t('shell.situationLine')
                    .replace('{a}', String(anomalies.length))
                    .replace('{d}', String(districtsRising))}
          </span>
        </button>

        <SearchBar className="hidden sm:block ml-5" />

        <nav className="flex items-stretch gap-0.5 ml-auto h-full">
          {TABS.map((tb) => {
            const active = tab === tb
            return (
              <button
                key={tb}
                onClick={() => goTab(tb)}
                className={`relative px-2.5 xl:px-3 h-full flex items-center text-[10.5px] font-semibold uppercase tracking-[0.12em] whitespace-nowrap transition-colors ${
                  active ? 'text-slate-50' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <span className="text-[9px] tabular-nums text-slate-400 mr-1.5">{TAB_NO[tb]}</span>
                {t(TAB_KEYS[tb])}
                {tb === 'COMMAND' && anomalies.length > 0 && (
                  <span className="ml-1.5 min-w-[15px] h-[15px] rounded-[3px] bg-red-500/90 text-[9px] text-white font-bold flex items-center justify-center px-1 tabular-nums">
                    {anomalies.length}
                  </span>
                )}
                {active && (
                  <span
                    className="absolute left-2.5 right-2.5 bottom-0 h-[2px] rounded-full"
                    style={{ background: 'var(--brand)' }}
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
          <Suspense fallback={<SectionSkeleton />}>
            {tab === 'COMMAND' ? <CommandView />
              : tab === 'INVESTIGATE' ? <InvestigateView />
              : tab === 'CONNECT' ? <ConnectView initialMode="network" lockMode />
              : tab === 'FORECAST' ? <ForecastView />
              : tab === 'ACT' ? <ActView />
              : tab === 'REPLAY' ? <ReplayView />
              : <TrustView />}
          </Suspense>
        </ErrorBoundary>
      </main>

      <footer className="shrink-0 z-20 flex items-center justify-between px-4 h-7 text-[10px] font-mono-data text-slate-500 border-t border-slate-800/70 bg-[#15181c]">
        <span className="tracking-tight">
          {stat(stats.firs)} FIRs · 2016–2024 · {stat(stats.districts)} {t('footer.districts')} ·{' '}
          {stat(stats.stations)} {t('footer.stations')}
        </span>
        <span className="flex items-center gap-3">
          {stats.computedAt && (
            <span className="flex items-center gap-1.5 text-slate-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              {t('common.analyticsComputed')} {stats.computedAt}
            </span>
          )}
          <span className="hidden lg:inline tracking-tight">{t('footer.hotspots')}</span>
        </span>
      </footer>
    </div>
  )
}

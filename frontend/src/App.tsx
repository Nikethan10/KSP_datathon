import { useEffect, useState } from 'react'
import SenseView from './views/SenseView'
import PredictView from './views/PredictView'
import ActView from './views/ActView'
import TrustView from './views/TrustView'
import IntroOverlay from './components/IntroOverlay'
import { fetchJson } from './lib/data'

const TABS = ['SENSE', 'PREDICT', 'ACT', 'TRUST'] as const
type Tab = (typeof TABS)[number]

export default function App() {
  const [tab, setTab] = useState<Tab>('SENSE')
  const [computedAt, setComputedAt] = useState<string | null>(null)
  const [showIntro, setShowIntro] = useState(
    () => localStorage.getItem('prahari_intro_seen') !== '1',
  )

  const closeIntro = () => {
    localStorage.setItem('prahari_intro_seen', '1')
    setShowIntro(false)
  }

  useEffect(() => {
    fetchJson<{ computed_at: string }>('meta.json')
      .then((m) => setComputedAt(m.computed_at.slice(0, 10)))
      .catch(() => {})
  }, [])

  return (
    <div className="h-full flex flex-col">
      <header className="shrink-0 z-20 flex items-center gap-6 px-4 h-13 border-b border-slate-800/80 bg-[#0a0e14]">
        <div className="flex items-baseline gap-2.5 py-2.5">
          <span className="text-lg font-bold tracking-wide text-slate-100">
            PRAHARI <span className="text-sky-400">प्रहरी</span>
          </span>
          <span className="hidden md:inline text-[10px] uppercase tracking-[0.25em] text-slate-500">
            Crime Intelligence · Karnataka State Police
          </span>
        </div>
        <nav className="flex items-center gap-1 ml-auto">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3.5 py-1.5 rounded-md text-xs font-semibold tracking-wider transition-colors ${
                tab === t
                  ? 'bg-sky-500/20 text-sky-300'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              {t}
            </button>
          ))}
          <button
            onClick={() => setShowIntro(true)}
            title="What am I looking at?"
            className="ml-1 w-6 h-6 rounded-full border border-slate-600/60 text-slate-400 text-xs hover:text-sky-300 hover:border-sky-400/50 transition-colors"
          >
            ?
          </button>
        </nav>
      </header>

      {showIntro && <IntroOverlay onClose={closeIntro} />}

      <main className="flex-1 flex flex-col min-h-0 relative">
        {tab === 'SENSE' ? <SenseView />
          : tab === 'PREDICT' ? <PredictView />
          : tab === 'ACT' ? <ActView />
          : <TrustView />}
      </main>

      <footer className="shrink-0 z-20 flex items-center justify-between px-4 h-7 text-[10px] text-slate-500 border-t border-slate-800/80 bg-[#0a0e14]">
        <span>1,674,732 FIRs · 2016–2024 · 41 districts · 1,074 stations</span>
        <span>
          {computedAt && (
            <span className="text-emerald-500/90 mr-3">
              analytics computed {computedAt} · nightly recompute
            </span>
          )}
          Hotspots: Getis-Ord Gi* (p &lt; 0.05) · Basemap © OpenStreetMap
        </span>
      </footer>
    </div>
  )
}

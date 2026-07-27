import { useState } from 'react'
import SenseView from './SenseView'
import PredictView from './PredictView'
import { useI18n } from '../lib/i18n'

/* FORECAST answers "what is happening, and what is coming".

   That is two existing surfaces: the Gi* hotspot and trend map (SenseView)
   and the week-ahead risk surface (PredictView in risk mode). They were
   separate top-level tabs, which meant an officer asking one question had to
   know which analytical layer produced the answer. Here they are two lenses
   on the same question instead. */

type Lens = 'patterns' | 'risk'

export default function ForecastView() {
  const [lens, setLens] = useState<Lens>('patterns')
  const { t } = useI18n()

  const LENSES: { id: Lens; key: string }[] = [
    { id: 'patterns', key: 'forecast.lensPatterns' },
    { id: 'risk', key: 'forecast.lensRisk' },
  ]

  return (
    <div className="relative h-full">
      {/* Lens switch sits above the map, clear of the view's own controls. */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex rounded-md border border-slate-700/70 bg-[#15181c] overflow-hidden">
        {LENSES.map((l) => (
          <button
            key={l.id}
            onClick={() => setLens(l.id)}
            aria-pressed={lens === l.id}
            className={`px-3.5 h-7 text-[10.5px] font-semibold uppercase tracking-[0.14em] transition-colors ${
              lens === l.id
                ? 'bg-slate-700/60 text-slate-50'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {t(l.key)}
          </button>
        ))}
      </div>

      {/* One lens mounted at a time. Keeping both alive held two MapLibre
          contexts plus two deck.gl contexts on a single section, and the
          browser caps WebGL contexts at around sixteen — enough to white-screen
          a map partway through a demo. Remounting is cheap now that data.ts
          caches parsed payloads, so a lens switch re-renders without
          re-downloading or re-parsing anything. */}
      <div className="absolute inset-0 flex flex-col">
        {lens === 'patterns' ? <SenseView /> : <PredictView initialMode="risk" lockMode />}
      </div>
    </div>
  )
}

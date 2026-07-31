import { useState } from 'react'
import SenseView from './SenseView'
import PredictView from './PredictView'
import { useI18n } from '../lib/i18n'

/* FORECAST, as the three questions an officer actually asks, in order:
   what is happening (Gi* hotspots and trends), what is changing (cells
   departing from their own history), and what is likely next (the week-ahead
   risk surface). Emerging used to hide behind a toggle inside the first
   lens; promoting it makes the analytical stages the visible structure. */

type Lens = 'happening' | 'emerging' | 'risk'

export default function ForecastView() {
  const [lens, setLens] = useState<Lens>('happening')
  const { t } = useI18n()

  const LENSES: { id: Lens; key: string }[] = [
    { id: 'happening', key: 'forecast.lensHappening' },
    { id: 'emerging', key: 'forecast.lensEmerging' },
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
        {lens === 'risk' ? (
          <PredictView initialMode="risk" lockMode />
        ) : (
          <SenseView emergingLens={lens === 'emerging'} />
        )}
      </div>
    </div>
  )
}

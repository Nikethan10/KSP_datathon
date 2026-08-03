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
    <div className="h-full flex flex-col">
      {/* The three questions get their own band. Floating this centred over the
          map put it on top of the filter bar the lens below anchors top-left;
          any absolute position collides at some width, a real row cannot. */}
      <div className="shrink-0 flex items-center gap-0.5 px-3 h-9 border-b border-slate-800/70 bg-[#15181c]">
        {LENSES.map((l) => (
          <button
            key={l.id}
            onClick={() => setLens(l.id)}
            aria-pressed={lens === l.id}
            className={`relative px-3.5 h-full text-[10.5px] font-semibold uppercase tracking-[0.14em] transition-colors ${
              lens === l.id
                ? 'text-slate-50 after:absolute after:inset-x-2 after:bottom-0 after:h-[2px] after:bg-sky-300'
                : 'text-slate-400 hover:text-slate-100'
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
      <div className="flex-1 min-h-0 flex flex-col">
        {lens === 'risk' ? (
          <PredictView initialMode="risk" lockMode />
        ) : (
          <SenseView emergingLens={lens === 'emerging'} />
        )}
      </div>
    </div>
  )
}

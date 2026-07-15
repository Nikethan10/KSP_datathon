interface Props {
  onClose: () => void
}

const ROWS = [
  {
    tab: 'SENSE',
    what: 'Where crime concentrates — statistically',
    how: 'Getis-Ord Gi* flags map cells with significantly more (or less) crime than expected, not just a colour blur. State view compares against all of Karnataka; District view compares each cell against its own district.',
  },
  {
    tab: 'PREDICT',
    what: 'Where crime is likely next — and who operates together',
    how: 'A gradient-boosted model scores every 1 km cell per 8-hour shift using near-repeat patterns (crime attracts crime nearby, briefly). PAI = share of crime captured per share of area patrolled. The 3D network links offenders co-accused in the same FIRs; colours are detected groups.',
  },
  {
    tab: 'ACT',
    what: 'Where to send tonight’s patrols',
    how: 'A maximal-coverage optimizer places the available patrols to cover the most predicted risk, compared against random and volume-driven deployment. Every patrol gets a printable briefing card.',
  },
  {
    tab: 'TRUST',
    what: 'Why each score — and is it fair',
    how: 'SHAP shows which factors drove every prediction in plain language. A fairness audit tracks geographic disparity and reporting bias. No individual-level prediction, no demographic features.',
  },
]

export default function IntroOverlay({ onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="glass rounded-2xl max-w-2xl w-full p-6 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-baseline justify-between mb-1">
          <h2 className="text-xl font-bold text-slate-100">
            PRAHARI <span className="text-sky-400">प्रहरी</span>
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 text-sm px-2"
            aria-label="Close intro"
          >
            ✕
          </button>
        </div>
        <p className="text-[13px] text-slate-400 mb-4">
          AI-driven crime analytics for Karnataka State Police — built on 1.67M FIRs
          (2016–2024, 41 districts). Four layers, one workflow: <span className="text-slate-200">sense</span> what
          is happening, <span className="text-slate-200">predict</span> what comes next,{' '}
          <span className="text-slate-200">act</span> on it tonight, and{' '}
          <span className="text-slate-200">trust</span> every number on screen.
        </p>

        <div className="flex flex-col gap-2.5">
          {ROWS.map((r) => (
            <div key={r.tab} className="rounded-lg bg-slate-800/50 border border-slate-700/40 px-3 py-2.5">
              <div className="flex items-baseline gap-2">
                <span className="text-xs font-bold tracking-wider text-sky-300">{r.tab}</span>
                <span className="text-[12px] font-medium text-slate-200">{r.what}</span>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-400">{r.how}</p>
            </div>
          ))}
        </div>

        <button
          onClick={onClose}
          className="mt-4 w-full py-2 rounded-lg bg-sky-500/20 border border-sky-400/40 text-sky-300 text-sm font-semibold hover:bg-sky-500/30 transition-colors"
        >
          Open the command view
        </button>
      </div>
    </div>
  )
}

import { useI18n } from '../lib/i18n'
import SentinelMark from './SentinelMark'

interface Props {
  onClose: () => void
}

export default function IntroOverlay({ onClose }: Props) {
  const { t } = useI18n()

  // Mirrors the seven-section navigation, in workflow order.
  const rows = [
    { tab: t('tab.command'), desc: t('intro.commandDesc') },
    { tab: t('tab.investigate'), desc: t('intro.investigateDesc') },
    { tab: t('tab.connect'), desc: t('intro.connectDesc') },
    { tab: t('tab.forecast'), desc: t('intro.forecastDesc') },
    { tab: t('tab.act'), desc: t('intro.actDesc') },
    { tab: t('tab.replay'), desc: t('intro.replayDesc') },
    { tab: t('tab.trust'), desc: t('intro.trustDesc') },
  ]

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="glass rounded-xl max-w-2xl w-full p-6 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            <SentinelMark size={34} />
            <div className="leading-none">
              <h2 className="text-xl font-bold tracking-[0.12em] text-slate-100">
                PRAHARI <span className="brand-accent">ಪ್ರಹರಿ</span>
              </h2>
              <p className="mt-1.5 text-[11px] font-mono-data uppercase tracking-[0.18em] text-slate-500">
                {t('intro.subtitle')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-200 text-sm px-1 leading-none"
            aria-label="Close intro"
          >
            ×
          </button>
        </div>

        <div className="flex flex-col gap-px rounded-lg overflow-hidden border border-slate-700/40">
          {rows.map((r, i) => (
            <div key={r.tab} className="flex items-start gap-3 bg-slate-800/40 px-3.5 py-3">
              <span
                className="mt-0.5 shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-mono-data font-semibold"
                style={{ background: 'var(--brand-soft)', color: 'var(--brand)' }}
              >
                {i + 1}
              </span>
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-200">{r.tab}</span>
                <p className="mt-1 text-[11.5px] leading-relaxed text-slate-400">{r.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={onClose}
          className="mt-5 w-full py-2.5 rounded-lg text-sm font-semibold uppercase tracking-[0.14em] text-slate-900 transition-opacity hover:opacity-90"
          style={{ background: 'var(--brand)' }}
        >
          {t('intro.dismiss')}
        </button>
      </div>
    </div>
  )
}

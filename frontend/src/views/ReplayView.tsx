import { useI18n } from '../lib/i18n'

/* REPLAY — prediction against reality, week by week.

   Placeholder until evaluate/backtest.py emits backtest_weeks.json (per ISO
   week of the 2024 test period: top-N predicted cells, actual incidents with
   coordinates and timestamps, realised hit rate). Shipping the shell now so
   the section exists in the navigation and the routing is settled; the
   scrubber and the map land on day 4.

   This screen deliberately gets a "worst week" control alongside "best week".
   A system that shows where it failed reads as science; one that shows only
   its wins reads as sales. */

export default function ReplayView() {
  const { t } = useI18n()
  return (
    <div className="h-full flex items-center justify-center px-8">
      <div className="max-w-lg text-center">
        <div className="text-[9.5px] font-semibold uppercase tracking-[0.2em] text-slate-500">
          {t('replay.stamp')}
        </div>
        <h2 className="mt-3 text-[18px] font-semibold text-slate-100">{t('replay.title')}</h2>
        <p className="mt-3 text-[12px] leading-relaxed text-slate-400">{t('replay.lede')}</p>
        <p className="mt-5 text-[10.5px] text-slate-600">{t('replay.pending')}</p>
      </div>
    </div>
  )
}

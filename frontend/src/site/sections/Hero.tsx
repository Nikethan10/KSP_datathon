import { useEffect, useState } from 'react'
import KarnatakaWireframe from '../KarnatakaWireframe'
import { useCountUp } from '../../lib/useCountUp'
import { useReveal } from '../../lib/useReveal'
import { useI18n } from '../../lib/i18n'
import { fetchJson } from '../../lib/data'
import { useStats, fillStats } from '../../lib/useStats'

function Stat({
  value,
  label,
  decimals = 0,
  suffix = '',
}: {
  value: number | null
  label: string
  decimals?: number
  suffix?: string
}) {
  // Count up to 0 while the value is unknown; the dash is rendered instead.
  const n = useCountUp(value ?? 0, 1400)
  return (
    <div>
      <div className="text-[clamp(20px,2.6vw,28px)] font-semibold tabular-nums text-slate-50 leading-none">
        {value === null
          ? '—'
          : `${decimals ? n.toFixed(decimals) : Math.round(n).toLocaleString('en-IN')}${suffix}`}
      </div>
      <div className="mt-2 text-[10px] font-mono-data uppercase tracking-[0.2em] text-slate-500">
        {label}
      </div>
    </div>
  )
}

export default function Hero() {
  const { t } = useI18n()
  const ref = useReveal<HTMLElement>()
  const stats = useStats()
  const [pai, setPai] = useState<number | null>(null)

  useEffect(() => {
    fetchJson<{ headline_numbers: { pai_5pct: number } }>('benchmark_report.json')
      .then((r) => setPai(r.headline_numbers.pai_5pct))
      .catch(() => setPai(null))
  }, [])

  return (
    <section ref={ref} className="reveal site-grid relative overflow-hidden">
      {/* the state, drawn */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.85]">
        <div className="absolute right-[-6%] top-[2%] w-[62%] h-[92%] hidden md:block">
          <KarnatakaWireframe />
        </div>
        <div className="absolute inset-x-0 top-[8%] h-[70%] md:hidden opacity-40">
          <KarnatakaWireframe />
        </div>
      </div>

      <div className="site-wrap relative pt-20 pb-24 md:pt-28 md:pb-32">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full border border-slate-700/70 bg-[#1d2126]/60">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="text-[10px] font-mono-data uppercase tracking-[0.22em] text-slate-400">
              {t('site.hero.badge')}
            </span>
          </div>

          <h1 className="mt-7 text-[clamp(34px,6vw,62px)] font-semibold leading-[1.04] text-slate-50">
            {t('site.hero.title1')}
            <br />
            <span className="brand-accent">{t('site.hero.title2')}</span>
          </h1>

          <p className="mt-6 text-[16px] md:text-[17px] leading-relaxed text-slate-400 max-w-xl">
            {fillStats(t('site.hero.lede'), stats)}
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <a href="#/console" className="site-btn site-btn-primary">
              {t('site.hero.cta')}
            </a>
            <a href="#/how-it-works" className="site-btn site-btn-ghost">
              {t('site.hero.cta2')}
            </a>
          </div>

          <div className="mt-14 pt-8 border-t border-slate-800/70 grid grid-cols-2 sm:grid-cols-4 gap-7">
            <Stat value={stats.firs} label={t('site.hero.statFirs')} />
            <Stat value={stats.districts} label={t('site.hero.statDistricts')} />
            <Stat value={stats.stations} label={t('site.hero.statStations')} />
            <Stat value={pai} decimals={1} suffix="×" label={t('site.hero.statPai')} />
          </div>
        </div>
      </div>
    </section>
  )
}

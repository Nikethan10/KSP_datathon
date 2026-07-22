import SiteShell from './SiteShell'
import PageHeader from './PageHeader'
import { Section, Reveal } from './primitives'
import CTA from './sections/CTA'
import { useI18n } from '../lib/i18n'
import { useStats, stat, fillStats } from '../lib/useStats'

const STAGES = [
  { key: 'sense', tab: 'sense', methods: ['Getis-Ord Gi* (p < 0.05)', 'LISA local clusters', 'State + district-normalised lenses', 'Emerging-hotspot classification'] },
  { key: 'predict', tab: 'predict', methods: ['LightGBM spatio-temporal risk', 'Near-repeat / self-exciting features', 'STL residual anomaly detection', 'Louvain community detection', 'Fragmentation simulation'] },
  { key: 'act', tab: 'act', methods: ['Maximal-coverage integer program', 'Greedy fallback (always solves)', 'Coverage uplift vs status quo', 'Printable patrol briefing sheet'] },
  { key: 'trust', tab: 'trust', methods: ['SHAP feature attributions', 'Reliability diagram / calibration', 'Reporting-bias-adjusted fairness audit', 'Benchmark harness'] },
]

export default function HowItWorksPage() {
  const { t } = useI18n()
  const stats = useStats()
  return (
    <SiteShell>
      <PageHeader
        stamp={t('site.how.stamp')}
        title={fillStats(t('site.how.title'), stats)}
        lede={t('site.how.lede')}
      />

      <Section stamp={t('site.how.dataStamp')} title={t('site.how.dataTitle')} lede={t('site.how.dataLede')}>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { v: stat(stats.firs), l: t('site.how.dFirs') },
            { v: '2016–2024', l: t('site.how.dYears') },
            { v: stat(stats.districts), l: t('site.how.dDistricts') },
            { v: stat(stats.stations), l: t('site.how.dStations') },
          ].map((s, i) => (
            <Reveal key={s.l} delay={i * 70}>
              <div className="site-card p-6">
                <div className="text-[26px] font-semibold tabular-nums text-slate-50 leading-none">{s.v}</div>
                <div className="mt-3 text-[11px] font-mono-data uppercase tracking-[0.18em] text-slate-500">{s.l}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      {STAGES.map((s, i) => (
        <Section
          key={s.key}
          id={s.key}
          stamp={`${String(i + 1).padStart(2, '0')} / ${t(`site.pipeline.${s.key}.name`)}`}
          title={t(`site.how.${s.key}.title`)}
          lede={t(`site.how.${s.key}.body`)}
          className="!py-14"
        >
          <Reveal className="mt-8">
            <div className="site-card p-7">
              <div className="stamp">{t('site.how.methods')}</div>
              <div className="rule-scan mt-3 mb-5" />
              <ul className="grid gap-2.5 sm:grid-cols-2">
                {s.methods.map((m) => (
                  <li key={m} className="text-[13.5px] text-slate-300 leading-snug flex gap-2.5">
                    <span className="brand-accent shrink-0">·</span>
                    {m}
                  </li>
                ))}
              </ul>
              <a
                href={`#/console/${s.tab}`}
                className="mt-7 inline-flex items-center gap-2 text-[12px] font-cond uppercase tracking-[0.16em] brand-accent hover:text-slate-100 transition-colors"
              >
                {t('site.how.open')} {t(`site.pipeline.${s.key}.name`)} →
              </a>
            </div>
          </Reveal>
        </Section>
      ))}

      <CTA />
    </SiteShell>
  )
}

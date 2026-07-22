import { useEffect, useState } from 'react'
import { Section, RedactedFigure } from '../primitives'
import { useI18n } from '../../lib/i18n'
import { fetchJson } from '../../lib/data'

/* Every figure here is read from public/data/benchmark_report.json at
   runtime, so the page can never drift from what the pipeline actually
   produced.

   There is deliberately no fallback object. A previous version seeded state
   with hardcoded figures, which meant those numbers painted on every visit
   before the fetch resolved -- and survived on screen if it never did. If the
   report cannot be loaded the tiles show an em-dash instead. */
interface Bench {
  headline_numbers: {
    pai_5pct: number
    hit_rate_5pct: number
    rri_5pct?: number
    baseline_hit_rate_5pct?: number
    optimized_coverage_pct: number
    statusquo_coverage_pct: number
    greedy_uplift_vs_statusquo_pct: number
    network_modularity: number
  }
  fairness: { gini: number; bias_districts_flagged: number }
}

/** Figure, or an em-dash when the report has not loaded. */
const fig = (v: number | undefined, fmt: (n: number) => string): string =>
  v === undefined ? '—' : fmt(v)

export default function Metrics() {
  const { t } = useI18n()
  const [b, setB] = useState<Bench | null>(null)

  useEffect(() => {
    fetchJson<Bench>('benchmark_report.json')
      .then(setB)
      .catch(() => setB(null))
  }, [])

  const h = b?.headline_numbers

  return (
    <Section
      id="metrics"
      stamp={t('site.metrics.stamp')}
      title={t('site.metrics.title')}
      lede={t('site.metrics.lede')}
    >
      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <RedactedFigure
          value={fig(h?.pai_5pct, (n) => `${n.toFixed(1)}×`)}
          label={t('site.metrics.pai')}
          note={t('site.metrics.paiNote').replace('{n}', fig(h?.hit_rate_5pct, (n) => n.toFixed(1)))}
        />
        <RedactedFigure
          value={fig(h?.hit_rate_5pct, (n) => `${n.toFixed(1)}%`)}
          label={t('site.metrics.hitRate')}
          note={t('site.metrics.hitRateNote')}
          delay={80}
        />
        <RedactedFigure
          value={fig(h?.rri_5pct, (n) => `${n.toFixed(2)}×`)}
          label={t('site.metrics.rri')}
          note={t('site.metrics.rriNote').replace(
            '{n}',
            fig(h?.baseline_hit_rate_5pct, (n) => n.toFixed(1)),
          )}
          delay={120}
        />
        <RedactedFigure
          value={fig(h?.greedy_uplift_vs_statusquo_pct, (n) => `+${n.toFixed(1)}%`)}
          label={t('site.metrics.coverage')}
          note={t('site.metrics.coverageNote')
            .replace('{a}', fig(h?.optimized_coverage_pct, (n) => n.toFixed(2)))
            .replace('{b}', fig(h?.statusquo_coverage_pct, (n) => n.toFixed(2)))}
          delay={160}
        />
        <RedactedFigure
          value={fig(b?.fairness.gini, (n) => n.toFixed(3))}
          label={t('site.metrics.gini')}
          note={t('site.metrics.giniNote').replace(
            '{n}',
            b ? String(b.fairness.bias_districts_flagged) : '—',
          )}
          delay={240}
        />
      </div>

      <p className="mt-8 text-[12.5px] leading-relaxed text-slate-500 max-w-3xl">
        {t('site.metrics.caveat')}
      </p>
    </Section>
  )
}

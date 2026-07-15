import { useEffect, useState } from 'react'
import { Section, RedactedFigure } from '../primitives'
import { useI18n } from '../../lib/i18n'
import { fetchJson } from '../../lib/data'

/* Every figure here is read from public/data/benchmark_report.json at
   runtime, so the page can never drift from what the pipeline actually
   produced. Defaults match the committed report. */
interface Bench {
  headline_numbers: {
    pai_5pct: number
    hit_rate_5pct: number
    optimized_coverage_pct: number
    statusquo_coverage_pct: number
    greedy_uplift_vs_statusquo_pct: number
    network_modularity: number
  }
  risk_model: { test_auc: number }
  fairness: { gini: number; bias_districts_flagged: number }
}

const FALLBACK: Bench = {
  headline_numbers: {
    pai_5pct: 10.63,
    hit_rate_5pct: 53.13,
    optimized_coverage_pct: 11.67,
    statusquo_coverage_pct: 9.87,
    greedy_uplift_vs_statusquo_pct: 18.2,
    network_modularity: 0.9784,
  },
  risk_model: { test_auc: 0.8471 },
  fairness: { gini: 0.1833, bias_districts_flagged: 11 },
}

export default function Metrics() {
  const { t } = useI18n()
  const [b, setB] = useState<Bench>(FALLBACK)

  useEffect(() => {
    fetchJson<Bench>('benchmark_report.json')
      .then(setB)
      .catch(() => {})
  }, [])

  const h = b.headline_numbers

  return (
    <Section
      id="metrics"
      stamp={t('site.metrics.stamp')}
      title={t('site.metrics.title')}
      lede={t('site.metrics.lede')}
    >
      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <RedactedFigure
          value={h.pai_5pct.toFixed(1)}
          label={t('site.metrics.pai')}
          note={t('site.metrics.paiNote').replace('{n}', h.hit_rate_5pct.toFixed(1))}
        />
        <RedactedFigure
          value={b.risk_model.test_auc.toFixed(3)}
          label={t('site.metrics.auc')}
          note={t('site.metrics.aucNote')}
          delay={80}
        />
        <RedactedFigure
          value={`+${h.greedy_uplift_vs_statusquo_pct.toFixed(1)}%`}
          label={t('site.metrics.coverage')}
          note={t('site.metrics.coverageNote')
            .replace('{a}', h.optimized_coverage_pct.toFixed(2))
            .replace('{b}', h.statusquo_coverage_pct.toFixed(2))}
          delay={160}
        />
        <RedactedFigure
          value={b.fairness.gini.toFixed(3)}
          label={t('site.metrics.gini')}
          note={t('site.metrics.giniNote').replace('{n}', String(b.fairness.bias_districts_flagged))}
          delay={240}
        />
      </div>

      <p className="mt-8 text-[12.5px] leading-relaxed text-slate-500 max-w-3xl">
        {t('site.metrics.caveat')}
      </p>
    </Section>
  )
}

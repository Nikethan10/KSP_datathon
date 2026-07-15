import SiteShell from './SiteShell'
import PageHeader from './PageHeader'
import { Section, Reveal } from './primitives'
import Stack, { CatalystTable } from './sections/Stack'
import CTA from './sections/CTA'
import { useI18n } from '../lib/i18n'

const PIPELINE_STEPS = [
  'Load & normalise 1,674,732 FIR records',
  'SENSE layer — Gi* / LISA hotspot surfaces',
  'Feature engineering — near-repeat, temporal, spatial lags',
  'Risk model — LightGBM, calibrated',
  'Network analysis — co-offending graph + Louvain',
  'Anomaly detection — STL residuals',
  'Patrol optimizer — maximal-coverage ILP + greedy',
  'TRUST layer — SHAP, fairness, calibration',
  'Benchmark harness — reproducible report',
]

export default function StackPage() {
  const { t } = useI18n()
  return (
    <SiteShell>
      <PageHeader
        stamp={t('site.stackPage.stamp')}
        title={t('site.stackPage.title')}
        lede={t('site.stackPage.lede')}
      />

      <Section
        stamp={t('site.stackPage.catStamp')}
        title={t('site.stackPage.catTitle')}
        lede={t('site.stackPage.catLede')}
      >
        <Reveal className="mt-10">
          <CatalystTable />
        </Reveal>
        <p className="mt-6 text-[12.5px] leading-relaxed text-slate-500 max-w-3xl">
          {t('site.stackPage.catNote')}
        </p>
      </Section>

      <Stack />

      <Section
        stamp={t('site.stackPage.pipeStamp')}
        title={t('site.stackPage.pipeTitle')}
        lede={t('site.stackPage.pipeLede')}
      >
        <Reveal className="mt-10">
          <ol className="site-card divide-y divide-slate-800/70">
            {PIPELINE_STEPS.map((s, i) => (
              <li key={s} className="flex items-baseline gap-5 px-6 py-4">
                <span className="stamp shrink-0 w-8">{String(i + 1).padStart(2, '0')}</span>
                <span className="text-[13.5px] text-slate-300 leading-snug">{s}</span>
              </li>
            ))}
          </ol>
        </Reveal>
        <p className="mt-6 text-[12.5px] leading-relaxed text-slate-500 max-w-3xl">
          {t('site.stackPage.pipeNote')}
        </p>
      </Section>

      <CTA />
    </SiteShell>
  )
}

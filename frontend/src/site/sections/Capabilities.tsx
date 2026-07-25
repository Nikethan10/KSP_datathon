import { Section, DossierCard } from '../primitives'
import { useI18n } from '../../lib/i18n'

/* One card per functional requirement in the BRD. Keeping the FR numbers
   visible turns this section into capability-coverage evidence, not just
   a feature grid. FR-11 is shown honestly as roadmap. */
const CAPS: { fr: string; key: string; shipped: boolean }[] = [
  { fr: 'FR-1', key: 'ingest', shipped: true },
  { fr: 'FR-2', key: 'geo', shipped: true },
  { fr: 'FR-3', key: 'hotspot', shipped: true },
  { fr: 'FR-4', key: 'risk', shipped: true },
  { fr: 'FR-5', key: 'anomaly', shipped: true },
  { fr: 'FR-6', key: 'network', shipped: true },
  { fr: 'FR-7', key: 'socio', shipped: true },
  { fr: 'FR-8', key: 'patrol', shipped: true },
  { fr: 'FR-9', key: 'explain', shipped: true },
  { fr: 'FR-10', key: 'fairness', shipped: true },
  { fr: 'FR-11', key: 'ask', shipped: false },
]

export default function Capabilities() {
  const { t } = useI18n()
  return (
    <Section
      id="capabilities"
      stamp={t('site.caps.stamp')}
      title={t('site.caps.title')}
      lede={t('site.caps.lede')}
    >
      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CAPS.map((c, i) => (
          <DossierCard
            key={c.fr}
            index={c.fr}
            meta={c.shipped ? t('site.caps.live') : t('site.caps.roadmap')}
            title={t(`site.caps.${c.key}.title`)}
            body={t(`site.caps.${c.key}.body`)}
            delay={(i % 3) * 70}
            muted={!c.shipped}
          />
        ))}
      </div>
    </Section>
  )
}

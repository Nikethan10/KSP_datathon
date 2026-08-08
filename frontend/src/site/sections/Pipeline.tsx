import { Section, Reveal } from '../primitives'
import { useI18n } from '../../lib/i18n'

/* These four are the ENGINE's layers, and they still are — the pipeline runs
   SENSE -> PREDICT -> ACT -> TRUST internally. The console, though, is now
   navigated by task, so a layer and a tab are no longer the same thing.

   `tab` is therefore the tab where that layer's output actually appears, and the
   card says so. It used to be the layer's own name as a slug, which meant the
   PREDICT card — "next-week risk per cell" — resolved through the legacy
   `predict` alias to CONNECT and dropped the visitor on the network graph. */
const LAYERS = [
  { tab: 'forecast', tabLabel: 'tab.forecast', key: 'sense', method: 'Getis-Ord Gi* · LISA' },
  { tab: 'forecast', tabLabel: 'tab.forecast', key: 'predict', method: 'LightGBM · near-repeat · STL' },
  { tab: 'act', tabLabel: 'tab.act', key: 'act', method: 'Maximal-coverage ILP' },
  { tab: 'trust', tabLabel: 'tab.trust', key: 'trust', method: 'SHAP · fairness audit' },
]

export default function Pipeline() {
  const { t } = useI18n()
  return (
    <Section
      id="pipeline"
      stamp={t('site.pipeline.stamp')}
      title={t('site.pipeline.title')}
      lede={t('site.pipeline.lede')}
    >
      <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {LAYERS.map((l, i) => (
          <Reveal key={l.key} delay={i * 90} className="h-full">
            <a
              href={`#/console/${l.tab}`}
              className="site-card h-full p-6 flex flex-col group"
            >
              <div className="flex items-center justify-between">
                <span className="stamp">{`0${i + 1}`}</span>
                <span className="text-slate-600 group-hover:brand-accent transition-colors text-sm">
                  →
                </span>
              </div>
              <h3 className="mt-5 text-[19px] font-semibold tracking-[0.1em] uppercase text-slate-50">
                {t(`site.pipeline.${l.key}.name`)}
              </h3>
              <p className="mt-3 text-[13.5px] leading-relaxed text-slate-400 flex-1">
                {t(`site.pipeline.${l.key}.body`)}
              </p>
              <div className="mt-5 pt-4 border-t border-slate-800/70 flex items-center justify-between gap-2">
                <span className="text-[10px] font-mono-data uppercase tracking-[0.16em] text-slate-500">
                  {l.method}
                </span>
                {/* Names the destination, so a layer card never surprises the
                    visitor with a differently-named tab. */}
                <span className="shrink-0 text-[9px] font-mono-data uppercase tracking-[0.14em] text-slate-600 group-hover:brand-accent transition-colors">
                  {t(l.tabLabel)}
                </span>
              </div>
            </a>
          </Reveal>
        ))}
      </div>
    </Section>
  )
}

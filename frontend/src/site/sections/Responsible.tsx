import { Section, Reveal } from '../primitives'
import { useI18n } from '../../lib/i18n'

const PILLARS = ['explain', 'bias', 'privacy', 'human']

export default function Responsible() {
  const { t } = useI18n()
  return (
    <Section
      id="responsible"
      stamp={t('site.resp.stamp')}
      title={t('site.resp.title')}
      lede={t('site.resp.lede')}
    >
      {/* The boundary statement is the section's centrepiece, not a footnote. */}
      <Reveal className="mt-11">
        <div
          className="site-glass p-7 md:p-9 border-l-2"
          style={{ borderLeftColor: 'var(--brand)' }}
        >
          <div className="stamp">{t('site.resp.boundaryStamp')}</div>
          <p className="mt-4 text-[16px] md:text-[18px] leading-relaxed text-slate-200">
            {t('site.resp.boundary')}
          </p>
        </div>
      </Reveal>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {PILLARS.map((p, i) => (
          <Reveal key={p} delay={i * 70} className="h-full">
            <div className="site-card h-full p-6">
              <h3 className="text-[15px] font-semibold text-slate-100">
                {t(`site.resp.${p}.title`)}
              </h3>
              <p className="mt-3 text-[13.5px] leading-relaxed text-slate-400">
                {t(`site.resp.${p}.body`)}
              </p>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  )
}

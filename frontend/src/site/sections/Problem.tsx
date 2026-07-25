import { Section, Reveal } from '../primitives'
import { useI18n } from '../../lib/i18n'

const POINTS = ['scattered', 'reactive', 'opaque']

export default function Problem() {
  const { t } = useI18n()
  return (
    <Section
      id="problem"
      stamp={t('site.problem.stamp')}
      title={t('site.problem.title')}
      lede={t('site.problem.lede')}
    >
      <div className="mt-12 grid gap-px md:grid-cols-3 bg-slate-800/50 border border-slate-800/50 rounded-[14px] overflow-hidden">
        {POINTS.map((p, i) => (
          <Reveal key={p} delay={i * 90}>
            <div className="h-full bg-[#1d2126] p-7">
              <div className="stamp">{`0${i + 1}`}</div>
              <h3 className="mt-4 text-[15px] font-semibold text-slate-100">
                {t(`site.problem.${p}.title`)}
              </h3>
              <p className="mt-3 text-[13.5px] leading-relaxed text-slate-400">
                {t(`site.problem.${p}.body`)}
              </p>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  )
}

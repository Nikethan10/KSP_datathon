import { Reveal } from '../primitives'
import { useI18n } from '../../lib/i18n'

export default function CTA() {
  const { t } = useI18n()
  return (
    <div className="site-wrap pt-8 pb-24">
      <Reveal>
        <div className="site-glass site-grid relative overflow-hidden px-7 py-16 md:px-16 md:py-20 text-center">
          <div className="relative">
            <div className="stamp">{t('site.cta.stamp')}</div>
            <h2 className="mt-5 text-[clamp(26px,4.4vw,44px)] font-semibold text-slate-50 leading-[1.1]">
              {t('site.cta.title')}
            </h2>
            <p className="mt-5 text-[15px] leading-relaxed text-slate-400 max-w-xl mx-auto">
              {t('site.cta.lede')}
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <a href="#/console" className="site-btn site-btn-primary pulse-glow">
                {t('site.cta.button')}
              </a>
              <a href="#/impact" className="site-btn site-btn-ghost">
                {t('site.cta.button2')}
              </a>
            </div>
          </div>
        </div>
      </Reveal>
    </div>
  )
}

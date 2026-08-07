import { useEffect, useState, type ReactNode } from 'react'
import SentinelMark from '../components/SentinelMark'
import { useI18n } from '../lib/i18n'
import { useRoute, type Screen } from '../lib/route'

const NAV: { screen: Screen; key: string; href: string }[] = [
  { screen: 'how-it-works', key: 'site.nav.how', href: '#/how-it-works' },
  { screen: 'impact', key: 'site.nav.impact', href: '#/impact' },
  { screen: 'stack', key: 'site.nav.stack', href: '#/stack' },
  { screen: 'report', key: 'report.nav', href: '#/report' },
]

export default function SiteShell({ children }: { children: ReactNode }) {
  const { t, lang, setLang } = useI18n()
  const { screen } = useRoute()
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => setMenuOpen(false), [screen])

  return (
    <div className="site-shell min-h-full flex flex-col text-slate-300">
      <header
        className={`sticky top-0 z-50 transition-colors duration-300 ${
          scrolled ? 'bg-[#15181c]/88 backdrop-blur-md border-b border-slate-800/70' : 'border-b border-transparent'
        }`}
      >
        <div className="site-wrap flex items-center h-16 gap-8">
          <a href="#/" className="flex items-center gap-3 shrink-0 group">
            <SentinelMark size={28} />
            <span className="flex flex-col leading-none">
              <span className="text-[16px] font-bold tracking-[0.16em] text-slate-100">
                PRAHARI <span className="brand-accent">ಪ್ರಹರಿ</span>
              </span>
              <span className="mt-1 stamp !text-[9px] !tracking-[0.26em] text-slate-500">
                KSP · Karnataka
              </span>
            </span>
          </a>

          <nav className="hidden md:flex items-center gap-7 ml-auto">
            {NAV.map((n) => (
              <a
                key={n.screen}
                href={n.href}
                className={`text-[12px] font-cond uppercase tracking-[0.16em] transition-colors ${
                  screen === n.screen ? 'text-slate-50' : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                {t(n.key)}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-3 ml-auto md:ml-0">
            <button
              onClick={() => setLang(lang === 'en' ? 'kn' : 'en')}
              title={lang === 'en' ? 'ಕನ್ನಡಕ್ಕೆ ಬದಲಿಸಿ' : 'Switch to English'}
              className="w-8 h-8 rounded-lg border border-slate-700/70 text-slate-300 text-[12px] font-semibold hover:text-slate-50 hover:border-slate-500 transition-colors"
            >
              {lang === 'en' ? 'ಕ' : 'En'}
            </button>
            {/* below sm the CTA lives in the dropdown — three controls plus
                the wordmark do not fit a 375px header */}
            <a href="#/console" className="hidden sm:inline-flex site-btn site-btn-primary !px-5 !py-2.5 !text-[11px]">
              {t('site.nav.console')}
            </a>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Menu"
              className="md:hidden w-8 h-8 rounded-lg border border-slate-700/70 text-slate-300 flex items-center justify-center"
            >
              <span className="text-sm leading-none">{menuOpen ? '×' : '≡'}</span>
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="md:hidden border-t border-slate-800/70 bg-[#15181c]/96 backdrop-blur-md">
            <div className="site-wrap py-3 flex flex-col">
              {NAV.map((n) => (
                <a
                  key={n.screen}
                  href={n.href}
                  className="py-2.5 text-[13px] font-cond uppercase tracking-[0.16em] text-slate-300"
                >
                  {t(n.key)}
                </a>
              ))}
              <a
                href="#/console"
                className="sm:hidden mt-3 site-btn site-btn-primary justify-center"
              >
                {t('site.nav.console')}
              </a>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="mt-24 border-t border-slate-800/70">
        <div className="site-wrap py-12 grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-3">
              <SentinelMark size={26} />
              <span className="text-[15px] font-bold tracking-[0.16em] text-slate-100">
                PRAHARI <span className="brand-accent">ಪ್ರಹರಿ</span>
              </span>
            </div>
            <p className="mt-4 text-[13px] leading-relaxed text-slate-500 max-w-sm">
              {t('site.footer.blurb')}
            </p>
          </div>

          <div>
            <div className="stamp">{t('site.footer.explore')}</div>
            <div className="mt-4 flex flex-col gap-2.5">
              {NAV.map((n) => (
                <a key={n.screen} href={n.href} className="text-[13px] text-slate-400 hover:text-slate-100 transition-colors w-fit">
                  {t(n.key)}
                </a>
              ))}
              <a href="#/console" className="text-[13px] brand-accent hover:text-slate-100 transition-colors w-fit">
                {t('site.nav.console')}
              </a>
            </div>
          </div>

          <div>
            <div className="stamp">{t('site.footer.built')}</div>
            <div className="mt-4 flex flex-col gap-2.5 text-[13px] text-slate-400">
              <span>{t('site.footer.catalyst')}</span>
              <span>{t('site.footer.dataset')}</span>
            </div>
          </div>
        </div>

        <div className="site-wrap pb-10">
          <div className="pt-6 border-t border-slate-800/60 flex flex-wrap items-center justify-between gap-3">
            <span className="stamp !text-slate-600">FILE: KSP-DTN-2026 · CH-02</span>
            <span className="text-[11px] text-slate-600 font-mono-data">{t('site.footer.note')}</span>
          </div>
        </div>
      </footer>
    </div>
  )
}

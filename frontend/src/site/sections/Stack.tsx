import { Section, Reveal } from '../primitives'
import { useI18n } from '../../lib/i18n'

const COLUMNS = [
  {
    key: 'frontend',
    items: ['React 19 · TypeScript', 'MapLibre GL · deck.gl', 'Recharts · 3d-force-graph', 'Tailwind CSS v4'],
  },
  {
    key: 'ml',
    items: ['pandas · scikit-learn', 'LightGBM (risk model)', 'libpysal + esda (Gi* / LISA)', 'networkx · Louvain', 'statsmodels (STL)', 'SHAP · OR-Tools / PuLP'],
  },
  {
    key: 'platform',
    items: ['Zoho Catalyst Hosting', 'Catalyst Functions', 'Catalyst Data Store', 'Catalyst Stratus', 'Catalyst Cron'],
  },
]

/* Catalyst services, stated honestly: Hosting is what the live build runs
   on today; the rest are architected in `plan/03`. Overclaiming here would
   be trivially disprovable by a judge. */
export const CATALYST_SERVICES: { name: string; use: string; live: boolean }[] = [
  { name: 'Catalyst Hosting (Web Client)', use: 'site.stack.svc.hosting', live: true },
  { name: 'Catalyst Functions', use: 'site.stack.svc.functions', live: false },
  { name: 'Catalyst Data Store', use: 'site.stack.svc.datastore', live: false },
  { name: 'Catalyst Stratus', use: 'site.stack.svc.stratus', live: false },
  { name: 'Catalyst Cron', use: 'site.stack.svc.cron', live: false },
]

export function CatalystTable() {
  const { t } = useI18n()
  return (
    <div className="overflow-x-auto rounded-[14px] border border-slate-800/70">
      <table className="w-full min-w-[560px] text-left border-collapse">
        <thead>
          <tr className="bg-[#1d2126]">
            <th className="stamp !text-slate-500 font-normal px-5 py-3.5">{t('site.stack.thService')}</th>
            <th className="stamp !text-slate-500 font-normal px-5 py-3.5">{t('site.stack.thUse')}</th>
            <th className="stamp !text-slate-500 font-normal px-5 py-3.5 text-right">{t('site.stack.thStatus')}</th>
          </tr>
        </thead>
        <tbody>
          {CATALYST_SERVICES.map((s) => (
            <tr key={s.name} className="border-t border-slate-800/70">
              <td className="px-5 py-4 text-[13.5px] font-semibold text-slate-100 whitespace-nowrap">
                {s.name}
              </td>
              <td className="px-5 py-4 text-[13px] text-slate-400">{t(s.use)}</td>
              <td className="px-5 py-4 text-right">
                <span
                  className={`inline-block px-2.5 py-1 rounded-full text-[9px] font-mono-data uppercase tracking-[0.16em] ${
                    s.live
                      ? 'text-emerald-300 bg-emerald-700/25'
                      : 'text-slate-400 bg-slate-800/70'
                  }`}
                >
                  {s.live ? t('site.stack.live') : t('site.stack.planned')}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function Stack() {
  const { t } = useI18n()
  return (
    <Section
      id="stack"
      stamp={t('site.stack.stamp')}
      title={t('site.stack.title')}
      lede={t('site.stack.lede')}
    >
      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {COLUMNS.map((c, i) => (
          <Reveal key={c.key} delay={i * 80} className="h-full">
            <div className="site-card h-full p-6">
              <div className="stamp">{t(`site.stack.${c.key}`)}</div>
              <div className="rule-scan mt-3 mb-5" />
              <ul className="flex flex-col gap-2.5">
                {c.items.map((it) => (
                  <li key={it} className="text-[13.5px] text-slate-400 leading-snug">
                    {it}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  )
}

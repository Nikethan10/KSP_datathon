import { useEffect, useState } from 'react'
import SiteShell from './SiteShell'
import PageHeader from './PageHeader'
import { Section, Reveal } from './primitives'
import Metrics from './sections/Metrics'
import Responsible from './sections/Responsible'
import CTA from './sections/CTA'
import { useI18n } from '../lib/i18n'
import { fetchJson } from '../lib/data'

interface Bench {
  headline_numbers: { network_communities: number; network_modularity: number }
  network_analysis: { graph_nodes: number; graph_edges: number }
  patrol_optimizer: {
    n_patrols: number
    patrol_radius_km: number
    scope_district: string
    baseline_coverage_pct: number
    statusquo_coverage_pct: number
    greedy_coverage_pct: number
    ilp_coverage_pct: number
  }
}

export default function ImpactPage() {
  const { t } = useI18n()
  const [b, setB] = useState<Bench | null>(null)

  useEffect(() => {
    fetchJson<Bench>('benchmark_report.json').then(setB).catch(() => {})
  }, [])

  const p = b?.patrol_optimizer
  const rows = p
    ? [
        { l: t('site.impact.rBaseline'), v: `${p.baseline_coverage_pct.toFixed(2)}%`, note: t('site.impact.nBaseline') },
        { l: t('site.impact.rStatusQuo'), v: `${p.statusquo_coverage_pct.toFixed(2)}%`, note: t('site.impact.nStatusQuo') },
        { l: t('site.impact.rGreedy'), v: `${p.greedy_coverage_pct.toFixed(2)}%`, note: t('site.impact.nGreedy') },
        { l: t('site.impact.rIlp'), v: `${p.ilp_coverage_pct.toFixed(2)}%`, note: t('site.impact.nIlp') },
      ]
    : []

  return (
    <SiteShell>
      <PageHeader
        stamp={t('site.impact.stamp')}
        title={t('site.impact.title')}
        lede={t('site.impact.lede')}
      />

      <Metrics />

      <Section
        stamp={t('site.impact.patrolStamp')}
        title={t('site.impact.patrolTitle')}
        lede={
          p
            ? t('site.impact.patrolLede')
                .replace('{n}', String(p.n_patrols))
                .replace('{r}', String(p.patrol_radius_km))
                .replace('{d}', p.scope_district)
            : t('site.impact.patrolLede').replace('{n}', '6').replace('{r}', '2').replace('{d}', 'BENGALURU CITY')
        }
      >
        <Reveal className="mt-10">
          <div className="overflow-x-auto rounded-[14px] border border-slate-800/70">
            <table className="w-full min-w-[520px] border-collapse">
              <thead>
                <tr className="bg-[#1d2126]">
                  <th className="stamp !text-slate-500 font-normal text-left px-5 py-3.5">{t('site.impact.thStrategy')}</th>
                  <th className="stamp !text-slate-500 font-normal text-right px-5 py-3.5">{t('site.impact.thCoverage')}</th>
                  <th className="stamp !text-slate-500 font-normal text-left px-5 py-3.5">{t('site.impact.thNote')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.l} className={`border-t border-slate-800/70 ${i === rows.length - 1 ? 'bg-[#c9a35c]/[0.05]' : ''}`}>
                    <td className="px-5 py-4 text-[13.5px] font-semibold text-slate-100 whitespace-nowrap">{r.l}</td>
                    <td className="px-5 py-4 text-right text-[15px] font-semibold tabular-nums text-slate-50">{r.v}</td>
                    <td className="px-5 py-4 text-[13px] text-slate-400">{r.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>
      </Section>

      <Section stamp={t('site.impact.netStamp')} title={t('site.impact.netTitle')} lede={t('site.impact.netLede')}>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { v: b ? b.network_analysis.graph_nodes.toLocaleString('en-US') : '341,803', l: t('site.impact.nodes') },
            { v: b ? b.network_analysis.graph_edges.toLocaleString('en-US') : '509,633', l: t('site.impact.edges') },
            { v: b ? b.headline_numbers.network_communities.toLocaleString('en-US') : '35,333', l: t('site.impact.communities') },
            { v: b ? b.headline_numbers.network_modularity.toFixed(3) : '0.978', l: t('site.impact.modularity') },
          ].map((s, i) => (
            <Reveal key={s.l} delay={i * 70}>
              <div className="site-card p-6">
                <div className="text-[24px] font-semibold tabular-nums text-slate-50 leading-none">{s.v}</div>
                <div className="mt-3 text-[11px] font-mono-data uppercase tracking-[0.18em] text-slate-500">{s.l}</div>
              </div>
            </Reveal>
          ))}
        </div>
        <p className="mt-7 text-[12.5px] leading-relaxed text-slate-500 max-w-3xl">
          {t('site.impact.netNote')}
        </p>
      </Section>

      <Responsible />
      <CTA />
    </SiteShell>
  )
}

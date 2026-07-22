import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from 'recharts'
import { featureName } from '../lib/data'
import { useI18n } from '../lib/i18n'
import { useCountUp } from '../lib/useCountUp'
import type { RiskSummary } from '../lib/data'

function Stat({ value, label, animate }: { value: string; label: string; animate?: number }) {
  const counted = useCountUp(animate ?? 0)
  const display = animate != null
    ? value.replace(/[\d.]+/, () => {
        const decimals = (value.match(/\.(\d+)/) ?? [])[1]?.length ?? 0
        return counted.toFixed(decimals)
      })
    : value

  return (
    <div className="flex-1 rounded-lg bg-slate-800/50 border border-slate-700/40 px-2.5 py-2 text-center">
      <div className="text-lg font-bold text-sky-300 tabular-nums leading-tight">{display}</div>
      <div className="text-[9.5px] uppercase tracking-wider text-slate-400 mt-0.5">{label}</div>
    </div>
  )
}

const AREA_PCTS = [1, 2, 5, 10, 20] as const

export default function RiskStats({ summary }: { summary: RiskSummary }) {
  const { t } = useI18n()
  const top = summary.feature_importance.slice(0, 7)
  const maxImp = top[0]?.importance ?? 1

  // precision-at-k: % of crime captured in the top X% highest-risk area,
  // model vs a random patrol (which captures ~X% of crime in X% of area).
  const curve = [
    { area: 0, model: 0, random: 0 },
    ...AREA_PCTS.map((p) => ({
      area: p,
      model: summary.pai[`hit_rate_${p}pct`] ?? 0,
      random: p,
    })),
  ]

  return (
    <div className="flex flex-col gap-3">
      <div>
        <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-1.5">
          {t('predict.modelStats')}
        </div>
        <div className="flex gap-2">
          <Stat value={`${summary.pai.hit_rate_5pct.toFixed(0)}%`} label={t('predict.crimesIn5')} animate={summary.pai.hit_rate_5pct} />
          <Stat value={summary.pai.pai_5pct.toFixed(1)} label={t('predict.predictionAccuracy')} animate={summary.pai.pai_5pct} />
          {summary.pei?.pei_5pct !== undefined && (
            <Stat
              value={`${(summary.pei.pei_5pct * 100).toFixed(0)}%`}
              label={t('predict.pei')}
              animate={summary.pei.pei_5pct * 100}
            />
          )}
        </div>
      </div>

      <div>
        <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-1">
          {t('predict.paiCurve')}
        </div>
        <div className="h-32">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={curve} margin={{ top: 4, right: 8, bottom: 2, left: -22 }}>
              <CartesianGrid stroke="#272c33" strokeDasharray="3 3" />
              <XAxis
                dataKey="area" type="number" domain={[0, 20]} ticks={[0, 5, 10, 15, 20]}
                tick={{ fill: '#6b7480', fontSize: 9 }} tickLine={false} axisLine={{ stroke: '#353b43' }}
                tickFormatter={(v: number) => `${v}%`}
              />
              <YAxis
                domain={[0, 100]} ticks={[0, 25, 50, 75, 100]}
                tick={{ fill: '#6b7480', fontSize: 9 }} tickLine={false} axisLine={false}
                tickFormatter={(v: number) => `${v}%`}
              />
              <Tooltip
                contentStyle={{ background: 'rgba(29,33,38,0.96)', border: '1px solid rgba(201,163,92,0.28)', borderRadius: 6, fontSize: 11 }}
                labelStyle={{ color: '#8a939e' }}
                labelFormatter={(v) => `${v}% ${t('predict.pctArea').replace('% ', '')}`}
                formatter={(value) => `${Number(value).toFixed(0)}%`}
              />
              <Legend wrapperStyle={{ fontSize: 9 }} iconType="plainline" />
              <Line type="monotone" dataKey="model" name={t('predict.modelLine')} stroke="#c9a35c" strokeWidth={2} dot={{ r: 2.5 }} />
              <Line type="monotone" dataKey="random" name={t('predict.randomPatrol')} stroke="#6b7480" strokeWidth={1.4} strokeDasharray="4 3" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-1.5">
          {t('predict.topDrivers')}
        </div>
        <div className="flex flex-col gap-1">
          {top.map((f) => (
            <div key={f.feature} className="flex items-center gap-2">
              <div className="w-44 shrink-0 text-[10.5px] text-slate-300 truncate" title={featureName(f.feature)}>
                {featureName(f.feature)}
              </div>
              <div className="flex-1 h-1.5 rounded bg-slate-700/50 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-sky-500 to-sky-300"
                  style={{ width: `${(f.importance / maxImp) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

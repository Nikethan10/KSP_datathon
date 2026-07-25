import {
  ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip,
  CartesianGrid, ReferenceLine, Legend,
} from 'recharts'
import { useI18n } from '../lib/i18n'
import type { CalibrationData } from '../lib/data'

function Delta({ label, before, after }: { label: string; before: number; after: number }) {
  const improved = after < before
  return (
    <div className="flex-1 rounded-lg bg-slate-800/50 border border-slate-700/40 px-2.5 py-2 text-center">
      <div className="flex items-center justify-center gap-1.5 text-sm font-bold tabular-nums leading-tight">
        <span className="text-slate-400">{before.toFixed(3)}</span>
        <span className="text-slate-500 text-[11px]">→</span>
        <span className={improved ? 'text-emerald-300' : 'text-sky-300'}>{after.toFixed(3)}</span>
      </div>
      <div className="text-[9px] uppercase tracking-wider text-slate-400 mt-0.5">{label}</div>
    </div>
  )
}

export default function CalibrationPanel({ data }: { data: CalibrationData }) {
  const { t } = useI18n()

  const allVals = [...data.reliability_raw, ...data.reliability_calibrated]
    .flatMap((p) => [p.conf, p.acc])
  const max = Math.min(1, Math.max(0.1, ...allVals) * 1.1)

  return (
    <div className="glass rounded-xl p-3.5">
      <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-2">
        {t('trust.calibTitle')}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-[10px] text-slate-400 mb-1">{t('trust.reliability')}</div>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 6, right: 10, bottom: 2, left: -18 }}>
                <CartesianGrid stroke="#272c33" strokeDasharray="3 3" />
                <XAxis
                  type="number" dataKey="conf" domain={[0, max]}
                  tick={{ fill: '#6b7480', fontSize: 9 }} tickLine={false} axisLine={{ stroke: '#353b43' }}
                  tickFormatter={(v: number) => v.toFixed(2)}
                  name={t('trust.predictedRisk')}
                />
                <YAxis
                  type="number" dataKey="acc" domain={[0, max]}
                  tick={{ fill: '#6b7480', fontSize: 9 }} tickLine={false} axisLine={false}
                  tickFormatter={(v: number) => v.toFixed(2)}
                  name={t('trust.actualRate')}
                />
                <ZAxis range={[35, 35]} />
                <ReferenceLine
                  segment={[{ x: 0, y: 0 }, { x: max, y: max }]}
                  stroke="#4a515a" strokeDasharray="4 3" ifOverflow="hidden"
                />
                <Tooltip
                  cursor={{ strokeDasharray: '3 3', stroke: '#353b43' }}
                  contentStyle={{ background: 'rgba(29,33,38,0.96)', border: '1px solid rgba(201,163,92,0.28)', borderRadius: 6, fontSize: 11 }}
                  labelStyle={{ color: '#8a939e' }}
                  formatter={(value) => Number(value).toFixed(3)}
                />
                <Legend wrapperStyle={{ fontSize: 9 }} />
                <Scatter name={`${t('trust.risk')} (raw)`} data={data.reliability_raw} fill="#8a939e" line={{ stroke: '#8a939e', strokeWidth: 1 }} />
                <Scatter name={t('trust.calibrated')} data={data.reliability_calibrated} fill="#c9a35c" line={{ stroke: '#c9a35c', strokeWidth: 1.4 }} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <div className="text-[9px] text-slate-500 mt-0.5">
            {t('trust.perfect')} = dashed diagonal
          </div>
        </div>

        <div className="flex flex-col justify-center gap-2">
          <div className="flex gap-2">
            <Delta label={t('trust.brier')} before={data.brier_raw} after={data.brier_calibrated} />
          </div>
          <div className="flex gap-2">
            <Delta label={t('trust.ece')} before={data.ece_raw} after={data.ece_calibrated} />
          </div>
          <div className="text-[10px] text-slate-500 leading-relaxed">
            {t('trust.afterIsotonic')}. {t('trust.calibNote')}
          </div>
        </div>
      </div>
    </div>
  )
}

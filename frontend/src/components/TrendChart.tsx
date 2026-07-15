import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts'
import type { TrendPoint } from '../lib/data'

interface Props {
  data: TrendPoint[]
  label: string
}

export default function TrendChart({ data, label }: Props) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-1">
        Monthly trend — {label}
      </div>
      <div className="h-36">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
            <defs>
              <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.45} />
                <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="period"
              tick={{ fill: '#64748b', fontSize: 9 }}
              tickLine={false}
              axisLine={{ stroke: '#334155' }}
              interval={Math.max(0, Math.floor(data.length / 6) - 1)}
            />
            <YAxis
              tick={{ fill: '#64748b', fontSize: 9 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`)}
            />
            <Tooltip
              contentStyle={{
                background: 'rgba(13,17,23,0.95)',
                border: '1px solid rgba(56,189,248,0.25)',
                borderRadius: 6,
                fontSize: 11,
              }}
              labelStyle={{ color: '#94a3b8' }}
              itemStyle={{ color: '#7dd3fc' }}
            />
            <Area
              type="monotone"
              dataKey="count"
              stroke="#38bdf8"
              strokeWidth={1.6}
              fill="url(#trendFill)"
              name="FIRs"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

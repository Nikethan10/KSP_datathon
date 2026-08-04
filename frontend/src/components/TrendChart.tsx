import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts'
import type { TrendPoint } from '../lib/data'
import { useI18n } from '../lib/i18n'

interface Props {
  data: TrendPoint[]
  label: string
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// "2024-03" -> "Mar '24" so the axis reads naturally
function fmtPeriod(p: string): string {
  const [y, m] = String(p).split('-')
  const mi = Number(m) - 1
  return mi >= 0 && mi < 12 ? `${MONTHS[mi]} '${y.slice(2)}` : String(p)
}

// The dataset ends mid-month, so the final month is only partially reported and
// shows a misleading cliff. Drop any trailing month well below the series median.
function trimPartialTail(data: TrendPoint[]): TrendPoint[] {
  if (data.length < 8) return data
  const counts = data.map((p) => p.count).sort((a, b) => a - b)
  const median = counts[Math.floor(counts.length / 2)]
  let end = data.length
  while (end > 1 && data[end - 1].count < median * 0.5) end--
  return data.slice(0, end)
}

export default function TrendChart({ data, label }: Props) {
  const { t } = useI18n()
  const series = trimPartialTail(data)

  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-1">
        {t('sense.monthlyTrend')} — {label}
      </div>
      <div className="h-36">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={series} margin={{ top: 4, right: 14, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#c9a35c" stopOpacity={0.45} />
                <stop offset="100%" stopColor="#c9a35c" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#272c33" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="period"
              tick={{ fill: '#6b7480', fontSize: 9 }}
              tickLine={false}
              tickMargin={6}
              axisLine={{ stroke: '#353b43' }}
              interval="preserveStartEnd"
              minTickGap={44}
              tickFormatter={fmtPeriod}
            />
            <YAxis
              tick={{ fill: '#6b7480', fontSize: 9 }}
              tickLine={false}
              axisLine={false}
              width={40}
              allowDecimals={false}
              tickFormatter={(v: number) => {
                if (v >= 1000) {
                  const k = v / 1000
                  return `${Number.isInteger(k) ? k : k.toFixed(1)}k`
                }
                return `${v}`
              }}
            />
            <Tooltip
              contentStyle={{
                background: 'rgba(29,33,38,0.96)',
                border: '1px solid rgba(201,163,92,0.28)',
                borderRadius: 6,
                fontSize: 11,
              }}
              labelStyle={{ color: '#8a939e' }}
              itemStyle={{ color: '#c9a35c' }}
              labelFormatter={(p) => fmtPeriod(String(p))}
              formatter={(v) => [Number(v).toLocaleString(), 'FIRs']}
            />
            <Area
              type="monotone"
              dataKey="count"
              stroke="#c9a35c"
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

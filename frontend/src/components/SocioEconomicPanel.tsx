import { useEffect, useState } from 'react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  AreaChart, Area, Cell,
} from 'recharts'
import { fetchJson } from '../lib/data'
import { useI18n } from '../lib/i18n'

interface OccupationStat {
  occupation: string
  total: number
  pct: number
  heinous_pct: number
  top_crime: string
}

interface AgeGroupStat { group: string; total: number; pct: number }
interface GenderStat { gender: string; total: number; pct: number }

interface CrimeOccRow {
  crime_type: string
  [occupation: string]: string | number
}

interface DistrictDemo {
  district: string
  dominant_occupation: string
  dominant_occupation_pct: number
  median_accused_age: number
  male_accused_pct: number
  total_complainants: number
}

interface HourlyRow {
  hour: number
  [ageGroup: string]: number
}

interface YearlyOccRow {
  year: number
  [occ: string]: number
}

interface SocioData {
  by_occupation: OccupationStat[]
  by_age_group: { accused: AgeGroupStat[]; victim: AgeGroupStat[] }
  by_gender: { accused: GenderStat[]; victim: GenderStat[] }
  crime_occupation_matrix: CrimeOccRow[]
  crime_caste_matrix: CrimeOccRow[]
  district_demographics: DistrictDemo[]
  temporal_demographics: {
    night_crime_by_age: AgeGroupStat[]
    weekend_by_occupation: OccupationStat[]
    hourly_age_heatmap: HourlyRow[]
  }
  yearly_occupation_trend: YearlyOccRow[]
}

const AGE_COLORS = ['#94a3b8', '#38bdf8', '#818cf8', '#c084fc', '#f472b6', '#fb923c']
const OCC_COLORS = ['#c9a35c', '#38bdf8', '#818cf8', '#34d399']
const GENDER_COLORS: Record<string, string> = { Male: '#38bdf8', Female: '#f472b6', Transgender: '#c084fc' }

const tooltipStyle = {
  contentStyle: {
    background: 'rgba(29,33,38,0.96)',
    border: '1px solid rgba(201,163,92,0.28)',
    borderRadius: 6,
    fontSize: 11,
  },
  labelStyle: { color: '#8a939e' },
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[9.5px] uppercase tracking-wider text-slate-400 mt-3 mb-1 first:mt-0">
      {children}
    </div>
  )
}

export default function SocioEconomicPanel() {
  const [data, setData] = useState<SocioData | null>(null)
  const { t } = useI18n()

  useEffect(() => {
    fetchJson<SocioData>('socioeconomic.json').then(setData).catch(() => {})
  }, [])

  if (!data) {
    return (
      <div className="flex-1 flex items-center justify-center text-xs text-slate-500">
        {t('socio.loading')}
      </div>
    )
  }

  const ageAccused = data.by_age_group.accused.filter(a => a.total > 0)
  const ageVictim = data.by_age_group.victim.filter(a => a.total > 0)

  const hourlyData = data.temporal_demographics.hourly_age_heatmap
  const ageKeys = Object.keys(hourlyData[0] || {}).filter(k => k !== 'hour')

  const occKeys = Object.keys(data.yearly_occupation_trend[0] || {}).filter(k => k !== 'year')

  const topDistricts = data.district_demographics.slice(0, 10)

  return (
    <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-1">
      {/* Accused age distribution */}
      <SectionTitle>{t('socio.accusedAge')}</SectionTitle>
      <div className="h-28">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={ageAccused} margin={{ top: 2, right: 8, bottom: 0, left: 0 }} layout="horizontal">
            <CartesianGrid stroke="#272c33" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="group" tick={{ fill: '#6b7480', fontSize: 9 }} tickLine={false} axisLine={{ stroke: '#353b43' }} />
            <YAxis tick={{ fill: '#6b7480', fontSize: 9 }} tickLine={false} axisLine={false} width={36}
              tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`} />
            <Tooltip {...tooltipStyle} formatter={((v: number) => [v.toLocaleString(), 'accused']) as any} />
            <Bar dataKey="total" radius={[3, 3, 0, 0]}>
              {ageAccused.map((_, i) => <Cell key={i} fill={AGE_COLORS[i % AGE_COLORS.length]} fillOpacity={0.8} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Victim age distribution */}
      <SectionTitle>{t('socio.victimAge')}</SectionTitle>
      <div className="h-28">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={ageVictim} margin={{ top: 2, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="#272c33" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="group" tick={{ fill: '#6b7480', fontSize: 9 }} tickLine={false} axisLine={{ stroke: '#353b43' }} />
            <YAxis tick={{ fill: '#6b7480', fontSize: 9 }} tickLine={false} axisLine={false} width={36}
              tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`} />
            <Tooltip {...tooltipStyle} formatter={((v: number) => [v.toLocaleString(), 'victims']) as any} />
            <Bar dataKey="total" radius={[3, 3, 0, 0]}>
              {ageVictim.map((_, i) => <Cell key={i} fill={AGE_COLORS[i % AGE_COLORS.length]} fillOpacity={0.8} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Gender split */}
      <SectionTitle>{t('socio.genderSplit')}</SectionTitle>
      <div className="flex gap-3">
        <div className="flex-1">
          <div className="text-[8.5px] text-slate-500 mb-1">{t('socio.accused')}</div>
          {data.by_gender.accused.map(g => (
            <div key={g.gender} className="flex items-center gap-1.5 mb-0.5">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: GENDER_COLORS[g.gender] || '#8aa0b8' }} />
              <span className="text-[10px] text-slate-300">{g.gender}</span>
              <span className="ml-auto text-[10px] tabular-nums text-slate-400">{g.pct}%</span>
            </div>
          ))}
        </div>
        <div className="flex-1">
          <div className="text-[8.5px] text-slate-500 mb-1">{t('socio.victims')}</div>
          {data.by_gender.victim.map(g => (
            <div key={g.gender} className="flex items-center gap-1.5 mb-0.5">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: GENDER_COLORS[g.gender] || '#8aa0b8' }} />
              <span className="text-[10px] text-slate-300">{g.gender}</span>
              <span className="ml-auto text-[10px] tabular-nums text-slate-400">{g.pct}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Crime by hour-of-day stacked area */}
      <SectionTitle>{t('socio.hourlyPattern')}</SectionTitle>
      <div className="h-32">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={hourlyData} margin={{ top: 2, right: 8, bottom: 0, left: 0 }}>
            <defs>
              {ageKeys.map((k, i) => (
                <linearGradient key={k} id={`hg-${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={AGE_COLORS[i % AGE_COLORS.length]} stopOpacity={0.5} />
                  <stop offset="100%" stopColor={AGE_COLORS[i % AGE_COLORS.length]} stopOpacity={0.05} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid stroke="#272c33" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="hour" tick={{ fill: '#6b7480', fontSize: 9 }} tickLine={false} axisLine={{ stroke: '#353b43' }}
              tickFormatter={(h: number) => `${h}h`} interval={3} />
            <YAxis tick={{ fill: '#6b7480', fontSize: 9 }} tickLine={false} axisLine={false} width={36}
              tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`} />
            <Tooltip {...tooltipStyle}
              labelFormatter={(h) => `${h}:00 – ${Number(h) + 1}:00`}
              formatter={((v: number, name: string) => [v.toLocaleString(), name]) as any} />
            {ageKeys.map((k, i) => (
              <Area key={k} type="monotone" dataKey={k} stackId="1"
                stroke={AGE_COLORS[i % AGE_COLORS.length]} strokeWidth={0.5}
                fill={`url(#hg-${i})`} />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Crime type × Occupation heatmap table */}
      <SectionTitle>{t('socio.crimeByOccupation')}</SectionTitle>
      <div className="overflow-x-auto">
        <table className="w-full text-[9px]">
          <thead>
            <tr className="text-slate-400">
              <th className="text-left font-medium py-0.5 pr-1">{t('socio.crimeType')}</th>
              {data.by_occupation.map(o => (
                <th key={o.occupation} className="text-right font-medium py-0.5 px-1 whitespace-nowrap">
                  {o.occupation.replace('Government Employee', 'Govt').replace('Private Sector', 'Private')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.crime_occupation_matrix.slice(0, 8).map((row) => {
              const vals = data.by_occupation.map(o => (row[o.occupation] as number) || 0)
              const mx = Math.max(...vals)
              return (
                <tr key={row.crime_type} className="border-t border-slate-700/30">
                  <td className="text-slate-300 py-0.5 pr-1 truncate max-w-[100px]">
                    {String(row.crime_type).replace('Crimes Against ', '').replace('Offences', 'Off.')}
                  </td>
                  {data.by_occupation.map((o) => {
                    const v = (row[o.occupation] as number) || 0
                    const intensity = mx > 0 ? v / mx : 0
                    return (
                      <td key={o.occupation} className="text-right tabular-nums py-0.5 px-1"
                        style={{ color: `rgba(${intensity > 0.7 ? '249,115,22' : '148,163,184'},${0.5 + intensity * 0.5})` }}>
                        {(v / 1000).toFixed(1)}k
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Yearly occupation trend */}
      <SectionTitle>{t('socio.yearlyTrend')}</SectionTitle>
      <div className="h-28">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data.yearly_occupation_trend.filter(d => d.year <= 2023)} margin={{ top: 2, right: 8, bottom: 0, left: 0 }}>
            <defs>
              {occKeys.map((k, i) => (
                <linearGradient key={k} id={`yt-${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={OCC_COLORS[i % OCC_COLORS.length]} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={OCC_COLORS[i % OCC_COLORS.length]} stopOpacity={0.02} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid stroke="#272c33" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="year" tick={{ fill: '#6b7480', fontSize: 9 }} tickLine={false} axisLine={{ stroke: '#353b43' }} />
            <YAxis tick={{ fill: '#6b7480', fontSize: 9 }} tickLine={false} axisLine={false} width={36}
              tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`} />
            <Tooltip {...tooltipStyle}
              formatter={((v: number, name: string) => [v.toLocaleString(), name]) as any} />
            {occKeys.map((k, i) => (
              <Area key={k} type="monotone" dataKey={k}
                stroke={OCC_COLORS[i % OCC_COLORS.length]} strokeWidth={1.4}
                fill={`url(#yt-${i})`} />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Top districts demographic summary */}
      <SectionTitle>{t('socio.districtProfile')}</SectionTitle>
      <div className="flex flex-col gap-0.5 mb-2">
        {topDistricts.map(d => (
          <div key={d.district} className="flex items-center gap-1.5 text-[9.5px]">
            <span className="text-slate-300 truncate flex-1 min-w-0">{d.district}</span>
            <span className="text-slate-400 tabular-nums shrink-0">{d.dominant_occupation.replace('Government Employee', 'Govt').replace('Private Sector', 'Pvt')}</span>
            <span className="text-slate-500 tabular-nums shrink-0">age {d.median_accused_age}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

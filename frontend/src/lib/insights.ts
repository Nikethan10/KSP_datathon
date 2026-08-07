import { featureName } from './data'
import type { Anomaly, DistrictSummary, ShapFeature, RiskSummary, PatrolBriefing } from './data'

export type ThreatLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'

export const THREAT_LEVEL_COLORS: Record<ThreatLevel, string> = {
  CRITICAL: '#ef4444',
  HIGH: '#f97316',
  MEDIUM: '#f59e0b',
  LOW: '#22c55e',
}

export function getThreatLevel(anomalyCount: number, avgYoY: number): ThreatLevel {
  if (anomalyCount >= 8 || avgYoY > 15) return 'CRITICAL'
  if (anomalyCount >= 4 || avgYoY > 8) return 'HIGH'
  if (anomalyCount >= 2 || avgYoY > 3) return 'MEDIUM'
  return 'LOW'
}

export function getDistrictThreatLevel(
  district: string,
  summary: DistrictSummary | undefined,
  anomalies: Anomaly[],
): ThreatLevel {
  const distAnomalies = anomalies.filter((a) => a.district === district)
  const yoy = summary?.yoy_change_pct ?? 0
  if (distAnomalies.some((a) => a.severity === 'critical') || yoy > 20) return 'CRITICAL'
  if (distAnomalies.length >= 3 || yoy > 10) return 'HIGH'
  if (distAnomalies.length >= 1 || yoy > 5) return 'MEDIUM'
  return 'LOW'
}

export interface FeedItem {
  id: string
  timestamp: string
  severity: 'critical' | 'high' | 'medium' | 'info'
  icon: 'alert' | 'trend' | 'network' | 'patrol'
  title: string
  detail: string
  district: string
}

export function generateFeedItems(
  anomalies: Anomaly[],
  districts: DistrictSummary[],
  t: Translate,
  tc: Translate,
  td: Translate,
): FeedItem[] {
  const items: FeedItem[] = []

  anomalies.slice(0, 12).forEach((a, i) => {
    const dir = a.zscore > 0 ? 'spike' : 'drop'
    const pctChange = Math.abs(((a.observed - a.expected) / Math.max(a.expected, 1)) * 100).toFixed(0)
    items.push({
      id: `anomaly-${i}`,
      timestamp: String(a.date).slice(0, 10),
      severity: a.severity === 'critical' ? 'critical' : a.zscore > 3 ? 'high' : 'medium',
      icon: 'alert',
      title: t(dir === 'spike' ? 'narr.feedSpike' : 'narr.feedDrop')
        .replace('{crime}', tc(a.crime_type))
        .replace('{district}', td(a.district)),
      detail: t('narr.feedDetail')
        .replace('{observed}', String(a.observed))
        .replace('{expected}', a.expected.toFixed(0))
        .replace('{sign}', dir === 'spike' ? '+' : '-')
        .replace('{pct}', pctChange)
        .replace('{z}', a.zscore.toFixed(1)),
      district: a.district,
    })
  })

  districts
    .filter((d) => d.yoy_change_pct > 8)
    .slice(0, 5)
    .forEach((d, i) => {
      items.push({
        id: `trend-${i}`,
        timestamp: `${d.latest_year} YTD`,
        severity: d.yoy_change_pct > 15 ? 'high' : 'medium',
        icon: 'trend',
        title: t('narr.feedTrend')
          .replace('{district}', td(d.district))
          .replace('{pct}', d.yoy_change_pct.toFixed(1)),
        detail: t('narr.feedTrendDetail')
          .replace('{cases}', d.latest_year_cases.toLocaleString())
          .replace('{year}', String(d.latest_year))
          .replace('{crime}', tc(d.top_crime_type))
          .replace('{heinous}', d.heinous_pct.toFixed(1)),
        district: d.district,
      })
    })

  return items.sort((a, b) => {
    const sev = { critical: 0, high: 1, medium: 2, info: 3 }
    return sev[a.severity] - sev[b.severity]
  })
}

/** The view passes its own t(); these builders stay pure. */
export type Translate = (key: string) => string

export interface DistrictBrief {
  threatLevel: ThreatLevel
  trend: 'increasing' | 'decreasing' | 'stable'
  trendPct: number
  topCrime: string
  heinousPct: number
  clearancePct: number
  anomalyCount: number
  narrative: string
  recommendation: string
}

export function generateDistrictBrief(
  district: string,
  summary: DistrictSummary | undefined,
  anomalies: Anomaly[],
  t: Translate,
  tc: Translate,
  td: Translate,
): DistrictBrief | null {
  if (!summary) return null

  const distAnomalies = anomalies.filter((a) => a.district === district)
  const threatLevel = getDistrictThreatLevel(district, summary, anomalies)
  const yoy = summary.yoy_change_pct
  const trend = yoy > 2 ? 'increasing' : yoy < -2 ? 'decreasing' : 'stable'

  let narrative = t('narr.briefBase')
    .replace('{district}', td(district))
    .replace('{cases}', summary.latest_year_cases.toLocaleString())
    .replace('{year}', String(summary.latest_year))
  if (trend === 'increasing') narrative += t('narr.briefUp').replace('{pct}', yoy.toFixed(1))
  else if (trend === 'decreasing') narrative += t('narr.briefDown').replace('{pct}', Math.abs(yoy).toFixed(1))
  narrative += t('narr.briefTop')
    .replace('{crime}', tc(summary.top_crime_type))
    .replace('{cases}', summary.top_crime_count.toLocaleString())
  if (summary.heinous_pct > 10) narrative += t('narr.briefHeinous').replace('{pct}', summary.heinous_pct.toFixed(1))
  if (distAnomalies.length > 0) narrative += t('narr.briefAnoms').replace('{n}', String(distAnomalies.length))

  let recommendation = ''
  if (threatLevel === 'CRITICAL' || threatLevel === 'HIGH') {
    const topAnomaly = distAnomalies[0]
    recommendation = t('narr.recIncrease').replace('{crime}', tc(summary.top_crime_type))
    if (topAnomaly) recommendation += ` Priority: ${topAnomaly.crime_type} spike (z=${topAnomaly.zscore.toFixed(1)}).`
  } else if (trend === 'increasing') {
    recommendation = t('narr.recMonitor').replace('{crime}', tc(summary.top_crime_type))
  } else {
    recommendation = t('narr.recMaintain').replace('{pct}', summary.clearance_pct.toFixed(1))
  }

  return {
    threatLevel,
    trend,
    trendPct: yoy,
    topCrime: summary.top_crime_type,
    heinousPct: summary.heinous_pct,
    clearancePct: summary.clearance_pct,
    anomalyCount: distAnomalies.length,
    narrative,
    recommendation,
  }
}

export function generatePredictionNarrative(
  shapFeatures: ShapFeature[],
  riskSummary: RiskSummary,
  t: Translate,
): string {
  const top3 = shapFeatures.slice(0, 3)
  // featureName over description: the description ships from the pipeline in
  // English, the feature key resolves through i18n
  const drivers = top3.map((f) => featureName(f.feature, t)).join(', ')
  const hitRate = riskSummary.pai?.hit_rate_5pct ?? 0
  const pai = riskSummary.pai?.pai_5pct ?? 0

  return t('narr.predictInsight')
    .replace('{hit}', hitRate.toFixed(1))
    .replace('{pai}', pai.toFixed(1))
    .replace('{drivers}', drivers)
}

export function generatePatrolRecommendation(
  briefing: PatrolBriefing,
  _anomalies: Anomaly[],
): string {
  const topCrimes = Object.entries(briefing.top_crime_types)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 2)
    .map(([t]) => t.replace('Crimes Against ', ''))
    .join(' and ')

  const heinous = briefing.gravity_breakdown['Heinous'] ?? 0
  const total = briefing.recent_incidents_30d

  let rec = `Deploy patrol unit at (${briefing.center_lat.toFixed(3)}, ${briefing.center_lon.toFixed(3)}). `
  rec += `${total} incidents in last 30 days covering ${briefing.cells_covered} grid cells. `
  rec += `Focus: ${topCrimes}. `
  if (heinous > 0) rec += `${heinous} heinous cases require priority response. `

  return rec
}

export interface ForecastItem {
  crimeType: string
  direction: 'up' | 'down' | 'stable'
  /** observed minus STL-expected, summed over this crime type's anomalies */
  excess: number
  /** 80% interval on `excess`, from the pooled STL residual dispersion */
  lo: number
  hi: number
  nSpikes: number
  nDrops: number
  nDistricts: number
  detail: string
}

/* z = (observed - expected) / sigma, so the STL residual standard deviation
   behind each anomaly is recoverable as (observed - expected) / z. Summing
   independent residuals gives sigma_total = sqrt(sum of sigma_i^2), which is
   what the interval below is built from.

   This replaces a "confidence" field that was literally
   `Math.min(95, 50 + total * 8)` -- a percentage that rose with how many
   anomalies happened to be in the feed and carried no statistical meaning at
   all. In a policing context that is not a rough heuristic, it is a made-up
   statistic attached to a crime forecast. */
const Z80 = 1.2816 // two-sided 80% normal quantile

export function generateForecast(
  anomalies: Anomaly[],
  _districts: DistrictSummary[],
  t?: Translate,
): ForecastItem[] {
  interface Acc {
    spikes: number
    drops: number
    excess: number
    variance: number
    districts: Set<string>
  }
  const byCrime = new Map<string, Acc>()

  for (const a of anomalies) {
    const acc =
      byCrime.get(a.crime_type) ??
      { spikes: 0, drops: 0, excess: 0, variance: 0, districts: new Set<string>() }

    const delta = a.observed - a.expected
    if (a.zscore > 0) acc.spikes++
    else acc.drops++
    acc.excess += delta

    // Guard against a zero z-score, which would divide to Infinity.
    if (a.zscore !== 0) {
      const sigma = Math.abs(delta / a.zscore)
      acc.variance += sigma * sigma
    }
    acc.districts.add(a.district)
    byCrime.set(a.crime_type, acc)
  }

  const items: ForecastItem[] = []
  for (const [crime, acc] of byCrime.entries()) {
    const margin = Z80 * Math.sqrt(acc.variance)
    const lo = acc.excess - margin
    const hi = acc.excess + margin

    // "Stable" is not a tie in spike/drop counts -- it is an interval that
    // straddles zero, i.e. we cannot tell the direction apart from noise.
    const direction: ForecastItem['direction'] =
      lo > 0 ? 'up' : hi < 0 ? 'down' : 'stable'

    const nDistricts = acc.districts.size
    items.push({
      crimeType: crime,
      direction,
      excess: acc.excess,
      lo,
      hi,
      nSpikes: acc.spikes,
      nDrops: acc.drops,
      nDistricts,
      detail: t
        ? t('forecast.stlDetail')
            .replace('{spikes}', String(acc.spikes))
            .replace('{drops}', String(acc.drops))
            .replace('{districts}', String(nDistricts))
            .replace('{sign}', acc.excess >= 0 ? '+' : '')
            .replace('{excess}', String(Math.round(acc.excess)))
            .replace('{lo}', String(Math.round(lo)))
            .replace('{hi}', String(Math.round(hi)))
        : `${acc.spikes} spike${acc.spikes !== 1 ? 's' : ''}, ` +
          `${acc.drops} drop${acc.drops !== 1 ? 's' : ''} across ` +
          `${nDistricts} district${nDistricts !== 1 ? 's' : ''}. ` +
          `Net ${acc.excess >= 0 ? '+' : ''}${Math.round(acc.excess)} vs STL baseline ` +
          `(80% interval ${Math.round(lo)} to ${Math.round(hi)}).`,
    })
  }

  // Rank by the size of the departure from baseline, not by a made-up score.
  return items.sort((a, b) => Math.abs(b.excess) - Math.abs(a.excess)).slice(0, 6)
}

/* Deterministic template, not a language model. It was called
   generateAISummary, which implied an LLM had written it. */
export function composeModelSummary(riskSummary: Pick<RiskSummary, 'pai'>, t: Translate): string {
  const hitRate = riskSummary.pai?.hit_rate_5pct ?? 0
  const pai = riskSummary.pai?.pai_5pct ?? 0

  return t('narr.modelSummary')
    .replace('{hit}', hitRate.toFixed(1))
    .replace('{pai}', pai.toFixed(1))
}

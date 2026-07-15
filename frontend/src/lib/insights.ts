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

const HOURS = ['00', '01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11',
  '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23']

function fakeTimestamp(idx: number): string {
  const h = HOURS[(23 - (idx * 3 + idx * 7) % 24)]
  const m = String((idx * 17 + 5) % 60).padStart(2, '0')
  return `${h}:${m}`
}

export function generateFeedItems(
  anomalies: Anomaly[],
  districts: DistrictSummary[],
): FeedItem[] {
  const items: FeedItem[] = []

  anomalies.slice(0, 12).forEach((a, i) => {
    const dir = a.zscore > 0 ? 'spike' : 'drop'
    const pctChange = Math.abs(((a.observed - a.expected) / Math.max(a.expected, 1)) * 100).toFixed(0)
    items.push({
      id: `anomaly-${i}`,
      timestamp: fakeTimestamp(i),
      severity: a.severity === 'critical' ? 'critical' : a.zscore > 3 ? 'high' : 'medium',
      icon: 'alert',
      title: `${a.crime_type} ${dir} detected in ${a.district}`,
      detail: `${a.observed} observed vs ${a.expected.toFixed(0)} expected (${dir === 'spike' ? '+' : '-'}${pctChange}%). Z-score: ${a.zscore.toFixed(1)}`,
      district: a.district,
    })
  })

  districts
    .filter((d) => d.yoy_change_pct > 8)
    .slice(0, 5)
    .forEach((d, i) => {
      items.push({
        id: `trend-${i}`,
        timestamp: fakeTimestamp(items.length + i),
        severity: d.yoy_change_pct > 15 ? 'high' : 'medium',
        icon: 'trend',
        title: `${d.district} crime trending +${d.yoy_change_pct.toFixed(1)}% YoY`,
        detail: `${d.latest_year_cases.toLocaleString()} cases in ${d.latest_year}, led by ${d.top_crime_type}. Heinous: ${d.heinous_pct.toFixed(1)}%`,
        district: d.district,
      })
    })

  return items.sort((a, b) => {
    const sev = { critical: 0, high: 1, medium: 2, info: 3 }
    return sev[a.severity] - sev[b.severity]
  })
}

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
): DistrictBrief | null {
  if (!summary) return null

  const distAnomalies = anomalies.filter((a) => a.district === district)
  const threatLevel = getDistrictThreatLevel(district, summary, anomalies)
  const yoy = summary.yoy_change_pct
  const trend = yoy > 2 ? 'increasing' : yoy < -2 ? 'decreasing' : 'stable'

  let narrative = `${district} recorded ${summary.latest_year_cases.toLocaleString()} FIRs in ${summary.latest_year}`
  if (trend === 'increasing') narrative += `, up ${yoy.toFixed(1)}% year-over-year`
  else if (trend === 'decreasing') narrative += `, down ${Math.abs(yoy).toFixed(1)}% year-over-year`
  narrative += `. Top offence: ${summary.top_crime_type} (${summary.top_crime_count.toLocaleString()} cases).`
  if (summary.heinous_pct > 10) narrative += ` ${summary.heinous_pct.toFixed(1)}% of cases are heinous offences.`
  if (distAnomalies.length > 0) narrative += ` ${distAnomalies.length} active anomaly alert${distAnomalies.length > 1 ? 's' : ''}.`

  let recommendation = ''
  if (threatLevel === 'CRITICAL' || threatLevel === 'HIGH') {
    const topAnomaly = distAnomalies[0]
    recommendation = `Increase patrol presence. Focus on ${summary.top_crime_type.replace('Crimes Against ', '')} prevention.`
    if (topAnomaly) recommendation += ` Priority: ${topAnomaly.crime_type} spike (z=${topAnomaly.zscore.toFixed(1)}).`
  } else if (trend === 'increasing') {
    recommendation = `Monitor ${summary.top_crime_type.replace('Crimes Against ', '')} trend. Consider preventive deployment.`
  } else {
    recommendation = `Maintain current deployment. Clearance rate: ${summary.clearance_pct.toFixed(1)}%.`
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
): string {
  const top3 = shapFeatures.slice(0, 3)
  const drivers = top3.map((f) => f.description || f.feature).join(', ')
  const hitRate = riskSummary.pai?.hit_rate_5pct ?? 0
  const auc = riskSummary.test_auc

  return `PRAHARI identifies ${hitRate.toFixed(1)}% of future crime in just 5% of the area (AUC ${auc.toFixed(2)}). Top prediction drivers: ${drivers}. The model has learned spatio-temporal crime clustering patterns — areas with recent nearby incidents face significantly elevated risk.`
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
  confidence: number
  detail: string
}

export function generateForecast(
  anomalies: Anomaly[],
  _districts: DistrictSummary[],
): ForecastItem[] {
  const crimeMap = new Map<string, { spikes: number; drops: number; total: number }>()

  for (const a of anomalies) {
    const entry = crimeMap.get(a.crime_type) ?? { spikes: 0, drops: 0, total: 0 }
    if (a.zscore > 0) entry.spikes++
    else entry.drops++
    entry.total++
    crimeMap.set(a.crime_type, entry)
  }

  const items: ForecastItem[] = []
  for (const [crime, stats] of crimeMap.entries()) {
    const direction = stats.spikes > stats.drops ? 'up' : stats.drops > stats.spikes ? 'down' : 'stable'
    const confidence = Math.min(95, 50 + stats.total * 8)
    const affectedDistricts = new Set(anomalies.filter((a) => a.crime_type === crime).map((a) => a.district))

    items.push({
      crimeType: crime,
      direction,
      confidence,
      detail: `${stats.spikes} spike${stats.spikes !== 1 ? 's' : ''} across ${affectedDistricts.size} district${affectedDistricts.size !== 1 ? 's' : ''}`,
    })
  }

  return items.sort((a, b) => b.confidence - a.confidence).slice(0, 6)
}

export function generateAISummary(riskSummary: Pick<RiskSummary, 'test_auc' | 'pai'>): string {
  const auc = riskSummary.test_auc
  const hitRate = riskSummary.pai?.hit_rate_5pct ?? 0
  const pai = riskSummary.pai?.pai_5pct ?? 0

  return `PRAHARI's predictive engine achieves ${(auc * 100).toFixed(0)}% ranking accuracy (AUC ${auc.toFixed(2)}) on held-out test data. By patrolling just 5% of the area, ${hitRate.toFixed(1)}% of future crime is covered — a ${pai.toFixed(1)}× improvement over random deployment. Every prediction is explainable: SHAP values show which factors drove each risk score, and isotonic calibration ensures scores read as true probabilities.`
}

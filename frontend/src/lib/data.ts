// Data loading helpers + shared types. All numbers come from the ML pipeline
// outputs (derived from the KSP dataset); boundaries/tiles are real OSM data.

export interface HotspotPoint {
  position: [number, number]
  cellId: number
  count: number
  z: number
  p: number
  sig: Significance
}

export type Significance =
  | 'hot_99' | 'hot_95' | 'hot_90'
  | 'not_sig'
  | 'cold_90' | 'cold_95' | 'cold_99'

export interface DistrictSummary {
  district: string
  total_cases: number
  latest_year: number
  latest_year_cases: number
  prior_year_cases: number
  yoy_change_pct: number
  top_crime_type: string
  top_crime_count: number
  heinous_count: number
  heinous_pct: number
  clearance_pct: number
}

export interface TrendPoint { period: string; count: number }

export interface TrendData {
  overall: TrendPoint[]
  by_crime_type: Record<string, TrendPoint[]>
  by_gravity: Record<string, TrendPoint[]>
}

export interface CrimeTypeBreakdown {
  crime_type: string
  count: number
  pct: number
}

export interface DistrictCentroid { district: string; lat: number; lon: number }

// significance -> RGBA for deck.gl layers
export const SIG_COLORS: Record<Significance, [number, number, number, number]> = {
  hot_99: [239, 68, 68, 235],
  hot_95: [249, 115, 22, 210],
  hot_90: [250, 204, 21, 185],
  not_sig: [148, 163, 184, 40],
  cold_90: [125, 211, 252, 130],
  cold_95: [56, 189, 248, 160],
  cold_99: [2, 132, 199, 200],
}

export const SIG_LABELS: Record<Significance, string> = {
  hot_99: 'Hot spot (99%)',
  hot_95: 'Hot spot (95%)',
  hot_90: 'Hot spot (90%)',
  not_sig: 'Not significant',
  cold_90: 'Cold spot (90%)',
  cold_95: 'Cold spot (95%)',
  cold_99: 'Cold spot (99%)',
}

const BASE = '/data'

export async function fetchJson<T>(name: string): Promise<T> {
  const res = await fetch(`${BASE}/${name}`)
  if (!res.ok) throw new Error(`fetch ${name}: ${res.status}`)
  return res.json()
}

export type HotspotScope = 'state' | 'district'

export function hotspotFile(crimeType: string | null, scope: HotspotScope = 'state'): string {
  const prefix = scope === 'district' ? 'hotspots_local' : 'hotspots'
  if (!crimeType) return `${prefix}_overall.geojson`
  return `${prefix}_${crimeType.replaceAll(' ', '_')}.geojson`
}

interface GeoJsonFC {
  features: {
    geometry: { coordinates: [number, number] }
    properties: {
      cell_id: number
      case_count: number
      gi_zscore: number
      gi_pvalue: number
      significance: Significance
    }
  }[]
}

export async function loadHotspots(
  crimeType: string | null,
  scope: HotspotScope = 'state',
): Promise<HotspotPoint[]> {
  const fc = await fetchJson<GeoJsonFC>(hotspotFile(crimeType, scope))
  return fc.features.map((f) => ({
    position: f.geometry.coordinates,
    cellId: f.properties.cell_id,
    count: f.properties.case_count,
    z: f.properties.gi_zscore,
    p: f.properties.gi_pvalue,
    sig: f.properties.significance,
  }))
}

// -- district name matching: real OSM/census boundary names vs dataset names --
const BOUNDARY_TO_DATASET: Record<string, string[]> = {
  'BENGALURU URBAN': ['BENGALURU CITY'],
  'BENGALURU RURAL': ['BENGALURU DIST'],
  'BAGALKOTE': ['BAGALKOT'],
  'BELAGAVI': ['BELAGAVI DIST', 'BELAGAVI CITY'],
  'MYSURU': ['MYSURU DIST', 'MYSURU CITY'],
  'CHAMARAJANAGARA': ['CHAMARAJANAGAR'],
  'CHIKKABALLAPURA': ['CHICKBALLAPURA'],
  'KALABURAGI': ['KALABURAGI DIST', 'KALABURAGI CITY', 'GULBARGA'],
  'HUBBALLI-DHARWAD': ['HUBBALLI DHARWAD CITY', 'DHARWAD'],
  'DAKSHINA KANNADA': ['DAKSHINA KANNADA', 'MANGALURU CITY'],
}

export function matchBoundaryToDataset(
  boundaryName: string,
  datasetDistricts: string[],
): string | null {
  const up = boundaryName.toUpperCase().trim()
  const mapped = BOUNDARY_TO_DATASET[up]
  if (mapped) {
    for (const m of mapped) {
      const hit = datasetDistricts.find((d) => d.toUpperCase() === m)
      if (hit) return hit
    }
  }
  // direct / prefix match fallback
  const direct = datasetDistricts.find((d) => d.toUpperCase() === up)
  if (direct) return direct
  return (
    datasetDistricts.find(
      (d) => d.toUpperCase().startsWith(up) || up.startsWith(d.toUpperCase()),
    ) ?? null
  )
}

export const KARNATAKA_CENTER: [number, number] = [76.7, 14.3]
export const KARNATAKA_ZOOM = 5.9

// ── PREDICT layer types ────────────────────────────────────────────────

export interface RiskCell {
  cell_id: number
  mean_risk: number
  max_risk: number
  cell_lat: number
  cell_lon: number
}

export interface Anomaly {
  district: string
  crime_type: string
  date: string
  observed: number
  expected: number
  zscore: number
  severity: string
  description: string
}

export interface GangKeyMember {
  offender_id: string
  name: string
  gang_degree: number
  total_cases: number
  is_articulation: boolean
}

export interface Gang {
  gang_rank: number
  gang_size: number
  gang_edges: number
  n_articulation_points: number
  key_members: GangKeyMember[]
  removed_top3: string[]
  largest_before: number
  largest_after_top3_removed: number
  components_after_top3_removed: number
  fragmentation_drop_pct: number
}

export interface NetworkSummary {
  graph_nodes: number
  graph_edges: number
  n_communities: number
  modularity: number
}

export interface RiskSummary {
  test_auc: number
  pai: Record<string, number>
  pei: Record<string, number>
  feature_importance: { feature: string; importance: number }[]
}

export interface CytoNode { data: { id: string; label: string; size: number; community: number; betweenness: number } }
export interface CytoEdge { data: { source: string; target: string; weight: number } }
export interface CytoNetwork { nodes: CytoNode[]; edges: CytoEdge[] }

// friendly names for model features (mirror of trust/explain.py)
export const FEATURE_NAMES: Record<string, string> = {
  hist_total: 'Historical crime volume',
  day_of_year: 'Seasonality (day of year)',
  is_night_shift: 'Night shift (22:00–06:00)',
  is_morning_shift: 'Morning shift (06:00–14:00)',
  is_weekend: 'Weekend',
  hour_cos: 'Time-of-day cycle',
  hour_sin: 'Time-of-day cycle',
  hour_proxy: 'Shift midpoint hour',
  dow: 'Day of week',
  dow_sin: 'Day-of-week cycle',
  dow_cos: 'Day-of-week cycle',
  month_sin: 'Seasonal cycle',
  month_cos: 'Seasonal cycle',
  crime_entropy: 'Crime-type diversity of area',
  hist_heinous_pct: 'Heinous-crime share of area',
  hist_violent_pct: 'Violent-crime share of area',
  hist_property_pct: 'Property-crime share of area',
  n_crime_types: 'Distinct crime types in area',
  n_officers: 'Officer deployment level',
}

export function featureName(f: string): string {
  if (FEATURE_NAMES[f]) return FEATURE_NAMES[f]
  const nr = f.match(/^nr_([\d.]+)km_(\d+)d$/)
  if (nr) return `Crimes within ${nr[1]} km, last ${nr[2]} days`
  return f
}

// ── ACT / TRUST layer types ───────────────────────────────────────────

export interface PatrolSummary {
  n_patrols: number
  patrol_radius_km: number
  scope_district: string
  baseline_coverage_pct: number
  statusquo_coverage_pct?: number
  greedy_coverage_pct: number
  greedy_uplift_pct: number
  greedy_uplift_x: number
  greedy_uplift_vs_statusquo_pct?: number
  greedy_uplift_vs_statusquo_x?: number
  ilp_coverage_pct?: number
}

export interface PatrolAllocation {
  patrol_id: number
  seed_cell_id: number
  center_lat: number
  center_lon: number
  cells_covered: number
  risk_covered: number
  cell_ids: number[]
}

export interface PatrolBriefing {
  patrol_id: number
  center_lat: number
  center_lon: number
  risk_covered: number
  cells_covered: number
  recent_incidents_30d: number
  top_crime_types: Record<string, number>
  gravity_breakdown: Record<string, number>
  description: string
}

export interface ShapFeature { feature: string; mean_abs_shap: number; description: string }
export interface ShapExplanation {
  cell_id: number
  date: string
  shift: number
  risk_score: number
  has_crime: number
  explanation: string
  top_features: Record<string, number>
}
export interface ShapData {
  global_feature_importance: ShapFeature[]
  sample_explanations: ShapExplanation[]
}

export interface FairnessReport {
  disparity_metrics: {
    gini_coefficient: number
    max_min_ratio: number
    coefficient_of_variation: number
    n_districts: number
    highest_risk_districts: { DistrictName: string; mean_risk: number; n_cases: number }[]
    lowest_risk_districts: { DistrictName: string; mean_risk: number; n_cases: number }[]
  }
  reporting_bias: {
    median_clearance_rate: number
    districts_below_median: number
    districts_above_median: number
    flag: string
  }
  fairness_statement: string
  methodology: Record<string, string | string[]>
}

export interface BenchmarkReport {
  headline_numbers: {
    pai_5pct: number
    hit_rate_5pct: number
    coverage_uplift_pct: number
    optimized_coverage_pct: number
    network_communities: number
    network_modularity: number
    best_gang_size: number
    best_gang_fragmentation_pct: number
    best_gang_pieces: number
  }
}

// categorical palette for network communities
export const COMMUNITY_COLORS = [
  '#38bdf8', '#f472b6', '#4ade80', '#fbbf24', '#a78bfa',
  '#fb7185', '#2dd4bf', '#fb923c', '#c084fc', '#84cc16',
  '#22d3ee', '#e879f9', '#facc15', '#34d399',
]

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

// ── Per-district × per-crime trend analysis ───────────────────────────
export interface TrendYearPoint { year: number; count: number }
export interface TrendPlace { place: string; count: number }
export interface DistrictCrimeTrend {
  monthly: TrendPoint[]
  yearly: TrendYearPoint[]
  top_places: TrendPlace[]
  total: number
}
// districts[district][crimeType | 'ALL'] -> trend
export interface DistrictTrends {
  generated: string
  districts: Record<string, Record<string, DistrictCrimeTrend>>
}

export interface DistrictCentroid { district: string; lat: number; lon: number }

// significance -> RGBA for deck.gl layers
export const SIG_COLORS: Record<Significance, [number, number, number, number]> = {
  // hot spots keep their statistical encoding (red / orange / yellow) untouched
  hot_99: [239, 68, 68, 235],
  hot_95: [249, 115, 22, 210],
  hot_90: [250, 204, 21, 185],
  not_sig: [138, 147, 158, 40],
  // cold spots: slate-blue, visible on the dark basemap
  cold_90: [123, 164, 192, 155],
  cold_95: [91, 132, 160, 185],
  cold_99: [71, 107, 131, 220],
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

const BASE = `${import.meta.env.BASE_URL}data`

/* Every fetch goes through one cache, for two reasons.

   Deduplication: ConsoleShell and several views ask for district_summary.json
   and anomaly_feed.json independently, so a cold console used to make the same
   request two or three times over.

   Persistence: only one section mounts at a time, so moving between sections
   unmounts a view and remounts it later. Without a cache that re-downloads
   megabytes on every navigation — the single biggest cause of the console
   feeling slow after the first load.

   Failures are evicted so a later mount can retry rather than inheriting a
   rejected promise forever. */
const cache = new Map<string, Promise<unknown>>()

export function fetchJson<T>(name: string): Promise<T> {
  const hit = cache.get(name)
  if (hit) return hit as Promise<T>

  const p = fetch(`${BASE}/${name}`).then((res) => {
    if (!res.ok) throw new Error(`fetch ${name}: ${res.status}`)
    return res.json()
  })
  cache.set(name, p)
  p.catch(() => cache.delete(name))
  return p as Promise<T>
}

/** Drop cached payloads — used when the data manifest changes. */
export function clearDataCache(): void {
  cache.clear()
}

export type HotspotScope = 'state' | 'district'

/* NOTE: these are GeoJSON documents but must be served with a `.json`
   extension. Catalyst's static host does not gzip `.geojson` (measured:
   identical encoded and decoded size), so the 14 MB district-scope file
   went over the wire uncompressed. As `.json` it is compressed ~7x.
   `optimize_geojson.py` performs the rename; re-run it after copy_data.py. */
export function hotspotFile(crimeType: string | null, scope: HotspotScope = 'state'): string {
  const prefix = scope === 'district' ? 'hotspots_local' : 'hotspots'
  if (!crimeType) return `${prefix}_overall.json`
  return `${prefix}_${crimeType.replaceAll(' ', '_')}.json`
}

interface GeoJsonFC {
  /** total cells the Gi* test ran over, including the non-significant ones
      stripped from `features` by strip_insignificant.py */
  analysed?: number
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

export interface HotspotSet {
  points: HotspotPoint[]
  /** denominator for the "N hot cells / M analysed" readout */
  analysed: number
}

/* The files ship significant cells only — the map filters out `not_sig`
   anyway, and they were ~74% of the payload (13.6 MB -> 3.6 MB on the
   district-scope file). `analysed` carries the original denominator. */
const hotspotCache = new Map<string, Promise<HotspotSet>>()

export function loadHotspots(
  crimeType: string | null,
  scope: HotspotScope = 'state',
): Promise<HotspotSet> {
  const key = hotspotFile(crimeType, scope)
  const hit = hotspotCache.get(key)
  if (hit) return hit
  const p = parseHotspots(key)
  hotspotCache.set(key, p)
  p.catch(() => hotspotCache.delete(key))
  return p
}

/* Kept separate so the cache above stores the mapped points, not just the
   raw document: re-mapping 20k features per filter change was the jank. */
async function parseHotspots(file: string): Promise<HotspotSet> {
  const fc = await fetchJson<GeoJsonFC>(file)
  const points = fc.features.map((f) => ({
    position: f.geometry.coordinates,
    cellId: f.properties.cell_id,
    count: f.properties.case_count,
    z: f.properties.gi_zscore,
    p: f.properties.gi_pvalue,
    sig: f.properties.significance,
  }))
  return { points, analysed: fc.analysed ?? points.length }
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

// Non-territorial units whose anomalies aren't mappable, plus STL artifacts
// (zero observed / non-positive baseline). Shared by the feed and the tab badge
// so the alert count always matches what the officer actually sees.
const NON_GEO_UNITS = new Set(['CID', 'COASTAL SECURITY POLICE', 'KARNATAKA RAILWAYS', 'ISD BENGALURU'])

export function filterAnomalies(anomalies: Anomaly[]): Anomaly[] {
  return anomalies.filter(
    (a) => !NON_GEO_UNITS.has(a.district) && a.observed > 0 && a.expected > 0,
  )
}

export interface GangKeyMember {
  offender_id: string
  name: string
  gang_degree: number
  total_cases: number
  is_articulation: boolean
}

export type ThreatTier = 'high' | 'medium' | 'low'

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
  // threat classification
  threat_tier: ThreatTier
  threat_score: number
  heinous_pct: number
  violent_pct: number
  top_crime: string
  n_districts: number
  total_cases: number
}

export interface GangNode {
  data: { id: string; label: string; size: number; gang: number; tier: ThreatTier; threat: number; degree: number }
}
export interface GangNetwork { nodes: GangNode[]; edges: CytoEdge[] }

// muted threat palette — clear, not neon
export const THREAT_COLORS: Record<ThreatTier, string> = {
  high: '#e5484d',
  medium: '#d99a3c',
  low: '#5b7a8c',   // muted slate-blue — was a bright blue competing with the accent
}
export const THREAT_ORDER: ThreatTier[] = ['high', 'medium', 'low']

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

export interface CytoNode { data: { id: string; label: string; size: number; community: number; key_player_score: number } }
export interface CytoEdge { data: { source: string; target: string; weight: number } }
export interface CytoNetwork { nodes: CytoNode[]; edges: CytoEdge[] }

// ── Offender dossiers (War Room) ──────────────────────────────────────
export interface OffenderAssociate {
  offender_id: string
  name: string
  shared_cases: number
}
export interface OffenderCrimeType { type: string; count: number }
export interface OffenderDistrict { district: string; count: number }

export interface OffenderDossier {
  offender_id: string
  name: string
  age: number | null
  total_cases: number
  arrest_records: number
  last_arrest: string | null
  top_crime: string
  crime_types: OffenderCrimeType[]
  districts: OffenderDistrict[]
  n_districts: number
  heinous_pct: number
  first_incident: string | null
  last_incident: string | null
  career_years: number
  n_associates: number
  associates: OffenderAssociate[]
  gang_rank: number | null
  threat_tier: ThreatTier | null
  threat_score: number | null
  gang_degree: number | null
  is_articulation: boolean
  in_graph: boolean
  wanted_score: number
  wanted_rank: number
}
export interface OffenderIndex {
  generated: string
  count: number
  offenders: OffenderDossier[]
}
export interface MostWantedData {
  generated: string
  offenders: OffenderDossier[]
}

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

export interface PatrolDistrict {
  district: string
  safe: string
  n_cells: number
  coverage_6: number | null
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

export interface ReliabilityPoint { conf: number; acc: number; frac: number }
export interface CalibrationData {
  n_test: number
  pos_rate: number
  brier_raw: number
  brier_calibrated: number
  ece_raw: number
  ece_calibrated: number
  reliability_raw: ReliabilityPoint[]
  reliability_calibrated: ReliabilityPoint[]
  method: string
}

export interface BenchmarkReport {
  headline_numbers: {
    pai_5pct: number
    hit_rate_5pct: number
    coverage_uplift_pct: number
    optimized_coverage_pct: number
    statusquo_coverage_pct: number
    greedy_uplift_vs_statusquo_pct: number
    greedy_uplift_vs_statusquo_x: number
    network_communities: number
    network_modularity: number
    best_gang_size: number
    best_gang_fragmentation_pct: number
    best_gang_pieces: number
  }
  risk_model?: {
    test_auc: number
    pai: Record<string, number>
    pei: Record<string, number>
  }
  patrol_optimizer?: {
    n_patrols: number
    patrol_radius_km: number
    scope_district: string
    baseline_coverage_pct: number
    statusquo_coverage_pct: number
    greedy_coverage_pct: number
    ilp_coverage_pct?: number
  }
  network_analysis?: {
    graph_nodes: number
    graph_edges: number
    n_communities: number
    modularity: number
    centrality_method: string
  }
}

// ── Novelty analytics types ───────────────────────────────────────────

export type EmergingCategory = 'new' | 'intensifying' | 'persistent' | 'cooling'

export interface EmergingCell {
  cell_id: number
  lat: number
  lon: number
  district: string | null
  category: EmergingCategory
  tau: number
  p: number
  recent_monthly: number
  hist_monthly: number
  total_cases: number
}

export interface EmergingData {
  summary: {
    window_start: string
    window_end: string
    cells_assessed: number
    counts: Partial<Record<EmergingCategory, number>>
    method: string
  }
  cells: EmergingCell[]
}

export const EMERGING_COLORS: Record<EmergingCategory, [number, number, number, number]> = {
  new: [232, 121, 249, 235],          // fuchsia — brand new activity
  intensifying: [239, 68, 68, 225],   // red — trending up
  persistent: [249, 115, 22, 190],    // orange — stable hot
  cooling: [91, 122, 140, 170],       // muted slate-blue — trending down
}

export interface SpreePoint { lat: number; lon: number; date: string }

export interface Spree {
  spree_id: number
  crime_type: string
  minor_head: number
  district: string
  n_cases: number
  start_date: string
  end_date: string
  span_days: number
  center_lat: number
  center_lon: number
  points: SpreePoint[]
}

export interface SpreeData {
  summary: { window_days: number; n_sprees: number; method: string }
  sprees: Spree[]
}

export interface Corridor {
  from_district: string
  to_district: string
  from_lat: number
  from_lon: number
  to_lat: number
  to_lon: number
  n_offenders: number
  n_transitions: number
}

export interface CorridorData {
  summary: {
    total_offenders: number
    multi_district_offenders: number
    multi_district_pct: number
    n_corridors: number
    method: string
  }
  corridors: Corridor[]
  top_offenders: { offender_id: string; name: string; n_districts: number; n_cases: number }[]
}

// categorical palette for network communities
export const COMMUNITY_COLORS = [
  '#38bdf8', '#f472b6', '#4ade80', '#fbbf24', '#a78bfa',
  '#fb7185', '#2dd4bf', '#fb923c', '#c084fc', '#84cc16',
  '#22d3ee', '#e879f9', '#facc15', '#34d399',
]

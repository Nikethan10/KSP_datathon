import { fetchJson } from '../data'

/* The lattice a report gets snapped to. Shared with the pipeline via
   grid_params.json (emitted by gen_grid_params.py from config.py) rather than
   re-typed here — the day someone changes GRID_RESOLUTION_KM, two hand-copied
   constants would drift and duplicate detection would quietly stop working.

   grid_params.json is an immutable pipeline artefact, so it goes through
   data.ts's fetchJson like every other one. Live report traffic does not. */

export interface GridParams {
  bbox: { lat_min: number; lat_max: number; lon_min: number; lon_max: number }
  dlat: number
  dlon: number
  n_lat: number
  n_lon: number
  n_cells: number
}

let params: GridParams | null = null

export async function loadGridParams(): Promise<GridParams> {
  if (params) return params
  params = await fetchJson<GridParams>('grid_params.json')
  return params
}

/** Non-throwing accessor for code paths that must not await. */
export function gridParams(): GridParams | null {
  return params
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

/* data/grid.py assigns cases with a cKDTree nearest-neighbour query over an
   axis-aligned rectangular lattice. On such a lattice the nearest point is just
   each axis rounded independently, so this matches the pipeline exactly rather
   than approximating it. */
export function cellIdFor(lat: number, lon: number, p: GridParams): number | null {
  const { bbox, dlat, dlon, n_lat, n_lon } = p
  if (lat < bbox.lat_min || lat > bbox.lat_max) return null
  if (lon < bbox.lon_min || lon > bbox.lon_max) return null

  const latIdx = clamp(Math.round((lat - bbox.lat_min) / dlat), 0, n_lat - 1)
  const lonIdx = clamp(Math.round((lon - bbox.lon_min) / dlon), 0, n_lon - 1)
  return latIdx * n_lon + lonIdx
}

export function cellCenter(cellId: number, p: GridParams): { lat: number; lon: number } {
  const latIdx = Math.floor(cellId / p.n_lon)
  const lonIdx = cellId % p.n_lon
  return {
    lat: p.bbox.lat_min + latIdx * p.dlat,
    lon: p.bbox.lon_min + lonIdx * p.dlon,
  }
}

/** The eight surrounding cells, for duplicate candidate lookup. Pure arithmetic
    on the lattice — no geo query, no spatial index. */
export function neighbourCells(cellId: number, p: GridParams): number[] {
  const latIdx = Math.floor(cellId / p.n_lon)
  const lonIdx = cellId % p.n_lon
  const out: number[] = []
  for (let dLat = -1; dLat <= 1; dLat++) {
    for (let dLon = -1; dLon <= 1; dLon++) {
      const li = latIdx + dLat
      const lo = lonIdx + dLon
      if (li < 0 || li >= p.n_lat || lo < 0 || lo >= p.n_lon) continue
      out.push(li * p.n_lon + lo)
    }
  }
  return out
}

export function withinKarnataka(lat: number, lon: number, p: GridParams): boolean {
  return (
    lat >= p.bbox.lat_min && lat <= p.bbox.lat_max &&
    lon >= p.bbox.lon_min && lon <= p.bbox.lon_max
  )
}

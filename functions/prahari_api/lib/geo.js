'use strict'

const P = require('../grid_params.json')
const CENTROIDS = require('../district_centroids.json')

/* The 1 km lattice a report gets snapped to, from grid_params.json — emitted by
   gen_grid_params.py out of config.py, not re-typed. Two hand-copied sets of these
   constants would diverge the first time someone changed GRID_RESOLUTION_KM, and
   the failure would be silent: duplicates would simply stop being detected. */

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v
}

function withinKarnataka(lat, lon) {
  return (
    lat >= P.bbox.lat_min && lat <= P.bbox.lat_max &&
    lon >= P.bbox.lon_min && lon <= P.bbox.lon_max
  )
}

/* data/grid.py assigns cases with a cKDTree nearest-neighbour query. On an
   axis-aligned rectangular lattice the nearest point is each axis rounded
   independently, so this matches the pipeline exactly rather than approximating
   it. cell_id = lat_index * n_lon + lon_index, matching meshgrid(indexing='ij'). */
function cellIdFor(lat, lon) {
  if (!withinKarnataka(lat, lon)) return null
  const latIdx = clamp(Math.round((lat - P.bbox.lat_min) / P.dlat), 0, P.n_lat - 1)
  const lonIdx = clamp(Math.round((lon - P.bbox.lon_min) / P.dlon), 0, P.n_lon - 1)
  return latIdx * P.n_lon + lonIdx
}

/** The eight surrounding cells. Pure arithmetic — no geo query, no spatial index. */
function neighbourCells(cellId) {
  const latIdx = Math.floor(cellId / P.n_lon)
  const lonIdx = cellId % P.n_lon
  const out = []
  for (let dLat = -1; dLat <= 1; dLat++) {
    for (let dLon = -1; dLon <= 1; dLon++) {
      const li = latIdx + dLat
      const lo = lonIdx + dLon
      if (li < 0 || li >= P.n_lat || lo < 0 || lo >= P.n_lon) continue
      out.push(li * P.n_lon + lo)
    }
  }
  return out
}

function cellCenter(cellId) {
  const latIdx = Math.floor(cellId / P.n_lon)
  const lonIdx = cellId % P.n_lon
  return {
    lat: P.bbox.lat_min + latIdx * P.dlat,
    lon: P.bbox.lon_min + lonIdx * P.dlon,
  }
}

/* Nearest centroid, not point-in-polygon. The district boundaries are an 84 MB
   artefact and this only has to be good enough to route a report to a station —
   the exact coordinate is never published anyway. */
function nearestDistrict(lat, lon) {
  let best = null
  let bestD = Infinity
  for (let i = 0; i < CENTROIDS.length; i++) {
    const c = CENTROIDS[i]
    const dy = c.lat - lat
    const dx = (c.lon - lon) * 0.96 // rough lon compression at ~15N
    const d = dy * dy + dx * dx
    if (d < bestD) { bestD = d; best = c.district }
  }
  return best
}

module.exports = { cellIdFor, neighbourCells, cellCenter, nearestDistrict, withinKarnataka, PARAMS: P }

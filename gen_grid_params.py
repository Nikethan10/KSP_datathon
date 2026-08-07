"""Emit the grid lattice parameters the frontend needs to derive a cell_id.

The duplicate detector and the citizen-report map layer both have to land on the
exact same 1 km lattice the pipeline uses. Re-typing these numbers into TypeScript
would work right up until someone changes GRID_RESOLUTION_KM, at which point the two
drift silently and duplicates simply stop being detected. So they come from here.
"""
import io, json, math
from config import (
    KARNATAKA_BBOX, GRID_RESOLUTION_KM, DEG_PER_KM_LAT, DEG_PER_KM_LON,
)

dlat = GRID_RESOLUTION_KM * DEG_PER_KM_LAT
dlon = GRID_RESOLUTION_KM * DEG_PER_KM_LON

# np.arange semantics: half-open, so ceil of the span over the step.
n_lat = int(math.ceil((KARNATAKA_BBOX["lat_max"] - KARNATAKA_BBOX["lat_min"]) / dlat))
n_lon = int(math.ceil((KARNATAKA_BBOX["lon_max"] - KARNATAKA_BBOX["lon_min"]) / dlon))

params = {
    "bbox": KARNATAKA_BBOX,
    "resolution_km": GRID_RESOLUTION_KM,
    "deg_per_km_lat": DEG_PER_KM_LAT,
    "deg_per_km_lon": DEG_PER_KM_LON,
    "dlat": dlat,
    "dlon": dlon,
    "n_lat": n_lat,
    "n_lon": n_lon,
    "n_cells": n_lat * n_lon,
    "_note": "cell_id = lat_index * n_lon + lon_index, matching np.meshgrid(indexing='ij') in data/grid.py",
}

out = "frontend/public/data/grid_params.json"
io.open(out, "w", encoding="utf-8").write(json.dumps(params, indent=2))
print("wrote %s  (%d x %d = %d cells)" % (out, n_lat, n_lon, n_lat * n_lon))

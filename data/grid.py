import numpy as np
import pandas as pd
from scipy.spatial import cKDTree
from config import (
    KARNATAKA_BBOX, GRID_RESOLUTION_KM, DEG_PER_KM_LAT, DEG_PER_KM_LON,
    MIN_CASES_PER_CELL,
)


def build_grid() -> pd.DataFrame:
    bbox = KARNATAKA_BBOX
    dlat = GRID_RESOLUTION_KM * DEG_PER_KM_LAT
    dlon = GRID_RESOLUTION_KM * DEG_PER_KM_LON

    lats = np.arange(bbox["lat_min"], bbox["lat_max"], dlat)
    lons = np.arange(bbox["lon_min"], bbox["lon_max"], dlon)

    grid_lats, grid_lons = np.meshgrid(lats, lons, indexing="ij")
    grid = pd.DataFrame({
        "cell_lat": grid_lats.ravel(),
        "cell_lon": grid_lons.ravel(),
    })
    grid["cell_id"] = np.arange(len(grid))
    print(f"[grid] Built {len(grid):,} cells ({len(lats)} lat × {len(lons)} lon), resolution={GRID_RESOLUTION_KM}km")
    return grid


def assign_cases_to_grid(cases: pd.DataFrame, grid: pd.DataFrame) -> pd.DataFrame:
    grid_coords = np.deg2rad(grid[["cell_lat", "cell_lon"]].values)
    tree = cKDTree(grid_coords)

    case_coords = np.deg2rad(cases[["latitude", "longitude"]].values)
    _, indices = tree.query(case_coords)

    cases = cases.copy()
    cases["cell_id"] = grid.iloc[indices]["cell_id"].values
    print(f"[grid] Assigned {len(cases):,} cases to grid cells")
    return cases


def get_active_cells(cases: pd.DataFrame, grid: pd.DataFrame) -> pd.DataFrame:
    counts = cases.groupby("cell_id").size().reset_index(name="total_cases")
    active = counts[counts["total_cases"] >= MIN_CASES_PER_CELL]
    active_grid = grid[grid["cell_id"].isin(active["cell_id"])].merge(active, on="cell_id")
    print(f"[grid] Active cells: {len(active_grid):,} / {len(grid):,} (min {MIN_CASES_PER_CELL} cases)")
    return active_grid


def compute_cell_stats(cases: pd.DataFrame) -> pd.DataFrame:
    stats = cases.groupby("cell_id").agg(
        total_cases=("CaseMasterID", "count"),
        heinous_cases=("GravityOffenceID", lambda x: (x == 1).sum()),
        nonheinous_cases=("GravityOffenceID", lambda x: (x == 2).sum()),
        petty_cases=("GravityOffenceID", lambda x: (x == 3).sum()),
        n_crime_types=("CrimeMajorHeadID", "nunique"),
        mean_lat=("latitude", "mean"),
        mean_lon=("longitude", "mean"),
    ).reset_index()
    return stats

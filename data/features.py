import numpy as np
import pandas as pd
from sklearn.neighbors import BallTree
from pathlib import Path
from tqdm import tqdm
from config import (
    NR_RADII_KM, NR_WINDOWS_DAYS, SHIFTS, TRAIN_END, VAL_END, TEST_START,
    CACHE_DIR, CRIME_GROUPS_VIOLENT, CRIME_GROUPS_PROPERTY,
)

EARTH_RADIUS_KM = 6371.0


def _get_shift(hour: int) -> int:
    if 6 <= hour < 14:
        return 0
    elif 14 <= hour < 22:
        return 1
    else:
        return 2


def build_cell_time_index(cases: pd.DataFrame) -> pd.DataFrame:
    """Build the (cell_id x date x shift) index for modeling."""
    cases = cases.copy()
    cases["date"] = cases["IncidentFromDate"].dt.normalize()
    cases["shift"] = cases["hour"].apply(_get_shift).astype("int8")

    date_range = pd.date_range(cases["date"].min(), cases["date"].max(), freq="D")
    cells = cases["cell_id"].unique()
    shifts = [0, 1, 2]

    idx = pd.MultiIndex.from_product(
        [cells, date_range, shifts], names=["cell_id", "date", "shift"]
    )
    ct = pd.DataFrame(index=idx).reset_index()

    crime_counts = (
        cases.groupby(["cell_id", "date", "shift"])
        .agg(n_crimes=("CaseMasterID", "count"))
        .reset_index()
    )
    ct = ct.merge(crime_counts, on=["cell_id", "date", "shift"], how="left")
    ct["n_crimes"] = ct["n_crimes"].fillna(0).astype("int16")
    ct["has_crime"] = (ct["n_crimes"] > 0).astype("int8")

    print(f"[features] Cell-time index: {len(ct):,} rows ({len(cells):,} cells x {len(date_range)} days x 3 shifts)")
    print(f"  positive rate: {ct['has_crime'].mean():.4f}")
    return ct


def compute_near_repeat_features(
    cases: pd.DataFrame,
    cell_time: pd.DataFrame,
    active_grid: pd.DataFrame,
) -> pd.DataFrame:
    """
    For each (cell, date, shift), count crimes within radius R and time window W
    using ONLY data strictly before the current time window.
    """
    print("[features] Computing near-repeat features ...")

    cell_coords = active_grid.set_index("cell_id")[["cell_lat", "cell_lon"]]
    coords_rad = np.deg2rad(cell_coords.values)
    tree = BallTree(coords_rad, metric="haversine")

    cases_sorted = cases.sort_values("IncidentFromDate").copy()
    cases_sorted["date"] = cases_sorted["IncidentFromDate"].dt.normalize()

    nr_features = {}

    for radius_km in NR_RADII_KM:
        radius_rad = radius_km / EARTH_RADIUS_KM
        neighbors = tree.query_radius(coords_rad, r=radius_rad)
        cell_ids = cell_coords.index.values
        cell_to_idx = {c: i for i, c in enumerate(cell_ids)}
        neighbor_map = {
            cell_ids[i]: set(cell_ids[nb] for nb in neighbors[i])
            for i in range(len(cell_ids))
        }

        daily_counts = (
            cases_sorted[cases_sorted["cell_id"].isin(cell_ids)]
            .groupby(["cell_id", "date"])
            .size()
            .reset_index(name="count")
        )
        daily_pivot = daily_counts.pivot_table(
            index="date", columns="cell_id", values="count", fill_value=0
        )

        for window_days in NR_WINDOWS_DAYS:
            col_name = f"nr_{radius_km}km_{window_days}d"
            rolled = daily_pivot.rolling(window=window_days, min_periods=1).sum().shift(1).fillna(0)

            nr_by_cell_date = {}
            for cell_id in cell_ids:
                nbrs = neighbor_map.get(cell_id, {cell_id})
                nbr_cols = [c for c in nbrs if c in rolled.columns]
                if nbr_cols:
                    nr_by_cell_date[cell_id] = rolled[nbr_cols].sum(axis=1)
                else:
                    nr_by_cell_date[cell_id] = pd.Series(0, index=rolled.index)

            nr_features[col_name] = nr_by_cell_date

        print(f"  radius={radius_km}km done")

    result = cell_time.copy()
    for col_name, cell_series in nr_features.items():
        vals = []
        for _, row in result.iterrows():
            cid, dt = row["cell_id"], row["date"]
            if cid in cell_series and dt in cell_series[cid].index:
                vals.append(cell_series[cid][dt])
            else:
                vals.append(0)
        result[col_name] = vals

    print(f"  generated {len(nr_features)} near-repeat columns")
    return result


def compute_near_repeat_features_fast(
    cases: pd.DataFrame,
    cell_time: pd.DataFrame,
    active_grid: pd.DataFrame,
) -> pd.DataFrame:
    """
    Vectorized near-repeat feature computation.
    For each (cell, date), sums crimes in neighboring cells over trailing windows.
    Shift-level granularity is ignored for speed — uses daily aggregation.
    """
    print("[features] Computing near-repeat features (fast vectorized) ...")

    cell_coords = active_grid.set_index("cell_id")[["cell_lat", "cell_lon"]]
    valid_cells = cell_coords.index.values
    coords_rad = np.deg2rad(cell_coords.values)
    tree = BallTree(coords_rad, metric="haversine")

    cases_daily = (
        cases[cases["cell_id"].isin(valid_cells)]
        .assign(date=lambda x: x["IncidentFromDate"].dt.normalize())
        .groupby(["cell_id", "date"])
        .size()
        .reset_index(name="count")
    )
    daily_pivot = daily_counts_pivot(cases_daily, valid_cells)

    nr_cols = []
    for radius_km in tqdm(NR_RADII_KM, desc="  radii"):
        radius_rad = radius_km / EARTH_RADIUS_KM
        neighbors = tree.query_radius(coords_rad, r=radius_rad)

        neighbor_sums = pd.DataFrame(0.0, index=daily_pivot.index, columns=valid_cells)
        for i, cell_id in enumerate(valid_cells):
            nbr_ids = valid_cells[neighbors[i]]
            nbr_present = [c for c in nbr_ids if c in daily_pivot.columns]
            if nbr_present:
                neighbor_sums[cell_id] = daily_pivot[nbr_present].sum(axis=1)

        for window_days in NR_WINDOWS_DAYS:
            col_name = f"nr_{radius_km}km_{window_days}d"
            rolled = neighbor_sums.rolling(window=window_days, min_periods=1).sum().shift(1).fillna(0)
            nr_cols.append((col_name, rolled))

    result = cell_time.copy()
    for col_name, rolled_df in nr_cols:
        lookup = rolled_df.stack().reset_index()
        lookup.columns = ["date", "cell_id", col_name]
        result = result.merge(lookup, on=["cell_id", "date"], how="left")
        result[col_name] = result[col_name].fillna(0)

    print(f"  generated {len(nr_cols)} near-repeat columns")
    return result


def daily_counts_pivot(daily_df, valid_cells):
    pivot = daily_df.pivot_table(
        index="date", columns="cell_id", values="count", fill_value=0
    )
    missing = [c for c in valid_cells if c not in pivot.columns]
    if missing:
        for c in missing:
            pivot[c] = 0
    return pivot


def compute_temporal_features(cell_time: pd.DataFrame) -> pd.DataFrame:
    """Add temporal encoding features to cell-time index."""
    print("[features] Computing temporal features ...")
    ct = cell_time.copy()

    ct["dow"] = ct["date"].dt.dayofweek.astype("int8")
    ct["month"] = ct["date"].dt.month.astype("int8")
    ct["year"] = ct["date"].dt.year.astype("int16")
    ct["day_of_year"] = ct["date"].dt.dayofyear.astype("int16")

    ct["is_weekend"] = ct["dow"].isin([5, 6]).astype("int8")
    ct["is_night_shift"] = (ct["shift"] == 2).astype("int8")
    ct["is_morning_shift"] = (ct["shift"] == 0).astype("int8")

    ct["dow_sin"] = np.sin(2 * np.pi * ct["dow"] / 7).astype("float32")
    ct["dow_cos"] = np.cos(2 * np.pi * ct["dow"] / 7).astype("float32")
    ct["month_sin"] = np.sin(2 * np.pi * (ct["month"] - 1) / 12).astype("float32")
    ct["month_cos"] = np.cos(2 * np.pi * (ct["month"] - 1) / 12).astype("float32")
    ct["hour_proxy"] = (ct["shift"] * 8 + 4).astype("int8")  # midpoint of shift
    ct["hour_sin"] = np.sin(2 * np.pi * ct["hour_proxy"] / 24).astype("float32")
    ct["hour_cos"] = np.cos(2 * np.pi * ct["hour_proxy"] / 24).astype("float32")

    return ct


def _compute_cell_stats_for_cutoff(cases: pd.DataFrame, cutoff: pd.Timestamp) -> pd.DataFrame:
    """Area stats using only cases strictly before the cutoff date."""
    subset = cases[cases["IncidentFromDate"] < cutoff]
    if len(subset) == 0:
        return pd.DataFrame(columns=["cell_id"])

    cell_stats = subset.groupby("cell_id").agg(
        hist_total=("CaseMasterID", "count"),
        hist_heinous_pct=("GravityOffenceID", lambda x: (x == 1).mean()),
        hist_violent_pct=("CrimeMajorHeadID", lambda x: x.isin(CRIME_GROUPS_VIOLENT).mean()),
        hist_property_pct=("CrimeMajorHeadID", lambda x: x.isin(CRIME_GROUPS_PROPERTY).mean()),
        n_crime_types=("CrimeMajorHeadID", "nunique"),
    ).reset_index()

    crime_counts = subset.groupby("cell_id")["CrimeMajorHeadID"].value_counts()
    crime_probs = crime_counts / crime_counts.groupby(level=0).sum()
    entropy = -(crime_probs * np.log2(crime_probs.clip(lower=1e-10))).groupby(level=0).sum()
    entropy = entropy.reset_index()
    entropy.columns = ["cell_id", "crime_entropy"]

    cell_stats = cell_stats.merge(entropy, on="cell_id", how="left")
    return cell_stats


def compute_area_features(
    cases: pd.DataFrame, cell_time: pd.DataFrame, employees: pd.DataFrame = None
) -> pd.DataFrame:
    """Area-level features per cell, temporally safe (no future leakage)."""
    print("[features] Computing area features (temporally separated) ...")
    ct = cell_time.copy()

    # Assign split before computing area stats to avoid leakage
    ct["_split"] = "train"
    ct.loc[ct["date"] > pd.Timestamp(TRAIN_END), "_split"] = "val"
    ct.loc[ct["date"] > pd.Timestamp(VAL_END), "_split"] = "test"

    cutoffs = {
        "train": pd.Timestamp(TRAIN_END),
        "val":   pd.Timestamp(VAL_END),
        "test":  pd.Timestamp(VAL_END),  # test sees same history as val
    }

    parts = []
    for split_name, cutoff in cutoffs.items():
        mask = ct["_split"] == split_name
        chunk = ct[mask].copy()
        stats = _compute_cell_stats_for_cutoff(cases, cutoff)
        chunk = chunk.merge(stats, on="cell_id", how="left")
        parts.append(chunk)

    ct = pd.concat(parts).sort_values(["cell_id", "date", "shift"]).reset_index(drop=True)
    ct.drop(columns=["_split"], inplace=True)

    if employees is not None and "UnitID" in employees.columns:
        station_officers = employees.groupby("UnitID").size().reset_index(name="n_officers")
        station_cell = cases.drop_duplicates("PoliceStationID")[["PoliceStationID", "cell_id"]]
        station_cell = station_cell.merge(
            station_officers, left_on="PoliceStationID", right_on="UnitID", how="left"
        )
        cell_officers = station_cell.groupby("cell_id")["n_officers"].sum().reset_index()
        ct = ct.merge(cell_officers, on="cell_id", how="left")
        ct["n_officers"] = ct["n_officers"].fillna(0)

    ct = ct.fillna(0)

    return ct


def build_feature_matrix(
    cases: pd.DataFrame,
    active_grid: pd.DataFrame,
    employees: pd.DataFrame = None,
    use_fast_nr: bool = True,
    sample_negatives: float = 0.1,
) -> pd.DataFrame:
    """
    Build the full (cell x date x shift) feature matrix.
    Downsamples negative rows to manage memory.
    """
    print("\n" + "=" * 70)
    print("BUILDING FEATURE MATRIX")
    print("=" * 70)

    cache_path = CACHE_DIR / "feature_matrix.parquet"
    if cache_path.exists():
        print(f"[features] Loading cached feature matrix from {cache_path}")
        return pd.read_parquet(cache_path)

    CACHE_DIR.mkdir(exist_ok=True)

    active_cells = active_grid["cell_id"].unique()
    cases_active = cases[cases["cell_id"].isin(active_cells)].copy()
    print(f"[features] Using {len(active_cells):,} active cells, {len(cases_active):,} cases")

    ct = build_cell_time_index(cases_active)

    if sample_negatives < 1.0:
        pos = ct[ct["has_crime"] == 1]
        neg = ct[ct["has_crime"] == 0].sample(frac=sample_negatives, random_state=42)
        ct = pd.concat([pos, neg]).sort_values(["cell_id", "date", "shift"]).reset_index(drop=True)
        print(f"[features] After negative sampling ({sample_negatives}): {len(ct):,} rows, pos rate: {ct['has_crime'].mean():.4f}")

    ct = compute_temporal_features(ct)
    ct = compute_area_features(cases_active, ct, employees)

    if use_fast_nr:
        ct = compute_near_repeat_features_fast(cases_active, ct, active_grid)
    else:
        ct = compute_near_repeat_features(cases_active, ct, active_grid)

    ct["split"] = "train"
    ct.loc[ct["date"] > pd.Timestamp(TRAIN_END), "split"] = "val"
    ct.loc[ct["date"] > pd.Timestamp(VAL_END), "split"] = "test"
    print(f"[features] Split: {dict(ct['split'].value_counts())}")

    ct.to_parquet(cache_path)
    print(f"[features] Cached to {cache_path}")

    return ct

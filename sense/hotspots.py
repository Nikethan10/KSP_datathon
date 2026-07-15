"""
sense/hotspots.py -- Spatial hotspot detection for PRAHARI crime analytics.

Computes Getis-Ord Gi*, LISA (Local Moran's I), and KDE-based hotspot maps.
Falls back to KDE if libpysal/esda are not installed.
"""

import json
import numpy as np
import pandas as pd
from pathlib import Path

from config import OUTPUT_DIR


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _filter_cases(cases, crime_type=None, district=None, date_range=None):
    """Apply optional filters to cases DataFrame."""
    df = cases.copy()
    if crime_type is not None:
        df = df[df["CrimeMajorHeadID"] == crime_type]
    if district is not None:
        df = df[df["DistrictName"] == district]
    if date_range is not None:
        start, end = date_range
        df = df[(df["IncidentFromDate"] >= start) & (df["IncidentFromDate"] <= end)]
    return df


def _classify_gi(z, p):
    """Classify Gi* z-score and p-value into significance labels."""
    if p <= 0.01:
        return "hot_99" if z > 0 else "cold_99"
    elif p <= 0.05:
        return "hot_95" if z > 0 else "cold_95"
    elif p <= 0.10:
        return "hot_90" if z > 0 else "cold_90"
    else:
        return "not_sig"


# ---------------------------------------------------------------------------
# Core Functions
# ---------------------------------------------------------------------------

def compute_gi_star(cases, grid, crime_type=None, district=None, date_range=None):
    """
    Compute Getis-Ord Gi* statistic per grid cell.

    Returns DataFrame with: cell_id, cell_lat, cell_lon, case_count,
    gi_zscore, gi_pvalue, significance.
    """
    filtered = _filter_cases(cases, crime_type, district, date_range)

    # Aggregate counts per cell
    counts = filtered.groupby("cell_id").size().reset_index(name="case_count")
    merged = grid[["cell_id", "cell_lat", "cell_lon"]].merge(counts, on="cell_id", how="inner")

    if len(merged) < 3:
        print("[hotspots] Too few cells with cases for Gi* -- returning empty")
        return pd.DataFrame(
            columns=["cell_id", "cell_lat", "cell_lon", "case_count",
                      "gi_zscore", "gi_pvalue", "significance"]
        )

    try:
        from libpysal.weights import KNN
        from esda import G_Local

        coords = merged[["cell_lat", "cell_lon"]].values
        k = min(8, len(merged) - 1)
        w = KNN.from_array(coords, k=k)
        w.transform = "R"

        y = merged["case_count"].values.astype(float)
        gi = G_Local(y, w, star=True, permutations=999)

        merged = merged.copy()
        merged["gi_zscore"] = gi.Zs
        merged["gi_pvalue"] = gi.p_sim
        merged["significance"] = [
            _classify_gi(z, p) for z, p in zip(gi.Zs, gi.p_sim)
        ]

    except ImportError:
        print("[hotspots] libpysal/esda not available -- falling back to KDE proxy")
        kde_df = compute_kde_fallback(filtered)
        merged = merged.merge(
            kde_df[["cell_id", "kde_density"]], on="cell_id", how="left"
        )
        merged["kde_density"] = merged["kde_density"].fillna(0)

        # Convert KDE density to z-scores as proxy
        mean_d = merged["kde_density"].mean()
        std_d = merged["kde_density"].std()
        if std_d > 0:
            merged["gi_zscore"] = (merged["kde_density"] - mean_d) / std_d
        else:
            merged["gi_zscore"] = 0.0
        merged["gi_pvalue"] = np.nan
        merged["significance"] = merged["gi_zscore"].apply(
            lambda z: "hot_99" if z > 2.576
            else "hot_95" if z > 1.96
            else "hot_90" if z > 1.645
            else "cold_90" if z < -1.645
            else "cold_95" if z < -1.96
            else "cold_99" if z < -2.576
            else "not_sig"
        )
        merged.drop(columns=["kde_density"], inplace=True, errors="ignore")

    except Exception as e:
        print(f"[hotspots] Gi* computation failed: {e} -- falling back to KDE proxy")
        kde_df = compute_kde_fallback(filtered)
        merged = merged.merge(
            kde_df[["cell_id", "kde_density"]], on="cell_id", how="left"
        )
        merged["kde_density"] = merged["kde_density"].fillna(0)
        mean_d = merged["kde_density"].mean()
        std_d = merged["kde_density"].std()
        if std_d > 0:
            merged["gi_zscore"] = (merged["kde_density"] - mean_d) / std_d
        else:
            merged["gi_zscore"] = 0.0
        merged["gi_pvalue"] = np.nan
        merged["significance"] = merged["gi_zscore"].apply(
            lambda z: "hot_99" if z > 2.576
            else "hot_95" if z > 1.96
            else "hot_90" if z > 1.645
            else "cold_90" if z < -1.645
            else "cold_95" if z < -1.96
            else "cold_99" if z < -2.576
            else "not_sig"
        )
        merged.drop(columns=["kde_density"], inplace=True, errors="ignore")

    result = merged[["cell_id", "cell_lat", "cell_lon", "case_count",
                      "gi_zscore", "gi_pvalue", "significance"]].copy()
    return result


def compute_lisa(cases, grid, crime_type=None, district=None):
    """
    Compute Local Indicators of Spatial Association (LISA / Local Moran's I).

    Returns DataFrame with: cell_id, cell_lat, cell_lon, case_count,
    lisa_i, lisa_p, quadrant (HH/HL/LH/LL/ns).
    """
    filtered = _filter_cases(cases, crime_type, district)

    counts = filtered.groupby("cell_id").size().reset_index(name="case_count")
    merged = grid[["cell_id", "cell_lat", "cell_lon"]].merge(counts, on="cell_id", how="inner")

    if len(merged) < 3:
        print("[hotspots] Too few cells for LISA -- returning empty")
        return pd.DataFrame(
            columns=["cell_id", "cell_lat", "cell_lon", "case_count",
                      "lisa_i", "lisa_p", "quadrant"]
        )

    try:
        from libpysal.weights import KNN
        from esda import Moran_Local

        coords = merged[["cell_lat", "cell_lon"]].values
        k = min(8, len(merged) - 1)
        w = KNN.from_array(coords, k=k)
        w.transform = "R"

        y = merged["case_count"].values.astype(float)
        lisa = Moran_Local(y, w, permutations=999)

        quad_map = {1: "HH", 2: "LH", 3: "LL", 4: "HL"}
        merged = merged.copy()
        merged["lisa_i"] = lisa.Is
        merged["lisa_p"] = lisa.p_sim
        merged["quadrant"] = [
            quad_map.get(q, "ns") if p <= 0.05 else "ns"
            for q, p in zip(lisa.q, lisa.p_sim)
        ]

    except ImportError:
        print("[hotspots] libpysal/esda not available -- LISA skipped, returning empty")
        return pd.DataFrame(
            columns=["cell_id", "cell_lat", "cell_lon", "case_count",
                      "lisa_i", "lisa_p", "quadrant"]
        )
    except Exception as e:
        print(f"[hotspots] LISA computation failed: {e}")
        return pd.DataFrame(
            columns=["cell_id", "cell_lat", "cell_lon", "case_count",
                      "lisa_i", "lisa_p", "quadrant"]
        )

    result = merged[["cell_id", "cell_lat", "cell_lon", "case_count",
                      "lisa_i", "lisa_p", "quadrant"]].copy()
    return result


def compute_kde_fallback(cases, bandwidth=0.02):
    """
    KDE-based density estimation on case lat/lon, evaluated at grid centroids.

    Returns DataFrame with: cell_id, cell_lat, cell_lon, kde_density.
    """
    from sklearn.neighbors import KernelDensity
    from data.grid import build_grid

    grid = build_grid()
    coords = cases[["latitude", "longitude"]].dropna().values

    if len(coords) < 2:
        print("[hotspots] Too few cases for KDE")
        grid["kde_density"] = 0.0
        return grid[["cell_id", "cell_lat", "cell_lon", "kde_density"]]

    kde = KernelDensity(bandwidth=bandwidth, kernel="gaussian", metric="haversine")
    # KernelDensity with haversine expects radians
    kde.fit(np.radians(coords))

    grid_coords = np.radians(grid[["cell_lat", "cell_lon"]].values)
    log_density = kde.score_samples(grid_coords)
    grid = grid.copy()
    grid["kde_density"] = np.exp(log_density)

    return grid[["cell_id", "cell_lat", "cell_lon", "kde_density"]]


def export_hotspots_geojson(hotspot_df, output_path):
    """
    Convert a hotspot DataFrame to GeoJSON FeatureCollection and save.

    Each cell becomes a Point feature with all columns as properties.
    """
    features = []
    for _, row in hotspot_df.iterrows():
        props = {}
        for col in hotspot_df.columns:
            if col in ("cell_lat", "cell_lon"):
                continue
            val = row[col]
            # Convert numpy types to native Python for JSON serialization
            if isinstance(val, (np.integer,)):
                val = int(val)
            elif isinstance(val, (np.floating,)):
                val = float(val) if not np.isnan(val) else None
            props[col] = val

        feature = {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [float(row["cell_lon"]), float(row["cell_lat"])],
            },
            "properties": props,
        }
        features.append(feature)

    geojson = {"type": "FeatureCollection", "features": features}

    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    # compact separators: these files ship to the browser, size matters
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(geojson, f, separators=(",", ":"))
    print(f"[hotspots] Exported {len(features)} features to {output_path}")


# Non-territorial units whose "district" cells are scattered statewide —
# a within-district spatial statistic is meaningless for them.
NON_GEO_DISTRICTS = {"CID", "COASTAL SECURITY POLICE", "KARNATAKA RAILWAYS", "ISD BENGALURU"}


def compute_gi_star_local(cases, grid, crime_type=None, min_cells=15):
    """
    District-normalized Gi*: the statistic is computed within each district
    separately, so every cell is compared against its own district's baseline
    rather than the statewide mean. This surfaces local hotspots in low-volume
    districts that the state view (dominated by Bengaluru) hides.
    """
    filtered = _filter_cases(cases, crime_type)

    parts = []
    for district in sorted(filtered["DistrictName"].dropna().unique()):
        if district in NON_GEO_DISTRICTS:
            continue
        sub = filtered[filtered["DistrictName"] == district]
        if sub["cell_id"].nunique() < min_cells:
            continue
        gi = compute_gi_star(sub, grid)
        if len(gi) == 0:
            continue
        gi = gi.copy()
        gi["district"] = district
        parts.append(gi)

    if not parts:
        return pd.DataFrame(
            columns=["cell_id", "cell_lat", "cell_lon", "case_count",
                      "gi_zscore", "gi_pvalue", "significance", "district"]
        )
    return pd.concat(parts, ignore_index=True)


def run_sense_hotspots_local(cases, grid, output_dir=None):
    """
    Orchestrator for the district-normalized view: Gi* within each district,
    for overall + every crime type. Mirrors run_sense_hotspots file naming
    with a `hotspots_local_` prefix.
    """
    if output_dir is None:
        output_dir = OUTPUT_DIR / "sense"
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    summary = {}

    print("[hotspots-local] Computing district-normalized Gi* (overall) ...")
    gi_all = compute_gi_star_local(cases, grid)
    export_hotspots_geojson(gi_all, output_dir / "hotspots_local_overall.geojson")
    summary["overall"] = dict(gi_all["significance"].value_counts()) if len(gi_all) else {}

    crime_types = cases["CrimeMajorHeadID"].dropna().unique()
    for ct in sorted(crime_types):
        subset = cases[cases["CrimeMajorHeadID"] == ct]
        label = str(subset["crime_type"].iloc[0]) if len(subset) else f"type_{ct}"
        safe_label = label.replace(" ", "_").replace("/", "_")
        print(f"[hotspots-local] {label} (id={ct}) ...")
        gi_ct = compute_gi_star_local(cases, grid, crime_type=ct)
        if len(gi_ct) > 0:
            export_hotspots_geojson(
                gi_ct, output_dir / f"hotspots_local_{safe_label}.geojson"
            )
            summary[label] = dict(gi_ct["significance"].value_counts())

    with open(output_dir / "hotspots_local_summary.json", "w", encoding="utf-8") as f:
        json.dump({k: {sk: int(sv) for sk, sv in v.items()} for k, v in summary.items()}, f, indent=2)
    print(f"[hotspots-local] Summary saved")
    return summary


def run_sense_hotspots(cases, grid, output_dir=None):
    """
    Orchestrator: run Gi* for all crime types + overall, export GeoJSON.
    """
    if output_dir is None:
        output_dir = OUTPUT_DIR / "sense"
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    results = {}

    # Overall hotspots
    print("[hotspots] Computing overall Gi* ...")
    gi_all = compute_gi_star(cases, grid)
    results["overall"] = gi_all
    export_hotspots_geojson(gi_all, output_dir / "hotspots_overall.geojson")

    # Per crime type
    crime_types = cases["CrimeMajorHeadID"].dropna().unique()
    crime_type_names = {}
    if "crime_type" in cases.columns:
        for ct in crime_types:
            subset = cases[cases["CrimeMajorHeadID"] == ct]
            if len(subset) > 0 and "crime_type" in subset.columns:
                name = subset["crime_type"].iloc[0]
                if pd.notna(name):
                    crime_type_names[ct] = str(name)

    for ct in sorted(crime_types):
        label = crime_type_names.get(ct, f"type_{ct}")
        safe_label = label.replace(" ", "_").replace("/", "_")
        print(f"[hotspots] Computing Gi* for {label} (id={ct}) ...")
        gi_ct = compute_gi_star(cases, grid, crime_type=ct)
        results[label] = gi_ct
        if len(gi_ct) > 0:
            export_hotspots_geojson(
                gi_ct, output_dir / f"hotspots_{safe_label}.geojson"
            )

    # Summary JSON
    summary = {}
    for key, df in results.items():
        if len(df) == 0:
            summary[key] = {"total_cells": 0, "hot_99": 0, "hot_95": 0, "hot_90": 0}
            continue
        sig_counts = df["significance"].value_counts().to_dict()
        summary[key] = {
            "total_cells": len(df),
            "hot_99": sig_counts.get("hot_99", 0),
            "hot_95": sig_counts.get("hot_95", 0),
            "hot_90": sig_counts.get("hot_90", 0),
            "cold_99": sig_counts.get("cold_99", 0),
            "cold_95": sig_counts.get("cold_95", 0),
            "cold_90": sig_counts.get("cold_90", 0),
            "not_sig": sig_counts.get("not_sig", 0),
        }

    with open(output_dir / "hotspots_summary.json", "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)
    print(f"[hotspots] Summary saved to {output_dir / 'hotspots_summary.json'}")

    return results

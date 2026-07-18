"""Novelty analytics for PRAHARI.

Three analyses no standard crime dashboard ships:

1. Emerging hotspot lifecycle — Mann-Kendall trend per cell over the last 24
   months classifies hot cells as NEW / INTENSIFYING / PERSISTENT / COOLING.
   "Where crime is about to be", not just where it was.
2. Crime spree chains — spatio-temporal linkage: cases of the same specific
   offence subtype within 1 km and 7 days of each other are chained; connected
   chains of 4+ cases are flagged as suspected sprees (near-repeat theory).
3. Offender mobility corridors — OffenderID tracked across districts reveals
   criminals operating in multiple jurisdictions and the district-pair
   corridors they travel.

Run after main.py. Outputs feed the frontend via copy_data.py.
"""
import sys, os, json
sys.path.insert(0, os.path.dirname(__file__))

import numpy as np
import pandas as pd
from scipy.stats import kendalltau
from sklearn.neighbors import BallTree
from config import OUTPUT_DIR
from data.loader import load_enriched_cases, load_accused
from data.grid import build_grid, assign_cases_to_grid

EARTH_RADIUS_KM = 6371.0
NON_GEO_DISTRICTS = {"CID", "COASTAL SECURITY POLICE", "KARNATAKA RAILWAYS", "ISD BENGALURU"}

# ── Emerging hotspots ─────────────────────────────────────────────────
EMERGING_WINDOW_MONTHS = 24
EMERGING_RECENT_MONTHS = 3
EMERGING_MIN_CASES = 12          # min cases in window for a cell to be assessed
TREND_P = 0.05

# ── Crime sprees ──────────────────────────────────────────────────────
SPREE_WINDOW_DAYS = 180
SPREE_RADIUS_KM = 1.0
SPREE_MAX_GAP_DAYS = 7
SPREE_MIN_CASES = 4
SPREE_MAX_CASES = 20             # bigger components are area effects, not sprees
SPREE_TOP_N = 25

# ── Corridors ─────────────────────────────────────────────────────────
CORRIDOR_TOP_N = 40
MOBILE_OFFENDER_TOP_N = 10


def run_emerging_hotspots(cases: pd.DataFrame) -> dict:
    print("\n" + "=" * 60)
    print("1/3  EMERGING HOTSPOT LIFECYCLE")
    print("=" * 60)

    max_date = cases["IncidentFromDate"].max().normalize()
    window_start = max_date - pd.DateOffset(months=EMERGING_WINDOW_MONTHS)
    win = cases[cases["IncidentFromDate"] >= window_start].copy()
    print(f"  window: {window_start.date()} to {max_date.date()} ({len(win):,} cases)")

    win["ym"] = win["IncidentFromDate"].dt.to_period("M")
    monthly = win.groupby(["cell_id", "ym"]).size().reset_index(name="n")

    totals = monthly.groupby("cell_id")["n"].sum()
    keep = totals[totals >= EMERGING_MIN_CASES].index
    monthly = monthly[monthly["cell_id"].isin(keep)]
    print(f"  cells assessed: {len(keep):,} (>= {EMERGING_MIN_CASES} cases in window)")

    all_months = pd.period_range(window_start, max_date, freq="M")
    month_idx = {m: i for i, m in enumerate(all_months)}
    n_months = len(all_months)
    recent_cut = n_months - EMERGING_RECENT_MONTHS  # last N whole months are "recent"

    cell_coords = win.groupby("cell_id")[["latitude", "longitude"]].mean()
    cell_district = win.groupby("cell_id")["DistrictName"].agg(
        lambda x: x.mode().iloc[0] if len(x.mode()) else None
    )

    results = []
    for cell_id, grp in monthly.groupby("cell_id"):
        series = np.zeros(n_months)
        for _, row in grp.iterrows():
            if row["ym"] in month_idx:
                series[month_idx[row["ym"]]] = row["n"]

        hist, recent = series[:recent_cut], series[recent_cut:]
        hist_mean, recent_mean = hist.mean(), recent.mean()
        tau, p = kendalltau(np.arange(n_months), series)
        if np.isnan(tau):
            continue

        if hist_mean <= 0.5 and recent_mean >= 2:
            category = "new"
        elif tau > 0 and p < TREND_P:
            category = "intensifying"
        elif tau < 0 and p < TREND_P:
            category = "cooling"
        else:
            category = "persistent"

        results.append({
            "cell_id": int(cell_id),
            "lat": round(float(cell_coords.loc[cell_id, "latitude"]), 5),
            "lon": round(float(cell_coords.loc[cell_id, "longitude"]), 5),
            "district": cell_district.get(cell_id),
            "category": category,
            "tau": round(float(tau), 3),
            "p": round(float(p), 4),
            "recent_monthly": round(float(recent_mean), 1),
            "hist_monthly": round(float(hist_mean), 1),
            "total_cases": int(series.sum()),
        })

    counts = pd.Series([r["category"] for r in results]).value_counts().to_dict()
    print(f"  lifecycle: {counts}")

    out = {
        "summary": {
            "window_start": str(window_start.date()),
            "window_end": str(max_date.date()),
            "cells_assessed": len(results),
            "counts": counts,
            "method": "Mann-Kendall trend test on 24 monthly counts per cell; "
                      "NEW = quiet history + active last 3 months; "
                      "INTENSIFYING/COOLING = significant trend (p<0.05); "
                      "PERSISTENT = stable activity.",
        },
        "cells": results,
    }
    path = OUTPUT_DIR / "sense" / "emerging_hotspots.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(out, f, separators=(",", ":"))
    print(f"  saved {path}")
    return out["summary"]


def run_crime_sprees(cases: pd.DataFrame) -> dict:
    print("\n" + "=" * 60)
    print("2/3  CRIME SPREE CHAINS (near-repeat linkage)")
    print("=" * 60)

    max_date = cases["IncidentFromDate"].max()
    win = cases[cases["IncidentFromDate"] >= max_date - pd.Timedelta(days=SPREE_WINDOW_DAYS)].copy()
    win = win.dropna(subset=["latitude", "longitude"])
    print(f"  window: last {SPREE_WINDOW_DAYS} days ({len(win):,} cases)")

    sprees = []
    # Same specific offence subtype = MO proxy; chain within 1 km and 7 days.
    for (major, minor), grp in win.groupby(["CrimeMajorHeadID", "CrimeMinorHeadID"]):
        if len(grp) < SPREE_MIN_CASES:
            continue
        grp = grp.sort_values("IncidentFromDate").reset_index(drop=True)
        coords = np.radians(grp[["latitude", "longitude"]].values)
        tree = BallTree(coords, metric="haversine")
        pairs = tree.query_radius(coords, r=SPREE_RADIUS_KM / EARTH_RADIUS_KM)

        # union-find over time-constrained neighbour pairs
        parent = list(range(len(grp)))

        def find(x):
            while parent[x] != x:
                parent[x] = parent[parent[x]]
                x = parent[x]
            return x

        times = grp["IncidentFromDate"].values.astype("datetime64[s]")
        max_gap = np.timedelta64(SPREE_MAX_GAP_DAYS, "D")
        for i, neighbours in enumerate(pairs):
            for j in neighbours:
                if j <= i:
                    continue
                if abs(times[j] - times[i]) <= max_gap:
                    ri, rj = find(i), find(j)
                    if ri != rj:
                        parent[ri] = rj

        comp = {}
        for i in range(len(grp)):
            comp.setdefault(find(i), []).append(i)

        for members in comp.values():
            if not (SPREE_MIN_CASES <= len(members) <= SPREE_MAX_CASES):
                continue
            sub = grp.iloc[members].sort_values("IncidentFromDate")
            span = (sub["IncidentFromDate"].max() - sub["IncidentFromDate"].min()).days
            sprees.append({
                "crime_type": str(sub["crime_type"].iloc[0]),
                "minor_head": int(minor),
                "district": str(sub["DistrictName"].mode().iloc[0]),
                "n_cases": len(sub),
                "start_date": str(sub["IncidentFromDate"].min().date()),
                "end_date": str(sub["IncidentFromDate"].max().date()),
                "span_days": int(span),
                "center_lat": round(float(sub["latitude"].mean()), 5),
                "center_lon": round(float(sub["longitude"].mean()), 5),
                "points": [
                    {
                        "lat": round(float(r["latitude"]), 5),
                        "lon": round(float(r["longitude"]), 5),
                        "date": str(r["IncidentFromDate"].date()),
                    }
                    for _, r in sub.iterrows()
                ],
            })

    # densest sprees first: most cases in fewest days
    sprees.sort(key=lambda s: (-s["n_cases"], s["span_days"]))
    sprees = sprees[:SPREE_TOP_N]
    for i, s in enumerate(sprees):
        s["spree_id"] = i + 1
    print(f"  sprees found: {len(sprees)}")

    out = {
        "summary": {
            "window_days": SPREE_WINDOW_DAYS,
            "n_sprees": len(sprees),
            "method": f"Cases of the same offence subtype within {SPREE_RADIUS_KM} km and "
                      f"{SPREE_MAX_GAP_DAYS} days are chained (near-repeat linkage); "
                      f"chains of {SPREE_MIN_CASES}+ cases flagged as suspected sprees.",
        },
        "sprees": sprees,
    }
    path = OUTPUT_DIR / "predict" / "crime_sprees.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(out, f, separators=(",", ":"))
    print(f"  saved {path}")
    return out["summary"]


def run_offender_corridors(cases: pd.DataFrame, accused: pd.DataFrame) -> dict:
    print("\n" + "=" * 60)
    print("3/3  OFFENDER MOBILITY CORRIDORS")
    print("=" * 60)

    geo = cases[~cases["DistrictName"].isin(NON_GEO_DISTRICTS)]
    ac = accused[["CaseMasterID", "OffenderID", "AccusedName"]].merge(
        geo[["CaseMasterID", "DistrictName", "IncidentFromDate"]],
        on="CaseMasterID", how="inner",
    )
    n_offenders = ac["OffenderID"].nunique()

    per_off = ac.groupby("OffenderID")["DistrictName"].nunique()
    mobile_ids = per_off[per_off >= 2].index
    print(f"  offenders: {n_offenders:,} total, {len(mobile_ids):,} multi-district "
          f"({len(mobile_ids) / n_offenders * 100:.1f}%)")

    mob = ac[ac["OffenderID"].isin(mobile_ids)].sort_values(["OffenderID", "IncidentFromDate"])

    # consecutive-case district transitions per offender
    mob["prev_district"] = mob.groupby("OffenderID")["DistrictName"].shift()
    trans = mob[(mob["prev_district"].notna()) & (mob["prev_district"] != mob["DistrictName"])]

    # aggregate on unordered district pair
    pair = pd.DataFrame({
        "a": np.minimum(trans["prev_district"], trans["DistrictName"]),
        "b": np.maximum(trans["prev_district"], trans["DistrictName"]),
        "OffenderID": trans["OffenderID"],
    })
    flows = pair.groupby(["a", "b"]).agg(
        n_transitions=("OffenderID", "count"),
        n_offenders=("OffenderID", "nunique"),
    ).reset_index().sort_values("n_offenders", ascending=False)

    centroids = geo.groupby("DistrictName")[["latitude", "longitude"]].mean()

    corridors = []
    for _, row in flows.head(CORRIDOR_TOP_N).iterrows():
        if row["a"] not in centroids.index or row["b"] not in centroids.index:
            continue
        corridors.append({
            "from_district": row["a"],
            "to_district": row["b"],
            "from_lat": round(float(centroids.loc[row["a"], "latitude"]), 5),
            "from_lon": round(float(centroids.loc[row["a"], "longitude"]), 5),
            "to_lat": round(float(centroids.loc[row["b"], "latitude"]), 5),
            "to_lon": round(float(centroids.loc[row["b"], "longitude"]), 5),
            "n_offenders": int(row["n_offenders"]),
            "n_transitions": int(row["n_transitions"]),
        })

    top_mobile = (
        ac[ac["OffenderID"].isin(mobile_ids)]
        .groupby("OffenderID")
        .agg(
            name=("AccusedName", "first"),
            n_districts=("DistrictName", "nunique"),
            n_cases=("CaseMasterID", "nunique"),
        )
        .sort_values(["n_districts", "n_cases"], ascending=False)
        .head(MOBILE_OFFENDER_TOP_N)
        .reset_index()
    )
    top_offenders = [
        {
            "offender_id": str(r["OffenderID"]),
            "name": str(r["name"]),
            "n_districts": int(r["n_districts"]),
            "n_cases": int(r["n_cases"]),
        }
        for _, r in top_mobile.iterrows()
    ]

    out = {
        "summary": {
            "total_offenders": int(n_offenders),
            "multi_district_offenders": int(len(mobile_ids)),
            "multi_district_pct": round(len(mobile_ids) / n_offenders * 100, 1),
            "n_corridors": len(corridors),
            "method": "OffenderID tracked across cases; consecutive cases in different "
                      "districts count as one transition on that district-pair corridor.",
        },
        "corridors": corridors,
        "top_offenders": top_offenders,
    }
    path = OUTPUT_DIR / "predict" / "offender_corridors.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(out, f, separators=(",", ":"))
    print(f"  saved {path}")
    return out["summary"]


if __name__ == "__main__":
    cases = load_enriched_cases()
    grid = build_grid()
    cases = assign_cases_to_grid(cases, grid)
    accused = load_accused()

    s1 = run_emerging_hotspots(cases)
    s2 = run_crime_sprees(cases)
    s3 = run_offender_corridors(cases, accused)

    print("\nAll novelty analytics complete.")
    print(json.dumps({"emerging": s1, "sprees": s2, "corridors": s3}, indent=2))

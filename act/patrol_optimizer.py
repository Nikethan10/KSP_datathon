import json
import numpy as np
import pandas as pd
from pathlib import Path
from config import DEFAULT_NUM_PATROLS, PATROL_RADIUS_KM, OUTPUT_DIR

EARTH_RADIUS_KM = 6371.0


def _haversine_km(lat1, lon1, lat2, lon2):
    lat1, lon1, lat2, lon2 = map(np.radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = np.sin(dlat / 2) ** 2 + np.cos(lat1) * np.cos(lat2) * np.sin(dlon / 2) ** 2
    return 2 * EARTH_RADIUS_KM * np.arcsin(np.sqrt(a))


def optimize_patrol_greedy(
    risk_map: pd.DataFrame,
    n_patrols: int = DEFAULT_NUM_PATROLS,
    patrol_radius_km: float = PATROL_RADIUS_KM,
) -> dict:
    """
    Greedy maximal-coverage patrol allocation.
    Each patrol covers all cells within patrol_radius_km of its assigned seed cell.
    Submodular greedy gives (1 - 1/e) ~ 63% of optimal.
    """
    print(f"\n[patrol] Greedy optimizer: {n_patrols} patrols, {patrol_radius_km}km radius ...")

    rm = risk_map.copy()
    if "mean_risk" not in rm.columns:
        if "risk_score" in rm.columns:
            rm["mean_risk"] = rm["risk_score"]
        elif "fallback_risk" in rm.columns:
            rm["mean_risk"] = rm["fallback_risk"]
        else:
            raise ValueError("risk_map must have mean_risk, risk_score, or fallback_risk column")

    rm = rm.sort_values("mean_risk", ascending=False).reset_index(drop=True)
    total_risk = rm["mean_risk"].sum()

    covered = set()
    allocations = []

    lats = rm["cell_lat"].values
    lons = rm["cell_lon"].values
    risks = rm["mean_risk"].values
    cell_ids = rm["cell_id"].values

    for patrol_idx in range(n_patrols):
        best_seed = None
        best_coverage = 0
        best_cells = []

        for i in range(len(rm)):
            if cell_ids[i] in covered:
                continue

            dists = _haversine_km(lats[i], lons[i], lats, lons)
            nearby = np.where(dists <= patrol_radius_km)[0]
            uncovered_nearby = [j for j in nearby if cell_ids[j] not in covered]
            coverage = sum(risks[j] for j in uncovered_nearby)

            if coverage > best_coverage:
                best_seed = i
                best_coverage = coverage
                best_cells = uncovered_nearby

            if i >= 200 and best_seed is not None:
                break

        if best_seed is None:
            break

        covered_ids = [cell_ids[j] for j in best_cells]
        covered.update(covered_ids)

        allocations.append({
            "patrol_id": patrol_idx + 1,
            "seed_cell_id": int(cell_ids[best_seed]),
            "center_lat": float(lats[best_seed]),
            "center_lon": float(lons[best_seed]),
            "cells_covered": len(covered_ids),
            "risk_covered": float(best_coverage),
            "cell_ids": [int(c) for c in covered_ids],
        })

    total_covered_risk = sum(a["risk_covered"] for a in allocations)
    total_cells_covered = len(covered)

    return {
        "allocations": allocations,
        "total_risk_covered": float(total_covered_risk),
        "total_risk": float(total_risk),
        "coverage_pct": round(100 * float(total_covered_risk) / float(total_risk), 2) if total_risk > 0 else 0,
        "cells_covered": total_cells_covered,
        "total_cells": len(rm),
    }


def compute_baseline_coverage(
    risk_map: pd.DataFrame,
    n_patrols: int = DEFAULT_NUM_PATROLS,
    patrol_radius_km: float = PATROL_RADIUS_KM,
) -> float:
    """
    Baseline: uniform/random deployment — pick n_patrols random seed cells.
    Average over multiple random trials.
    """
    rm = risk_map.copy()
    if "mean_risk" not in rm.columns:
        rm["mean_risk"] = rm.get("risk_score", rm.get("fallback_risk", 0))

    total_risk = rm["mean_risk"].sum()
    lats = rm["cell_lat"].values
    lons = rm["cell_lon"].values
    risks = rm["mean_risk"].values
    cell_ids = rm["cell_id"].values

    trial_coverages = []
    rng = np.random.RandomState(42)

    for _ in range(20):
        seeds = rng.choice(len(rm), size=min(n_patrols, len(rm)), replace=False)
        covered = set()
        cov_risk = 0

        for s in seeds:
            dists = _haversine_km(lats[s], lons[s], lats, lons)
            nearby = np.where(dists <= patrol_radius_km)[0]
            for j in nearby:
                if cell_ids[j] not in covered:
                    covered.add(cell_ids[j])
                    cov_risk += risks[j]

        trial_coverages.append(cov_risk / total_risk * 100 if total_risk > 0 else 0)

    return float(np.mean(trial_coverages))


def compute_statusquo_coverage(
    risk_map: pd.DataFrame,
    cases: pd.DataFrame,
    n_patrols: int = DEFAULT_NUM_PATROLS,
    patrol_radius_km: float = PATROL_RADIUS_KM,
) -> float:
    """
    Status-quo baseline: patrols placed at the highest historical-volume cells
    (volume-driven deployment — the realistic proxy for current practice),
    spaced at least one patrol radius apart. Coverage measured on predicted risk.
    """
    rm = risk_map.copy()
    if "mean_risk" not in rm.columns:
        rm["mean_risk"] = rm.get("risk_score", rm.get("fallback_risk", 0))

    hist = cases.groupby("cell_id").size().reset_index(name="hist_count")
    rm = rm.merge(hist, on="cell_id", how="left")
    rm["hist_count"] = rm["hist_count"].fillna(0)

    total_risk = rm["mean_risk"].sum()
    lats = rm["cell_lat"].values
    lons = rm["cell_lon"].values
    risks = rm["mean_risk"].values
    order = np.argsort(-rm["hist_count"].values)

    seeds = []
    for i in order:
        if len(seeds) >= n_patrols:
            break
        if all(_haversine_km(lats[i], lons[i], lats[s], lons[s]) > patrol_radius_km for s in seeds):
            seeds.append(i)

    covered = np.zeros(len(rm), dtype=bool)
    for s in seeds:
        dists = _haversine_km(lats[s], lons[s], lats, lons)
        covered |= dists <= patrol_radius_km

    return float(risks[covered].sum() / total_risk * 100) if total_risk > 0 else 0.0


def compute_coverage_uplift(optimized_coverage_pct: float, baseline_coverage_pct: float) -> float:
    if baseline_coverage_pct <= 0:
        return 0.0
    return round((optimized_coverage_pct - baseline_coverage_pct) / baseline_coverage_pct * 100, 1)


def generate_briefing_sheet(allocations: list, cases: pd.DataFrame, risk_map: pd.DataFrame) -> list:
    """Generate per-patrol briefing with recent incidents and risk context."""
    briefings = []
    recent_cutoff = cases["IncidentFromDate"].max() - pd.Timedelta(days=30)

    for alloc in allocations:
        patrol_cells = set(alloc["cell_ids"])
        patrol_cases = cases[
            (cases["cell_id"].isin(patrol_cells))
            & (cases["IncidentFromDate"] >= recent_cutoff)
        ]

        crime_mix = {}
        if "crime_type" in patrol_cases.columns:
            crime_mix = dict(patrol_cases["crime_type"].value_counts().head(5))

        gravity_mix = {}
        if "gravity_label" in patrol_cases.columns:
            gravity_mix = dict(patrol_cases["gravity_label"].value_counts())

        briefings.append({
            "patrol_id": alloc["patrol_id"],
            "center_lat": alloc["center_lat"],
            "center_lon": alloc["center_lon"],
            "risk_covered": alloc["risk_covered"],
            "cells_covered": alloc["cells_covered"],
            "recent_incidents_30d": len(patrol_cases),
            "top_crime_types": {k: int(v) for k, v in crime_mix.items()},
            "gravity_breakdown": {k: int(v) for k, v in gravity_mix.items()},
            "description": (
                f"Patrol {alloc['patrol_id']}: Deploy to ({alloc['center_lat']:.4f}, {alloc['center_lon']:.4f}). "
                f"Covers {alloc['cells_covered']} cells with {len(patrol_cases)} recent incidents. "
                f"Primary concern: {list(crime_mix.keys())[0] if crime_mix else 'General'}."
            ),
        })

    return briefings


def try_ilp_optimizer(
    risk_map: pd.DataFrame,
    n_patrols: int = DEFAULT_NUM_PATROLS,
    patrol_radius_km: float = PATROL_RADIUS_KM,
) -> dict:
    """
    Integer Linear Program for maximal coverage using PuLP.
    Falls back to greedy if PuLP/OR-Tools not available.
    """
    try:
        import pulp
    except ImportError:
        print("[patrol] PuLP not installed, using greedy fallback")
        return optimize_patrol_greedy(risk_map, n_patrols, patrol_radius_km)

    print(f"\n[patrol] ILP optimizer: {n_patrols} patrols, {patrol_radius_km}km radius ...")

    rm = risk_map.copy()
    if "mean_risk" not in rm.columns:
        rm["mean_risk"] = rm.get("risk_score", rm.get("fallback_risk", 0))

    rm = rm.nlargest(2000, "mean_risk").reset_index(drop=True)

    n = len(rm)
    lats = rm["cell_lat"].values
    lons = rm["cell_lon"].values
    risks = rm["mean_risk"].values
    cell_ids = rm["cell_id"].values

    coverage_matrix = np.zeros((n, n), dtype=bool)
    for i in range(n):
        dists = _haversine_km(lats[i], lons[i], lats, lons)
        coverage_matrix[i] = dists <= patrol_radius_km

    prob = pulp.LpProblem("PatrolCoverage", pulp.LpMaximize)

    y = [pulp.LpVariable(f"y_{i}", cat="Binary") for i in range(n)]  # facility open
    x = [pulp.LpVariable(f"x_{j}", cat="Binary") for j in range(n)]  # demand covered

    prob += pulp.lpSum(risks[j] * x[j] for j in range(n))

    prob += pulp.lpSum(y[i] for i in range(n)) <= n_patrols

    for j in range(n):
        covering = [i for i in range(n) if coverage_matrix[i, j]]
        prob += x[j] <= pulp.lpSum(y[i] for i in covering)

    prob.solve(pulp.PULP_CBC_CMD(msg=0, timeLimit=60))

    if prob.status != 1:
        print("  ILP did not find optimal, falling back to greedy")
        return optimize_patrol_greedy(risk_map, n_patrols, patrol_radius_km)

    open_facilities = [i for i in range(n) if y[i].value() > 0.5]
    covered_set = set()
    allocations = []

    for idx, fac in enumerate(open_facilities):
        covered_cells = [j for j in range(n) if coverage_matrix[fac, j]]
        new_covered = [j for j in covered_cells if cell_ids[j] not in covered_set]
        cov_risk = sum(risks[j] for j in new_covered)
        cov_ids = [int(cell_ids[j]) for j in new_covered]
        covered_set.update(cov_ids)

        allocations.append({
            "patrol_id": idx + 1,
            "seed_cell_id": int(cell_ids[fac]),
            "center_lat": float(lats[fac]),
            "center_lon": float(lons[fac]),
            "cells_covered": len(cov_ids),
            "risk_covered": float(cov_risk),
            "cell_ids": cov_ids,
        })

    total_covered = sum(a["risk_covered"] for a in allocations)
    total_risk = risks.sum()

    return {
        "allocations": allocations,
        "total_risk_covered": float(total_covered),
        "total_risk": float(total_risk),
        "coverage_pct": round(100 * float(total_covered) / float(total_risk), 2) if total_risk > 0 else 0,
        "cells_covered": len(covered_set),
        "total_cells": n,
        "method": "ILP",
    }


def run_patrol_optimizer(
    risk_map: pd.DataFrame,
    cases: pd.DataFrame,
    output_dir: Path = None,
    district: str = "BENGALURU CITY",
    n_patrols: int = None,
):
    """
    Full patrol optimization pipeline.

    Coverage is computed within a single district (default Bengaluru City):
    patrols are deployed per-district in practice, so measuring coverage against
    the whole state would make any allocation look negligible. This matches the
    demo scenario ("6 patrols in Bengaluru City tonight").
    """
    if output_dir is None:
        output_dir = OUTPUT_DIR / "act"
    output_dir.mkdir(parents=True, exist_ok=True)

    # ── scope the risk map to the demo district ───────────────────────
    if district and "DistrictName" in cases.columns:
        cell_district = (
            cases.groupby("cell_id")["DistrictName"]
            .agg(lambda s: s.mode().iloc[0])
        )
        district_cells = set(cell_district[cell_district == district].index)
        scoped = risk_map[risk_map["cell_id"].isin(district_cells)].copy()
        # geographic guard: registration-based district labels can pull in cells
        # physically far away (e.g. specialized-unit cases); keep the contiguous core
        if len(scoped) >= 20:
            med_lat = scoped["cell_lat"].median()
            med_lon = scoped["cell_lon"].median()
            dist_km = _haversine_km(med_lat, med_lon, scoped["cell_lat"].values, scoped["cell_lon"].values)
            far = (dist_km > 60).sum()
            if far:
                print(f"[patrol] Dropping {far} cells >60km from {district} core")
            scoped = scoped[dist_km <= 60]
        if len(scoped) >= 20:
            print(f"[patrol] Scoping to {district}: {len(scoped):,} cells "
                  f"(of {len(risk_map):,} statewide)")
            risk_map = scoped
            cases = cases[cases["DistrictName"] == district]
        else:
            print(f"[patrol] District {district} has too few cells; using statewide map")
            district = None

    n_patrols = n_patrols or DEFAULT_NUM_PATROLS
    greedy_result = optimize_patrol_greedy(risk_map, n_patrols=n_patrols)
    # float() guards: risk scores arrive as np.float32; json.dump(default=str)
    # would silently serialize numpy scalars as strings and break the frontend
    baseline_pct = float(compute_baseline_coverage(risk_map, n_patrols=n_patrols))
    statusquo_pct = float(compute_statusquo_coverage(risk_map, cases, n_patrols=n_patrols))
    uplift = compute_coverage_uplift(greedy_result["coverage_pct"], baseline_pct)
    uplift_sq = compute_coverage_uplift(greedy_result["coverage_pct"], statusquo_pct)

    briefings = generate_briefing_sheet(greedy_result["allocations"], cases, risk_map)

    ilp_result = None
    try:
        ilp_result = try_ilp_optimizer(risk_map, n_patrols=n_patrols)
        ilp_uplift = compute_coverage_uplift(ilp_result["coverage_pct"], baseline_pct)
    except Exception as e:
        print(f"  ILP failed: {e}")
        ilp_uplift = None

    summary = {
        "n_patrols": n_patrols,
        "patrol_radius_km": PATROL_RADIUS_KM,
        "scope_district": district or "STATEWIDE",
        "baseline_coverage_pct": round(baseline_pct, 2),
        "statusquo_coverage_pct": round(statusquo_pct, 2),
        "greedy_coverage_pct": greedy_result["coverage_pct"],
        "greedy_uplift_pct": uplift,
        "greedy_uplift_x": round(greedy_result["coverage_pct"] / baseline_pct, 1) if baseline_pct > 0 else None,
        "greedy_uplift_vs_statusquo_pct": uplift_sq,
        "greedy_uplift_vs_statusquo_x": round(greedy_result["coverage_pct"] / statusquo_pct, 2) if statusquo_pct > 0 else None,
        "greedy_cells_covered": greedy_result["cells_covered"],
    }
    if ilp_result:
        summary["ilp_coverage_pct"] = ilp_result["coverage_pct"]
        summary["ilp_uplift_pct"] = ilp_uplift

    print("\n[patrol] === RESULTS ===")
    print(f"  Baseline coverage (random): {baseline_pct:.1f}%")
    print(f"  Baseline coverage (status-quo volume-driven): {statusquo_pct:.1f}%")
    print(f"  Greedy coverage: {greedy_result['coverage_pct']:.1f}%")
    print(f"  COVERAGE UPLIFT: +{uplift:.1f}% vs random, +{uplift_sq:.1f}% vs status-quo")
    if ilp_result:
        print(f"  ILP coverage: {ilp_result['coverage_pct']:.1f}% (uplift +{ilp_uplift:.1f}%)")

    with open(output_dir / "patrol_summary.json", "w") as f:
        json.dump(summary, f, indent=2, default=str)
    with open(output_dir / "patrol_allocations.json", "w") as f:
        json.dump(greedy_result, f, indent=2, default=str)
    with open(output_dir / "patrol_briefings.json", "w") as f:
        json.dump(briefings, f, indent=2, default=str)
    if ilp_result:
        with open(output_dir / "patrol_ilp.json", "w") as f:
            json.dump(ilp_result, f, indent=2, default=str)

    print(f"  saved to {output_dir}")
    return summary

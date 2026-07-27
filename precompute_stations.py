"""Per-station rollup for the district drill-down.

The challenge brief asks for district-level drill-down to specific police
stations. CaseMaster's coordinates are not district-faithful in this corpus
(see the note in precompute_district_trends.py), but PoliceStationID -> Unit
-> District is sound, so the station is the truthful unit of "where".

For every district: each station's total FIRs, latest-year FIRs, YoY change
and top crime type. Sorted by latest-year volume so the first rows are the
stations that matter now.

Output: outputs/sense/station_summary.json
"""
import json
from datetime import datetime

import pandas as pd

from config import OUTPUT_DIR
from data.loader import load_enriched_cases, load_units

OUT = OUTPUT_DIR / "sense"


def main():
    t0 = datetime.now()
    print("[stations] loading cases ...", flush=True)
    cases = load_enriched_cases()
    units = load_units()[["UnitID", "UnitName"]]
    cases = cases.merge(units, left_on="PoliceStationID", right_on="UnitID", how="left")

    cases = cases.dropna(subset=["DistrictName", "UnitName", "IncidentFromDate"]).copy()
    cases["year"] = cases["IncidentFromDate"].dt.year.astype(int)

    years = sorted(cases["year"].unique())
    latest, prior = int(years[-1]), int(years[-2]) if len(years) > 1 else None

    # The latest year is partial (corpus ends 2024-03-15); compare it against
    # the same window of the prior year, never the full year.
    cutoff = cases["IncidentFromDate"].max()
    try:
        prior_cutoff = cutoff.replace(year=prior) if prior is not None else None
    except ValueError:
        prior_cutoff = cutoff.replace(year=prior, day=28)

    result: dict = {}
    for (district, station), g in cases.groupby(["DistrictName", "UnitName"]):
        n_latest = int((g["year"] == latest).sum())
        n_prior = (
            int(((g["year"] == prior) & (g["IncidentFromDate"] <= prior_cutoff)).sum())
            if prior is not None and prior_cutoff is not None else 0
        )
        yoy = round((n_latest - n_prior) / n_prior * 100, 1) if n_prior > 0 else None
        top_crime = None
        if "crime_type" in g.columns:
            vc = g["crime_type"].value_counts()
            if len(vc):
                top_crime = str(vc.index[0])
        result.setdefault(str(district), []).append({
            "station": str(station),
            "total": int(len(g)),
            "latest": n_latest,
            "yoy_pct": yoy,
            "top_crime": top_crime,
        })

    for district in result:
        result[district].sort(key=lambda r: r["latest"], reverse=True)

    OUT.mkdir(parents=True, exist_ok=True)
    payload = {
        "generated": datetime.now().isoformat(timespec="seconds"),
        "latest_year": latest,
        "prior_year": prior,
        "districts": result,
    }
    path = OUT / "station_summary.json"
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, separators=(",", ":"))

    import os
    size = os.path.getsize(path) / 1024
    n_stations = sum(len(v) for v in result.values())
    print(f"[stations] {len(result)} districts, {n_stations} stations -> "
          f"{path.name} ({size:.0f} KB) in {(datetime.now()-t0).total_seconds():.1f}s")


if __name__ == "__main__":
    main()

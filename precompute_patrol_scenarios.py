"""Precompute patrol optimizer results per district x patrol count.

Patrols are deployed per-district (a Bengaluru SP doesn't dispatch to Bidar), so
the optimizer runs inside one district's risk map. We precompute every district
that has enough active risk cells, for 4/6/8/10 patrols, so the ACT tab can offer
a district picker + a what-if slider without solving anything client-side.

Layout:
  outputs/act/districts/<SAFE_DISTRICT>/p<N>/patrol_{summary,allocations,briefings}.json
  outputs/act/patrol_districts.json   -> index of available districts
  outputs/act/scenarios/p<N>/...      -> Bengaluru City (kept for the default view)
"""
import sys, os, json, shutil
sys.path.insert(0, os.path.dirname(__file__))

import pandas as pd
from pathlib import Path
from config import OUTPUT_DIR
from data.loader import load_enriched_cases
from data.grid import build_grid, assign_cases_to_grid
from act.patrol_optimizer import run_patrol_optimizer

SCENARIOS = [4, 6, 8, 10]
DEFAULT_DISTRICT = "BENGALURU CITY"
MIN_CELLS = 25  # districts below this can't support a meaningful patrol plan
# non-territorial units have no contiguous area to patrol
NON_GEO = {"CID", "COASTAL SECURITY POLICE", "KARNATAKA RAILWAYS", "ISD BENGALURU"}


def safe(name: str) -> str:
    return name.replace(" ", "_").replace(".", "").replace("/", "_")


cases = load_enriched_cases()
grid = build_grid()
cases = assign_cases_to_grid(cases, grid)

risk_map = pd.read_json(OUTPUT_DIR / "predict" / "risk_map.json", orient="records")
print(f"Risk map: {len(risk_map):,} cells")

# cell -> district (majority vote), so we can size each district's patrollable area
cell_district = cases.groupby("cell_id")["DistrictName"].agg(lambda s: s.mode().iloc[0])
risk_map["_district"] = risk_map["cell_id"].map(cell_district)
cell_counts = risk_map.groupby("_district").size().sort_values(ascending=False)

districts = [
    d for d, n in cell_counts.items()
    if d and d not in NON_GEO and n >= MIN_CELLS
]
# always put the default first
districts = [DEFAULT_DISTRICT] + [d for d in districts if d != DEFAULT_DISTRICT]
print(f"Districts to optimize: {len(districts)}")

act_dir = OUTPUT_DIR / "act"
districts_root = act_dir / "districts"
districts_root.mkdir(parents=True, exist_ok=True)

index = []
for district in districts:
    d_dir = districts_root / safe(district)
    default_cov = None
    ok = True
    for n in SCENARIOS:
        out_dir = d_dir / f"p{n}"
        out_dir.mkdir(parents=True, exist_ok=True)
        summary = run_patrol_optimizer(
            risk_map.drop(columns=["_district"]).copy(), cases.copy(),
            output_dir=out_dir, n_patrols=n, district=district,
        )
        # if scoping fell back to STATEWIDE the district isn't really patrollable
        if summary.get("scope_district") != district:
            ok = False
            break
        if n == 6:
            default_cov = summary.get("greedy_coverage_pct")
    if not ok:
        print(f"  skip {district} (fell back to statewide)")
        continue
    index.append({
        "district": district,
        "safe": safe(district),
        "n_cells": int(cell_counts.get(district, 0)),
        "coverage_6": default_cov,
    })
    print(f"  {district}: {int(cell_counts.get(district,0))} cells, 6-patrol {default_cov}% coverage")

with open(act_dir / "patrol_districts.json", "w", encoding="utf-8") as f:
    json.dump(index, f, indent=2)

# keep the flat Bengaluru scenarios (scenarios/pN + top-level files) for the
# default view / any legacy loader
bengaluru = districts_root / safe(DEFAULT_DISTRICT)
scenarios_dir = act_dir / "scenarios"
for n in SCENARIOS:
    dst = scenarios_dir / f"p{n}"
    dst.mkdir(parents=True, exist_ok=True)
    for fname in ("patrol_summary.json", "patrol_allocations.json", "patrol_briefings.json"):
        src = bengaluru / f"p{n}" / fname
        if src.exists():
            shutil.copy2(src, dst / fname)
for fname in ("patrol_summary.json", "patrol_allocations.json", "patrol_briefings.json"):
    src = bengaluru / "p6" / fname
    if src.exists():
        shutil.copy2(src, act_dir / fname)

print(f"\nDone. {len(index)} districts -> {act_dir / 'patrol_districts.json'}")

"""Build patrol_districts.json from already-computed per-district optimizer runs
and copy the district trees into the frontend, WITHOUT re-running the optimizer.

The full precompute (precompute_patrol_scenarios.py) writes the index only after
looping every district; it was interrupted after the first 12, so the trees exist
under outputs/act/districts/<SAFE>/p{4,6,8,10}/ but the index was never written and
nothing was copied to frontend/public/data. This scans what's there and finishes
the job.
"""
import json
import shutil
from pathlib import Path

ROOT = Path(__file__).parent
ACT = ROOT / "outputs" / "act"
DISTRICTS = ACT / "districts"
FRONT = ROOT / "frontend" / "public" / "data"
SCENARIOS = [4, 6, 8, 10]
DEFAULT_DISTRICT = "BENGALURU CITY"

# crime volume per district (for ordering the picker) — optional
vol = {}
try:
    ds = json.load(open(ROOT / "outputs" / "sense" / "district_summary.json", encoding="utf-8"))
    vol = {d["district"]: d.get("total_cases", 0) for d in ds}
except Exception as e:  # noqa: BLE001
    print(f"[warn] no district_summary for ordering: {e}")

index = []
for d_dir in sorted(DISTRICTS.iterdir()):
    if not d_dir.is_dir():
        continue
    # require all four scenarios present and correctly scoped
    ok = True
    district = None
    coverage_6 = None
    for n in SCENARIOS:
        summ = d_dir / f"p{n}" / "patrol_summary.json"
        if not summ.exists():
            ok = False
            break
        s = json.load(open(summ, encoding="utf-8"))
        if s.get("scope_district") in (None, "STATEWIDE"):
            ok = False
            break
        district = s["scope_district"]
        if n == 6:
            coverage_6 = s.get("greedy_coverage_pct")
    if not ok or not district:
        print(f"  skip {d_dir.name} (incomplete or statewide fallback)")
        continue
    index.append({
        "district": district,
        "safe": d_dir.name,
        "n_cells": int(vol.get(district, 0)),
        "coverage_6": coverage_6,
    })

# order: default district first, then by crime volume desc
index.sort(key=lambda e: (e["district"] != DEFAULT_DISTRICT, -e["n_cells"]))

with open(ACT / "patrol_districts.json", "w", encoding="utf-8") as f:
    json.dump(index, f, indent=2)
print(f"Wrote index with {len(index)} districts: {[e['district'] for e in index]}")

# ---- copy to frontend ----------------------------------------------------
front_districts = FRONT / "districts"
if front_districts.exists():
    shutil.rmtree(front_districts)
for e in index:
    src = DISTRICTS / e["safe"]
    dst = front_districts / e["safe"]
    for n in SCENARIOS:
        (dst / f"p{n}").mkdir(parents=True, exist_ok=True)
        for fname in ("patrol_summary.json", "patrol_allocations.json", "patrol_briefings.json"):
            s = src / f"p{n}" / fname
            if s.exists():
                shutil.copy2(s, dst / f"p{n}" / fname)
shutil.copy2(ACT / "patrol_districts.json", FRONT / "patrol_districts.json")
print(f"Copied {len(index)} district trees + index to {FRONT}")

"""Resumable per-district patrol precompute.

Unlike precompute_patrol_scenarios.py (which writes the index only at the very
end of the whole loop — so an interruption loses everything), this:
  * SKIPS districts already computed (all 4 scenarios present & correctly scoped),
  * after EACH district finishes, rebuilds patrol_districts.json AND copies the
    trees into the frontend — so progress is live and an interruption never
    wastes completed work.

Run in the background; re-run any time to resume where it stopped.
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
MIN_CELLS = 25
NON_GEO = {"CID", "COASTAL SECURITY POLICE", "KARNATAKA RAILWAYS", "ISD BENGALURU"}

ROOT = Path(__file__).parent
ACT = OUTPUT_DIR / "act"
DISTRICTS = ACT / "districts"
FRONT = ROOT / "frontend" / "public" / "data"


def safe(name: str) -> str:
    return name.replace(" ", "_").replace(".", "").replace("/", "_")


def scenario_ok(d_dir: Path, district: str) -> bool:
    """True if all 4 scenarios exist and are scoped to this district."""
    for n in SCENARIOS:
        summ = d_dir / f"p{n}" / "patrol_summary.json"
        if not summ.exists():
            return False
        try:
            s = json.load(open(summ, encoding="utf-8"))
        except Exception:  # noqa: BLE001
            return False
        if s.get("scope_district") != district:
            return False
    return True


def rebuild_index_and_copy():
    """Scan finished district folders, write the index, copy trees to frontend.
    Incremental (no rmtree) so the live app is never left empty mid-run."""
    vol = {}
    try:
        ds = json.load(open(OUTPUT_DIR / "sense" / "district_summary.json", encoding="utf-8"))
        vol = {d["district"]: d.get("total_cases", 0) for d in ds}
    except Exception:  # noqa: BLE001
        pass

    index = []
    for d_dir in sorted(DISTRICTS.iterdir()):
        if not d_dir.is_dir():
            continue
        # recover the real district name from any scenario summary
        district = None
        for n in SCENARIOS:
            summ = d_dir / f"p{n}" / "patrol_summary.json"
            if summ.exists():
                try:
                    district = json.load(open(summ, encoding="utf-8")).get("scope_district")
                except Exception:  # noqa: BLE001
                    pass
                break
        if not district or not scenario_ok(d_dir, district):
            continue
        cov6 = None
        try:
            cov6 = json.load(open(d_dir / "p6" / "patrol_summary.json", encoding="utf-8")).get("greedy_coverage_pct")
        except Exception:  # noqa: BLE001
            pass
        index.append({"district": district, "safe": d_dir.name,
                      "n_cells": int(vol.get(district, 0)), "coverage_6": cov6})

    index.sort(key=lambda e: (e["district"] != DEFAULT_DISTRICT, -e["n_cells"]))
    with open(ACT / "patrol_districts.json", "w", encoding="utf-8") as f:
        json.dump(index, f, indent=2)

    # copy incrementally into the frontend
    front_districts = FRONT / "districts"
    for e in index:
        src, dst = DISTRICTS / e["safe"], front_districts / e["safe"]
        for n in SCENARIOS:
            (dst / f"p{n}").mkdir(parents=True, exist_ok=True)
            for fname in ("patrol_summary.json", "patrol_allocations.json", "patrol_briefings.json"):
                s = src / f"p{n}" / fname
                if s.exists():
                    shutil.copy2(s, dst / f"p{n}" / fname)
    shutil.copy2(ACT / "patrol_districts.json", FRONT / "patrol_districts.json")
    return [e["district"] for e in index]


def main():
    print("[patrol-all] loading data ...", flush=True)
    cases = load_enriched_cases()
    grid = build_grid()
    cases = assign_cases_to_grid(cases, grid)

    risk_map = pd.read_json(OUTPUT_DIR / "predict" / "risk_map.json", orient="records")
    cell_district = cases.groupby("cell_id")["DistrictName"].agg(lambda s: s.mode().iloc[0])
    risk_map["_district"] = risk_map["cell_id"].map(cell_district)
    cell_counts = risk_map.groupby("_district").size().sort_values(ascending=False)

    districts = [d for d, n in cell_counts.items() if d and d not in NON_GEO and n >= MIN_CELLS]
    districts = [DEFAULT_DISTRICT] + [d for d in districts if d != DEFAULT_DISTRICT]
    DISTRICTS.mkdir(parents=True, exist_ok=True)

    done = [d for d in districts if scenario_ok(DISTRICTS / safe(d), d)]
    todo = [d for d in districts if d not in done]
    print(f"[patrol-all] {len(districts)} qualifying · {len(done)} already done · {len(todo)} to compute", flush=True)

    for i, district in enumerate(todo, 1):
        d_dir = DISTRICTS / safe(district)
        print(f"[patrol-all] ({i}/{len(todo)}) {district} ...", flush=True)
        ok = True
        for n in SCENARIOS:
            out_dir = d_dir / f"p{n}"
            out_dir.mkdir(parents=True, exist_ok=True)
            summary = run_patrol_optimizer(
                risk_map.drop(columns=["_district"]).copy(), cases.copy(),
                output_dir=out_dir, n_patrols=n, district=district,
            )
            if summary.get("scope_district") != district:
                ok = False
                break
        if not ok:
            print(f"[patrol-all]   skip {district} (statewide fallback)", flush=True)
            continue
        live = rebuild_index_and_copy()   # publish progress after each district
        print(f"[patrol-all]   done {district} · index now {len(live)} districts", flush=True)

    live = rebuild_index_and_copy()
    print(f"[patrol-all] COMPLETE · {len(live)} districts available: {live}", flush=True)


if __name__ == "__main__":
    main()

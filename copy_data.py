"""Copy pipeline outputs into the frontend's public/data directory.

Re-run whenever the ML pipeline regenerates outputs/.
"""
import json
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).parent
OUT = ROOT / "outputs"
DEST = ROOT / "frontend" / "public" / "data"

# session 1: SENSE layer + summaries
COPY = [
    ("sense", "*.geojson"),
    ("sense", "district_summary.json"),
    ("sense", "station_summary.json"),
    ("sense", "trend_monthly.json"),
    ("sense", "trend_weekly.json"),
    ("sense", "crime_type_breakdown.json"),
    ("sense", "crime_type_by_district.json"),
    ("sense", "district_trends.json"),
    ("sense", "hotspots_summary.json"),
    ("sense", "district_centroids.json"),
    ("sense", "emerging_hotspots.json"),
    ("sense", "karnataka_outline.geojson"),
    ("sense", "karnataka_mask.geojson"),
    # later sessions (copied if present)
    ("predict", "risk_map.json"),
    ("predict", "crime_sprees.json"),
    ("predict", "offender_corridors.json"),
    ("predict", "anomaly_feed.json"),
    ("predict", "cooffending_network.json"),
    ("predict", "gang_network.json"),
    ("predict", "gang_disruption.json"),
    ("predict", "network_summary.json"),
    ("predict", "offender_index.json"),
    ("predict", "most_wanted.json"),
    ("predict", "risk_summary.json"),
    ("act", "patrol_summary.json"),
    ("act", "patrol_allocations.json"),
    ("act", "patrol_briefings.json"),
    ("act", "patrol_districts.json"),
    ("trust", "shap_explanations.json"),
    ("trust", "fairness_report.json"),
    ("trust", "calibration.json"),
    ("evaluate", "benchmark_report.json"),
]

# KSP jurisdictions that are not territorial districts. They appear in
# District.csv alongside the 37 real police districts, which is why a naive
# row count reports "41 districts" -- a number a KSP officer knows is wrong.
SPECIAL_UNITS = {"CID", "COASTAL SECURITY POLICE", "KARNATAKA RAILWAYS", "ISD BENGALURU"}


def write_meta(dest: Path) -> None:
    """Emit every headline figure the UI displays, derived from the data.

    Nothing here may be typed by hand: the frontend reads these and renders a
    dash if the fetch fails, so a hardcoded literal anywhere would let the UI
    assert a number it never loaded.
    """
    meta = {"computed_at": datetime.now(timezone.utc).isoformat(timespec="seconds")}

    summary_path = dest / "district_summary.json"
    if summary_path.exists():
        with open(summary_path, encoding="utf-8") as f:
            rows = json.load(f)
        territorial = [r for r in rows if r["district"] not in SPECIAL_UNITS]
        special = [r for r in rows if r["district"] in SPECIAL_UNITS]
        meta["total_firs"] = sum(r.get("total_cases", 0) for r in rows)
        meta["n_districts"] = len(territorial)
        meta["n_special_units"] = len(special)
        meta["special_units"] = sorted(r["district"] for r in special)

    # Stations that actually recorded at least one FIR. Unit.csv lists 1,075
    # but one has no cases, so the master-table count would overstate by one.
    stations = count_stations()
    if stations is not None:
        meta["n_stations"] = stations

    with open(dest / "meta.json", "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)
    print(f"[copy_data] meta.json: {meta}")


def count_stations():
    """Distinct PoliceStationID present in CaseMaster, or None if the dataset
    is not available (meta.json then omits the key and the UI shows a dash)."""
    try:
        import pandas as pd
        from config import DATASET_DIR
        cm = DATASET_DIR / "CaseMaster.csv"
        if not cm.exists():
            return None
        return int(pd.read_csv(cm, usecols=["PoliceStationID"], low_memory=False)
                   ["PoliceStationID"].nunique())
    except Exception as e:
        print(f"[copy_data] station count skipped: {e}")
        return None


def main():
    DEST.mkdir(parents=True, exist_ok=True)
    copied = 0
    for sub, pattern in COPY:
        src_dir = OUT / sub
        if not src_dir.exists():
            continue
        for f in src_dir.glob(pattern):
            shutil.copy2(f, DEST / f.name)
            copied += 1

    # Patrol what-if scenarios (default Bengaluru view)
    scenarios_src = OUT / "act" / "scenarios"
    if scenarios_src.exists():
        for pdir in sorted(scenarios_src.iterdir()):
            if pdir.is_dir() and pdir.name.startswith("p"):
                dest_sub = DEST / "scenarios" / pdir.name
                dest_sub.mkdir(parents=True, exist_ok=True)
                for f in pdir.glob("*.json"):
                    shutil.copy2(f, dest_sub / f.name)
                    copied += 1

    # Per-district patrol scenarios (district picker on ACT tab)
    districts_src = OUT / "act" / "districts"
    if districts_src.exists():
        for ddir in sorted(districts_src.iterdir()):
            if not ddir.is_dir():
                continue
            for pdir in sorted(ddir.iterdir()):
                if pdir.is_dir() and pdir.name.startswith("p"):
                    dest_sub = DEST / "districts" / ddir.name / pdir.name
                    dest_sub.mkdir(parents=True, exist_ok=True)
                    for f in pdir.glob("*.json"):
                        shutil.copy2(f, dest_sub / f.name)
                        copied += 1

    # clip stray out-of-state / ocean dots from the display layers
    try:
        from clip_to_state import clip_public_data
        clip_public_data(DEST)
    except Exception as e:
        print(f"[copy_data] clip skipped: {e}")

    write_meta(DEST)

    print(f"copied {copied} files -> {DEST}")

if __name__ == "__main__":
    main()

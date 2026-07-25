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

    # freshness stamp shown in the app header ("nightly Cron recompute" story)
    meta = {"computed_at": datetime.now(timezone.utc).isoformat(timespec="seconds")}
    with open(DEST / "meta.json", "w", encoding="utf-8") as f:
        json.dump(meta, f)

    print(f"copied {copied} files -> {DEST}")

if __name__ == "__main__":
    main()

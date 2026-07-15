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
    ("sense", "hotspots_summary.json"),
    ("sense", "district_centroids.json"),
    # later sessions (copied if present)
    ("predict", "risk_map.json"),
    ("predict", "anomaly_feed.json"),
    ("predict", "cooffending_network.json"),
    ("predict", "gang_disruption.json"),
    ("predict", "network_summary.json"),
    ("predict", "risk_summary.json"),
    ("act", "patrol_summary.json"),
    ("act", "patrol_allocations.json"),
    ("act", "patrol_briefings.json"),
    ("trust", "shap_explanations.json"),
    ("trust", "fairness_report.json"),
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

    # freshness stamp shown in the app header ("nightly Cron recompute" story)
    meta = {"computed_at": datetime.now(timezone.utc).isoformat(timespec="seconds")}
    with open(DEST / "meta.json", "w", encoding="utf-8") as f:
        json.dump(meta, f)

    print(f"copied {copied} files -> {DEST}")

if __name__ == "__main__":
    main()

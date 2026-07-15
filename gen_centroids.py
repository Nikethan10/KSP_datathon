"""Generate district centroids (mean lat/lon of cases per district)."""
import sys, os, json
sys.path.insert(0, os.path.dirname(__file__))

from config import OUTPUT_DIR
from data.loader import load_enriched_cases

cases = load_enriched_cases()
cent = (
    cases.groupby("DistrictName")[["latitude", "longitude"]]
    .mean()
    .round(5)
    .reset_index()
    .rename(columns={"DistrictName": "district", "latitude": "lat", "longitude": "lon"})
)
out = OUTPUT_DIR / "sense" / "district_centroids.json"
cent.to_json(out, orient="records")
print(f"saved {len(cent)} centroids -> {out}")

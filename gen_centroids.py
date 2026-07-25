"""Generate district centroids from the REAL boundary polygons.

Why not average the case coordinates (what this script used to do)? In this
dataset most non-Bengaluru cases carry Bengaluru coordinates — only ~22% of
BAGALKOT-labelled cases fall within 50 km of Bagalkot — so both the mean and the
median of a district's cases land in Bengaluru. That made every district's
"centroid" collapse toward Bengaluru and sent map fly-to/search to the wrong
place. The district *label* (PoliceStationID -> Unit -> District) is sound; the
per-case lat/lon is not. So take each district's location from the authoritative
boundary polygon instead.

representative_point() is used rather than centroid() because it is guaranteed to
land inside the polygon — matters for concave/coastal shapes like Uttara Kannada.
"""
import json
from pathlib import Path
from shapely.geometry import shape

ROOT = Path(__file__).parent
BOUNDARIES = ROOT / "frontend" / "public" / "data" / "karnataka_districts.geojson"
OUT = ROOT / "outputs" / "sense" / "district_centroids.json"

# dataset district (41 police units) -> boundary polygon (30 admin districts).
# City units map to their parent district; Vijayanagara was carved out of Ballari
# in 2021 and isn't in the boundary file yet.
DATASET_TO_BOUNDARY = {
    "BAGALKOT": "Bagalkote",
    "BALLARI": "Ballari",
    "BELAGAVI CITY": "Belagavi",
    "BELAGAVI DIST": "Belagavi",
    "BENGALURU CITY": "Bengaluru Urban",
    "BENGALURU DIST": "Bengaluru Rural",
    "BIDAR": "Bidar",
    "CHAMARAJANAGAR": "Chamarajanagara",
    "CHICKBALLAPURA": "Chikkaballapura",
    "CHIKKAMAGALURU": "Chikkamagaluru",
    "CHITRADURGA": "Chitradurga",
    "DAKSHINA KANNADA": "Dakshina Kannada",
    "DAVANAGERE": "Davanagere",
    "DHARWAD": "Dharwad",
    "GADAG": "Gadag",
    "HASSAN": "Hassan",
    "HAVERI": "Haveri",
    "HUBBALLI DHARWAD CITY": "Dharwad",
    "K.G.F": "Kolar",
    "KALABURAGI": "Kalaburagi",
    "KALABURAGI CITY": "Kalaburagi",
    "KODAGU": "Kodagu",
    "KOLAR": "Kolar",
    "KOPPAL": "Koppal",
    "MANDYA": "Mandya",
    "MANGALURU CITY": "Dakshina Kannada",
    "MYSURU CITY": "Mysuru",
    "MYSURU DIST": "Mysuru",
    "RAICHUR": "Raichur",
    "RAMANAGARA": "Ramanagara",
    "SHIVAMOGGA": "Shivamogga",
    "TUMAKURU": "Tumakuru",
    "UDUPI": "Udupi",
    "UTTARA KANNADA": "Uttara Kannada",
    "VIJAYANAGARA": "Ballari",
    "VIJAYAPUR": "Vijayapura",
    "YADGIR": "Yadgir",
}

# Statewide / non-territorial units — no meaningful map location, so they are
# left out of the centroid index (and therefore out of search and fly-to).
NON_GEO = {"CID", "COASTAL SECURITY POLICE", "KARNATAKA RAILWAYS", "ISD BENGALURU"}


def main():
    fc = json.load(open(BOUNDARIES, encoding="utf-8"))
    polys = {f["properties"]["district"]: shape(f["geometry"]) for f in fc["features"]}

    out, missing = [], []
    for dataset_name, boundary_name in sorted(DATASET_TO_BOUNDARY.items()):
        poly = polys.get(boundary_name)
        if poly is None:
            missing.append((dataset_name, boundary_name))
            continue
        # true centroid when it lands inside the district; otherwise a
        # guaranteed-interior point (for concave/coastal shapes).
        c = poly.centroid
        pt = c if poly.contains(c) else poly.representative_point()
        out.append({"district": dataset_name, "lat": round(pt.y, 5), "lon": round(pt.x, 5)})

    if missing:
        print("WARNING unmatched boundaries:", missing)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, separators=(",", ":"))

    print(f"wrote {len(out)} centroids -> {OUT}")
    print(f"excluded {len(NON_GEO)} non-territorial units: {sorted(NON_GEO)}")

    # sanity check against known real-world coordinates
    truth = {
        "BAGALKOT": (16.18, 75.70), "BIDAR": (17.91, 77.52),
        "MANGALURU CITY": (12.91, 74.85), "BENGALURU CITY": (12.97, 77.59),
        "BELAGAVI DIST": (15.85, 74.50), "MYSURU CITY": (12.30, 76.64),
    }
    print("\nsanity check (distance from true location):")
    for name, (tlat, tlon) in truth.items():
        row = next((r for r in out if r["district"] == name), None)
        if not row:
            continue
        km = (((row["lat"] - tlat) * 111) ** 2 + ((row["lon"] - tlon) * 107) ** 2) ** 0.5
        print(f"  {name:<18} ({row['lat']:.3f},{row['lon']:.3f})  {km:5.0f} km off")


if __name__ == "__main__":
    main()

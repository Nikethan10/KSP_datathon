"""Build a Karnataka state outline + spotlight mask for the map.

- karnataka_outline.geojson : the state boundary (districts dissolved into one).
- karnataka_mask.geojson     : a large rectangle with Karnataka cut out as a hole,
                               used to dim everything outside the state.

Run once (or whenever the district boundaries change), then copy_data.py.
"""
import json
from pathlib import Path
from shapely.geometry import shape, mapping, box
from shapely.ops import unary_union

ROOT = Path(__file__).parent
SRC = ROOT / "frontend" / "public" / "data" / "karnataka_districts.geojson"
OUT_DIR = ROOT / "outputs" / "sense"
OUT_DIR.mkdir(parents=True, exist_ok=True)

# Generous bbox — covers the whole viewport well beyond any pan/zoom-out.
MASK_BBOX = box(30.0, -10.0, 120.0, 45.0)  # (minlon, minlat, maxlon, maxlat)

districts = json.load(open(SRC, encoding="utf-8"))
# buffer(0) on each district first heals self-intersections/invalid rings that
# would otherwise make the union throw a TopologyException.
geoms = [shape(f["geometry"]).buffer(0.0) for f in districts["features"]]

# Dissolve all districts into one state polygon; final buffer heals slivers/gaps.
state = unary_union(geoms).buffer(0.0)
print(f"dissolved {len(geoms)} districts -> {state.geom_type}")

# ── State outline ──────────────────────────────────────────────────────
outline = {
    "type": "FeatureCollection",
    "features": [{"type": "Feature", "properties": {"name": "Karnataka"},
                  "geometry": mapping(state)}],
}
with open(OUT_DIR / "karnataka_outline.geojson", "w", encoding="utf-8") as f:
    json.dump(outline, f, separators=(",", ":"))

# ── Spotlight mask: bbox with the state as hole(s) ─────────────────────
# difference() yields the rectangle minus Karnataka; fill it dark and
# everything outside the state is dimmed, Karnataka stays clear.
mask = MASK_BBOX.difference(state)
mask_fc = {
    "type": "FeatureCollection",
    "features": [{"type": "Feature", "properties": {}, "geometry": mapping(mask)}],
}
with open(OUT_DIR / "karnataka_mask.geojson", "w", encoding="utf-8") as f:
    json.dump(mask_fc, f, separators=(",", ":"))

print("wrote karnataka_outline.geojson + karnataka_mask.geojson")

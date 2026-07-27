"""Clip all point-based display layers to the actual Karnataka boundary.

The analysis grid is a rectangle over Karnataka's bounding box, so it includes
the Arabian Sea and slivers of neighbouring states. Cells there with a few
cases render as stray dots outside the state (some in the ocean). This removes
any point that falls outside the dissolved state polygon.

Operates on the served files in frontend/public/data (in place). copy_data.py
calls this automatically after syncing, so the map is always clean.
"""
import json
from pathlib import Path
from shapely.geometry import shape, Point
from shapely.prepared import prep

# small outward buffer (~1 km) so legitimate coastal/border cells right on the
# boundary aren't clipped, while ocean/other-state cells (well outside) are.
BUFFER_DEG = 0.01


def load_state(dest: Path):
    """Prepared Karnataka polygon, buffered outward ~1 km.

    Accepts either extension: copy_data.py writes `.geojson` and clips before
    optimize_geojson.py renames everything to `.json`, so a standalone run
    after that rename used to find nothing and skip silently.
    """
    for name in ("karnataka_outline.geojson", "karnataka_outline.json"):
        outline = dest / name
        if outline.exists():
            geom = shape(json.load(open(outline, encoding="utf-8"))["features"][0]["geometry"])
            return prep(geom.buffer(BUFFER_DEG))
    return None


# backwards-compatible alias
_load_state = load_state


def _clip_geojson(path: Path, inside) -> tuple[int, int]:
    fc = json.load(open(path, encoding="utf-8"))
    feats = fc["features"]
    kept = [f for f in feats if inside.contains(Point(f["geometry"]["coordinates"]))]
    fc["features"] = kept
    with open(path, "w", encoding="utf-8") as f:
        json.dump(fc, f, separators=(",", ":"))
    return len(feats), len(kept)


def _clip_json_points(path: Path, inside, lon_key, lat_key, container=None) -> tuple[int, int]:
    data = json.load(open(path, encoding="utf-8"))
    rows = data[container] if container else data
    kept = [r for r in rows if inside.contains(Point(r[lon_key], r[lat_key]))]
    if container:
        data[container] = kept
    else:
        data = kept
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, separators=(",", ":"))
    return len(rows), len(kept)


def clip_public_data(dest: Path) -> None:
    inside = load_state(dest)
    if inside is None:
        print("[clip] karnataka_outline.geojson missing — skipping clip")
        return

    total_removed = 0
    # all hotspot layers: state view (hotspots_*) and district view (hotspots_local_*)
    for path in sorted(dest.glob("hotspots_*.geojson")):
        before, after = _clip_geojson(path, inside)
        if before != after:
            total_removed += before - after
            print(f"[clip] {path.name}: {before} -> {after} ({before - after} removed)")

    # risk map cells
    rm = dest / "risk_map.json"
    if rm.exists():
        before, after = _clip_json_points(rm, inside, "cell_lon", "cell_lat")
        if before != after:
            total_removed += before - after
            print(f"[clip] risk_map.json: {before} -> {after} ({before - after} removed)")

    # emerging hotspot cells
    em = dest / "emerging_hotspots.json"
    if em.exists():
        before, after = _clip_json_points(em, inside, "lon", "lat", container="cells")
        if before != after:
            total_removed += before - after
            print(f"[clip] emerging_hotspots.json: {before} -> {after} ({before - after} removed)")

    # replay shards: forecast cells and the FIRs drawn against them
    replay = dest / "replay"
    if replay.is_dir():
        for path in sorted(replay.glob("2024-W*.json")):
            data = json.load(open(path, encoding="utf-8"))
            before = len(data.get("cells", [])) + len(data.get("incidents", []))
            data["cells"] = [c for c in data.get("cells", []) if inside.contains(Point(c[0], c[1]))]
            data["incidents"] = [i for i in data.get("incidents", []) if inside.contains(Point(i[0], i[1]))]
            after = len(data["cells"]) + len(data["incidents"])
            if before != after:
                total_removed += before - after
                with open(path, "w", encoding="utf-8") as f:
                    json.dump(data, f, separators=(",", ":"))
                print(f"[clip] {path.name}: {before} -> {after} ({before - after} removed)")

    print(f"[clip] done — {total_removed} out-of-state points removed")


if __name__ == "__main__":
    ROOT = Path(__file__).parent
    clip_public_data(ROOT / "frontend" / "public" / "data")

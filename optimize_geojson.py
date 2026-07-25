"""Shrink the GeoJSON payload the console downloads.

Two independent wins, both large:

1. Catalyst does not gzip `.geojson` (verified: karnataka_outline.geojson
   arrives 52 KB encoded / 52 KB decoded, while `.json` files arrive
   compressed ~7x). Renaming to `.json` is enough to turn compression on.

2. The precompute writes full float64 coordinates -- 15 significant digits
   for a point we draw on a 256 px tile. 5 decimal places is ~1.1 m at this
   latitude, which is finer than the 1 km analysis grid.

Run from PRAHARI/:  python optimize_geojson.py
Rewrites frontend/public/data in place. Safe to re-run.
"""
import json
import pathlib
import sys

DATA = pathlib.Path(__file__).parent / "frontend" / "public" / "data"
PRECISION = 5


def round_coords(node):
    """Recursively round every number in a nested coordinate structure."""
    if isinstance(node, list):
        return [round_coords(x) for x in node]
    if isinstance(node, float):
        return round(node, PRECISION)
    return node


def shrink(obj):
    if isinstance(obj, dict):
        out = {}
        for k, v in obj.items():
            if k == "coordinates":
                out[k] = round_coords(v)
            elif k == "properties" and isinstance(v, dict):
                # round any float properties too (gi_z, p-values, counts)
                out[k] = {
                    pk: (round(pv, 4) if isinstance(pv, float) else pv)
                    for pk, pv in v.items()
                }
            else:
                out[k] = shrink(v)
        return out
    if isinstance(obj, list):
        return [shrink(x) for x in obj]
    return obj


def main():
    if not DATA.exists():
        sys.exit(f"not found: {DATA}")

    files = sorted(DATA.rglob("*.geojson"))
    if not files:
        print("no .geojson files left -- already converted?")
        return

    before = after = 0
    for src in files:
        raw = src.stat().st_size
        before += raw
        with src.open("r", encoding="utf-8") as fh:
            data = json.load(fh)

        data = shrink(data)
        dst = src.with_suffix(".json")
        with dst.open("w", encoding="utf-8") as fh:
            # separators kill the whitespace json.dump adds by default
            json.dump(data, fh, separators=(",", ":"), ensure_ascii=False)

        new = dst.stat().st_size
        after += new
        src.unlink()
        print(f"{src.name:52s} {raw/1e6:7.2f} MB -> {new/1e6:6.2f} MB")

    print(f"\nTOTAL  {before/1e6:.1f} MB -> {after/1e6:.1f} MB "
          f"({100*(1-after/before):.0f}% smaller before gzip)")


if __name__ == "__main__":
    main()

"""Drop statistically non-significant cells from the hotspot files.

The SENSE map is locked to significant-only (MapView filters
`sig !== 'not_sig'`), so every `not_significant` feature is downloaded,
decompressed and parsed purely to be thrown away at render. In
hotspots_local_overall that is the overwhelming majority of 66,606
features -- 13.6 MB of JSON the user waits on and never sees.

The only thing the full set is used for is the "N hot cells / M analysed"
readout, so M is preserved as a top-level `analysed` property.

Run from PRAHARI/:  python strip_insignificant.py
Rewrites frontend/public/data/hotspots*.json in place. Re-runnable
(already-stripped files are detected and skipped).
"""
import json
import pathlib
import sys

DATA = pathlib.Path(__file__).parent / "frontend" / "public" / "data"


def main():
    files = sorted(DATA.glob("hotspots*.json"))
    if not files:
        sys.exit(f"no hotspot files in {DATA} -- run optimize_geojson.py first")

    before = after = 0
    for path in files:
        raw = path.stat().st_size
        before += raw
        with path.open("r", encoding="utf-8") as fh:
            fc = json.load(fh)

        # hotspots_summary.json is a per-crime stats map, not a FeatureCollection
        if "features" not in fc:
            after += raw
            print(f"{path.name:46s} (not a FeatureCollection -- skipped)")
            continue

        feats = fc["features"]
        # `analysed` already present => stripped on a previous run; keep the
        # original denominator rather than recomputing it from the subset.
        analysed = fc.get("analysed", len(feats))
        # NB: the sentinel is "not_sig" -- matching MapView's filter exactly.
        keep = [f for f in feats
                if f["properties"].get("significance") != "not_sig"]

        fc["analysed"] = analysed
        fc["features"] = keep

        with path.open("w", encoding="utf-8") as fh:
            json.dump(fc, fh, separators=(",", ":"), ensure_ascii=False)

        new = path.stat().st_size
        after += new
        print(f"{path.name:46s} {len(feats):>6,} -> {len(keep):>6,} feats   "
              f"{raw/1e6:6.2f} -> {new/1e6:5.2f} MB")

    print(f"\nTOTAL  {before/1e6:.1f} MB -> {after/1e6:.1f} MB "
          f"({100*(1-after/before):.0f}% smaller)")


if __name__ == "__main__":
    main()

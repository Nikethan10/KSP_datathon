"""Collapse the per-district patrol scenarios into one JSON bundle.

Catalyst rejects a client ZIP over roughly 500 files
(ZIPSANITIZER_FILES_COUNT_EXCEEDED). The patrol tree is 444 files --
37 districts x 4 unit-counts x 3 files -- but only 1 MB in total, so the
deploy was excluding it to stay under the cap. That silently shipped an
ACT tab with no patrol data: `scenarios/p4/patrol_summary.json` 404s in
production.

Bundling turns 444 files into 1, which both fixes the deploy and removes
three network round-trips every time the user changes district or unit
count (each round-trip is ~1-3 s against the Catalyst dev environment).

Shape:  { "<district_safe>": { "p6": {summary, allocations, briefings}, ... } }
plus a "_scenarios" key holding the Bengaluru fallback tree.

Run from PRAHARI/:  python bundle_patrol.py
"""
import json
import pathlib
import sys

DATA = pathlib.Path(__file__).parent / "frontend" / "public" / "data"
PARTS = ("patrol_summary", "patrol_allocations", "patrol_briefings")


def read_scenario(folder: pathlib.Path):
    out = {}
    for part in PARTS:
        f = folder / f"{part}.json"
        if not f.exists():
            return None
        with f.open("r", encoding="utf-8") as fh:
            out[part] = json.load(fh)
    return out


def collect(root: pathlib.Path):
    """root contains p4/ p6/ p8/ p10/ subfolders."""
    scen = {}
    for sub in sorted(root.glob("p*")):
        if not sub.is_dir():
            continue
        data = read_scenario(sub)
        if data:
            scen[sub.name] = data
    return scen


def main():
    bundle = {}

    districts_dir = DATA / "districts"
    if districts_dir.exists():
        for d in sorted(districts_dir.iterdir()):
            if not d.is_dir():
                continue
            scen = collect(d)
            if scen:
                bundle[d.name] = scen

    scenarios_dir = DATA / "scenarios"
    if scenarios_dir.exists():
        scen = collect(scenarios_dir)
        if scen:
            bundle["_scenarios"] = scen

    if not bundle:
        sys.exit("nothing to bundle -- run the patrol precompute first")

    out = DATA / "patrol_bundle.json"
    with out.open("w", encoding="utf-8") as fh:
        json.dump(bundle, fh, separators=(",", ":"), ensure_ascii=False)

    n_district = len([k for k in bundle if k != "_scenarios"])
    print(f"bundled {n_district} districts"
          f"{' + fallback scenarios' if '_scenarios' in bundle else ''}"
          f" -> {out.name}  ({out.stat().st_size/1e6:.2f} MB, 1 file)")


if __name__ == "__main__":
    main()

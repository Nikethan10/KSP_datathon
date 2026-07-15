"""One-off: minify existing hotspot GeoJSONs in outputs/sense (round floats, no indent)."""
import json
from pathlib import Path

SENSE = Path(__file__).parent / "outputs" / "sense"

def r5(x):
    return round(x, 5) if isinstance(x, float) else x

total_before = total_after = 0
for f in sorted(SENSE.glob("hotspots_*.geojson")):
    before = f.stat().st_size
    gj = json.loads(f.read_text(encoding="utf-8"))
    for feat in gj.get("features", []):
        c = feat["geometry"]["coordinates"]
        feat["geometry"]["coordinates"] = [round(c[0], 5), round(c[1], 5)]
        p = feat.get("properties", {})
        for k in ("gi_zscore", "gi_pvalue"):
            if isinstance(p.get(k), float):
                p[k] = round(p[k], 4)
    f.write_text(json.dumps(gj, separators=(",", ":")), encoding="utf-8")
    after = f.stat().st_size
    total_before += before
    total_after += after

print(f"minified {total_before/1e6:.1f} MB -> {total_after/1e6:.1f} MB "
      f"({100*(1-total_after/total_before):.0f}% smaller)")

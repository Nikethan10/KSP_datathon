"""Per-district x per-crime-type trend analysis for the SENSE tab.

For every district and each crime type present there (plus an ALL aggregate):
  * monthly time series (for the trend chart)
  * yearly totals
  * top police stations ("major places") by case count
  * total count  (lets the UI rank which crimes are highest in a district)

Karnataka is a single state (no StateID), so this is district/station-level —
the meaningful geography for this dataset.

Output: outputs/sense/district_trends.json
"""
import json
from datetime import datetime
from pathlib import Path

import pandas as pd

from config import OUTPUT_DIR
from data.loader import load_enriched_cases, load_units

OUT = OUTPUT_DIR / "sense"
TOP_PLACES = 6

# NOTE on geography: CaseMaster has no place/locality name column, and its
# latitude/longitude are NOT district-faithful in this corpus — every district's
# median coordinate lands near Bengaluru (e.g. UTTARA KANNADA median is
# 13.13,77.63). So clustering coordinates would place a district's crime in the
# wrong place. The police station (Unit.UnitName) IS the reliable locality
# signal — station->district mapping is correct and each station names a real
# town (HONNAVARA PS, KUMTA PS, ANKOLA PS ...). Station-level is therefore the
# truthful maximum granularity for "where crime is happening".


def series_for(df: pd.DataFrame) -> dict:
    monthly = df.groupby("period").size()
    yearly = df.groupby("year").size()
    places = (
        df.dropna(subset=["UnitName"]).groupby("UnitName").size()
        .sort_values(ascending=False).head(TOP_PLACES)
    )
    return {
        "monthly": [{"period": str(p), "count": int(c)} for p, c in monthly.items()],
        "yearly": [{"year": int(y), "count": int(c)} for y, c in yearly.items()],
        "top_places": [{"place": str(k), "count": int(v)} for k, v in places.items()],
        "total": int(len(df)),
    }


def main():
    t0 = datetime.now()
    print("[trends] loading cases ...", flush=True)
    cases = load_enriched_cases()
    units = load_units()[["UnitID", "UnitName"]]
    cases = cases.merge(units, left_on="PoliceStationID", right_on="UnitID", how="left")

    cases = cases.dropna(subset=["DistrictName", "crime_type", "IncidentFromDate"]).copy()
    cases["period"] = cases["IncidentFromDate"].dt.to_period("M").astype(str)
    cases["year"] = cases["IncidentFromDate"].dt.year.astype(int)

    result: dict = {}
    for district, ddf in cases.groupby("DistrictName"):
        entry = {"ALL": series_for(ddf)}
        # crime-type totals in this district, biggest first
        for crime, cdf in sorted(
            ddf.groupby("crime_type"), key=lambda kv: len(kv[1]), reverse=True
        ):
            entry[str(crime)] = series_for(cdf)
        result[str(district)] = entry

    OUT.mkdir(parents=True, exist_ok=True)
    payload = {"generated": datetime.now().isoformat(timespec="seconds"), "districts": result}
    path = OUT / "district_trends.json"
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, separators=(",", ":"))

    import os
    size = os.path.getsize(path) / 1024
    print(f"[trends] {len(result)} districts -> {path.name} ({size:.0f} KB) "
          f"in {(datetime.now() - t0).total_seconds():.0f}s", flush=True)
    # peek
    d0 = next(iter(result))
    crimes = [k for k in result[d0] if k != "ALL"][:3]
    print(f"[trends] e.g. {d0}: ALL={result[d0]['ALL']['total']:,} cases · "
          f"top crimes {[(c, result[d0][c]['total']) for c in crimes]}", flush=True)


if __name__ == "__main__":
    main()

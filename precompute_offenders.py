"""
Offender intelligence index for PRAHARI's "War Room" (PREDICT → Crime Network).

Builds rich, searchable dossiers for the most significant repeat offenders and
every gang key-member: crime-type profile, districts of operation, criminal
career span, gang affiliation + threat, known associates, and arrest/custody
records on file.

Reuses the existing network outputs (gang_network.json, cooffending_network.json,
gang_disruption.json) so it does NOT re-run the heavy graph analysis — it only
enriches a bounded target set of offenders from the raw tables.

Outputs (to outputs/predict/):
  * offender_index.json  — full searchable set of dossiers
  * most_wanted.json     — top offenders ranked by a composite "wanted" score
"""

import json
from pathlib import Path
from datetime import datetime

import numpy as np
import pandas as pd

from config import OUTPUT_DIR, DATASET_DIR, CRIME_GROUPS_VIOLENT
from data.loader import load_enriched_cases, load_accused

PRED = OUTPUT_DIR / "predict"

# how many extra top-by-caseload offenders to enrich beyond the graph members
TOP_BY_CASELOAD = 400
# most-wanted board size
MOST_WANTED_N = 40
# cap list fields so the JSON stays lean
MAX_CRIME_TYPES = 6
MAX_DISTRICTS = 8
MAX_ASSOCIATES = 8


def _load_json(path: Path) -> dict | list | None:
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"  [warn] {path.name} not found — skipping")
        return None


def build_adjacency() -> dict[str, dict[str, int]]:
    """Merge co-offending edges from both exported graphs into one adjacency
    map: offender_id -> {associate_id: shared_cases}."""
    adj: dict[str, dict[str, int]] = {}

    def add(a: str, b: str, w: int):
        adj.setdefault(a, {})
        adj[a][b] = max(adj[a].get(b, 0), w)

    for fname in ("gang_network.json", "cooffending_network.json"):
        g = _load_json(PRED / fname)
        if not g:
            continue
        for e in g.get("edges", []):
            d = e.get("data", e)
            s, t = str(d["source"]), str(d["target"])
            w = int(d.get("weight", 1))
            add(s, t, w)
            add(t, s, w)
    print(f"  adjacency: {len(adj):,} offenders with known associates")
    return adj


def gang_lookup() -> dict[str, dict]:
    """offender_id -> gang/threat attributes, from gang_network + gang_disruption."""
    lut: dict[str, dict] = {}

    gn = _load_json(PRED / "gang_network.json")
    if gn:
        for n in gn.get("nodes", []):
            d = n["data"]
            lut[str(d["id"])] = {
                "gang_rank": int(d.get("gang", 0)),
                "threat_tier": d.get("tier"),
                "threat_score": float(d.get("threat", 0)),
                "gang_degree": int(d.get("degree", 0)),
                "is_articulation": False,
            }

    gd = _load_json(PRED / "gang_disruption.json")
    if gd:
        for gang in gd:
            for m in gang.get("key_members", []):
                oid = str(m["offender_id"])
                lut.setdefault(oid, {})
                lut[oid].update({
                    "gang_rank": int(gang["gang_rank"]),
                    "threat_tier": gang["threat_tier"],
                    "threat_score": float(gang["threat_score"]),
                    "gang_degree": int(m.get("gang_degree", lut[oid].get("gang_degree", 0))),
                    "is_articulation": bool(m.get("is_articulation", False)),
                })
    print(f"  gang attributes for {len(lut):,} offenders")
    return lut


def main():
    t0 = datetime.now()
    print("[offenders] Loading raw tables ...")
    cases = load_enriched_cases()
    accused = load_accused()

    acc = accused.dropna(subset=["OffenderID"]).copy()
    acc["OffenderID"] = acc["OffenderID"].astype(str)

    # rank offenders by distinct caseload
    case_counts = acc.groupby("OffenderID")["CaseMasterID"].nunique()

    # ---- target set: graph members ∪ top-by-caseload -----------------------
    adj = build_adjacency()
    gang = gang_lookup()
    target = set(adj) | set(gang) | set(case_counts.nlargest(TOP_BY_CASELOAD).index)
    target &= set(case_counts.index)  # only offenders we actually have
    print(f"[offenders] Enriching {len(target):,} offenders ...")

    acc_t = acc[acc["OffenderID"].isin(target)].copy()

    # name / age / gender: first appearance per offender
    ident = acc_t.drop_duplicates("OffenderID").set_index("OffenderID")
    name_by_id = ident["AccusedName"].to_dict()

    # join case attributes (crime type, district, gravity, date)
    case_cols = ["CaseMasterID"]
    for c in ("crime_type", "DistrictName", "IncidentFromDate", "GravityOffenceID"):
        if c in cases.columns:
            case_cols.append(c)
    merged = acc_t[["OffenderID", "CaseMasterID", "AccusedMasterID"]].merge(
        cases[case_cols], on="CaseMasterID", how="left"
    )

    # ---- arrests / custody records (best-effort join) ----------------------
    arrest_counts: dict[str, int] = {}
    last_arrest: dict[str, str] = {}
    try:
        arr = pd.read_csv(
            DATASET_DIR / "ArrestSurrender.csv",
            usecols=["CaseMasterID", "AccusedMasterID", "ArrestSurrenderDate"],
            low_memory=False,
        )
        arr["ArrestSurrenderDate"] = pd.to_datetime(arr["ArrestSurrenderDate"], errors="coerce")
        key = acc_t[["OffenderID", "CaseMasterID", "AccusedMasterID"]].dropna()
        ar = key.merge(arr, on=["CaseMasterID", "AccusedMasterID"], how="inner")
        arrest_counts = ar.groupby("OffenderID").size().to_dict()
        la = ar.dropna(subset=["ArrestSurrenderDate"]).groupby("OffenderID")["ArrestSurrenderDate"].max()
        last_arrest = {k: v.strftime("%Y-%m-%d") for k, v in la.items()}
        print(f"  arrest records linked for {len(arrest_counts):,} offenders")
    except Exception as exc:  # noqa: BLE001
        print(f"  [warn] arrest join skipped: {exc}")

    # ---- per-offender dossiers ---------------------------------------------
    dossiers: list[dict] = []
    for oid, grp in merged.groupby("OffenderID"):
        total = int(case_counts.get(oid, len(grp)))

        # crime types with counts, most frequent first
        ct = (grp["crime_type"].dropna().value_counts().head(MAX_CRIME_TYPES)
              if "crime_type" in grp else pd.Series(dtype=int))
        crime_types = [{"type": str(k), "count": int(v)} for k, v in ct.items()]
        top_crime = crime_types[0]["type"] if crime_types else "—"

        # districts
        dl = (grp["DistrictName"].dropna().value_counts().head(MAX_DISTRICTS)
              if "DistrictName" in grp else pd.Series(dtype=int))
        districts = [{"district": str(k), "count": int(v)} for k, v in dl.items()]
        n_districts = int(grp["DistrictName"].nunique()) if "DistrictName" in grp else 0

        # heinous share
        heinous_pct = 0.0
        if "GravityOffenceID" in grp and len(grp):
            heinous_pct = round(float((grp["GravityOffenceID"] == 1).mean()) * 100, 1)

        # career span
        first_i = last_i = None
        span_years = 0.0
        if "IncidentFromDate" in grp and grp["IncidentFromDate"].notna().any():
            fi = grp["IncidentFromDate"].min()
            li = grp["IncidentFromDate"].max()
            first_i = fi.strftime("%Y-%m-%d")
            last_i = li.strftime("%Y-%m-%d")
            span_years = round((li - fi).days / 365.25, 1)

        # associates
        associates = []
        for aid, w in sorted(adj.get(oid, {}).items(), key=lambda kv: kv[1], reverse=True)[:MAX_ASSOCIATES]:
            associates.append({
                "offender_id": aid,
                "name": name_by_id.get(aid) or "Unknown",
                "shared_cases": int(w),
            })

        g = gang.get(oid, {})
        row = ident.loc[oid] if oid in ident.index else None
        age = int(row["AgeYear"]) if row is not None and pd.notna(row.get("AgeYear")) and row.get("AgeYear", 0) > 0 else None

        dossiers.append({
            "offender_id": oid,
            "name": name_by_id.get(oid) or "Unknown",
            "age": age,
            "total_cases": total,
            "arrest_records": int(arrest_counts.get(oid, 0)),
            "last_arrest": last_arrest.get(oid),
            "top_crime": top_crime,
            "crime_types": crime_types,
            "districts": districts,
            "n_districts": n_districts,
            "heinous_pct": heinous_pct,
            "first_incident": first_i,
            "last_incident": last_i,
            "career_years": span_years,
            "n_associates": len(adj.get(oid, {})),
            "associates": associates,
            "gang_rank": g.get("gang_rank"),
            "threat_tier": g.get("threat_tier"),
            "threat_score": g.get("threat_score"),
            "gang_degree": g.get("gang_degree"),
            "is_articulation": bool(g.get("is_articulation", False)),
            "in_graph": oid in gang,
        })

    # ---- composite "wanted" score + ranking --------------------------------
    if dossiers:
        max_cases = max(d["total_cases"] for d in dossiers) or 1
        max_reach = max(d["n_districts"] for d in dossiers) or 1
        for d in dossiers:
            sev = d["heinous_pct"] / 100.0
            cases_n = d["total_cases"] / max_cases
            reach_n = d["n_districts"] / max_reach
            threat_n = (d["threat_score"] or 0) / 100.0
            d["wanted_score"] = round(
                100 * (0.34 * cases_n + 0.24 * sev + 0.18 * reach_n
                       + 0.16 * threat_n + 0.08 * min(1.0, (d["arrest_records"] / 5.0))),
                1,
            )
        dossiers.sort(key=lambda d: d["wanted_score"], reverse=True)
        for i, d in enumerate(dossiers, start=1):
            d["wanted_rank"] = i

    PRED.mkdir(parents=True, exist_ok=True)
    index = {
        "generated": datetime.now().isoformat(timespec="seconds"),
        "count": len(dossiers),
        "offenders": dossiers,
    }
    with open(PRED / "offender_index.json", "w", encoding="utf-8") as f:
        json.dump(index, f, separators=(",", ":"), default=str)
    print(f"[offenders] Saved offender_index.json ({len(dossiers):,} dossiers)")

    most_wanted = {
        "generated": index["generated"],
        "offenders": dossiers[:MOST_WANTED_N],
    }
    with open(PRED / "most_wanted.json", "w", encoding="utf-8") as f:
        json.dump(most_wanted, f, separators=(",", ":"), default=str)
    print(f"[offenders] Saved most_wanted.json (top {min(MOST_WANTED_N, len(dossiers))})")

    if dossiers:
        top = dossiers[0]
        print(f"[offenders] #1 most-wanted: {top['name']} — {top['total_cases']} cases, "
              f"{top['arrest_records']} arrest records, {top['n_districts']} districts, "
              f"{top['heinous_pct']}% heinous")
    print(f"[offenders] Done in {(datetime.now() - t0).total_seconds():.0f}s")


if __name__ == "__main__":
    main()

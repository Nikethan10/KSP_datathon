"""Socio-economic crime correlation analysis.

Joins ComplainantDetails (occupation, religion, caste) with CaseMaster and
Accused/Victim demographics (age, gender) to produce district-level and
state-level socio-economic correlations with crime types.

Output: outputs/sense/socioeconomic.json
"""
import json
from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd

from config import DATASET_DIR, OUTPUT_DIR

OUT = OUTPUT_DIR / "sense"

GENDER_MAP = {1: "Male", 2: "Female", 3: "Transgender"}
AGE_BINS = [0, 18, 25, 35, 45, 60, 100]
AGE_LABELS = ["<18", "18–25", "26–35", "36–45", "46–60", "60+"]


def load_and_join():
    print("[socio] loading CaseMaster ...", flush=True)
    cm = pd.read_csv(
        DATASET_DIR / "CaseMaster.csv",
        usecols=["CaseMasterID", "CrimeMajorHeadID", "GravityOffenceID",
                 "PoliceStationID", "IncidentFromDate"],
        dtype={"CaseMasterID": "int32", "CrimeMajorHeadID": "int8",
               "GravityOffenceID": "int8", "PoliceStationID": "int16"},
        parse_dates=["IncidentFromDate"],
        low_memory=False,
    )
    cm["hour"] = cm["IncidentFromDate"].dt.hour
    cm["is_night"] = ((cm["hour"] >= 22) | (cm["hour"] < 6)).astype(int)
    cm["is_weekend"] = cm["IncidentFromDate"].dt.dayofweek.isin([5, 6]).astype(int)
    cm["year"] = cm["IncidentFromDate"].dt.year

    print("[socio] loading lookups ...", flush=True)
    heads = pd.read_csv(DATASET_DIR / "CrimeHead.csv",
                        usecols=["CrimeHeadID", "CrimeGroupName"],
                        dtype={"CrimeHeadID": "int8"})
    gravity = pd.read_csv(DATASET_DIR / "GravityOffence.csv",
                          dtype={"GravityOffenceID": "int8"})
    units = pd.read_csv(DATASET_DIR / "Unit.csv",
                        usecols=["UnitID", "DistrictID"],
                        dtype={"UnitID": "int16", "DistrictID": "int8"})
    districts = pd.read_csv(DATASET_DIR / "District.csv",
                            usecols=["DistrictID", "DistrictName"],
                            dtype={"DistrictID": "int8"})
    occ = pd.read_csv(DATASET_DIR / "OccupationMaster.csv")
    rel = pd.read_csv(DATASET_DIR / "ReligionMaster.csv")
    caste = pd.read_csv(DATASET_DIR / "caste_master.csv")

    cm = cm.merge(heads, left_on="CrimeMajorHeadID", right_on="CrimeHeadID", how="left")
    cm = cm.merge(gravity, on="GravityOffenceID", how="left")
    cm = cm.merge(units, left_on="PoliceStationID", right_on="UnitID", how="left")
    cm = cm.merge(districts, on="DistrictID", how="left")
    cm.rename(columns={"CrimeGroupName": "crime_type", "LookupValue": "gravity_label"}, inplace=True)

    print("[socio] loading ComplainantDetails ...", flush=True)
    comp = pd.read_csv(
        DATASET_DIR / "ComplainantDetails.csv",
        usecols=["CaseMasterID", "AgeYear", "OccupationID", "ReligionID", "CasteID", "GenderID"],
        low_memory=False,
    )
    comp = comp.merge(occ, on="OccupationID", how="left")
    comp = comp.merge(rel, on="ReligionID", how="left")
    comp = comp.merge(caste, left_on="CasteID", right_on="caste_master_id", how="left")

    print("[socio] loading Accused ...", flush=True)
    acc = pd.read_csv(
        DATASET_DIR / "Accused.csv",
        usecols=["CaseMasterID", "AgeYear", "GenderID"],
        dtype={"CaseMasterID": "int32"},
        low_memory=False,
    )

    print("[socio] loading Victim ...", flush=True)
    vic = pd.read_csv(
        DATASET_DIR / "Victim.csv",
        usecols=["CaseMasterID", "AgeYear", "GenderID"],
        low_memory=False,
    )
    vic["AgeYear"] = pd.to_numeric(vic["AgeYear"], errors="coerce")
    vic["GenderID"] = pd.to_numeric(vic["GenderID"], errors="coerce")

    return cm, comp, acc, vic


def age_group(age):
    if pd.isna(age) or age < 0 or age > 120:
        return None
    for i, (lo, hi) in enumerate(zip(AGE_BINS, AGE_BINS[1:])):
        if lo <= age < hi:
            return AGE_LABELS[i]
    return AGE_LABELS[-1]


def safe_pct(n, total):
    return round(100 * n / total, 1) if total > 0 else 0


def compute_occupation_stats(cm, comp):
    merged = comp.merge(cm[["CaseMasterID", "crime_type", "gravity_label", "DistrictName"]],
                        on="CaseMasterID", how="inner")
    merged = merged.dropna(subset=["OccupationName"])

    total = len(merged)
    result = []
    for occ_name, gdf in merged.groupby("OccupationName"):
        n = len(gdf)
        heinous = (gdf["gravity_label"] == "Heinous").sum()
        top_crime = gdf["crime_type"].value_counts().index[0] if len(gdf) > 0 else ""
        result.append({
            "occupation": str(occ_name),
            "total": int(n),
            "pct": safe_pct(n, total),
            "heinous_pct": safe_pct(heinous, n),
            "top_crime": str(top_crime),
        })
    result.sort(key=lambda x: x["total"], reverse=True)
    return result


def compute_age_distribution(df, label):
    df = df.copy()
    df["age_group"] = df["AgeYear"].apply(age_group)
    df = df.dropna(subset=["age_group"])
    total = len(df)
    result = []
    for grp in AGE_LABELS:
        n = (df["age_group"] == grp).sum()
        result.append({"group": grp, "total": int(n), "pct": safe_pct(n, total)})
    return result


def compute_gender_distribution(df):
    df = df.copy()
    df["gender"] = df["GenderID"].map(GENDER_MAP)
    df = df.dropna(subset=["gender"])
    total = len(df)
    result = []
    for g in ["Male", "Female", "Transgender"]:
        n = (df["gender"] == g).sum()
        if n > 0:
            result.append({"gender": g, "total": int(n), "pct": safe_pct(n, total)})
    result.sort(key=lambda x: x["total"], reverse=True)
    return result


def compute_crime_occupation_matrix(cm, comp):
    merged = comp.merge(cm[["CaseMasterID", "crime_type"]], on="CaseMasterID", how="inner")
    merged = merged.dropna(subset=["OccupationName", "crime_type"])

    pivot = merged.groupby(["crime_type", "OccupationName"]).size().unstack(fill_value=0)
    result = []
    for crime in pivot.index:
        row = {"crime_type": str(crime)}
        for occ_col in pivot.columns:
            row[str(occ_col)] = int(pivot.loc[crime, occ_col])
        result.append(row)
    result.sort(key=lambda x: sum(v for k, v in x.items() if k != "crime_type"), reverse=True)
    return result[:12]


def compute_crime_caste_matrix(cm, comp):
    merged = comp.merge(cm[["CaseMasterID", "crime_type"]], on="CaseMasterID", how="inner")
    merged = merged.dropna(subset=["caste_master_name", "crime_type"])

    pivot = merged.groupby(["crime_type", "caste_master_name"]).size().unstack(fill_value=0)
    result = []
    for crime in pivot.index:
        row = {"crime_type": str(crime)}
        for col in pivot.columns:
            row[str(col)] = int(pivot.loc[crime, col])
        result.append(row)
    result.sort(key=lambda x: sum(v for k, v in x.items() if k != "crime_type"), reverse=True)
    return result[:12]


def compute_district_demographics(cm, comp, acc):
    merged_comp = comp.merge(
        cm[["CaseMasterID", "DistrictName", "crime_type"]],
        on="CaseMasterID", how="inner"
    )
    merged_comp = merged_comp.dropna(subset=["DistrictName"])

    merged_acc = acc.merge(
        cm[["CaseMasterID", "DistrictName"]],
        on="CaseMasterID", how="inner"
    )
    merged_acc = merged_acc.dropna(subset=["DistrictName"])

    result = []
    for district in sorted(merged_comp["DistrictName"].unique()):
        dcomp = merged_comp[merged_comp["DistrictName"] == district]
        dacc = merged_acc[merged_acc["DistrictName"] == district]

        dom_occ = dcomp["OccupationName"].value_counts().index[0] if len(dcomp) > 0 else "Unknown"
        dom_occ_pct = safe_pct(
            (dcomp["OccupationName"] == dom_occ).sum(), len(dcomp)
        ) if len(dcomp) > 0 else 0

        avg_acc_age = float(dacc["AgeYear"].median()) if len(dacc) > 0 else 0
        male_pct = safe_pct((dacc["GenderID"] == 1).sum(), len(dacc)) if len(dacc) > 0 else 0

        result.append({
            "district": str(district),
            "dominant_occupation": str(dom_occ),
            "dominant_occupation_pct": dom_occ_pct,
            "median_accused_age": round(avg_acc_age, 1),
            "male_accused_pct": male_pct,
            "total_complainants": int(len(dcomp)),
        })
    result.sort(key=lambda x: x["total_complainants"], reverse=True)
    return result


def compute_temporal_demographics(cm, comp, acc):
    merged_acc = acc.merge(
        cm[["CaseMasterID", "is_night", "is_weekend", "hour"]],
        on="CaseMasterID", how="inner"
    )
    merged_acc["age_group"] = merged_acc["AgeYear"].apply(age_group)
    merged_acc = merged_acc.dropna(subset=["age_group"])

    night_crimes = merged_acc[merged_acc["is_night"] == 1]
    night_age = night_crimes.groupby("age_group").size()
    night_total = len(night_crimes)

    merged_comp = comp.merge(
        cm[["CaseMasterID", "is_weekend"]],
        on="CaseMasterID", how="inner"
    )
    merged_comp = merged_comp.dropna(subset=["OccupationName"])
    weekend = merged_comp[merged_comp["is_weekend"] == 1]
    weekend_occ = weekend.groupby("OccupationName").size()
    weekend_total = len(weekend)

    hour_age = merged_acc.groupby(["hour", "age_group"]).size().unstack(fill_value=0)
    hour_data = []
    for h in range(24):
        row = {"hour": int(h)}
        for grp in AGE_LABELS:
            row[grp] = int(hour_age.loc[h, grp]) if h in hour_age.index and grp in hour_age.columns else 0
        hour_data.append(row)

    return {
        "night_crime_by_age": [
            {"group": str(g), "total": int(n), "pct": safe_pct(n, night_total)}
            for g, n in night_age.items()
        ],
        "weekend_by_occupation": [
            {"occupation": str(o), "total": int(n), "pct": safe_pct(n, weekend_total)}
            for o, n in weekend_occ.items()
        ],
        "hourly_age_heatmap": hour_data,
    }


def compute_yearly_trends(cm, comp):
    merged = comp.merge(cm[["CaseMasterID", "year", "crime_type"]], on="CaseMasterID", how="inner")
    merged = merged.dropna(subset=["OccupationName", "year"])

    pivot = merged.groupby(["year", "OccupationName"]).size().unstack(fill_value=0)
    result = []
    for yr in sorted(pivot.index):
        if pd.isna(yr) or yr < 2016 or yr > 2024:
            continue
        row = {"year": int(yr)}
        for col in pivot.columns:
            row[str(col)] = int(pivot.loc[yr, col])
        result.append(row)
    return result


def main():
    t0 = datetime.now()
    cm, comp, acc, vic = load_and_join()

    print(f"[socio] {len(cm):,} cases, {len(comp):,} complainants, "
          f"{len(acc):,} accused, {len(vic):,} victims", flush=True)

    payload = {
        "generated": datetime.now().isoformat(timespec="seconds"),
        "by_occupation": compute_occupation_stats(cm, comp),
        "by_age_group": {
            "accused": compute_age_distribution(acc, "accused"),
            "victim": compute_age_distribution(vic, "victim"),
        },
        "by_gender": {
            "accused": compute_gender_distribution(acc),
            "victim": compute_gender_distribution(vic),
        },
        "crime_occupation_matrix": compute_crime_occupation_matrix(cm, comp),
        "crime_caste_matrix": compute_crime_caste_matrix(cm, comp),
        "district_demographics": compute_district_demographics(cm, comp, acc),
        "temporal_demographics": compute_temporal_demographics(cm, comp, acc),
        "yearly_occupation_trend": compute_yearly_trends(cm, comp),
    }

    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / "socioeconomic.json"
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, separators=(",", ":"))

    import os
    size = os.path.getsize(path) / 1024
    elapsed = (datetime.now() - t0).total_seconds()
    print(f"[socio] done -> {path.name} ({size:.0f} KB) in {elapsed:.0f}s", flush=True)
    print(f"[socio] occupations: {[x['occupation'] for x in payload['by_occupation']]}", flush=True)
    print(f"[socio] crime×occ matrix: {len(payload['crime_occupation_matrix'])} crime types", flush=True)
    print(f"[socio] districts: {len(payload['district_demographics'])}", flush=True)


if __name__ == "__main__":
    main()

"""
sense/trends.py -- Temporal trend analysis for PRAHARI crime analytics.

Computes district summaries, time-series trends, and crime type breakdowns.
"""

import json
import numpy as np
import pandas as pd
from pathlib import Path

from config import OUTPUT_DIR


# ---------------------------------------------------------------------------
# Core Functions
# ---------------------------------------------------------------------------

def compute_district_summary(cases):
    """
    Per-district summary: total cases, YoY change, top crime type,
    heinous percentage, and a clearance proxy.

    Returns list of dicts suitable for JSON export.
    """
    results = []

    # Determine latest full year and prior year
    years = cases["year"].dropna().unique()
    years = sorted([int(y) for y in years])
    if len(years) < 2:
        latest_year = years[-1] if years else None
        prior_year = None
    else:
        latest_year = years[-1]
        prior_year = years[-2]

    for district, grp in cases.groupby("DistrictName"):
        if pd.isna(district):
            continue

        total = len(grp)

        # YoY change
        if latest_year is not None and prior_year is not None:
            latest_count = len(grp[grp["year"] == latest_year])
            prior_count = len(grp[grp["year"] == prior_year])
            if prior_count > 0:
                yoy_change = round((latest_count - prior_count) / prior_count * 100, 1)
            else:
                yoy_change = None
        else:
            yoy_change = None
            latest_count = total
            prior_count = 0

        # Top crime type
        if "crime_type" in grp.columns:
            top_crime = grp["crime_type"].value_counts()
            top_crime_type = str(top_crime.index[0]) if len(top_crime) > 0 else "Unknown"
            top_crime_count = int(top_crime.iloc[0]) if len(top_crime) > 0 else 0
        else:
            top_crime_type = "Unknown"
            top_crime_count = 0

        # Heinous percentage
        heinous = int((grp["GravityOffenceID"] == 1).sum())
        heinous_pct = round(heinous / total * 100, 1) if total > 0 else 0.0

        # Clearance proxy: cases with CaseStatusID >= 3 (chargesheeted/convicted)
        # Using CaseStatusID if available
        if "CaseStatusID" in grp.columns:
            cleared = int((grp["CaseStatusID"] >= 3).sum())
            clearance_pct = round(cleared / total * 100, 1) if total > 0 else 0.0
        else:
            clearance_pct = None

        results.append({
            "district": str(district),
            "total_cases": int(total),
            "latest_year": int(latest_year) if latest_year else None,
            "latest_year_cases": int(latest_count) if latest_year else None,
            "prior_year_cases": int(prior_count) if prior_year else None,
            "yoy_change_pct": yoy_change,
            "top_crime_type": top_crime_type,
            "top_crime_count": int(top_crime_count),
            "heinous_count": heinous,
            "heinous_pct": heinous_pct,
            "clearance_pct": clearance_pct,
        })

    # Sort by total cases descending
    results.sort(key=lambda x: x["total_cases"], reverse=True)
    return results


def compute_trend_timeseries(cases, freq="M"):
    """
    Compute time-series of case counts at the given frequency.

    Parameters
    ----------
    cases : DataFrame with IncidentFromDate column
    freq : 'M' for monthly, 'W' for weekly

    Returns
    -------
    dict with keys:
        overall: [{period, count}]
        by_crime_type: {crime_type: [{period, count}]}
        by_gravity: {gravity_label: [{period, count}]}
    """
    df = cases.dropna(subset=["IncidentFromDate"]).copy()
    df["period"] = df["IncidentFromDate"].dt.to_period(freq)

    result = {}

    # Overall
    overall = df.groupby("period").size().reset_index(name="count")
    overall["period"] = overall["period"].astype(str)
    result["overall"] = overall.to_dict(orient="records")

    # By crime type
    if "crime_type" in df.columns:
        by_ct = {}
        for ct, grp in df.groupby("crime_type"):
            if pd.isna(ct):
                continue
            ts = grp.groupby("period").size().reset_index(name="count")
            ts["period"] = ts["period"].astype(str)
            by_ct[str(ct)] = ts.to_dict(orient="records")
        result["by_crime_type"] = by_ct

    # By gravity
    if "gravity_label" in df.columns:
        by_grav = {}
        for gl, grp in df.groupby("gravity_label"):
            if pd.isna(gl):
                continue
            ts = grp.groupby("period").size().reset_index(name="count")
            ts["period"] = ts["period"].astype(str)
            by_grav[str(gl)] = ts.to_dict(orient="records")
        result["by_gravity"] = by_grav

    return result


def compute_crime_type_breakdown(cases, district=None):
    """
    Crime type distribution, optionally filtered by district.

    Returns list of dicts: [{crime_type, count, pct, gravity_mix}]
    where gravity_mix = {heinous_pct, non_heinous_pct, petty_pct}.
    """
    df = cases.copy()
    if district is not None:
        df = df[df["DistrictName"] == district]

    if len(df) == 0:
        return []

    total = len(df)
    results = []

    if "crime_type" not in df.columns:
        return []

    for ct, grp in df.groupby("crime_type"):
        if pd.isna(ct):
            continue
        count = len(grp)
        pct = round(count / total * 100, 2)

        # Gravity mix
        heinous = int((grp["GravityOffenceID"] == 1).sum())
        non_heinous = int((grp["GravityOffenceID"] == 2).sum())
        petty = int((grp["GravityOffenceID"] == 3).sum())
        gravity_mix = {
            "heinous_pct": round(heinous / count * 100, 1) if count > 0 else 0.0,
            "non_heinous_pct": round(non_heinous / count * 100, 1) if count > 0 else 0.0,
            "petty_pct": round(petty / count * 100, 1) if count > 0 else 0.0,
        }

        results.append({
            "crime_type": str(ct),
            "count": int(count),
            "pct": pct,
            "gravity_mix": gravity_mix,
        })

    results.sort(key=lambda x: x["count"], reverse=True)
    return results


def run_sense_trends(cases, output_dir=None):
    """
    Orchestrator: compute all trend analyses and export as JSON.
    """
    if output_dir is None:
        output_dir = OUTPUT_DIR / "sense"
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    # District summary
    print("[trends] Computing district summary ...")
    district_summary = compute_district_summary(cases)
    with open(output_dir / "district_summary.json", "w", encoding="utf-8") as f:
        json.dump(district_summary, f, indent=2)
    print(f"[trends] Saved district_summary.json ({len(district_summary)} districts)")

    # Monthly time series
    print("[trends] Computing monthly time series ...")
    monthly_ts = compute_trend_timeseries(cases, freq="M")
    with open(output_dir / "trend_monthly.json", "w", encoding="utf-8") as f:
        json.dump(monthly_ts, f, indent=2)
    n_months = len(monthly_ts.get("overall", []))
    print(f"[trends] Saved trend_monthly.json ({n_months} periods)")

    # Weekly time series
    print("[trends] Computing weekly time series ...")
    weekly_ts = compute_trend_timeseries(cases, freq="W")
    with open(output_dir / "trend_weekly.json", "w", encoding="utf-8") as f:
        json.dump(weekly_ts, f, indent=2)
    n_weeks = len(weekly_ts.get("overall", []))
    print(f"[trends] Saved trend_weekly.json ({n_weeks} periods)")

    # Crime type breakdown (overall)
    print("[trends] Computing crime type breakdown ...")
    breakdown = compute_crime_type_breakdown(cases)
    with open(output_dir / "crime_type_breakdown.json", "w", encoding="utf-8") as f:
        json.dump(breakdown, f, indent=2)
    print(f"[trends] Saved crime_type_breakdown.json ({len(breakdown)} types)")

    # Per-district breakdowns
    districts = cases["DistrictName"].dropna().unique()
    district_breakdowns = {}
    for dist in sorted(districts):
        bd = compute_crime_type_breakdown(cases, district=str(dist))
        district_breakdowns[str(dist)] = bd

    with open(output_dir / "crime_type_by_district.json", "w", encoding="utf-8") as f:
        json.dump(district_breakdowns, f, indent=2)
    print(f"[trends] Saved crime_type_by_district.json ({len(district_breakdowns)} districts)")

    return {
        "district_summary": district_summary,
        "monthly_ts": monthly_ts,
        "weekly_ts": weekly_ts,
        "breakdown": breakdown,
        "district_breakdowns": district_breakdowns,
    }

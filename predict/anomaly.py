"""
Crime anomaly detection module for PRAHARI.

Provides STL-based and rolling-window anomaly detection on daily crime counts,
changepoint detection via ruptures, and an anomaly feed generator.
"""

import json
import os
import logging
from datetime import timedelta
from pathlib import Path

import numpy as np
import pandas as pd

try:
    from statsmodels.tsa.seasonal import STL
    HAS_STL = True
except ImportError:
    HAS_STL = False

try:
    import ruptures as rpt
    HAS_RUPTURES = True
except ImportError:
    HAS_RUPTURES = False

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration defaults (overridable via environment or config)
# ---------------------------------------------------------------------------
ANOMALY_ZSCORE_THRESHOLD = float(os.getenv("ANOMALY_ZSCORE_THRESHOLD", "3.0"))
STL_PERIOD = int(os.getenv("STL_PERIOD", "7"))
OUTPUT_DIR = os.getenv("OUTPUT_DIR", "output")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _prepare_daily(cases: pd.DataFrame):
    """
    Precompute, in a SINGLE pass, the daily count series and the per-day
    CaseMasterID lists for every (district, crime_type) pair.

    Returns
    -------
    series_map : dict[(district, crime_type)] -> pd.Series (daily counts, zero-filled)
    caseid_map : dict[(district, crime_type, date_str)] -> list[str]
    """
    df = cases[["DistrictName", "crime_type", "IncidentFromDate", "CaseMasterID"]].copy()
    df["date"] = df["IncidentFromDate"].dt.normalize()

    # one groupby for counts
    counts = df.groupby(["DistrictName", "crime_type", "date"]).size()
    # one groupby for case ids per day
    ids = df.groupby(["DistrictName", "crime_type", "date"])["CaseMasterID"].apply(list)

    series_map = {}
    for (district, crime_type), grp in counts.groupby(level=[0, 1]):
        s = grp.droplevel([0, 1])
        if s.empty:
            continue
        idx = pd.date_range(s.index.min(), s.index.max(), freq="D")
        series_map[(district, crime_type)] = s.reindex(idx, fill_value=0).astype(float)

    caseid_map = {}
    for (district, crime_type, date), id_list in ids.items():
        caseid_map[(district, crime_type, str(pd.Timestamp(date).date()))] = [str(i) for i in id_list]

    return series_map, caseid_map


def _case_ids_lookup(caseid_map: dict, district: str, crime_type: str, date) -> list:
    key = (district, crime_type, str(pd.Timestamp(date).date()))
    return caseid_map.get(key, [])


def _severity_label(zscore: float) -> str:
    absz = abs(zscore)
    if absz >= 5.0:
        return "critical"
    if absz >= 4.0:
        return "high"
    if absz >= 3.0:
        return "medium"
    return "low"


# ---------------------------------------------------------------------------
# 1. STL-based anomaly detection
# ---------------------------------------------------------------------------

def detect_anomalies_stl(
    cases: pd.DataFrame,
    min_series_length: int = 60,
    period: int = STL_PERIOD,
    threshold: float = ANOMALY_ZSCORE_THRESHOLD,
) -> list:
    """
    For each (DistrictName x crime_type) combination, decompose the daily
    crime count series using STL (period=7 by default), compute z-scores of
    the residuals, and flag dates where |z| exceeds the threshold.

    Falls back to rolling-window detection if STL is unavailable or the
    series is too short.

    Returns a list of dicts:
        [{district, crime_type, date, observed, expected, residual,
          zscore, severity, case_ids}, ...]
    """
    if not HAS_STL:
        logger.warning("statsmodels not available; falling back to rolling anomaly detection")
        return detect_anomalies_rolling(cases, threshold=threshold)

    series_map, caseid_map = _prepare_daily(cases)
    anomalies = []

    for (district, crime_type), series in series_map.items():
        if len(series) < min_series_length:
            anomalies.extend(_rolling_anomalies_for_series(
                caseid_map, series, district, crime_type, threshold=threshold
            ))
            continue

        try:
            stl = STL(series.values, period=period, robust=True)
            result = stl.fit()
        except Exception as exc:
            logger.debug("STL failed for %s / %s: %s", district, crime_type, exc)
            anomalies.extend(_rolling_anomalies_for_series(
                caseid_map, series, district, crime_type, threshold=threshold
            ))
            continue

        residuals = result.resid
        expected = result.trend + result.seasonal

        std = np.nanstd(residuals)
        if std == 0 or np.isnan(std):
            continue

        zscores = residuals / std
        dates = list(series.index)

        for i, z in enumerate(zscores):
            if abs(z) >= threshold:
                dt = dates[i]
                anomalies.append({
                    "district": district,
                    "crime_type": crime_type,
                    "date": str(dt),
                    "observed": int(series.iloc[i]),
                    "expected": round(float(expected[i]), 2),
                    "residual": round(float(residuals[i]), 2),
                    "zscore": round(float(z), 2),
                    "severity": _severity_label(z),
                    "case_ids": _case_ids_lookup(caseid_map, district, crime_type, dt),
                })

    return anomalies


# ---------------------------------------------------------------------------
# 2. Rolling-window anomaly detection (fallback)
# ---------------------------------------------------------------------------

def _rolling_anomalies_for_series(
    caseid_map: dict,
    series: pd.Series,
    district: str,
    crime_type: str,
    window: int = 30,
    threshold: float = ANOMALY_ZSCORE_THRESHOLD,
) -> list:
    """Detect anomalies on a single pre-computed series using rolling stats."""
    anomalies = []
    if len(series) < window + 1:
        return anomalies

    vals = series.values.astype(float)
    dates = list(series.index)

    for i in range(window, len(vals)):
        win = vals[i - window : i]
        mu = np.nanmean(win)
        sigma = np.nanstd(win)
        if sigma == 0 or np.isnan(sigma):
            continue
        z = (vals[i] - mu) / sigma
        if abs(z) >= threshold:
            dt = dates[i]
            anomalies.append({
                "district": district,
                "crime_type": crime_type,
                "date": str(dt),
                "observed": int(vals[i]),
                "expected": round(float(mu), 2),
                "residual": round(float(vals[i] - mu), 2),
                "zscore": round(float(z), 2),
                "severity": _severity_label(z),
                "case_ids": _case_ids_lookup(caseid_map, district, crime_type, dt),
            })

    return anomalies


def detect_anomalies_rolling(
    cases: pd.DataFrame,
    window: int = 30,
    threshold: float = ANOMALY_ZSCORE_THRESHOLD,
) -> list:
    """
    Rolling mean +/- k*std anomaly detection across all (district x crime_type).

    Returns the same output format as detect_anomalies_stl.
    """
    series_map, caseid_map = _prepare_daily(cases)
    anomalies = []
    for (district, crime_type), series in series_map.items():
        anomalies.extend(_rolling_anomalies_for_series(
            caseid_map, series, district, crime_type,
            window=window, threshold=threshold,
        ))
    return anomalies


# ---------------------------------------------------------------------------
# 3. Changepoint detection
# ---------------------------------------------------------------------------

def detect_changepoints(
    cases: pd.DataFrame,
    district: str = None,
    crime_type_id=None,
    n_bkps: int = 5,
) -> list:
    """
    Detect structural changepoints in daily crime count series using ruptures.

    Parameters
    ----------
    cases : DataFrame
    district : str, optional  -- filter to one district
    crime_type_id : int/str, optional -- filter by CrimeMajorHeadID
    n_bkps : int -- max number of breakpoints to detect

    Returns
    -------
    list of dicts:
        [{district, crime_type, changepoint_date, direction, magnitude}, ...]
    """
    if not HAS_RUPTURES:
        logger.warning("ruptures library not available; skipping changepoint detection")
        return []

    filtered = cases
    if district is not None:
        filtered = filtered[filtered["DistrictName"] == district]
    if crime_type_id is not None:
        filtered = filtered[filtered["CrimeMajorHeadID"] == int(crime_type_id)]

    if filtered.empty:
        return []

    series_map, _ = _prepare_daily(filtered)

    # ruptures is expensive; process the highest-volume series only
    ranked = sorted(series_map.items(), key=lambda kv: kv[1].sum(), reverse=True)
    ranked = ranked[:80]

    results = []
    for (dist, ctype), series in ranked:
        if len(series) < 2 * n_bkps + 2:
            continue

        signal = series.values.astype(float)
        dates = list(series.index)

        try:
            # Binseg with an l2 cost is O(n) per split -- fast and stable.
            # (Pelt with an rbf kernel is O(n^2) and far too slow at this scale.)
            algo = rpt.Binseg(model="l2", min_size=14).fit(signal)
            bkps = algo.predict(n_bkps=n_bkps)

            # Remove the last element (always == len(signal))
            bkps = [b for b in bkps if b < len(signal)]

            for bp in bkps:
                if bp < 7:
                    continue
                before = np.mean(signal[max(0, bp - 7) : bp])
                after = np.mean(signal[bp : min(len(signal), bp + 7)])
                magnitude = float(after - before)
                direction = "increase" if magnitude > 0 else "decrease"

                results.append({
                    "district": dist,
                    "crime_type": ctype,
                    "changepoint_date": str(dates[bp]),
                    "direction": direction,
                    "magnitude": round(abs(magnitude), 2),
                })
        except Exception as exc:
            logger.debug("Changepoint detection failed for %s / %s: %s", dist, ctype, exc)
            continue

    return results


# ---------------------------------------------------------------------------
# 4. Anomaly feed
# ---------------------------------------------------------------------------

def get_anomaly_feed(anomalies: list, top_n: int = 20) -> list:
    """
    Deduplicate anomalies within a 3-day window per (district, crime_type),
    keep the entry with the highest |zscore|, attach a natural-language
    description, and return the top_n most severe.
    """
    if not anomalies:
        return []

    df = pd.DataFrame(anomalies)
    df["date_dt"] = pd.to_datetime(df["date"])
    df["abs_z"] = df["zscore"].abs()

    # Sort so we process highest zscore first
    df = df.sort_values("abs_z", ascending=False).reset_index(drop=True)

    kept_indices = []
    seen = set()  # (district, crime_type, date_bucket)

    for idx, row in df.iterrows():
        key_base = (row["district"], row["crime_type"])
        bucket = row["date_dt"].date().toordinal() // 3  # 3-day buckets
        key = (*key_base, bucket)
        if key in seen:
            continue
        seen.add(key)
        kept_indices.append(idx)

    deduped = df.loc[kept_indices].head(top_n)

    feed = []
    for _, row in deduped.iterrows():
        direction = "spike" if row["zscore"] > 0 else "drop"
        description = (
            "Unusual {dir} in {ct} cases in {dist} on {dt}: "
            "observed {obs} vs expected {exp} (z-score {z})."
        ).format(
            dir=direction,
            ct=row["crime_type"],
            dist=row["district"],
            dt=row["date"],
            obs=int(row["observed"]),
            exp=row["expected"],
            z=row["zscore"],
        )

        entry = {
            "district": row["district"],
            "crime_type": row["crime_type"],
            "date": row["date"],
            "observed": int(row["observed"]),
            "expected": row["expected"],
            "zscore": row["zscore"],
            "severity": row["severity"],
            "description": description,
        }
        if "case_ids" in row and isinstance(row["case_ids"], list):
            entry["case_ids"] = row["case_ids"]

        feed.append(entry)

    return feed


# ---------------------------------------------------------------------------
# 5. Orchestrator
# ---------------------------------------------------------------------------

def run_anomaly_detection(cases: pd.DataFrame, output_dir: str = None) -> dict:
    """
    Run the full anomaly detection pipeline and save results to JSON files.

    Outputs:
        - anomalies.json      (all flagged anomalies)
        - anomaly_feed.json   (top-N deduplicated feed with descriptions)
        - changepoints.json   (structural changepoints)

    Returns a summary dict with counts.
    """
    if output_dir is None:
        output_dir = OUTPUT_DIR

    out = Path(output_dir)
    out.mkdir(parents=True, exist_ok=True)

    # --- Anomalies (STL with rolling fallback) ---
    logger.info("Running anomaly detection (STL + rolling fallback)...")
    anomalies = detect_anomalies_stl(cases)
    logger.info("Detected %d anomalies", len(anomalies))

    anomalies_path = out / "anomalies.json"
    with open(anomalies_path, "w", encoding="utf-8") as f:
        json.dump(anomalies, f, indent=2, default=str, ensure_ascii=True)
    print("[anomaly] Saved {} anomalies to {}".format(len(anomalies), anomalies_path))

    # --- Feed ---
    feed = get_anomaly_feed(anomalies)
    feed_path = out / "anomaly_feed.json"
    with open(feed_path, "w", encoding="utf-8") as f:
        json.dump(feed, f, indent=2, default=str, ensure_ascii=True)
    print("[anomaly] Saved {} feed items to {}".format(len(feed), feed_path))

    # --- Changepoints ---
    logger.info("Running changepoint detection...")
    changepoints = detect_changepoints(cases)
    logger.info("Detected %d changepoints", len(changepoints))

    cp_path = out / "changepoints.json"
    with open(cp_path, "w", encoding="utf-8") as f:
        json.dump(changepoints, f, indent=2, default=str, ensure_ascii=True)
    print("[anomaly] Saved {} changepoints to {}".format(len(changepoints), cp_path))

    summary = {
        "total_anomalies": len(anomalies),
        "feed_items": len(feed),
        "changepoints": len(changepoints),
        "output_dir": str(out),
    }
    return summary

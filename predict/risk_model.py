import json
import numpy as np
import pandas as pd
from pathlib import Path
import lightgbm as lgb
from sklearn.metrics import roc_auc_score, precision_recall_curve, average_precision_score, brier_score_loss
from sklearn.isotonic import IsotonicRegression
from config import LGBM_PARAMS, OUTPUT_DIR

EXCLUDE_COLS = [
    "cell_id", "date", "shift", "n_crimes", "has_crime", "split",
    "year",  # leakage-prone
]

# Cap training rows to bound peak memory during LightGBM fit.
MAX_TRAIN_ROWS = 4_000_000
# Batch size for scoring to avoid a single huge float array.
PREDICT_BATCH = 2_000_000


def get_feature_cols(df: pd.DataFrame) -> list:
    return [c for c in df.columns if c not in EXCLUDE_COLS and df[c].dtype in ("float32", "float64", "int8", "int16", "int32", "int64")]


def train_risk_model(feature_matrix: pd.DataFrame) -> tuple:
    """Train LightGBM binary classifier on the feature matrix."""
    print("\n[risk_model] Training LightGBM ...")

    feat_cols = get_feature_cols(feature_matrix)
    print(f"  features: {len(feat_cols)} columns")

    train = feature_matrix[feature_matrix["split"] == "train"]
    val = feature_matrix[feature_matrix["split"] == "val"]

    # Cap training rows to bound memory (float32, keeps all positives).
    if len(train) > MAX_TRAIN_ROWS:
        pos = train[train["has_crime"] == 1]
        neg = train[train["has_crime"] == 0]
        n_neg = max(MAX_TRAIN_ROWS - len(pos), len(pos))
        neg = neg.sample(n=min(n_neg, len(neg)), random_state=42)
        train = pd.concat([pos, neg])
        print(f"  capped train to {len(train):,} rows (kept all {len(pos):,} positives)")

    # float32 halves memory vs LightGBM's default float64 conversion.
    X_train = train[feat_cols].astype("float32")
    y_train = train["has_crime"]
    X_val = val[feat_cols].astype("float32")
    y_val = val["has_crime"]

    print(f"  train: {len(X_train):,} rows (pos rate {y_train.mean():.4f})")
    print(f"  val:   {len(X_val):,} rows (pos rate {y_val.mean():.4f})")

    model = lgb.LGBMClassifier(**LGBM_PARAMS)
    model.fit(
        X_train, y_train,
        eval_set=[(X_val, y_val)],
        callbacks=[lgb.log_evaluation(100), lgb.early_stopping(50)],
    )

    val_proba = model.predict_proba(X_val)[:, 1]
    auc = roc_auc_score(y_val, val_proba)
    ap = average_precision_score(y_val, val_proba)
    print(f"  val AUC: {auc:.4f}, AP: {ap:.4f}")

    return model, feat_cols


def predict_risk(model, feature_matrix: pd.DataFrame, feat_cols: list) -> pd.DataFrame:
    """Score all rows with risk probabilities, in memory-bounded batches."""
    print("[risk_model] Predicting risk scores ...")
    feature_matrix = feature_matrix.copy()
    n = len(feature_matrix)
    scores = np.empty(n, dtype="float32")
    for start in range(0, n, PREDICT_BATCH):
        end = min(start + PREDICT_BATCH, n)
        X = feature_matrix.iloc[start:end][feat_cols].astype("float32")
        scores[start:end] = model.predict_proba(X)[:, 1]
    feature_matrix["risk_score"] = scores
    feature_matrix["risk_rank"] = feature_matrix["risk_score"].rank(pct=True)
    return feature_matrix


def compute_fallback_risk(cases: pd.DataFrame, active_grid: pd.DataFrame, halflife_days: int = 14) -> pd.DataFrame:
    """
    Exponentially-weighted recent crime counts per cell.
    This is a discrete Hawkes approximation.
    """
    print("[risk_model] Computing fallback risk (decayed counts) ...")
    cases = cases.copy()
    cases["date"] = cases["IncidentFromDate"].dt.normalize()
    ref_date = cases["date"].max()

    cases["days_ago"] = (ref_date - cases["date"]).dt.days
    cases["weight"] = np.exp(-np.log(2) * cases["days_ago"] / halflife_days)

    cell_risk = cases.groupby("cell_id")["weight"].sum().reset_index(name="fallback_risk")
    cell_risk["fallback_risk_rank"] = cell_risk["fallback_risk"].rank(pct=True)

    result = active_grid.merge(cell_risk, on="cell_id", how="left")
    result["fallback_risk"] = result["fallback_risk"].fillna(0)
    result["fallback_risk_rank"] = result["fallback_risk_rank"].fillna(0)
    return result


def compute_pai(scored_df: pd.DataFrame, area_pcts: list = None) -> dict:
    """
    Prediction Accuracy Index: (% of crimes in top X% area) / X%.
    Higher PAI = model concentrates crime predictions better.
    """
    if area_pcts is None:
        area_pcts = [1, 2, 5, 10, 20]

    test = scored_df[scored_df["split"] == "test"].copy()
    total_crimes = test["n_crimes"].sum()
    n_cells = test["cell_id"].nunique()

    cell_risk = test.groupby("cell_id").agg(
        mean_risk=("risk_score", "mean"),
        actual_crimes=("n_crimes", "sum"),
    ).reset_index()
    cell_risk = cell_risk.sort_values("mean_risk", ascending=False)

    results = {}
    for pct in area_pcts:
        n_top = max(1, int(n_cells * pct / 100))
        top_cells = cell_risk.head(n_top)
        crimes_in_top = top_cells["actual_crimes"].sum()
        crime_pct = crimes_in_top / total_crimes * 100 if total_crimes > 0 else 0
        pai = crime_pct / pct if pct > 0 else 0
        results[f"pai_{pct}pct"] = round(pai, 2)
        results[f"hit_rate_{pct}pct"] = round(crime_pct, 2)

    return results


def compute_pei(scored_df: pd.DataFrame, area_pcts: list = None) -> dict:
    """
    Prediction Efficiency Index: PAI / max possible PAI.
    """
    if area_pcts is None:
        area_pcts = [1, 2, 5, 10, 20]

    test = scored_df[scored_df["split"] == "test"].copy()
    total_crimes = test["n_crimes"].sum()
    n_cells = test["cell_id"].nunique()

    cell_actual = test.groupby("cell_id")["n_crimes"].sum().reset_index()
    cell_actual = cell_actual.sort_values("n_crimes", ascending=False)

    results = {}
    for pct in area_pcts:
        n_top = max(1, int(n_cells * pct / 100))

        oracle_crimes = cell_actual.head(n_top)["n_crimes"].sum()
        oracle_pct = oracle_crimes / total_crimes * 100 if total_crimes > 0 else 0
        max_pai = oracle_pct / pct if pct > 0 else 0

        pai_val = compute_pai(scored_df, [pct]).get(f"pai_{pct}pct", 0)
        pei = pai_val / max_pai if max_pai > 0 else 0
        results[f"pei_{pct}pct"] = round(pei, 4)

    return results


def get_feature_importance(model, feat_cols: list, top_n: int = 20) -> list:
    imp = model.feature_importances_
    pairs = sorted(zip(feat_cols, imp), key=lambda x: -x[1])
    return [{"feature": f, "importance": int(i)} for f, i in pairs[:top_n]]


def _reliability(y_true, y_prob, n_bins: int = 10):
    """Quantile-binned reliability curve + ECE (robust to class imbalance)."""
    order = np.argsort(y_prob)
    y_true, y_prob = np.asarray(y_true)[order], np.asarray(y_prob)[order]
    curve, ece, n = [], 0.0, len(y_prob)
    for idx in np.array_split(np.arange(n), n_bins):
        if len(idx) == 0:
            continue
        conf, acc = float(y_prob[idx].mean()), float(y_true[idx].mean())
        ece += (len(idx) / n) * abs(acc - conf)
        curve.append({"conf": round(conf, 4), "acc": round(acc, 4), "frac": round(len(idx) / n, 3)})
    return curve, round(ece, 4)


def compute_calibration(scored: pd.DataFrame) -> dict:
    """Reliability, Brier and ECE on the test split, before and after isotonic
    calibration (fit on validation). Isotonic is monotonic, so rankings —
    hence PAI/AUC and patrol allocation — are unchanged."""
    val, test = scored[scored["split"] == "val"], scored[scored["split"] == "test"]
    yv, pv = val["has_crime"].to_numpy(), val["risk_score"].to_numpy()
    yt, pt = test["has_crime"].to_numpy(), test["risk_score"].to_numpy()

    curve_raw, ece_raw = _reliability(yt, pt)
    iso = IsotonicRegression(out_of_bounds="clip").fit(pv, yv)
    pt_cal = iso.predict(pt)
    curve_cal, ece_cal = _reliability(yt, pt_cal)

    return {
        "n_test": int(len(test)),
        "pos_rate": round(float(yt.mean()), 4),
        "brier_raw": round(float(brier_score_loss(yt, pt)), 5),
        "brier_calibrated": round(float(brier_score_loss(yt, pt_cal)), 5),
        "ece_raw": ece_raw,
        "ece_calibrated": ece_cal,
        "reliability_raw": curve_raw,
        "reliability_calibrated": curve_cal,
        "method": "Quantile-binned reliability on the held-out test period; isotonic "
                  "regression fit on validation. Calibration is monotonic, so cell "
                  "ranking (PAI/AUC) and patrol allocation are unchanged.",
    }


def run_risk_model(feature_matrix: pd.DataFrame, cases: pd.DataFrame, active_grid: pd.DataFrame, output_dir: Path = None):
    """Full risk model pipeline."""
    if output_dir is None:
        output_dir = OUTPUT_DIR / "predict"
    output_dir.mkdir(parents=True, exist_ok=True)

    model, feat_cols = train_risk_model(feature_matrix)
    scored = predict_risk(model, feature_matrix, feat_cols)

    pai_results = compute_pai(scored)
    pei_results = compute_pei(scored)
    importance = get_feature_importance(model, feat_cols)

    fallback = compute_fallback_risk(cases, active_grid)

    test_auc = roc_auc_score(
        scored[scored["split"] == "test"]["has_crime"],
        scored[scored["split"] == "test"]["risk_score"],
    )

    summary = {
        "test_auc": round(test_auc, 4),
        "pai": pai_results,
        "pei": pei_results,
        "feature_importance": importance,
    }

    print("\n[risk_model] === RESULTS ===")
    print(f"  Test AUC: {test_auc:.4f}")
    for k, v in pai_results.items():
        print(f"  {k}: {v}")

    with open(output_dir / "risk_summary.json", "w") as f:
        json.dump(summary, f, indent=2, default=str)

    # model calibration -> TRUST tab (rank-preserving, doesn't affect PAI/patrol)
    try:
        calibration = compute_calibration(scored)
        calib_dir = OUTPUT_DIR / "trust"
        calib_dir.mkdir(parents=True, exist_ok=True)
        with open(calib_dir / "calibration.json", "w") as f:
            json.dump(calibration, f, indent=2)
        print(f"  calibration: Brier {calibration['brier_raw']}->{calibration['brier_calibrated']}, "
              f"ECE {calibration['ece_raw']}->{calibration['ece_calibrated']}")
    except Exception as e:
        print(f"  calibration skipped: {e}")

    # Same correction as main.py: the exported surface is a forecast, so it
    # must not average in the periods the model was trained on.
    forecast = scored[scored["split"] == "test"]
    risk_map = forecast.groupby("cell_id").agg(
        mean_risk=("risk_score", "mean"),
        max_risk=("risk_score", "max"),
    ).reset_index()
    risk_map = risk_map.merge(
        active_grid[["cell_id", "cell_lat", "cell_lon"]], on="cell_id", how="left"
    )
    risk_map.to_json(output_dir / "risk_map.json", orient="records")

    fallback.to_json(output_dir / "fallback_risk.json", orient="records")

    print(f"  saved to {output_dir}")
    return model, scored, summary

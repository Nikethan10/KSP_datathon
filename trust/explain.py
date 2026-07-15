import json
import numpy as np
import pandas as pd
from pathlib import Path
from config import OUTPUT_DIR

FEATURE_DESCRIPTIONS = {
    "nr_0.5km_1d": "crimes within 500m in the past day",
    "nr_0.5km_3d": "crimes within 500m in 3 days",
    "nr_0.5km_7d": "nearby crimes this week",
    "nr_0.5km_14d": "nearby crimes in 2 weeks",
    "nr_0.5km_30d": "nearby crimes this month",
    "nr_1.0km_1d": "crimes within 1km yesterday",
    "nr_1.0km_3d": "crimes within 1km in 3 days",
    "nr_1.0km_7d": "crimes within 1km this week",
    "nr_1.0km_14d": "crimes within 1km in 2 weeks",
    "nr_1.0km_30d": "crimes within 1km this month",
    "nr_2.0km_7d": "crimes within 2km this week",
    "nr_2.0km_30d": "crimes in the wider area this month",
    "nr_5.0km_7d": "crimes in the neighborhood this week",
    "nr_5.0km_30d": "crimes in the neighborhood this month",
    "is_weekend": "weekend",
    "is_night_shift": "night shift (10pm-6am)",
    "is_morning_shift": "morning shift",
    "dow_sin": "day of week pattern",
    "dow_cos": "day of week pattern",
    "month_sin": "seasonal pattern",
    "month_cos": "seasonal pattern",
    "hour_sin": "time of day pattern",
    "hour_cos": "time of day pattern",
    "hist_total": "historically high-crime area",
    "hist_heinous_pct": "high rate of serious crime",
    "hist_violent_pct": "high rate of violent crime",
    "hist_property_pct": "property crime area",
    "crime_entropy": "diverse crime types in area",
    "n_crime_types": "multiple crime categories",
    "n_officers": "officer deployment level",
}


def compute_shap_explanations(model, feature_matrix: pd.DataFrame, feat_cols: list, n_samples: int = 1000):
    """Compute SHAP values for model predictions."""
    try:
        import shap
    except ImportError:
        print("[explain] SHAP not installed, skipping explanations")
        return None, None

    print(f"[explain] Computing SHAP values on {n_samples} samples ...")

    test = feature_matrix[feature_matrix["split"] == "test"]
    if len(test) > n_samples:
        test = test.sample(n=n_samples, random_state=42)

    X = test[feat_cols]
    explainer = shap.TreeExplainer(model)
    shap_values = explainer.shap_values(X)

    if isinstance(shap_values, list):
        shap_values = shap_values[1]

    shap_df = pd.DataFrame(shap_values, columns=feat_cols, index=test.index)
    print(f"  SHAP computed for {len(shap_df)} samples")
    return shap_df, test


def get_global_feature_importance(shap_df: pd.DataFrame) -> list:
    """Mean absolute SHAP value per feature."""
    if shap_df is None:
        return []
    mean_abs = shap_df.abs().mean().sort_values(ascending=False)
    return [
        {
            "feature": feat,
            "mean_abs_shap": round(float(val), 6),
            "description": FEATURE_DESCRIPTIONS.get(feat, feat),
        }
        for feat, val in mean_abs.head(20).items()
    ]


def explain_prediction(shap_row: pd.Series, risk_score: float = None) -> str:
    """Generate natural language explanation for a single prediction."""
    top_positive = shap_row[shap_row > 0].sort_values(ascending=False).head(3)
    top_negative = shap_row[shap_row < 0].sort_values().head(2)

    reasons = []
    for feat, val in top_positive.items():
        desc = FEATURE_DESCRIPTIONS.get(feat, feat)
        reasons.append(desc)

    mitigating = []
    for feat, val in top_negative.items():
        desc = FEATURE_DESCRIPTIONS.get(feat, feat)
        mitigating.append(desc)

    explanation = "Risk elevated due to: " + ", ".join(reasons) if reasons else "No strong risk drivers"
    if mitigating:
        explanation += ". Mitigating: " + ", ".join(mitigating)
    if risk_score is not None:
        explanation = f"Risk score: {risk_score:.3f}. " + explanation

    return explanation


def generate_sample_explanations(
    shap_df: pd.DataFrame, test_df: pd.DataFrame, feat_cols: list, model, n: int = 50
) -> list:
    """Generate explanations for top-risk predictions."""
    if shap_df is None:
        return []

    X = test_df[feat_cols]
    scores = model.predict_proba(X)[:, 1]
    test_df = test_df.copy()
    test_df["risk_score"] = scores

    top_risk = test_df.nlargest(n, "risk_score")

    explanations = []
    for idx in top_risk.index:
        if idx in shap_df.index:
            explanation = explain_prediction(shap_df.loc[idx], test_df.loc[idx, "risk_score"])
            explanations.append({
                "cell_id": int(test_df.loc[idx, "cell_id"]),
                "date": str(test_df.loc[idx, "date"]),
                "shift": int(test_df.loc[idx, "shift"]),
                "risk_score": round(float(test_df.loc[idx, "risk_score"]), 4),
                "has_crime": int(test_df.loc[idx, "has_crime"]),
                "explanation": explanation,
                "top_features": {
                    feat: round(float(shap_df.loc[idx, feat]), 4)
                    for feat in shap_df.loc[idx].abs().nlargest(5).index
                },
            })

    return explanations


def run_explanations(model, feature_matrix, feat_cols, output_dir=None):
    """Full SHAP explanation pipeline."""
    if output_dir is None:
        output_dir = OUTPUT_DIR / "trust"
    output_dir.mkdir(parents=True, exist_ok=True)

    shap_df, test_df = compute_shap_explanations(model, feature_matrix, feat_cols)

    global_importance = get_global_feature_importance(shap_df)
    sample_explanations = generate_sample_explanations(shap_df, test_df, feat_cols, model)

    results = {
        "global_feature_importance": global_importance,
        "sample_explanations": sample_explanations,
    }

    with open(output_dir / "shap_explanations.json", "w") as f:
        json.dump(results, f, indent=2, default=str)

    if global_importance:
        print("\n[explain] Top SHAP features:")
        for item in global_importance[:10]:
            print(f"  {item['feature']:30s} {item['mean_abs_shap']:.6f}  ({item['description']})")

    print(f"  saved {len(sample_explanations)} explanations to {output_dir}")
    return results

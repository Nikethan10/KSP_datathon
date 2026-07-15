import json
import numpy as np
import pandas as pd
from pathlib import Path
from config import OUTPUT_DIR


def compute_disparity_metrics(risk_map: pd.DataFrame, cases: pd.DataFrame) -> dict:
    """
    Measure fairness of risk score distribution across districts.
    Key question: are risk scores disproportionately concentrated in certain areas?
    """
    print("[fairness] Computing disparity metrics ...")

    if "DistrictName" not in risk_map.columns:
        cell_district = cases.groupby("cell_id")["DistrictName"].first().reset_index()
        rm = risk_map.merge(cell_district, on="cell_id", how="left")
    else:
        rm = risk_map.copy()

    risk_col = "mean_risk" if "mean_risk" in rm.columns else "fallback_risk"
    if risk_col not in rm.columns:
        print("  no risk column found")
        return {}

    district_risk = rm.groupby("DistrictName").agg(
        mean_risk=(risk_col, "mean"),
        max_risk=(risk_col, "max"),
        total_risk=(risk_col, "sum"),
        n_cells=("cell_id", "count"),
    ).reset_index()

    district_cases = cases.groupby("DistrictName")["CaseMasterID"].count().reset_index(name="n_cases")
    district_risk = district_risk.merge(district_cases, on="DistrictName", how="left")
    district_risk["cases_per_cell"] = district_risk["n_cases"] / district_risk["n_cells"]

    risk_values = district_risk["mean_risk"].values
    gini = _gini_coefficient(risk_values)

    max_min_ratio = risk_values.max() / risk_values.min() if risk_values.min() > 0 else float("inf")

    cv = risk_values.std() / risk_values.mean() if risk_values.mean() > 0 else 0

    top5 = district_risk.nlargest(5, "mean_risk")
    bottom5 = district_risk.nsmallest(5, "mean_risk")

    return {
        "gini_coefficient": round(float(gini), 4),
        "max_min_ratio": round(float(max_min_ratio), 2),
        "coefficient_of_variation": round(float(cv), 4),
        "n_districts": len(district_risk),
        "highest_risk_districts": top5[["DistrictName", "mean_risk", "n_cases"]].to_dict("records"),
        "lowest_risk_districts": bottom5[["DistrictName", "mean_risk", "n_cases"]].to_dict("records"),
        "district_details": district_risk.to_dict("records"),
    }


def _gini_coefficient(values: np.ndarray) -> float:
    values = np.sort(values)
    n = len(values)
    if n == 0 or values.sum() == 0:
        return 0.0
    index = np.arange(1, n + 1)
    return float(np.sum((2 * index - n - 1) * values) / (n * np.sum(values)))


def compute_reporting_bias_adjustment(cases: pd.DataFrame, chargesheets: pd.DataFrame = None) -> dict:
    """
    Use the chargesheet rate as a proxy for reporting/processing propensity.
    Areas with lower clearance may have under-reporting, biasing predictions.

    Uses ChargesheetDetails (case has a filed chargesheet) rather than
    CaseStatusID, which is single-valued in this dataset.
    """
    print("[fairness] Computing reporting bias adjustment ...")

    district_total = cases.groupby("DistrictName")["CaseMasterID"].count().reset_index(name="total_cases")

    if chargesheets is None:
        try:
            from data.loader import load_chargesheets
            chargesheets = load_chargesheets()
        except Exception as e:
            print(f"  chargesheet load failed ({e}); clearance proxy unavailable")
            chargesheets = pd.DataFrame(columns=["CaseMasterID"])

    charged_ids = set(pd.to_numeric(chargesheets["CaseMasterID"], errors="coerce").dropna().astype("int64"))
    charged = cases[cases["CaseMasterID"].isin(charged_ids)]
    district_cleared = charged.groupby("DistrictName")["CaseMasterID"].count().reset_index(name="cleared_cases")

    merged = district_total.merge(district_cleared, on="DistrictName", how="left")
    merged["cleared_cases"] = merged["cleared_cases"].fillna(0)
    merged["clearance_rate"] = merged["cleared_cases"] / merged["total_cases"]

    median_clearance = merged["clearance_rate"].median()
    merged["reporting_weight"] = median_clearance / merged["clearance_rate"].clip(lower=0.01)
    merged["reporting_weight"] = merged["reporting_weight"].clip(0.5, 2.0)

    under_reporting = merged[merged["clearance_rate"] < median_clearance * 0.7]
    over_reporting = merged[merged["clearance_rate"] > median_clearance * 1.3]

    return {
        "median_clearance_rate": round(float(median_clearance), 4),
        "districts_below_median": len(under_reporting),
        "districts_above_median": len(over_reporting),
        "adjustment_weights": merged[["DistrictName", "clearance_rate", "reporting_weight"]].to_dict("records"),
        "flag": "Areas with low clearance rates may have under-reporting, "
                "inflating apparent safety. Predictions are area-level, not individual-level.",
    }


def generate_fairness_statement() -> str:
    return (
        "PRAHARI predicts crime risk for geographic areas and time windows, "
        "not for individuals. It uses historical FIR data which reflects "
        "reported crime, not true crime rates. Areas with lower reporting "
        "or clearance rates may appear safer than they are. We apply a "
        "reporting-bias adjustment to mitigate this effect. Risk scores "
        "are explained via SHAP to ensure transparency. No demographic "
        "attributes (religion, caste) are used as model features."
    )


def run_fairness_audit(risk_map, cases, output_dir=None):
    """Full fairness audit pipeline."""
    if output_dir is None:
        output_dir = OUTPUT_DIR / "trust"
    output_dir.mkdir(parents=True, exist_ok=True)

    disparity = compute_disparity_metrics(risk_map, cases)
    bias_adj = compute_reporting_bias_adjustment(cases)
    statement = generate_fairness_statement()

    report = {
        "disparity_metrics": disparity,
        "reporting_bias": bias_adj,
        "fairness_statement": statement,
        "methodology": {
            "risk_target": "area-level, not individual",
            "features_excluded": ["religion", "caste", "ethnicity"],
            "bias_proxy": "clearance rate as reporting propensity",
            "adjustment": "inverse-clearance weighting, clipped to [0.5, 2.0]",
        },
    }

    with open(output_dir / "fairness_report.json", "w") as f:
        json.dump(report, f, indent=2, default=str)

    print("\n[fairness] === FAIRNESS REPORT ===")
    if disparity:
        print(f"  Gini coefficient: {disparity.get('gini_coefficient', 'N/A')}")
        print(f"  Max/Min risk ratio: {disparity.get('max_min_ratio', 'N/A')}")
    print(f"  Reporting bias: {bias_adj.get('districts_below_median', 0)} districts flagged")
    print(f"  saved to {output_dir}")

    return report

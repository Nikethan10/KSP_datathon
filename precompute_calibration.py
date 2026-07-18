"""Model calibration analysis for the TRUST tab.

A risk score of 0.30 should mean crime actually occurs ~30% of the time. Tree
models are often miscalibrated. We measure it (reliability curve, Brier, ECE),
then fit isotonic calibration on the validation split and show the improvement.

Calibration is monotonic, so it does NOT change the cell ranking — PAI/AUC and
the patrol optimizer are unaffected. This is a pure trust/quality upgrade.

Refits the model from the CACHED feature matrix (deterministic, same params →
identical model), so headline numbers are unchanged. Feature building — the slow
part — is skipped.
"""
import sys, os, json
sys.path.insert(0, os.path.dirname(__file__))

import pandas as pd
from config import CACHE_DIR, OUTPUT_DIR
from predict.risk_model import train_risk_model, predict_risk, compute_calibration


if __name__ == "__main__":
    fm_path = CACHE_DIR / "feature_matrix.parquet"
    print(f"[calibration] loading cached features: {fm_path}")
    fm = pd.read_parquet(fm_path)

    model, feat_cols = train_risk_model(fm)
    scored = predict_risk(model, fm, feat_cols)

    result = compute_calibration(scored)

    out = OUTPUT_DIR / "trust" / "calibration.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2)

    print(f"\n[calibration] Brier {result['brier_raw']} -> {result['brier_calibrated']}, "
          f"ECE {result['ece_raw']} -> {result['ece_calibrated']}")
    print(f"[calibration] saved {out}")

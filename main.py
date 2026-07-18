"""
PRAHARI - AI-Driven Crime Analytics Platform
Main orchestrator: runs all pipeline stages end-to-end.

Usage:
    python main.py                          # full pipeline
    python main.py --skip-features          # skip feature engineering (use cached)
    python main.py --skip-training          # skip model training (use cached)
    python main.py --sense-only             # only run SENSE layer
    python main.py --network-only           # only run network analysis
"""
import sys
import os
import argparse
import json
import time
from pathlib import Path

sys.path.insert(0, os.path.dirname(__file__))

from config import OUTPUT_DIR, CACHE_DIR, DATASET_DIR


def require_dataset():
    """Fail loudly and usefully rather than with a FileNotFoundError six
    frames deep inside a loader. The dataset ships separately from the repo."""
    if DATASET_DIR.is_dir() and any(DATASET_DIR.glob("*.csv")):
        return
    sys.exit(
        f"""
PRAHARI: dataset not found at {DATASET_DIR}

The KSP dataset is distributed separately and is not in this repository.
Extract `submission_dataset` and point PRAHARI_DATASET_DIR at it:

  PowerShell:  $env:PRAHARI_DATASET_DIR = "D:/path/to/submission_dataset"
  bash:        export PRAHARI_DATASET_DIR=/path/to/submission_dataset

Or place the folder at <repo>/dataset. See .env.example.
"""
    )


def main():
    parser = argparse.ArgumentParser(description="PRAHARI Pipeline")
    parser.add_argument("--skip-features", action="store_true", help="Use cached feature matrix")
    parser.add_argument("--skip-training", action="store_true", help="Use cached model")
    parser.add_argument("--sense-only", action="store_true")
    parser.add_argument("--network-only", action="store_true")
    parser.add_argument("--anomaly-only", action="store_true")
    parser.add_argument("--district", type=str, default=None, help="Filter to a specific district")
    args = parser.parse_args()

    require_dataset()

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    CACHE_DIR.mkdir(parents=True, exist_ok=True)

    t0 = time.time()
    print("=" * 70)
    print("PRAHARI - Crime Analytics Pipeline")
    print("=" * 70)

    # ── Step 1: Load data ──────────────────────────────────────────────
    print("\n--- STEP 1: Loading data ---")
    from data.loader import load_enriched_cases, load_accused, load_employees
    from data.grid import build_grid, assign_cases_to_grid, get_active_cells

    cases = load_enriched_cases()
    accused = load_accused()
    employees = load_employees()

    if args.district:
        cases = cases[cases["DistrictName"] == args.district]
        print(f"  filtered to district: {args.district} ({len(cases):,} cases)")

    grid = build_grid()
    cases = assign_cases_to_grid(cases, grid)
    active_grid = get_active_cells(cases, grid)

    print(f"  data loaded in {time.time()-t0:.1f}s")

    # ── Network-only mode ──────────────────────────────────────────────
    if args.network_only:
        print("\n--- NETWORK ANALYSIS ONLY ---")
        from predict.network import run_network_analysis
        run_network_analysis(accused, cases, OUTPUT_DIR / "predict")
        print(f"\nDone in {time.time()-t0:.1f}s")
        return

    # ── Anomaly-only mode ──────────────────────────────────────────────
    if args.anomaly_only:
        print("\n--- ANOMALY DETECTION ONLY ---")
        from predict.anomaly import run_anomaly_detection
        run_anomaly_detection(cases, OUTPUT_DIR / "predict")
        print(f"\nDone in {time.time()-t0:.1f}s")
        return

    # ── Step 2: SENSE layer ────────────────────────────────────────────
    print("\n--- STEP 2: SENSE layer ---")
    from sense.hotspots import run_sense_hotspots
    from sense.trends import run_sense_trends

    run_sense_hotspots(cases, active_grid, OUTPUT_DIR / "sense")
    run_sense_trends(cases, OUTPUT_DIR / "sense")

    if args.sense_only:
        print(f"\nSENSE complete in {time.time()-t0:.1f}s")
        return

    # ── Step 3: Feature engineering ────────────────────────────────────
    print("\n--- STEP 3: Feature engineering ---")
    from data.features import build_feature_matrix

    feature_matrix = build_feature_matrix(
        cases, active_grid, employees,
        use_fast_nr=True,
        sample_negatives=0.1,
    )

    # ── Step 4: PREDICT - Risk model ───────────────────────────────────
    print("\n--- STEP 4: Risk model ---")
    from predict.risk_model import run_risk_model

    model, scored, risk_summary = run_risk_model(feature_matrix, cases, active_grid)

    # ── Step 5: PREDICT - Network ──────────────────────────────────────
    print("\n--- STEP 5: Network analysis ---")
    from predict.network import run_network_analysis

    network_summary = run_network_analysis(accused, cases, OUTPUT_DIR / "predict")

    # ── Step 6: PREDICT - Anomaly ──────────────────────────────────────
    print("\n--- STEP 6: Anomaly detection ---")
    from predict.anomaly import run_anomaly_detection

    run_anomaly_detection(cases, OUTPUT_DIR / "predict")

    # ── Step 7: ACT - Patrol optimizer ─────────────────────────────────
    print("\n--- STEP 7: Patrol optimizer ---")
    from act.patrol_optimizer import run_patrol_optimizer

    # Forecast-period rows only. Averaging risk across train+val+test blends
    # scores the model fitted on into a surface that is supposed to say where
    # crime is going next, and it measurably degrades the ranking: the
    # all-splits surface captures 40.8% of test-period crime in its top 5% of
    # cells, the test-only surface 53.1%. The optimizer inherits whichever it
    # is given, so this is the ACT layer's input as well as the map's.
    forecast = scored[scored["split"] == "test"]
    risk_map = forecast.groupby("cell_id").agg(
        mean_risk=("risk_score", "mean"),
        max_risk=("risk_score", "max"),
    ).reset_index()
    risk_map = risk_map.merge(
        active_grid[["cell_id", "cell_lat", "cell_lon"]], on="cell_id", how="left"
    )

    patrol_summary = run_patrol_optimizer(risk_map, cases)

    # ── Step 8: TRUST ──────────────────────────────────────────────────
    print("\n--- STEP 8: TRUST layer ---")
    from trust.explain import run_explanations
    from trust.fairness import run_fairness_audit
    from predict.risk_model import get_feature_cols

    feat_cols = get_feature_cols(feature_matrix)
    run_explanations(model, feature_matrix, feat_cols)
    fairness_report = run_fairness_audit(risk_map, cases)

    # ── Step 9: Benchmark ──────────────────────────────────────────────
    print("\n--- STEP 9: Benchmark ---")
    from evaluate.benchmark import run_full_benchmark

    # Load network summary from file if needed
    net_summary_path = OUTPUT_DIR / "predict" / "network_summary.json"
    if net_summary_path.exists():
        with open(net_summary_path) as f:
            network_summary = json.load(f)

    run_full_benchmark(
        risk_summary, patrol_summary, network_summary, fairness_report, scored_df=scored
    )

    elapsed = time.time() - t0
    print(f"\n{'='*70}")
    print(f"PRAHARI pipeline complete in {elapsed/60:.1f} minutes")
    print(f"All outputs in: {OUTPUT_DIR}")
    print(f"{'='*70}")


if __name__ == "__main__":
    main()

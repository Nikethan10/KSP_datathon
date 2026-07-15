"""Re-run only the fairness audit (chargesheet-based clearance)."""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

import pandas as pd
from config import OUTPUT_DIR
from data.loader import load_enriched_cases
from data.grid import build_grid, assign_cases_to_grid
from trust.fairness import run_fairness_audit

cases = load_enriched_cases()
grid = build_grid()
cases = assign_cases_to_grid(cases, grid)

risk_map = pd.read_json(OUTPUT_DIR / "predict" / "risk_map.json", orient="records")
run_fairness_audit(risk_map, cases)
print("DONE")

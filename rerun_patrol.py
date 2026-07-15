"""Re-run only the patrol optimizer using the saved risk map."""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

import pandas as pd
from config import OUTPUT_DIR
from data.loader import load_enriched_cases
from data.grid import build_grid, assign_cases_to_grid
from act.patrol_optimizer import run_patrol_optimizer

cases = load_enriched_cases()
grid = build_grid()
cases = assign_cases_to_grid(cases, grid)

risk_map = pd.read_json(OUTPUT_DIR / "predict" / "risk_map.json", orient="records")
print(f"risk map: {len(risk_map):,} cells")

summary = run_patrol_optimizer(risk_map, cases)
print("\nFinal summary:", summary)

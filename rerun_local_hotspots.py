"""Compute the district-normalized hotspot layers only."""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from data.loader import load_enriched_cases
from data.grid import build_grid, assign_cases_to_grid
from sense.hotspots import run_sense_hotspots_local

cases = load_enriched_cases()
grid = build_grid()
cases = assign_cases_to_grid(cases, grid)

run_sense_hotspots_local(cases, grid)
print("DONE")

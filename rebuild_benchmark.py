"""Rebuild benchmark_report.json from the saved per-step summaries."""
import sys, os, json
sys.path.insert(0, os.path.dirname(__file__))

from config import OUTPUT_DIR
from evaluate.benchmark import run_full_benchmark

def load(p):
    p = OUTPUT_DIR / p
    if p.exists():
        with open(p, encoding="utf-8") as f:
            return json.load(f)
    print(f"  missing: {p}")
    return {}

risk = load("predict/risk_summary.json")
patrol = load("act/patrol_summary.json")
network = load("predict/network_summary.json")
fairness = load("trust/fairness_report.json")

run_full_benchmark(risk, patrol, network, fairness)

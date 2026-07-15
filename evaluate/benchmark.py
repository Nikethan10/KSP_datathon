import json
import numpy as np
import pandas as pd
from pathlib import Path
from config import OUTPUT_DIR


def run_full_benchmark(
    risk_summary: dict,
    patrol_summary: dict,
    network_summary: dict,
    fairness_report: dict,
    output_dir: Path = None,
) -> dict:
    """Consolidate all metrics into a single benchmark report."""
    if output_dir is None:
        output_dir = OUTPUT_DIR / "evaluate"
    output_dir.mkdir(parents=True, exist_ok=True)

    report = {
        "headline_numbers": {},
        "risk_model": {},
        "patrol_optimizer": {},
        "network_analysis": {},
        "fairness": {},
    }

    # Risk model metrics
    if risk_summary:
        report["risk_model"] = {
            "test_auc": risk_summary.get("test_auc"),
            "pai": risk_summary.get("pai", {}),
            "pei": risk_summary.get("pei", {}),
            "top_features": risk_summary.get("feature_importance", [])[:5],
        }
        pai_5 = risk_summary.get("pai", {}).get("pai_5pct", 0)
        hit_5 = risk_summary.get("pai", {}).get("hit_rate_5pct", 0)
        report["headline_numbers"]["pai_5pct"] = pai_5
        report["headline_numbers"]["hit_rate_5pct"] = hit_5

    # Patrol optimizer
    if patrol_summary:
        report["patrol_optimizer"] = patrol_summary
        report["headline_numbers"]["coverage_uplift_pct"] = patrol_summary.get("greedy_uplift_pct", 0)
        report["headline_numbers"]["optimized_coverage_pct"] = patrol_summary.get("greedy_coverage_pct", 0)

    # Network
    if network_summary:
        report["network_analysis"] = network_summary
        if network_summary.get("top_disruptor"):
            report["headline_numbers"]["top_disruptor_drop_pct"] = network_summary["top_disruptor"].get("drop_pct", 0)
        # cumulative removal on the giant component
        cum = network_summary.get("cumulative_disruption")
        if cum:
            report["headline_numbers"]["cumulative_disruption_removed"] = cum.get("n_removed")
            report["headline_numbers"]["cumulative_disruption_drop_pct"] = cum.get("drop_pct")
        report["headline_numbers"]["network_communities"] = network_summary.get("n_communities")
        report["headline_numbers"]["network_modularity"] = network_summary.get("modularity")
        # gang-level fragmentation is the meaningful disruption headline
        gang = network_summary.get("best_gang_target")
        if gang:
            report["headline_numbers"]["best_gang_size"] = gang.get("gang_size")
            report["headline_numbers"]["best_gang_fragmentation_pct"] = gang.get("fragmentation_drop_pct")
            report["headline_numbers"]["best_gang_pieces"] = gang.get("components_after_top3_removed")

    # Fairness
    if fairness_report:
        dm = fairness_report.get("disparity_metrics", {})
        report["fairness"] = {
            "gini": dm.get("gini_coefficient"),
            "max_min_ratio": dm.get("max_min_ratio"),
            "bias_districts_flagged": fairness_report.get("reporting_bias", {}).get("districts_below_median", 0),
        }

    # Print the pitch card
    hn = report["headline_numbers"]
    print("\n" + "=" * 70)
    print("PRAHARI BENCHMARK REPORT")
    print("=" * 70)
    print(f"\n  1. PAI at 5% area: {hn.get('pai_5pct', 'N/A')}")
    print(f"     ({hn.get('hit_rate_5pct', 'N/A')}% of crimes found in 5% of area)")
    print(f"\n  2. Coverage uplift: +{hn.get('coverage_uplift_pct', 'N/A')}%")
    print(f"     ({hn.get('optimized_coverage_pct', 'N/A')}% optimized vs baseline)")
    print(f"\n  3. Network: {hn.get('network_communities', 'N/A')} co-offending groups "
          f"(modularity {hn.get('network_modularity', 'N/A')})")
    if hn.get("best_gang_fragmentation_pct") is not None:
        print(f"     Best target: {hn.get('best_gang_size')}-member gang, removing top 3 "
              f"fragments it {hn.get('best_gang_fragmentation_pct')}% into "
              f"{hn.get('best_gang_pieces')} pieces")
    if report["fairness"].get("gini") is not None:
        print(f"\n  Fairness Gini: {report['fairness']['gini']}")
    print("=" * 70)

    with open(output_dir / "benchmark_report.json", "w") as f:
        json.dump(report, f, indent=2, default=str)

    print(f"\n  Full report saved to {output_dir / 'benchmark_report.json'}")
    return report

import json
import numpy as np
import pandas as pd
from pathlib import Path
from config import OUTPUT_DIR


def compute_rri(scored_df, hit_rates: dict, area_pcts=None) -> dict:
    """Recapture Rate Index: our hit rate divided by the hit rate of the
    baseline stations already run -- "patrol where crime has been happening".

    The baseline is ranked using ONLY pre-test rows, which is exactly the
    information a station has on the first morning of the forecast window.
    Ranking it on test-period data would leak the answer and understate us.

    RRI > 1 means we beat current practice. An SP can take "27% better than
    what you do today" to a budget meeting; AUC does not survive that room.
    """
    if area_pcts is None:
        area_pcts = [1, 2, 5, 10, 20]

    test = scored_df[scored_df["split"] == "test"]
    prior = scored_df[scored_df["split"] != "test"]

    actual = test.groupby("cell_id")["n_crimes"].sum()
    total = actual.sum()
    n_cells = actual.size
    if total == 0 or n_cells == 0:
        return {}

    prior_vol = prior.groupby("cell_id")["n_crimes"].sum().reindex(actual.index).fillna(0)

    results = {}
    for pct in area_pcts:
        n_top = max(1, int(n_cells * pct / 100))
        top = prior_vol.sort_values(ascending=False).head(n_top).index
        base = actual.reindex(top).fillna(0).sum() / total * 100
        ours = hit_rates.get(f"hit_rate_{pct}pct", 0)
        results[f"baseline_hit_rate_{pct}pct"] = round(base, 2)
        results[f"rri_{pct}pct"] = round(ours / base, 2) if base else None
    return results


def run_full_benchmark(
    risk_summary: dict,
    patrol_summary: dict,
    network_summary: dict,
    fairness_report: dict,
    output_dir: Path = None,
    scored_df=None,
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
        # Kept for the methodology appendix and never rendered in the UI. AUC
        # is computed over all cell-shift pairs, including the vast mass of
        # quiet rural cells at 3am nobody was ever going to patrol, so it
        # flatters the model and says nothing about the decision an SP makes.
        "diagnostics": {},
    }

    # Risk model metrics
    if risk_summary:
        report["risk_model"] = {
            "pai": risk_summary.get("pai", {}),
            "pei": risk_summary.get("pei", {}),
            "top_features": risk_summary.get("feature_importance", [])[:5],
        }
        report["diagnostics"]["test_auc"] = risk_summary.get("test_auc")
        pai = risk_summary.get("pai", {})
        report["headline_numbers"]["pai_5pct"] = pai.get("pai_5pct", 0)
        report["headline_numbers"]["hit_rate_5pct"] = pai.get("hit_rate_5pct", 0)

        if scored_df is not None:
            rri = compute_rri(scored_df, pai)
            report["risk_model"]["rri"] = rri
            if rri.get("rri_5pct") is not None:
                report["headline_numbers"]["rri_5pct"] = rri["rri_5pct"]
                report["headline_numbers"]["baseline_hit_rate_5pct"] = rri["baseline_hit_rate_5pct"]

    # Patrol optimizer
    if patrol_summary:
        report["patrol_optimizer"] = patrol_summary
        report["headline_numbers"]["coverage_uplift_pct"] = patrol_summary.get("greedy_uplift_pct", 0)
        report["headline_numbers"]["optimized_coverage_pct"] = patrol_summary.get("greedy_coverage_pct", 0)
        report["headline_numbers"]["statusquo_coverage_pct"] = patrol_summary.get("statusquo_coverage_pct", 0)
        report["headline_numbers"]["greedy_uplift_vs_statusquo_pct"] = patrol_summary.get("greedy_uplift_vs_statusquo_pct", 0)
        report["headline_numbers"]["greedy_uplift_vs_statusquo_x"] = patrol_summary.get("greedy_uplift_vs_statusquo_x", 0)

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
    if hn.get("rri_5pct") is not None:
        print(f"  1b. Recapture Rate Index: {hn['rri_5pct']}x current practice")
        print(f"      (baseline 'patrol where crime has been' captures "
              f"{hn.get('baseline_hit_rate_5pct')}% in the same 5%)")
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

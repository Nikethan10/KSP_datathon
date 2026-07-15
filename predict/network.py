"""
Co-offending network analysis for PRAHARI.

Builds a graph where nodes are repeat offenders (OffenderID) and edges
connect offenders who co-appear as accused in the same FIR.  Provides
community detection, centrality scoring, disruption simulation, and
Cytoscape.js export for the frontend.
"""

import json
import itertools
from pathlib import Path

import numpy as np
import pandas as pd
import networkx as nx

from config import TOP_DISRUPTORS, MAX_NETWORK_NODES_EXPORT, OUTPUT_DIR, CRIME_GROUPS_VIOLENT


# ---------------------------------------------------------------------------
# 1. Graph construction
# ---------------------------------------------------------------------------

# Cases with more accused than this are mass-arrest events (riots, unlawful
# assembly). Co-arrest in a riot is not evidence of criminal association, and
# a single 289-accused case would inject a 289-clique (~41k spurious edges).
# Capping at 10 follows standard co-offending network practice.
MAX_ACCUSED_PER_CASE = 10


def build_cooffending_graph(accused: pd.DataFrame) -> nx.Graph:
    """
    Build an undirected weighted graph of co-offending relationships.

    Nodes  = OffenderIDs that appear in 2+ cases (repeat offenders).
    Edges  = pairs of offenders accused in the same case (mass-arrest
             cases excluded, see MAX_ACCUSED_PER_CASE).
    Weight = number of shared cases.
    """
    print("[network] Building co-offending graph ...")

    # -- keep only rows with a valid OffenderID --------------------------
    acc = accused.dropna(subset=["OffenderID"]).copy()
    acc["OffenderID"] = acc["OffenderID"].astype(str)

    # -- exclude mass-arrest cases before anything else -------------------
    case_sizes = acc.groupby("CaseMasterID")["OffenderID"].nunique()
    mega = case_sizes[case_sizes > MAX_ACCUSED_PER_CASE].index
    if len(mega):
        before = len(acc)
        acc = acc[~acc["CaseMasterID"].isin(mega)]
        print(f"  excluded {len(mega):,} mass-arrest cases (>{MAX_ACCUSED_PER_CASE} accused), "
              f"{before - len(acc):,} rows dropped")

    # -- filter to repeat offenders (2+ cases) ---------------------------
    case_counts = acc.groupby("OffenderID")["CaseMasterID"].nunique()
    repeat_ids = set(case_counts[case_counts >= 2].index)
    acc = acc[acc["OffenderID"].isin(repeat_ids)]
    print(f"  repeat offenders (2+ cases): {len(repeat_ids):,}")

    # -- first-appearance name for each offender -------------------------
    name_map = (
        acc.dropna(subset=["AccusedName"])
        .drop_duplicates(subset=["OffenderID"])
        .set_index("OffenderID")["AccusedName"]
        .to_dict()
    )

    # -- total cases per offender ----------------------------------------
    total_cases = (
        acc.groupby("OffenderID")["CaseMasterID"]
        .nunique()
        .to_dict()
    )

    # -- build edges from case-level co-appearances ----------------------
    # keep only multi-accused cases among repeat offenders
    offenders_per_case = acc.groupby("CaseMasterID")["OffenderID"].nunique()
    multi_cases = offenders_per_case[offenders_per_case > 1].index
    acc_multi = acc[acc["CaseMasterID"].isin(multi_cases)]
    print(f"  rows in multi-accused cases (repeaters): {len(acc_multi):,}")

    # vectorized edge construction: self-join on CaseMasterID
    pairs = acc_multi[["CaseMasterID", "OffenderID"]].merge(
        acc_multi[["CaseMasterID", "OffenderID"]],
        on="CaseMasterID",
        suffixes=("_a", "_b"),
    )
    pairs = pairs[pairs["OffenderID_a"] < pairs["OffenderID_b"]]
    edge_counts = pairs.groupby(["OffenderID_a", "OffenderID_b"]).size().reset_index(name="weight")
    print(f"  unique edges: {len(edge_counts):,}")

    # -- assemble graph (vectorized) -------------------------------------
    # Build directly from the edge list; isolates never enter the graph.
    G = nx.from_pandas_edgelist(
        edge_counts,
        source="OffenderID_a",
        target="OffenderID_b",
        edge_attr="weight",
    )
    # Attach node attributes only for nodes that made it into the graph.
    nx.set_node_attributes(
        G, {n: total_cases.get(n, 0) for n in G.nodes()}, "total_cases"
    )
    nx.set_node_attributes(
        G, {n: name_map.get(n, "Unknown") for n in G.nodes()}, "name"
    )

    print(
        f"  graph: {G.number_of_nodes():,} nodes, "
        f"{G.number_of_edges():,} edges"
    )
    return G


# ---------------------------------------------------------------------------
# 2. Community detection
# ---------------------------------------------------------------------------

def detect_communities(G: nx.Graph) -> dict:
    """
    Louvain community detection with fallback to connected components.

    Returns
    -------
    dict with keys: communities, modularity, n_communities, community_labels
    """
    print("[network] Detecting communities ...")

    if G.number_of_nodes() == 0:
        return {
            "communities": [],
            "modularity": 0.0,
            "n_communities": 0,
            "community_labels": {},
        }

    try:
        communities = nx.community.louvain_communities(
            G, weight="weight", seed=42
        )
        modularity = nx.community.modularity(G, communities, weight="weight")
    except Exception as exc:
        print(f"  Louvain failed ({exc}), falling back to connected components")
        communities = list(nx.connected_components(G))
        modularity = 0.0

    # node -> community_id mapping
    community_labels: dict[str, int] = {}
    for cid, members in enumerate(communities):
        for node in members:
            community_labels[node] = cid

    print(
        f"  communities: {len(communities):,}, "
        f"modularity: {modularity:.4f}"
    )
    return {
        "communities": communities,
        "modularity": modularity,
        "n_communities": len(communities),
        "community_labels": community_labels,
    }


# ---------------------------------------------------------------------------
# 3. Centrality
# ---------------------------------------------------------------------------

def compute_centrality(G: nx.Graph, community_labels: dict | None = None) -> pd.DataFrame:
    """
    Compute degree and key-player score centrality.
    For small graphs (<=5000 nodes) the key-player score is exact betweenness;
    for large graphs it falls back to degree centrality.

    Returns a DataFrame indexed by offender_id.
    """
    print("[network] Computing centrality measures ...")
    n = G.number_of_nodes()
    if n == 0:
        return pd.DataFrame(
            columns=["offender_id", "degree", "key_player_score",
                      "eigenvector", "total_cases", "community_id"]
        )

    # Degree centrality is cheap and O(1) per node over the whole graph.
    deg = nx.degree_centrality(G)

    # Exact/approx betweenness in NetworkX is pure Python and infeasible on
    # very large graphs (this network is ~400K nodes). Only compute it when the
    # graph is small enough; otherwise use degree as the key-player proxy.
    # Degree is a well-established centrality and, on this hub-and-spoke
    # co-offending topology, ranks the same high-connectivity offenders.
    BETWEENNESS_MAX_NODES = 5000
    if n <= BETWEENNESS_MAX_NODES:
        print(f"  graph small ({n:,} nodes) -> computing exact betweenness")
        between = nx.betweenness_centrality(G, weight=None, seed=42)
        try:
            eigen = nx.eigenvector_centrality(G, max_iter=100, weight=None)
        except nx.PowerIterationFailedConvergence:
            eigen = deg
    else:
        print(f"  graph large ({n:,} nodes) -> ranking key players by degree "
              f"(betweenness skipped as infeasible in NetworkX at this scale)")
        between = deg          # degree stands in as the ranking metric
        eigen = deg

    df = pd.DataFrame({"offender_id": list(G.nodes())})
    df["degree"] = df["offender_id"].map(deg).astype("float32")
    df["key_player_score"] = df["offender_id"].map(between).fillna(0.0).astype("float32")
    df["eigenvector"] = df["offender_id"].map(eigen).fillna(0.0).astype("float32")
    df["total_cases"] = df["offender_id"].map(
        {nd: G.nodes[nd].get("total_cases", 0) for nd in G.nodes()}
    )
    df["community_id"] = df["offender_id"].map(community_labels or {}).fillna(-1).astype(int)

    # Rank by degree (primary key-player signal on large graphs).
    df.sort_values("degree", ascending=False, inplace=True)
    df.reset_index(drop=True, inplace=True)
    print(f"  centrality computed for {len(df):,} nodes")
    return df


# ---------------------------------------------------------------------------
# 4. Disruption simulation
# ---------------------------------------------------------------------------

def simulate_network_disruption(
    G: nx.Graph,
    centrality_df: pd.DataFrame,
    top_n: int = TOP_DISRUPTORS,
    rank_col: str = "degree",
) -> dict:
    """
    Simulate targeted removal of the top key-player offenders and measure how
    the criminal network fragments.

    Two views are produced:
      * per_node   -- remove each key player individually; drop in the largest
                      connected component. (On one giant component this is small
                      per node, but still ranks who matters most.)
      * cumulative -- remove the top-K key players TOGETHER and track how the
                      largest component shrinks and splits. This is the headline:
                      "arresting the top 50 offenders fragments the network by X%."
    """
    print(f"[network] Simulating disruption (top {top_n} by {rank_col}) ...")

    if G.number_of_nodes() == 0:
        return {"per_node": [], "cumulative": [], "headline": None}

    top_nodes = centrality_df.nlargest(top_n, rank_col)["offender_id"].tolist()

    largest_before = len(max(nx.connected_components(G), key=len))
    components_before = nx.number_connected_components(G)

    # quick lookup for the ranking metric
    metric_lookup = dict(zip(centrality_df["offender_id"], centrality_df[rank_col]))

    # ---- per-node individual removal ----------------------------------
    per_node: list[dict] = []
    for oid in top_nodes:
        if oid not in G:
            continue
        node_data = dict(G.nodes[oid])
        incident = list(G.edges(oid, data=True))
        G.remove_node(oid)
        largest_after = (
            len(max(nx.connected_components(G), key=len))
            if G.number_of_nodes() > 0 else 0
        )
        G.add_node(oid, **node_data)
        for u, v, d in incident:
            G.add_edge(u, v, **d)

        per_node.append({
            "offender_id": oid,
            "name": node_data.get("name", "Unknown"),
            "total_cases": node_data.get("total_cases", 0),
            "key_player_score": float(metric_lookup.get(oid, 0.0)),
            "largest_comp_before": largest_before,
            "largest_comp_after": largest_after,
            "drop_pct": round(
                (largest_before - largest_after) / largest_before * 100
                if largest_before > 0 else 0.0, 2
            ),
            "edges_removed": len(incident),
        })
    per_node.sort(key=lambda r: r["drop_pct"], reverse=True)

    # ---- cumulative removal (headline) --------------------------------
    checkpoints = sorted({1, 5, 10, 20, 30, 40, top_n})
    removed_store = []  # (oid, node_data, incident_edges) for restoration
    cumulative: list[dict] = []
    for i, oid in enumerate(top_nodes, start=1):
        if oid in G:
            removed_store.append((oid, dict(G.nodes[oid]), list(G.edges(oid, data=True))))
            G.remove_node(oid)
        if i in checkpoints:
            largest_now = (
                len(max(nx.connected_components(G), key=len))
                if G.number_of_nodes() > 0 else 0
            )
            cumulative.append({
                "n_removed": i,
                "largest_comp": largest_now,
                "n_components": nx.number_connected_components(G),
                "drop_pct": round(
                    (largest_before - largest_now) / largest_before * 100
                    if largest_before > 0 else 0.0, 2
                ),
            })

    # restore graph to original state
    for oid, nd, inc in removed_store:
        G.add_node(oid, **nd)
        for u, v, d in inc:
            G.add_edge(u, v, **d)

    headline = cumulative[-1] if cumulative else None
    if headline:
        print(f"  cumulative: removing top {headline['n_removed']} offenders "
              f"drops the largest network by {headline['drop_pct']}% "
              f"(into {headline['n_components']:,} components)")
    if per_node:
        print(f"  top single disruptor: {per_node[0]['name']} "
              f"({per_node[0]['drop_pct']}% drop alone)")

    return {
        "per_node": per_node,
        "cumulative": cumulative,
        "headline": headline,
        "largest_before": largest_before,
        "components_before": components_before,
    }


def _minmax(vals: list[float]) -> list[float]:
    lo, hi = min(vals), max(vals)
    if hi == lo:
        return [0.5] * len(vals)
    return [(v - lo) / (hi - lo) for v in vals]


def _gang_crime_profiles(
    accused: pd.DataFrame, cases: pd.DataFrame, member_to_gang: dict,
) -> dict:
    """One-pass crime-severity profile per gang: heinous %, violent %, top crime
    type, district reach, and total cases. Severity is what makes a gang a
    *threat* (vs. just large), so it drives the threat tier."""
    acc = accused.dropna(subset=["OffenderID"]).copy()
    acc["OffenderID"] = acc["OffenderID"].astype(str)
    acc["gang"] = acc["OffenderID"].map(member_to_gang)
    acc = acc.dropna(subset=["gang"])

    sev_cols = ["CaseMasterID", "GravityOffenceID", "CrimeMajorHeadID"]
    for c in ("crime_type", "DistrictName"):
        if c in cases.columns:
            sev_cols.append(c)
    g = acc[["gang", "CaseMasterID"]].merge(cases[sev_cols], on="CaseMasterID", how="left")
    g["is_heinous"] = (g["GravityOffenceID"] == 1).astype("int8")
    g["is_violent"] = g["CrimeMajorHeadID"].isin(CRIME_GROUPS_VIOLENT).astype("int8")

    profiles: dict = {}
    for gang_id, grp in g.groupby("gang"):
        top_crime = "—"
        if "crime_type" in grp.columns and grp["crime_type"].notna().any():
            top_crime = str(grp["crime_type"].mode().iloc[0])
        profiles[int(gang_id)] = {
            "total_cases": int(grp["CaseMasterID"].nunique()),
            "heinous": float(grp["is_heinous"].mean()),
            "violent": float(grp["is_violent"].mean()),
            "n_districts": int(grp["DistrictName"].nunique()) if "DistrictName" in grp else 0,
            "top_crime": top_crime,
        }
    return profiles


def analyze_gangs(
    G: nx.Graph,
    communities: dict,
    accused: pd.DataFrame,
    cases: pd.DataFrame,
    top_gangs: int = 24,
    min_size: int = 6,
    max_members_viz: int = 22,
) -> tuple[list[dict], dict]:
    """
    Classify the major gangs by THREAT and build a threat-tagged 3D network.

    Threat combines: crime severity (heinous + violent share — the dominant
    factor), gang size, internal cohesion, activity, and geographic reach.
    Gangs are split High / Medium / Low so the map immediately shows which
    crews are dangerous. Each record also carries the disruption result
    (fragmentation from arresting the top-3 members) used elsewhere.

    Returns (gang_records, gang_network) where gang_network = {nodes, edges}
    with each node tagged {gang, tier, threat} for the frontend.
    """
    print(f"[network] Classifying gang threats (top {top_gangs} gangs) ...")

    comm_list = communities.get("communities", [])
    if not comm_list:
        return [], {"nodes": [], "edges": []}

    gangs = sorted((c for c in comm_list if len(c) >= min_size), key=len, reverse=True)[:top_gangs]

    # offender -> gang_rank (1 = largest); one map drives the crime-profile join
    member_to_gang = {}
    for rank, members in enumerate(gangs, start=1):
        for m in members:
            member_to_gang[m] = rank
    profiles = _gang_crime_profiles(accused, cases, member_to_gang)

    # ---- per-gang structural + disruption metrics -----------------------
    raw = []
    for rank, members in enumerate(gangs, start=1):
        sub = G.subgraph(members).copy()
        size = sub.number_of_nodes()
        deg = dict(sub.degree())
        key_members = sorted(deg, key=deg.get, reverse=True)
        try:
            artic = set(nx.articulation_points(sub))
        except Exception:
            artic = set()

        largest_before = len(max(nx.connected_components(sub), key=len))
        remove_set = key_members[:3]
        H = sub.copy()
        H.remove_nodes_from(remove_set)
        if H.number_of_nodes() > 0:
            largest_after = len(max(nx.connected_components(H), key=len))
            comps_after = nx.number_connected_components(H)
        else:
            largest_after, comps_after = 0, 0
        drop_pct = round((largest_before - largest_after) / largest_before * 100
                         if largest_before > 0 else 0.0, 1)

        prof = profiles.get(rank, {"total_cases": 0, "heinous": 0.0, "violent": 0.0,
                                   "n_districts": 0, "top_crime": "—"})
        raw.append({
            "rank": rank, "sub": sub, "size": size, "edges": sub.number_of_edges(),
            "deg": deg, "key_members": key_members, "artic": artic,
            "remove_set": remove_set, "largest_before": largest_before,
            "largest_after": largest_after, "comps_after": comps_after,
            "drop_pct": drop_pct, "cohesion": sub.number_of_edges() / size if size else 0.0,
            **prof,
        })

    # ---- composite threat score + tiers ---------------------------------
    severity = [0.6 * r["heinous"] + 0.4 * r["violent"] for r in raw]
    size_n = _minmax([r["size"] for r in raw])
    coh_n = _minmax([r["cohesion"] for r in raw])
    cases_n = _minmax([r["total_cases"] for r in raw])
    reach_n = _minmax([r["n_districts"] for r in raw])
    scores = [round(100 * (0.42 * severity[i] + 0.20 * size_n[i] + 0.14 * coh_n[i]
                           + 0.12 * cases_n[i] + 0.12 * reach_n[i]), 1)
              for i in range(len(raw))]

    order = sorted(range(len(raw)), key=lambda i: scores[i], reverse=True)
    n = len(order)
    tier = {}
    for pos, i in enumerate(order):
        frac = pos / max(1, n)
        tier[i] = "high" if frac < 0.30 else ("medium" if frac < 0.65 else "low")

    # ---- assemble records + threat-tagged network -----------------------
    records: list[dict] = []
    viz_nodes, viz_edges = [], []
    for i, r in enumerate(raw):
        rank, deg = r["rank"], r["deg"]
        records.append({
            "gang_rank": rank,
            "gang_size": r["size"],
            "gang_edges": r["edges"],
            "threat_tier": tier[i],
            "threat_score": scores[i],
            "heinous_pct": round(r["heinous"] * 100, 1),
            "violent_pct": round(r["violent"] * 100, 1),
            "top_crime": r["top_crime"],
            "n_districts": r["n_districts"],
            "total_cases": r["total_cases"],
            "n_articulation_points": len(r["artic"]),
            "key_members": [
                {"offender_id": m, "name": G.nodes[m].get("name", "Unknown"),
                 "gang_degree": deg[m], "total_cases": G.nodes[m].get("total_cases", 0),
                 "is_articulation": m in r["artic"]}
                for m in r["key_members"][:5]
            ],
            "removed_top3": [G.nodes[m].get("name", "Unknown") for m in r["remove_set"]],
            "largest_before": r["largest_before"],
            "largest_after_top3_removed": r["largest_after"],
            "components_after_top3_removed": r["comps_after"],
            "fragmentation_drop_pct": r["drop_pct"],
        })

        # viz: keep each gang's most-connected core so clusters stay legible
        chosen = r["key_members"][:max_members_viz]
        for m in chosen:
            viz_nodes.append({"data": {
                "id": str(m), "label": G.nodes[m].get("name", "Unknown"),
                "size": G.nodes[m].get("total_cases", 1), "gang": rank,
                "tier": tier[i], "threat": scores[i], "degree": deg[m],
            }})
        for u, v, d in r["sub"].subgraph(chosen).edges(data=True):
            viz_edges.append({"data": {"source": str(u), "target": str(v),
                                       "weight": int(d.get("weight", 1))}})

    gang_network = {"nodes": viz_nodes, "edges": viz_edges}

    # file/benchmark order: biggest fragmentation target first (headline unchanged)
    records.sort(key=lambda x: (x["fragmentation_drop_pct"], x["gang_size"]), reverse=True)

    hi = sum(1 for r in records if r["threat_tier"] == "high")
    print(f"  threat tiers -> high:{hi} "
          f"med:{sum(1 for r in records if r['threat_tier']=='medium')} "
          f"low:{sum(1 for r in records if r['threat_tier']=='low')}")
    print(f"  gang network: {len(viz_nodes)} nodes, {len(viz_edges)} edges")
    return records, gang_network


# ---------------------------------------------------------------------------
# 5. Frontend export (Cytoscape.js JSON)
# ---------------------------------------------------------------------------

def export_network_for_frontend(
    G: nx.Graph,
    communities: dict,
    centrality_df: pd.DataFrame,
    max_nodes: int = MAX_NETWORK_NODES_EXPORT,
) -> dict:
    """
    Export the network in Cytoscape.js JSON format, limited to the
    top *max_nodes* nodes by key-player score.
    """
    print(f"[network] Exporting network for frontend (max {max_nodes} nodes) ...")

    community_labels = communities.get("community_labels", {})
    top_ids = set(
        centrality_df.nlargest(max_nodes, "key_player_score")["offender_id"]
    )

    subgraph = G.subgraph(top_ids).copy()

    nodes = []
    for nid in subgraph.nodes():
        nd = subgraph.nodes[nid]
        nodes.append({
            "data": {
                "id": str(nid),
                "label": nd.get("name", "Unknown"),
                "size": nd.get("total_cases", 1),
                "community": community_labels.get(nid, -1),
                "key_player_score": float(
                    centrality_df.loc[
                        centrality_df["offender_id"] == nid, "key_player_score"
                    ].iloc[0]
                ) if nid in centrality_df["offender_id"].values else 0.0,
            }
        })

    edges = []
    for u, v, d in subgraph.edges(data=True):
        edges.append({
            "data": {
                "source": str(u),
                "target": str(v),
                "weight": int(d.get("weight", 1)),
            }
        })

    print(f"  exported {len(nodes)} nodes, {len(edges)} edges")
    return {"nodes": nodes, "edges": edges}


# ---------------------------------------------------------------------------
# 6. Repeat offenders table
# ---------------------------------------------------------------------------

def get_repeat_offenders(
    accused: pd.DataFrame,
    cases: pd.DataFrame,
    top_n: int = 100,
) -> pd.DataFrame:
    """
    Top repeat offenders with crime types, districts, and date range.
    """
    print(f"[network] Identifying top {top_n} repeat offenders ...")

    acc = accused.dropna(subset=["OffenderID"]).copy()
    acc["OffenderID"] = acc["OffenderID"].astype(str)

    # 1) Rank offenders by distinct case count -- fully vectorized, fast.
    case_counts = acc.groupby("OffenderID")["CaseMasterID"].nunique()
    top_ids = case_counts.nlargest(top_n).index
    counts_top = case_counts.loc[top_ids]

    # 2) Only enrich the top_n offenders (a tiny slice) with the costly joins.
    acc_top = acc[acc["OffenderID"].isin(top_ids)]
    case_cols = ["CaseMasterID"]
    for c in ("crime_type", "DistrictName", "IncidentFromDate"):
        if c in cases.columns:
            case_cols.append(c)
    merged = acc_top.merge(cases[case_cols], on="CaseMasterID", how="left")

    rows = []
    name_by_id = acc_top.drop_duplicates("OffenderID").set_index("OffenderID")["AccusedName"]
    for oid, grp in merged.groupby("OffenderID"):
        row = {
            "offender_id": oid,
            "name": name_by_id.get(oid, "Unknown"),
            "total_cases": int(counts_top.get(oid, 0)),
        }
        if "crime_type" in grp.columns:
            row["crime_types"] = ", ".join(pd.Series(grp["crime_type"]).dropna().unique()[:5])
        if "DistrictName" in grp.columns:
            row["districts"] = ", ".join(pd.Series(grp["DistrictName"]).dropna().unique()[:5])
        if "IncidentFromDate" in grp.columns:
            row["first_incident"] = grp["IncidentFromDate"].min()
            row["last_incident"] = grp["IncidentFromDate"].max()
        rows.append(row)

    result = pd.DataFrame(rows).sort_values("total_cases", ascending=False).reset_index(drop=True)
    print(f"  top offender: {result.iloc[0]['total_cases']} cases" if len(result) else "  no data")
    return result


# ---------------------------------------------------------------------------
# 7. Orchestrator
# ---------------------------------------------------------------------------

def run_network_analysis(
    accused: pd.DataFrame,
    cases: pd.DataFrame,
    output_dir: Path | str | None = None,
) -> dict:
    """
    Run the full network analysis pipeline and save results.

    Returns a summary dict with all computed artefacts.
    """
    out = Path(output_dir) if output_dir else (OUTPUT_DIR / "predict")
    out.mkdir(parents=True, exist_ok=True)

    # 1. build graph
    G = build_cooffending_graph(accused)

    # 2. communities
    communities = detect_communities(G)

    # 3. centrality
    centrality_df = compute_centrality(G, communities["community_labels"])

    # 4. disruption -- whole-network (cumulative) and gang-level threat + disruption
    disruption = simulate_network_disruption(G, centrality_df)
    gang_disruption, gang_network = analyze_gangs(G, communities, accused, cases)

    # 5. frontend export
    cytoscape = export_network_for_frontend(G, communities, centrality_df)

    # 6. repeat offenders
    repeat = get_repeat_offenders(accused, cases)

    # ── save outputs ────────────────────────────────────────────────────
    centrality_df.to_csv(out / "centrality.csv", index=False)
    print(f"[network] Saved centrality.csv ({len(centrality_df):,} rows)")

    with open(out / "disruption.json", "w", encoding="utf-8") as f:
        json.dump(disruption, f, indent=2, default=str)
    print(f"[network] Saved disruption.json "
          f"({len(disruption.get('per_node', []))} per-node, "
          f"{len(disruption.get('cumulative', []))} cumulative points)")

    with open(out / "gang_disruption.json", "w", encoding="utf-8") as f:
        json.dump(gang_disruption, f, indent=2, default=str)
    print(f"[network] Saved gang_disruption.json ({len(gang_disruption)} gangs)")

    with open(out / "cooffending_network.json", "w", encoding="utf-8") as f:
        json.dump(cytoscape, f, indent=2, default=str)
    print(f"[network] Saved cooffending_network.json")

    with open(out / "gang_network.json", "w", encoding="utf-8") as f:
        json.dump(gang_network, f, separators=(",", ":"), default=str)
    print(f"[network] Saved gang_network.json "
          f"({len(gang_network['nodes'])} nodes, {len(gang_network['edges'])} edges)")

    repeat.to_csv(out / "repeat_offenders.csv", index=False)
    print(f"[network] Saved repeat_offenders.csv ({len(repeat)} rows)")

    per_node = disruption.get("per_node", [])
    centrality_method = "betweenness" if G.number_of_nodes() <= 5000 else "degree"
    summary = {
        "graph_nodes": G.number_of_nodes(),
        "graph_edges": G.number_of_edges(),
        "n_communities": communities["n_communities"],
        "modularity": communities["modularity"],
        "centrality_method": centrality_method,
        "top_disruptor": per_node[0] if per_node else None,
        "cumulative_disruption": disruption.get("headline"),
        "best_gang_target": gang_disruption[0] if gang_disruption else None,
        "cytoscape_nodes": len(cytoscape["nodes"]),
        "cytoscape_edges": len(cytoscape["edges"]),
    }

    with open(out / "network_summary.json", "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2, default=str)
    print("[network] Saved network_summary.json")

    print("[network] === Network analysis complete ===")
    return {
        "graph": G,
        "communities": communities,
        "centrality": centrality_df,
        "disruption": disruption,
        "gang_disruption": gang_disruption,
        "cytoscape": cytoscape,
        "repeat_offenders": repeat,
        "summary": summary,
    }

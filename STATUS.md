# PRAHARI Build Status

_Last updated: 2026-07-14_

## Where we are

FULL PIPELINE RUNS END TO END in ~22 min (`python main.py`, exit 0). All 9 steps
produce outputs. Two of three headline numbers are strong; the patrol coverage
metric needs a reframing pass (see "Known issue" below).

### Latest benchmark (outputs/evaluate/benchmark_report.json) -- ALL THREE HEADLINES READY
1. PAI @ 5% area = 11.2  (56% of crime in 5% of area), Test AUC 0.867  -- STRONG
2. Patrol (Bengaluru City, 6 patrols, 2km): 13.5% risk coverage vs 4.6%
   random baseline = +192% uplift (2.9x). ILP confirms greedy (13.6%).  -- FIXED & DEFENSIBLE
3. Network: 20,673 gangs, modularity 0.92; best gang target = 1828-member
   gang, arresting top 3 fragments it 41% into 4 pieces                  -- STRONG
   Fairness Gini 0.239 (low disparity). SHAP drivers = near-repeat + night shift.

## Patrol metric fix (done 2026-07-14)
run_patrol_optimizer now scopes coverage to a demo district (default BENGALURU CITY,
1,263 cells) instead of all Karnataka -- patrols deploy per-district in reality.
Pitch line: "6 patrols positioned by PRAHARI cover 2.9x the predicted risk of
uniform deployment." Utilities: rerun_patrol.py (patrol step only, ~3 min),
rebuild_benchmark.py (regenerate benchmark_report.json from saved summaries).

## Frontend — Session 1 DONE (2026-07-14)
`frontend/` = Vite + React + TS + Tailwind v4 + MapLibre (real OSM tiles, dark-filtered)
+ deck.gl (3D Gi* columns / flat toggle) + real Karnataka district boundaries
(public/data/karnataka_districts.geojson, from udit-001/india-maps-data) + Recharts trend
+ ranked district panel with flyTo drill-down. All numbers from outputs/ only.
- Run: `npm run dev` in frontend/ (or .claude/launch.json "prahari-frontend")
- Data refresh: `python copy_data.py` (also gen_centroids.py for district centroids)
- Verified in browser: map renders, Bengaluru shows orange/red hot core in 3D,
  crime-type filter swaps layers + trend, district click flies, no console errors.
- Gotcha fixed: maplibre CSS overrides container position -> map div needs a sized
  wrapper (see MapView.tsx return).
- three.js: dependency installed; used in Session 2 for the 3D network (3d-force-graph).

## Frontend — Session 2 DONE (2026-07-14)
PREDICT tab with two modes (top-left switch):
- RISK FORECAST: deck.gl HeatmapLayer risk surface (risk_map.json) + top-5% priority-cell
  rings toggle (the PAI story on the map); right panel = model stat cards (56% / PAI 11.2 /
  AUC 0.87) + friendly-named top risk drivers + anomaly feed (spikes first, click = flyTo
  district). Demo gem: Feb-2018 Shivamogga anomaly cluster across 5 crime types.
- CRIME NETWORK: three.js 3D force graph (3d-force-graph) of top-500 offenders colored by
  Louvain community; right panel = network stats (454k/1.3M/20,673/0.92) + gang disruption
  ranking (Gang #10: arrest 3 named members -> -41%, 4 fragments); selecting a gang expands
  key members (cut-point badges) and highlights them amber in the 3D graph.
New files: views/PredictView.tsx, components/{RiskMap,RiskStats,AnomalyFeed,NetworkGraph,
GangPanel}.tsx; added @deck.gl/aggregation-layers. Verified in browser via DOM (screenshots
time out while WebGL animates — known Browser-pane limitation, not an app bug).
Polish note: right panel (fixed 360px) overlaps top-left controls below ~950px viewport
width — fine on demo screens, make responsive in polish pass.

## Frontend — Session 3 DONE (2026-07-14)
ACT tab: PatrolMap (risk heatmap over Bengaluru + 2km coverage circles + P1-P6 labeled
markers) + BriefingPanel (deployment stats 6/13.5%/4.6%/2.9x + ILP-verified note + per-patrol
briefing cards with heinous counts and crime chips + Print button; card click = flyTo).
TRUST tab: benchmark headline card (56% / 2.9x / -41%), SHAP global attribution with
plain-English feature names (near-repeat dominates: 0.47), fairness audit (Gini 0.239,
4.6x max/min, full statement), sample explanations grid with "crime occurred" validation
ticks on holdout predictions.
New files: views/{ActView,TrustView}.tsx, components/{PatrolMap,BriefingPanel}.tsx.
All four tabs verified live in browser via DOM text extraction.
Known data quirk: Patrol 4 lands at (15.32, 75.72) — a cluster of BENGALURU CITY-registered
cases physically located near Hubballi (cell->district majority-vote artifact). Explainable
in demo or filter later.
## Session 4 polish — DONE (2026-07-14)
- `npm run build` PASSES (fixed 4 TS errors: maplibre `antialias` option removed,
  3d-force-graph accessor casts). Bundle 3.7MB / 1.0MB gzip (code-split later if needed).
- Anomaly feed: filtered non-territorial units (CID, Coastal Security Police, Karnataka
  Railways, ISD Bengaluru) + rows with observed==0 or expected<=0. Only real spikes remain.
- Patrol outlier FIXED at the source: act/patrol_optimizer.py now drops cells >60km from
  the district's median center (registration-vs-location artifact). Re-ran optimizer:
  all 6 patrols inside Bengaluru City; numbers IMPROVED -> 13.9% coverage, 3.9% baseline,
  +259% / 3.6x uplift, ILP 14.1%. Benchmark + frontend data re-synced; TRUST card auto-updated.
- Loading chips on PREDICT/ACT, loading state on TRUST (SENSE already had one).
- Right panels: max-w-[calc(100vw-340px)] stops overlap at narrow widths.
- copy_data.py writes meta.json {computed_at}; footer shows "analytics computed <date> ·
  nightly recompute" (Catalyst Cron story).
- @media print stylesheet: Print button now outputs a clean black-on-white briefing sheet
  (.print-briefing class on ACT right panel).
Headline numbers now: PAI 11.2 / 56% in 5% area; patrol 3.6x uplift; gang -41%.

## District-normalized hotspot view — DONE (2026-07-15)
User asked why hotspots only show in Bengaluru (state-baseline Gi* is dominated by metro
volume). Decision: KEEP dataset (concentration is realistic); added a second lens instead.
- Pipeline: sense/hotspots.py -> compute_gi_star_local() + run_sense_hotspots_local():
  Gi* within each district separately (own-district baseline), skips non-geo units +
  districts <15 cells. Runner: rerun_local_hotspots.py. Exports hotspots_local_*.geojson
  (22 layers) + hotspots_local_summary.json.
- Frontend: State view | District view toggle in SENSE FilterBar (tooltip explains),
  loadHotspots(crimeType, scope) picks file set.
- Result: district view = 3,202 hot cells / 68,241 rows (hotspots in EVERY district)
  vs state view 724 / 16,463 (metros only). Verified live via DOM.
- Demo line: "State view = resource allocation between districts (DGP); District view =
  patrol targeting within a district (SP)." Also the answer to the judge question
  "isn't this just a population map?"
- Note: 68,241 rows > 16,463 cells because border/registration-scatter cells appear in
  multiple districts' layers — visually harmless (overlapping points).

## Judge-review fix pass — DONE (2026-07-15)
All review items fixed except Catalyst deploy:
1. NETWORK mega-case fix: build_cooffending_graph excludes cases >10 accused
   (MAX_ACCUSED_PER_CASE; 22,659 mass-arrest cases were contributing 77% of edges).
   New graph: 341,803 nodes / 509,633 edges, 35,333 communities, modularity 0.978.
   NEW HEADLINE: 953-member gang, 3 arrests -> -77.9% into 11 pieces (stronger AND
   more defensible than old 1,828/-41%).
2. FAIRNESS: clearance now chargesheet-based (ChargesheetDetails join, not the
   single-valued CaseStatusID). 11 districts flagged for reporting bias (was 0).
   rerun_fairness.py added.
3. PATROL status-quo baseline: compute_statusquo_coverage (patrols at top
   historical-volume cells, radius-spaced). Results: optimizer 13.9% vs volume-driven
   11.4% vs random 3.9% -> +21.9% (1.22x) vs status quo. Honest number matches
   published predictive-policing field-trial gains — pitch it that way.
4. SYNTHETIC framing: amber "Benchmark methodology" note on TRUST (planted-pattern
   recovery; same harness runs on live CCTNS). Judges see it proactively.
5. GEOJSON minify: 173.8 MB -> 84.3 MB (52%); exporter now compact-separators.
   minify_geojson.py for existing files.
6. ANOMALY feed: newest-first sort (spikes first), relabeled.
7. UX: IntroOverlay onboarding (first visit + "?" in header, localStorage);
   officer 👍/👎 feedback on patrol briefing cards (localStorage; BRD human-in-the-loop).
8. GIT: repo initialized at PRAHARI/, initial commit 870366e (201 files), repo-local
   identity nikethantirumala@gmail.com. .gitignore: node_modules/dist/cache/pycache.
   NOT pushed anywhere yet — needs user's GitHub.
Build passes; all tabs re-verified in browser.

## Current headline numbers (post-fix)
1. PAI 11.2 — 56% of crimes in 5% of area (AUC 0.867, PEI 0.955)
2. Patrol: +21.9% risk coverage vs volume-driven status quo (1.22x; +259% vs random; ILP-verified)
3. Gang: 953-member network, 3 targeted arrests fragment it 77.9% into 11 pieces
   Fairness: Gini 0.239, 11 districts flagged for under-reporting adjustment.

## NEXT: Catalyst deploy (needs user's Zoho login for CLI auth) -> live URL for submission.
Then golden-path demo walkthrough, 3-min video, submission template.
Deferred niceties: cross-tab filter persistence, Ask Prahari, Kannada toggle, network node
click dossier, code-splitting, 👍/👎 feedback buttons (BRD human-in-the-loop).

## Performance fixes applied this session (all verified, keep them)
- risk_model.py: cap training 4M rows + float32 + batched scoring (fixed 4.18GB OOM)
- network.py: vectorized edges (nx.from_pandas_edgelist); degree ranking for large
  graphs (betweenness only if component <=5000 nodes); in-place disruption removal;
  fast get_repeat_offenders (rank first, enrich only top-100). Added gang-level
  disruption (simulate_gang_disruption) -- the meaningful fragmentation headline.
- network.py path bug fixed (was writing to outputs/predict/predict/).
- anomaly.py: single-pass _prepare_daily (was doing full 1.67M-row scans per group,
  ~820 groups x2); changepoints use fast Binseg/l2 (was Pelt/rbf O(n^2)), capped 80 series.

## What WORKS and is verified

- **Data loading + grid** — 1.67M cases, 16,463 active cells. Verified.
- **SENSE (hotspots + trends)** — Gi* for all 20 crime types + overall, 41 district summaries,
  monthly/weekly trends. Outputs in `outputs/sense/`. Verified.
- **Feature engineering** — cached to `cache/feature_matrix.parquet` (~14M rows). Done.
- **Risk model (LightGBM)** — VERIFIED. Results in `outputs/predict/risk_summary.json`:
  - **Test AUC = 0.867**
  - **PAI @ 5% area = 11.2  (56% of crime in 5% of area)**  <-- HEADLINE #1
  - PEI @ 5% = 0.955 (95% of a perfect oracle)
  - Near-repeat + temporal features are top drivers (not just historical average)

## What is STILL BROKEN (fix tomorrow)

**Network analysis** (`predict/network.py`) — the co-offending graph builds fine and fast now
(454,470 nodes, 1.29M edges, 20,673 communities, modularity 0.92 — all good and computed in ~2 min).
The problem is CENTRALITY:
  - The graph is ONE giant connected component (397,447 nodes).
  - NetworkX betweenness is pure Python -> would take ~40 min at this scale. Infeasible.
  - Also: removing a single node from a 397K blob drops it by ~0%, so the
    "arrest one person -> gang drops X%" headline does NOT work on this topology as-is.

### The planned fix (was mid-edit when we stopped)
1. In `compute_centrality`: for large graphs, rank key players by DEGREE centrality (instant),
   skip infeasible betweenness (guard: only do betweenness if component <= ~5000 nodes).
2. In `simulate_network_disruption`: add CUMULATIVE removal — remove the top-K (e.g. 50)
   offenders TOGETHER and measure total fragmentation of the giant component. That produces
   a real headline number ("removing top 50 hubs fragments the network by X%") whereas
   single-node removal gives ~0%.
   Optional upgrade: use python-igraph (installed) for fast C-based betweenness with a
   path-length cutoff.

## Still never run (blocked only by network step in the full pipeline)
- Anomaly detection (`predict/anomaly.py`) — code ready
- Patrol optimizer (`act/patrol_optimizer.py`) — code ready. Gives HEADLINE #2 (coverage uplift %)
- TRUST: SHAP + fairness — code ready
- Benchmark consolidation

These can be run independently:
  - `python main.py --anomaly-only`
  - Patrol/trust need the risk_map (already saved in outputs/predict/risk_map.json)

## Memory fixes already applied (keep these)
- `predict/risk_model.py`: caps training to 4M rows + float32 + batched scoring.
  This fixed the earlier 4.18 GB MemoryError. Verified working.
- `predict/network.py`: vectorized edge build via `nx.from_pandas_edgelist`
  (replaced a slow iterrows loop). Fixed.

## How to resume
- Feature matrix is cached, so re-runs are fast: `python main.py` skips feature engineering.
- To debug network alone: `python main.py --network-only` (set PYTHONUNBUFFERED=1 for live logs).
- Three headline numbers targeted:
  1. PAI @ 5% = 11.2  (DONE)
  2. Coverage uplift %  (patrol optimizer — not yet run)
  3. Network fragmentation %  (needs the cumulative-disruption fix above)

# PRAHARI · ಪ್ರಹರಿ

**AI-driven crime analytics and visualization platform for Karnataka State Police.**  
KSP Datathon 2026 — Challenge 02.

**Live Application:** https://prahari-60076064719.development.catalystserverless.in/app/index.html

PRAHARI processes 1,674,732 FIR records (2016–2024, across all 37 Karnataka police districts, 4 non-territorial units and 1,074 police stations) into actionable operational decision intelligence: identifying statistical crime clusters, predicting week-ahead spatial risk, and optimizing shift patrol deployments.

---

## Architecture & System Layers

| Layer | Functional Objective | Technical Methodology |
|---|---|---|
| **SENSE** | Statistical Hotspot Identification | Getis-Ord Gi\* / LISA local statistics at $p < 0.05$ threshold |
| **PREDICT** | Spatio-Temporal Risk & Offender Forecasting | LightGBM with near-repeat spatial features, STL anomaly detection, & Louvain co-offending graph analytics |
| **ACT** | Patrol Resource Optimization | Maximal-coverage Integer Linear Program (OR-Tools) with greedy fallbacks |
| **TRUST** | Explainability & Algorithmic Auditability | Per-prediction SHAP attributions, empirical calibration curves, & reporting-bias adjusted fairness audits |

---

## Empirical Benchmark Performance

All metrics are exported to `outputs/evaluate/benchmark_report.json` by the pipeline and published to [`frontend/public/data/benchmark_report.json`](frontend/public/data/benchmark_report.json), which **is committed** — `outputs/` is gitignored, so that published copy is the one to read. The interface reads it at runtime and renders an em-dash for any figure it cannot load, so nothing on screen is ever a hardcoded literal.

| Evaluation Metric | Value | Technical Context |
|---|---|---|
| Recapture Rate Index (RRI @ 5%) | **1.27×** | Versus the status-quo tactic of patrolling where crime has historically occurred, which captures 41.9% in the same area budget. Baseline ranked on pre-2024 data only, so no test-period information leaks into it. |
| Predictive Accuracy Index (PAI @ 5%) | **10.63** | Captures 53.1% of crimes within top 5% priority spatial area |
| Patrol Coverage | **11.67%** | Optimized ILP coverage vs **9.87%** volume-based baseline (+18.2% relative uplift) |
| Optimization Gap | **11.72% vs 11.67%** | Greedy heuristic within 0.05 percentage points of global ILP optimum |
| Co-offending Network Scale | **341,803 nodes** | 509,633 co-offender linkages across 35,333 graph communities (modularity 0.978) |
| Allocation Disparity (Gini) | **0.183** | Low allocation disparity across jurisdictions; 11 districts flagged for reporting audit |

---

## Responsible AI & Ethical Design

PRAHARI predicts spatial-temporal crime risk for **geographic grid cells and time windows**, and analyzes structural relationships among individuals **already on official record**. The system explicitly does **not** generate individual-level pre-crime scores.

**Current access model — stated plainly.** This prototype is a static site with no authentication: every precomputed artifact under `/app/data/` is readable by anyone with the URL, including the offender dossier index. The personal names in the supplied dataset are synthetic, so no real individual is identifiable, but the *architecture* has no access control and we are not going to imply otherwise. Role-based access (SCRB analyst / District SP / Station House Officer), an access audit log requiring a written justification before any dossier is opened, and a move of offender lookup behind an authenticated Catalyst Function are in progress; this section will be updated when they land. On real CCTNS data, none of the dossier surfaces should be deployed without them.

---

## Project Setup & Execution

### 1. Web Console & User Interface

```bash
cd frontend
npm install
npm run dev
```

The web console initializes locally at `http://localhost:5173/app/`. Precomputed analytics artifacts reside in `frontend/public/data/` for standalone execution.

### 2. Analytics Pipeline Execution

The dataset is distributed separately and is not in this repository. Point
`PRAHARI_DATASET_DIR` at your extracted `submission_dataset` folder (or place it
at `<repo>/dataset`); see [`.env.example`](.env.example). `main.py` fails with an
explanatory message if it cannot find it.

```bash
pip install -r requirements.txt
export PRAHARI_DATASET_DIR=/path/to/submission_dataset   # PowerShell: $env:PRAHARI_DATASET_DIR = "..."
python main.py            # Executes full 9-stage analytics pipeline (~22 min)
python copy_data.py       # Exports analytics outputs to frontend assets
python optimize_geojson.py      # Optimizes GeoJSON structures for compressed delivery
python strip_insignificant.py   # Filters non-significant spatial units
python bundle_patrol.py         # Aggregates district patrol plans into bundled structures
```

---

## Deployment Configuration (Zoho Catalyst)

**Deployment URL:** https://prahari-60076064719.development.catalystserverless.in/app/index.html

### Deployment Workflow

Full instructions, platform gotchas and the Catalyst project binding are in
[`docs/DEPLOY.md`](docs/DEPLOY.md). Short version, from the root directory:

```powershell
cd frontend; npm run build; cd ..
robocopy frontend\dist client /E /XD districts scenarios

# Prune outdated asset bundles
$keep = Get-ChildItem frontend\dist\assets -File | Select-Object -ExpandProperty Name
Get-ChildItem client\assets -File | Where-Object { $keep -notcontains $_.Name } | Remove-Item -Force

npx zcatalyst-cli deploy --only client
```

### Deployment & Infrastructure Guidelines

- **File Count Thresholds:** Serverless client distribution bundles exclude raw unbundled scenario directories to satisfy platform file limit constraints (`patrol_bundle.json` satisfies spatial query requirements).
- **Data Compression:** Map layers are optimized and served with standard `.json` encoding to leverage edge-compression filters.
- **Routing Configuration:** Base paths are scoped to `/app/` within `vite.config.ts` for reverse-proxy routing compatibility.

---

## Directory Structure

```
sense/ predict/ act/ trust/ evaluate/   Python analytics pipeline modules
main.py                                  Main pipeline orchestrator (9 stages)
copy_data.py                             Data publishing & asset synchronization
frontend/                                React 19 + TypeScript web application
  src/site/                              Marketing & overview web interfaces
  src/console/  src/views/               4-tab operational analytics dashboard
  public/data/                           Precomputed spatial & model artifacts
```

---

## Technology Stack

- **Frontend & Visualization:** React 19, TypeScript, Vite 8, MapLibre GL, deck.gl, Recharts, Tailwind v4
- **Data Science & ML Pipeline:** pandas, scikit-learn, LightGBM, libpysal, esda, networkx, statsmodels, SHAP
- **Optimization:** Google OR-Tools (Integer Linear Programming)
- **Cloud Infrastructure:** Zoho Catalyst (Hosting & Serverless Distribution)

---

## Team & Contribution Ownership

| Team Member | GitHub Profile | Core Component Ownership |
|---|---|---|
| **Nikethan Tirumala** | [@Nikethan10](https://github.com/Nikethan10) | Frontend Architecture, Web Console, MapLibre GL & deck.gl Integration |
| **Hari Nair** | [@r-harinarayanan](https://github.com/r-harinarayanan) | Analytics Pipeline, LightGBM Risk Model, STL Anomaly Detection |
| **Katir Velavan** (team lead) | [@myselfcarewinter-hue](https://github.com/myselfcarewinter-hue) | System Architecture, ACT Patrol Optimizer, TRUST Layer, Catalyst Deployment |
| **Dhikshitha** | [@DHIKSHITHA0906](https://github.com/DHIKSHITHA0906) | Co-offending Graph Analytics, Louvain Community Detection, Disruption Modeling |
| **Nihan** | [@nihan-98716](https://github.com/nihan-98716) | Data Engineering, CCTNS Data Normalization, Gi\* Spatial Analysis Pipeline |

> *Note: Development was conducted using a shared core development environment. Module ownership is delineated above.*

---

## License

See [LICENSE](LICENSE).

Submitted to KSP Datathon 2026 under Hack2skill's terms, which require a public repository. Verify the licence choice against those terms before the finale.

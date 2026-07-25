# PRAHARI · ಪ್ರಹರಿ

**AI-driven crime analytics and visualisation for Karnataka State Police.**
KSP Datathon 2026 — Challenge 02.

**Live:** https://prahari-60076064719.development.catalystserverless.in/app/index.html

PRAHARI turns 1,674,732 FIR records (2016–2024, all 41 districts, 1,074
stations) into decisions a station house officer can act on tonight: where
crime is statistically clustering, what is likely next week, and exactly
where to send the patrol.

---

## The four layers

| Layer | Question it answers | Method |
|---|---|---|
| **SENSE** | Where is crime actually clustering? | Getis-Ord Gi\* / LISA at p < 0.05 — significance, not a blurred heatmap |
| **PREDICT** | What is likely next, and who is behind it? | LightGBM with near-repeat features · STL anomaly detection · Louvain co-offending communities |
| **ACT** | Where do I send the units I have? | Maximal-coverage integer program (OR-Tools) with a greedy fallback |
| **TRUST** | Why should I believe it? | SHAP attributions · calibration curve · reporting-bias-adjusted fairness audit |

## Measured results

Every figure is produced by `outputs/evaluate/benchmark_report.json` and read
live by the UI, so the site cannot drift from what the pipeline actually did.

| Metric | Value |
|---|---|
| Risk model — test AUC | **0.847** (held-out temporal split) |
| PAI @ top 5% of area | **10.63** — 53.1% of crime inside 5% of the map |
| Patrol coverage | **11.67%** optimised vs **9.87%** status quo → **+18.2%** |
| ILP vs greedy | 11.72% vs 11.67% — the fast heuristic leaves almost nothing on the table |
| Co-offending graph | 341,803 offenders · 509,633 links · modularity 0.978 |
| Allocation fairness (Gini) | **0.183**, 11 districts flagged for review |

## Ethical boundary

PRAHARI predicts risk for **areas and time windows**, and analyses networks of
people **already on record**. It does not predict crime for named individuals.
There is no pre-crime score for a person anywhere in this system. Personal
identifiers are hashed at ingest and no case-level or offender-level data
appears on the public marketing pages.

---

## Running it

### Frontend (what the judges see)

```bash
cd frontend
npm install
npm run dev
```

Opens on `http://localhost:5173/app/`. All analytics are precomputed — the
committed `frontend/public/data/` is everything the UI needs, so this works
without running the Python pipeline.

### Analytics pipeline (optional — regenerates the data)

```bash
pip install -r requirements.txt
python main.py            # ~22 min, 9 steps
python copy_data.py       # publish outputs -> frontend/public/data
python optimize_geojson.py      # .geojson -> .json (Catalyst gzips .json only)
python strip_insignificant.py   # drop not_sig cells (~74% of the payload)
python bundle_patrol.py         # 444 patrol files -> 1 bundle
```

> The three post-processing scripts are **not optional** if you re-run
> `copy_data.py`. Without them the app requests `.geojson` files that no
> longer exist in the code paths, ships 3× the bytes, and the ACT tab loses
> its patrol data. See `DEPLOY.md`.

### Deploy to Catalyst

See [DEPLOY.md](DEPLOY.md).

---

## Repository layout

```
sense/ predict/ act/ trust/ evaluate/   analytics pipeline (Python)
main.py                                  runs all 9 pipeline steps
copy_data.py                             publishes outputs -> frontend
frontend/                                React + TypeScript console + site
  src/site/                              public landing site
  src/console/  src/views/               the 4-tab operational console
  public/data/                           precomputed analytics (committed)
plan/                                    BRD, PRD, architecture, pitch
```

## Stack

React 19 · TypeScript · MapLibre GL · deck.gl · Recharts · Tailwind v4 ·
pandas · scikit-learn · LightGBM · libpysal/esda · networkx · statsmodels ·
SHAP · OR-Tools · **Zoho Catalyst** (Hosting)

## Team

Nikethan · Hari Nair · Katir · Dhikshitha · Nihan

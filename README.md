# PRAHARI · ಪ್ರಹರಿ

**AI-driven crime analytics and visualisation for Karnataka State Police.**  
KSP Datathon 2026 — Challenge 02.

**Live:** https://prahari-60076064719.development.catalystserverless.in/app/index.html

PRAHARI turns 1,674,732 FIR records (2016–2024, all 41 districts, 1,074
stations) into decisions a station house officer can act on tonight: where
crime is statistically clustering, what is likely next week, and exactly
where to send the patrol.

---

## The Four Layers

| Layer | Question it answers | Method |
|---|---|---|
| **SENSE** | Where is crime actually clustering? | Getis-Ord Gi\* / LISA at p < 0.05 — significance, not a blurred heatmap |
| **PREDICT** | What is likely next, and who is behind it? | LightGBM with near-repeat features · STL anomaly detection · Louvain co-offending communities |
| **ACT** | Where do I send the units I have? | Maximal-coverage integer program (OR-Tools) with a greedy fallback |
| **TRUST** | Why should I believe it? | SHAP attributions · calibration curve · reporting-bias-adjusted fairness audit |

---

## Measured Results

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

---

## Ethical Boundary

PRAHARI predicts risk for **areas and time windows**, and analyses networks of
people **already on record**. It does not predict crime for named individuals.
There is no pre-crime score for a person anywhere in this system. Personal
identifiers are hashed at ingest and no case-level or offender-level data
appears on the public marketing pages.

---

## Running It

### Frontend (what the judges see)

```bash
cd frontend
npm install
npm run dev
```

Opens on `http://localhost:5173/app/`. All analytics are precomputed — the
committed `frontend/public/data/` is everything the UI needs, so this works
without running the Python pipeline.

### Analytics Pipeline (optional — regenerates the data)

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
> its patrol data.

---

## Deploying to Zoho Catalyst

**Live URL:** https://prahari-60076064719.development.catalystserverless.in/app/index.html

Run from the repo root in PowerShell:

```powershell
cd frontend; npm run build; cd ..
robocopy frontend\dist client /E /XD districts scenarios

# Prune stale bundles from client/assets
$keep = Get-ChildItem frontend\dist\assets -File | Select-Object -ExpandProperty Name
Get-ChildItem client\assets -File | Where-Object { $keep -notcontains $_.Name } | Remove-Item -Force

npx zcatalyst-cli deploy --only client
```

Then verify with a cache-buster (Catalyst caches `index.html`):
```
https://prahari-60076064719.development.catalystserverless.in/app/index.html?v=2
```

### Key Gotchas

- **`robocopy` exit codes 0–7 mean success.** Anything ≥ 8 is a real failure.
- **`catalyst.json` must stay a plain client**, not the React plugin.
- **`vite.config.ts` needs `base: '/app/'`** — Catalyst serves the client under `/app/`.
- **Catalyst rejects a client ZIP over ~500 files** — this is why `robocopy` excludes `districts` and `scenarios` (pre-merged into `patrol_bundle.json`).
- **Catalyst does not gzip `.geojson`** — every map file must be served as `.json` (`optimize_geojson.py` handles this).

---

## Repository Layout

```
sense/ predict/ act/ trust/ evaluate/   analytics pipeline (Python)
main.py                                  runs all 9 pipeline steps
copy_data.py                             publishes outputs -> frontend
frontend/                                React + TypeScript console + site
  src/site/                              public landing site
  src/console/  src/views/               the 4-tab operational console
  public/data/                           precomputed analytics (committed)
```

---

## Stack

React 19 · TypeScript · MapLibre GL · deck.gl · Recharts · Tailwind v4 ·
pandas · scikit-learn · LightGBM · libpysal/esda · networkx · statsmodels ·
SHAP · OR-Tools · **Zoho Catalyst** (Hosting)

---

## Team

| Member | GitHub | Role |
|---|---|---|
| **Nikethan Tirumala** | [@nikethan_10](https://github.com/Nikethan10) | Frontend architecture · React console · MapLibre GL · deck.gl |
| **Hari Nair** | [@r-harinarayanan](https://github.com/r-harinarayanan) | Analytics pipeline · LightGBM risk model · STL anomaly detection |
| **Katir** | [@myselfcarewinter-hue](https://github.com/myselfcarewinter-hue) | System design · ACT patrol optimizer · TRUST layer · Catalyst deploy |
| **Dhikshitha** | [@DHIKSHITHA0906](https://github.com/DHIKSHITHA0906) | Co-offending network · Louvain communities · gang disruption |
| **Nihan** | [@nihan-98716](https://github.com/nihan-98716) | Data engineering · Gi\* spatial analysis · GeoJSON pipeline |

> Development was carried out on a shared workstation. Git history reflects a single committer; the breakdown above reflects actual module ownership.

---

## License

© 2026 Nikethan10. All rights reserved. No permission is granted to use, copy, modify, or distribute this code without prior written permission.

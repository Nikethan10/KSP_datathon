# PRAHARI Build Status

_Last updated: 2026-08-29_

All figures below are read from `frontend/public/data/benchmark_report.json`, which is
the committed copy of the pipeline's output (`outputs/` is gitignored). If a number
here disagrees with that file, the file is right and this document is stale.

## Where we are

The analytics pipeline runs end to end (`python main.py`, ~22 min, exit 0). The web
console is built, bilingual, and deployed. The system is a **static site** — there is
no backend, no database, and no authentication anywhere in it.

**Live:** https://prahari-60076064719.development.catalystserverless.in/app/

## Current verified numbers

| Metric | Value | Context |
|---|---|---|
| PAI @ 5% area | **10.63** | 53.13% of crime inside 5% of the map |
| RRI @ 5% area | **1.27** | vs a 41.94% status-quo baseline ranked on pre-2024 data only |
| Patrol coverage | **11.67%** | vs 9.87% volume-driven status quo — **+18.2%** (1.18x) |
| ILP verification | **11.72%** | greedy within 0.05 pts of the exact optimum |
| Network | **341,803 nodes** | 509,633 edges, 35,333 communities, modularity 0.978 |
| Gang disruption | **953-member gang** | 3 targeted arrests fragment it 77.9% into 11 pieces |
| Fairness Gini | **0.1833** | max/min ratio 3.51; 11 districts flagged for reporting-bias review |

Patrol scope is a single district (BENGALURU CITY, 6 units, 2 km radius). Coverage
uplift is always quoted against the volume-driven status quo, never against random —
the random comparison flatters and does not survive a follow-up question.

**AUC is a diagnostic, not a headline.** It lives at `diagnostics.test_auc` in the
benchmark report and must not appear in the UI or in any published document.

## What is built

**Pipeline** — `main.py` orchestrates 9 steps across `data/ sense/ predict/ act/ trust/
evaluate/`. Outputs land in `outputs/`, then `copy_data.py` publishes an enumerated
allowlist into `frontend/public/data/`.

**Console** — `frontend/`, React 19 + TypeScript + Vite 8 + Tailwind v4. Seven tabs:

| Tab | Purpose |
|---|---|
| COMMAND | State-wide picture: live alerts, STL intelligence headline, top districts |
| INVESTIGATE | Person dossier assembled from record: timeline, co-accused, offence pattern |
| CONNECT | Co-offending network, Louvain communities, gang disruption |
| FORECAST | Three lenses — Gi* hotspots, emerging lifecycle, week-ahead risk |
| ACT | ILP patrol deployment with printable briefing sheets |
| REPLAY | Week-by-week backtest against held-out 2024 data |
| TRUST | Calibration, SHAP, fairness audit, stated limitations |

**Public site** — `frontend/src/site/`: landing, how-it-works, impact, stack.

**Bilingual** — full English/Kannada across both surfaces via `src/lib/i18n.tsx`.

## Known gaps

- **No backend.** One `fetch()` GET in `src/lib/data.ts` reads static JSON. The only
  writes are two `localStorage` keys. Nothing persists.
- **No authentication.** Every artefact under `/app/data/`, including the offender
  dossier index, is readable by anyone with the URL. `README.md` states this plainly.
  The names in the supplied dataset are synthetic, so no real person is identifiable,
  but the architecture has no access control.
- **Catalyst: Hosting only.** Functions, Data Store, Stratus and Cron are designed but
  not built.
- Benchmarks are measured on a synthetic FIR corpus with planted patterns. The same
  harness runs unchanged on live CCTNS data; real-world scores will differ.

## In progress

Citizen reporting portal plus officer triage — see the approved plan for scope,
schema, and the report/analytics separation rule. Summary:

- Public report portal on the existing site surface, email OTP via Brevo
- Officer triage queue as an eighth console tab
- Catalyst Functions + Data Store behind a swappable repository interface
- Citizen reports are **never** merged into the analytics; a human seals a verified
  batch to a file, and `main.py` only reads it behind `--include-citizen-firs`

## How to run

```
cd frontend && npm run dev          # console at http://localhost:5173/app/
python main.py                      # full pipeline (~22 min)
python main.py --anomaly-only       # single step
python copy_data.py                 # republish artefacts to the frontend
```

After `copy_data.py`, re-apply the deploy optimisations described in `docs/DEPLOY.md`
(geojson rename, patrol bundling) or the client ZIP will be rejected.

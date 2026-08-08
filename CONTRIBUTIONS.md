# PRAHARI · Project Contributions & Ownership

## Team: fault line (KSP Datathon 2026 — Challenge 02)

Development of PRAHARI was conducted on a shared workstation to maintain an integrated development environment across complex geospatial, machine learning, and visualization pipelines. Below is the breakdown of module ownership and contributions across the team:

---

### Team Members & Module Ownership

| Member | GitHub Handle | Key Contributions & Ownership |
| :--- | :--- | :--- |
| **Nikethan Tirumala** | `@nikethan_10` | **Frontend & Dashboard Architecture**<br>• React 19 + TypeScript + Vite 8 frontend shell<br>• MapLibre GL geospatial map integration and 3D deck.gl hotspot layers<br>• SENSE & PREDICT UI console components and code-splitting<br>• Citizen reporting portal (public form, OTP flow, status tracking) and the REPORTS triage console<br>• Complete English / Kannada i18n across all eight console tabs and the public site |
| **Hari Nair** | `@r-harinarayanan` | **Analytics & Machine Learning Pipeline**<br>• LightGBM risk prediction model with spatio-temporal near-repeat features<br>• STL anomaly detection & daily crime spike detection algorithm<br>• Model evaluation metrics (PAI 10.63 @ top 5% area, RRI 1.27 vs status quo)<br>• Held-out backtesting harness behind the REPLAY tab (43.3% mean hit rate over 11 weeks) |
| **Katir** | `@myselfcarewinter-hue` | **System Design & Optimization (Team Lead)**<br>• Project architecture, BRD/PRD specification & pitch deck<br>• ACT layer maximal-coverage Integer Linear Program (ILP) using OR-Tools<br>• TRUST layer (SHAP explainability & fairness audit) & Zoho Catalyst deployment<br>• Report lifecycle model and the sealed-export gate separating citizen reports from the analytics |
| **Dhikshitha** | `@DHIKSHITHA0906` | **Co-offending Network & Graph Analytics**<br>• NetworkX & 3D force graph co-offending network pipeline (341k nodes, 509k links)<br>• Louvain community detection & gang disruption simulation algorithm<br>• Socio-economic data integration & contextual map overlay research |
| **Nihan** | `@nihan-98716` | **Data Engineering & Geospatial Pipeline**<br>• CCTNS 8-table dataset loading, normalization & grid assignment (1.67M records)<br>• libpysal/esda Getis-Ord Gi* & LISA statistical hotspot computation<br>• GeoJSON minification & district boundary clipping pipeline<br>• Shared 1 km grid parameters (grid_params.json) binding the report portal to the pipeline lattice |

---

### Shared Development Environment Note
> **Note for Organizers & Judges:**
> All primary codebase development, model training, and integration builds were
> executed from a shared core workstation (`PRAHARI/`). Because of that, the git
> author on most commits is the machine's configured identity rather than the
> person who wrote a given module, and commit timestamps reflect when work was
> integrated on that workstation rather than when each member's contribution
> began.
>
> Every commit therefore carries all five members as `Co-authored-by:` trailers,
> and this table is the authoritative record of who owned which module. We have
> stated it this way rather than reshaping the history to imply a distribution
> the commits cannot actually evidence.

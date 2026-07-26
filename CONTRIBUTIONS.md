# PRAHARI · Project Contributions & Ownership

## Team: fault line (KSP Datathon 2026 — Challenge 02)

Development of PRAHARI was conducted on a shared workstation to maintain an integrated development environment across complex geospatial, machine learning, and visualization pipelines. Below is the breakdown of module ownership and contributions across the team:

---

### Team Members & Module Ownership

| Member | GitHub Handle | Key Contributions & Ownership |
| :--- | :--- | :--- |
| **Nikethan Tirumala** | `@nikethan_10` | **Frontend & Dashboard Architecture**<br>• React 19 + TypeScript + Vite 8 frontend shell<br>• MapLibre GL geospatial map integration and 3D deck.gl hotspot layers<br>• SENSE & PREDICT UI console components and code-splitting |
| **Hari Nair** | `@r-harinarayanan` | **Analytics & Machine Learning Pipeline**<br>• LightGBM risk prediction model with spatio-temporal near-repeat features<br>• STL anomaly detection & daily crime spike detection algorithm<br>• Model evaluation metrics (AUC 0.847, PAI 10.63 @ top 5% area) |
| **Katir** | `@myselfcarewinter-hue` | **System Design & Optimization (Team Lead)**<br>• Project architecture, BRD/PRD specification & pitch deck<br>• ACT layer maximal-coverage Integer Linear Program (ILP) using OR-Tools<br>• TRUST layer (SHAP explainability & fairness audit) & Zoho Catalyst deployment |
| **Dhikshitha** | `@DHIKSHITHA0906` | **Co-offending Network & Graph Analytics**<br>• NetworkX & 3D force graph co-offending network pipeline (341k nodes, 509k links)<br>• Louvain community detection & gang disruption simulation algorithm<br>• Socio-economic data integration & contextual map overlay research |
| **Nihan** | `@nihan-98716` | **Data Engineering & Geospatial Pipeline**<br>• CCTNS 8-table dataset loading, normalization & grid assignment (1.67M records)<br>• libpysal/esda Getis-Ord Gi* & LISA statistical hotspot computation<br>• GeoJSON minification & district boundary clipping pipeline |

---

### Shared Development Environment Note
> **Note for Organizers & Judges:**  
> All primary codebase development, model training, and integration builds were executed from a shared core workstation (`PRAHARI/`). The commit history and submission reflect collective contributions tagged across module boundaries.

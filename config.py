import os
from pathlib import Path
from datetime import datetime

# ── Paths ──────────────────────────────────────────────────────────────
PROJECT_ROOT = Path(__file__).parent
DATASET_DIR = Path(r"C:\Users\tirum\OneDrive\Desktop\KSP_Final_Dataset\submission_dataset")
OUTPUT_DIR = PROJECT_ROOT / "outputs"
CACHE_DIR = PROJECT_ROOT / "cache"

# ── Spatial grid ───────────────────────────────────────────────────────
KARNATAKA_BBOX = {
    "lat_min": 11.50, "lat_max": 18.50,
    "lon_min": 74.00, "lon_max": 78.60,
}
GRID_RESOLUTION_KM = 1.0
DEG_PER_KM_LAT = 1 / 111.0
DEG_PER_KM_LON = 1 / 107.0  # cos(15°) × 111 ≈ 107 km/deg at Karnataka's mid-latitude
MIN_CASES_PER_CELL = 5

# ── Temporal ───────────────────────────────────────────────────────────
TRAIN_END = datetime(2023, 6, 30)
VAL_END = datetime(2023, 12, 31)
TEST_START = datetime(2024, 1, 1)

SHIFT_HOURS = 8
SHIFTS = [(6, 14), (14, 22), (22, 6)]  # day, evening, night

# ── Near-repeat features ──────────────────────────────────────────────
NR_RADII_KM = [0.5, 1.0, 2.0, 5.0]
NR_WINDOWS_DAYS = [1, 3, 7, 14, 30]

# ── LightGBM ──────────────────────────────────────────────────────────
LGBM_PARAMS = {
    "objective": "binary",
    "metric": "auc",
    "num_leaves": 63,
    "max_depth": 8,
    "learning_rate": 0.05,
    "n_estimators": 500,
    "subsample": 0.8,
    "colsample_bytree": 0.8,
    "min_child_samples": 50,
    "verbose": -1,
    "n_jobs": -1,
    "random_state": 42,
}

# ── Anomaly detection ─────────────────────────────────────────────────
ANOMALY_ZSCORE_THRESHOLD = 3.0
STL_PERIOD = 7  # weekly seasonality

# ── Patrol optimizer ──────────────────────────────────────────────────
DEFAULT_NUM_PATROLS = 6
PATROL_RADIUS_KM = 2.0

# ── Network ───────────────────────────────────────────────────────────
TOP_DISRUPTORS = 50
MAX_NETWORK_NODES_EXPORT = 500

# ── Crime type groupings (for feature stratification) ─────────────────
CRIME_GROUPS_VIOLENT = [1, 3, 12, 13, 14, 15]   # body, sexual, women, children, kidnap, robbery
CRIME_GROUPS_PROPERTY = [2, 5, 9, 19]            # property, fraud, forgery, economic
CRIME_GROUPS_TRAFFIC = [6]                        # motor vehicle
CRIME_GROUPS_DRUGS = [8]                          # narcotics
CRIME_GROUPS_CYBER = [11]                         # cyber

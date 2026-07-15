import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from data.loader import load_enriched_cases, load_accused
from data.grid import build_grid, assign_cases_to_grid, get_active_cells, compute_cell_stats

print("=" * 70)
print("STEP 1 VERIFICATION: Skeleton")
print("=" * 70)

cases = load_enriched_cases()
print(f"\nCases shape: {cases.shape}")
print(f"Columns: {list(cases.columns)}")
print(f"Date range: {cases['IncidentFromDate'].min()} to {cases['IncidentFromDate'].max()}")
print(f"Districts: {cases['DistrictName'].nunique()}")
print(f"Crime types: {cases['crime_type'].nunique()}")
print(f"Gravity: {dict(cases['gravity_label'].value_counts())}")
print(f"Hour range: {cases['hour'].min()}-{cases['hour'].max()}, non-zero: {(cases['hour']!=0).sum():,}")

accused = load_accused()
print(f"\nAccused: {len(accused):,} rows, {accused['OffenderID'].nunique():,} unique offenders")

grid = build_grid()
cases = assign_cases_to_grid(cases, grid)
active = get_active_cells(cases, grid)
stats = compute_cell_stats(cases)

print(f"\nCell stats sample:")
print(stats.describe().to_string())

print("\n✓ Skeleton verification complete!")

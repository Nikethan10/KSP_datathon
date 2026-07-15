import pandas as pd
import numpy as np
from pathlib import Path
from config import DATASET_DIR, KARNATAKA_BBOX


def _p(name: str) -> Path:
    return DATASET_DIR / name


def load_case_master() -> pd.DataFrame:
    print("[loader] Loading CaseMaster.csv ...")
    cm = pd.read_csv(
        _p("CaseMaster.csv"),
        dtype={
            "CaseMasterID": "int32",
            "PoliceStationID": "int16",
            "CaseCategoryID": "int8",
            "GravityOffenceID": "int8",
            "CrimeMajorHeadID": "int8",
            "CrimeMinorHeadID": "int8",
            "CaseStatusID": "int8",
        },
        parse_dates=["IncidentFromDate", "IncidentToDate", "InfoReceivedPSDate"],
        low_memory=False,
    )
    cm["CrimeRegisteredDate"] = pd.to_datetime(cm["CrimeRegisteredDate"], errors="coerce")
    cm["latitude"] = pd.to_numeric(cm["latitude"], errors="coerce")
    cm["longitude"] = pd.to_numeric(cm["longitude"], errors="coerce")

    # filter to valid Karnataka coordinates
    bbox = KARNATAKA_BBOX
    mask = (
        cm["latitude"].between(bbox["lat_min"], bbox["lat_max"])
        & cm["longitude"].between(bbox["lon_min"], bbox["lon_max"])
    )
    dropped = (~mask).sum()
    if dropped:
        print(f"  dropped {dropped} rows outside Karnataka bbox")
    cm = cm[mask].copy()

    # temporal features
    cm["hour"] = cm["IncidentFromDate"].dt.hour.astype("int8")
    cm["dow"] = cm["IncidentFromDate"].dt.dayofweek.astype("int8")  # 0=Mon
    cm["month"] = cm["IncidentFromDate"].dt.month.astype("int8")
    cm["year"] = cm["IncidentFromDate"].dt.year.astype("int16")
    cm["is_weekend"] = cm["dow"].isin([5, 6]).astype("int8")
    cm["is_night"] = ((cm["hour"] >= 22) | (cm["hour"] < 6)).astype("int8")

    print(f"  loaded {len(cm):,} cases, {cm['IncidentFromDate'].min()} to {cm['IncidentFromDate'].max()}")
    return cm


def load_accused() -> pd.DataFrame:
    print("[loader] Loading Accused.csv ...")
    ac = pd.read_csv(
        _p("Accused.csv"),
        dtype={"CaseMasterID": "int32", "AgeYear": "int8", "GenderID": "int8"},
        low_memory=False,
    )
    print(f"  loaded {len(ac):,} accused rows, {ac['OffenderID'].nunique():,} unique offenders")
    return ac


def load_victims() -> pd.DataFrame:
    print("[loader] Loading Victim.csv ...")
    return pd.read_csv(_p("Victim.csv"), dtype=str, low_memory=False)


def load_arrests() -> pd.DataFrame:
    print("[loader] Loading ArrestSurrender.csv ...")
    ar = pd.read_csv(_p("ArrestSurrender.csv"), low_memory=False)
    ar["ArrestSurrenderDate"] = pd.to_datetime(ar["ArrestSurrenderDate"], errors="coerce")
    return ar


def load_chargesheets() -> pd.DataFrame:
    print("[loader] Loading ChargesheetDetails.csv ...")
    return pd.read_csv(_p("ChargesheetDetails.csv"), low_memory=False)


def load_act_sections() -> pd.DataFrame:
    print("[loader] Loading ActSectionAssociation.csv ...")
    return pd.read_csv(_p("ActSectionAssociation.csv"), dtype=str, low_memory=False)


def load_complainants() -> pd.DataFrame:
    print("[loader] Loading ComplainantDetails.csv ...")
    return pd.read_csv(_p("ComplainantDetails.csv"), low_memory=False)


def load_employees() -> pd.DataFrame:
    print("[loader] Loading Employee.csv ...")
    return pd.read_csv(_p("Employee.csv"), low_memory=False)


# ── Lookup tables ─────────────────────────────────────────────────────

def load_crime_heads() -> pd.DataFrame:
    return pd.read_csv(_p("CrimeHead.csv"), dtype={"CrimeHeadID": "int8"})


def load_crime_subheads() -> pd.DataFrame:
    return pd.read_csv(_p("CrimeSubHead.csv"))


def load_gravity() -> pd.DataFrame:
    return pd.read_csv(_p("GravityOffence.csv"), dtype={"GravityOffenceID": "int8"})


def load_units() -> pd.DataFrame:
    return pd.read_csv(_p("Unit.csv"), dtype={"UnitID": "int16", "DistrictID": "int8"})


def load_districts() -> pd.DataFrame:
    return pd.read_csv(_p("District.csv"), dtype={"DistrictID": "int8"})


# ── Enriched loader (joins lookups into CaseMaster) ───────────────────

def load_enriched_cases() -> pd.DataFrame:
    cm = load_case_master()
    units = load_units()[["UnitID", "DistrictID"]]
    districts = load_districts()[["DistrictID", "DistrictName"]]
    heads = load_crime_heads()[["CrimeHeadID", "CrimeGroupName"]]
    gravity = load_gravity()

    cm = cm.merge(units, left_on="PoliceStationID", right_on="UnitID", how="left")
    cm = cm.merge(districts, on="DistrictID", how="left")
    cm = cm.merge(
        heads, left_on="CrimeMajorHeadID", right_on="CrimeHeadID", how="left"
    )
    cm = cm.merge(
        gravity, on="GravityOffenceID", how="left"
    )
    cm.rename(columns={"CrimeGroupName": "crime_type", "LookupValue": "gravity_label"}, inplace=True)

    print(f"  enriched: {cm['DistrictName'].nunique()} districts, {cm['crime_type'].nunique()} crime types")
    return cm


def load_all() -> dict:
    cases = load_enriched_cases()
    accused = load_accused()
    return {
        "cases": cases,
        "accused": accused,
        "employees": load_employees(),
        "units": load_units(),
        "districts": load_districts(),
        "crime_heads": load_crime_heads(),
        "crime_subheads": load_crime_subheads(),
        "gravity": load_gravity(),
    }

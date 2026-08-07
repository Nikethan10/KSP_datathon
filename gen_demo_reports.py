"""Seed data for the citizen-report triage queue.

This is a FIXTURE, not a pipeline artefact. It is deliberately absent from
copy_data.py's COPY allowlist: nothing here is derived from FIR data, and it must
never be mistaken for analytics. It exists so a cold browser shows a populated
triage queue instead of an empty one.
"""
import io, json, random
from datetime import datetime, timedelta, timezone

random.seed(20260829)

cent = {c["district"]: c for c in json.load(
    io.open("frontend/public/data/district_centroids.json", encoding="utf-8"))}

now = datetime(2026, 8, 29, 18, 0, tzinfo=timezone.utc)
def iso(dt): return dt.strftime("%Y-%m-%dT%H:%M:%S.000Z")

def near(d, jitter=0.02):
    c = cent[d]
    return (round(c["lat"] + random.uniform(-jitter, jitter), 5),
            round(c["lon"] + random.uniform(-jitter, jitter), 5))

# (district, category, severity, status, hours_ago, description)
ROWS = [
    ("BENGALURU CITY", "Motor Vehicle Offences", "routine", "SUBMITTED", 3,
     "Two-wheelers riding on the footpath outside the market gate every evening around 7pm. An elderly man was clipped yesterday."),
    ("BENGALURU CITY", "Cheating & Fraud", "urgent", "SUBMITTED", 6,
     "Received a call claiming to be from the electricity board asking for a payment link to avoid disconnection. They knew my consumer number."),
    # Duplicate pair: same category, same area, within 48h, near-identical text.
    ("MYSURU CITY", "Crimes Against Property", "urgent", "SUBMITTED", 10,
     "Chain snatching near the temple street bus stop this morning. Two men on a black bike, no number plate visible."),
    ("MYSURU CITY", "Crimes Against Property", "urgent", "SUBMITTED", 14,
     "Chain snatching reported near temple street bus stop this morning. Two men on a black motorcycle with no visible number plate."),
    ("MANGALURU CITY", "Narcotics & Drugs", "urgent", "TRIAGE", 30,
     "Group gathering behind the old warehouse after midnight. Strong smell and foil packets left behind. Happens most nights."),
    ("SHIVAMOGGA", "Public Order Violations", "routine", "TRIAGE", 40,
     "Loud unauthorised gathering blocking the main road on weekends, vehicles cannot pass and there is no permission board displayed."),
    ("HUBBALLI DHARWAD CITY", "Crimes Against Body", "urgent", "NEEDS_INFO", 60,
     "Fight broke out near the bus stand, one person was injured and taken away by friends. I did not see who started it."),
    ("BELAGAVI CITY", "Gambling & Betting", "routine", "SUBMITTED", 20,
     "Card gambling running out of a shed near the canal every night, large amounts of cash changing hands."),
    ("TUMAKURU", "Environmental Offences", "routine", "SUBMITTED", 26,
     "Industrial effluent being released into the stream behind the layout after dark. Water has turned dark and smells strongly."),
    ("KALABURAGI", "Cyber Crimes", "urgent", "VERIFIED_FIR", 90,
     "My account was accessed and money transferred after I clicked a link sent by someone posing as bank support."),
    ("BENGALURU DIST", "Crimes Against Property", "routine", "VERIFIED_FIR", 120,
     "House break-in while the family was away for the weekend. Lock was cut, jewellery and cash missing."),
    ("DAKSHINA KANNADA", "Arms Act Violations", "urgent", "REJECTED", 150,
     "Saw someone showing what looked like a country weapon near the field. Could not see clearly, it was getting dark."),
    ("BALLARI", "Motor Vehicle Offences", "routine", "DUPLICATE", 55,
     "Rash driving by a tempo on the highway service road, nearly hit a cyclist near the junction."),
    ("UDUPI", "Forgery & Counterfeiting", "routine", "CLOSED_NO_ACTION", 200,
     "Suspected fake stamp paper being sold near the registration office."),
    # Deliberately junk, to show the spam signal and the queue ordering.
    ("BENGALURU CITY", "Cheating & Fraud", "emergency", "SUBMITTED", 1,
     "aaaaaaaaaaaaaaaaaaaaaaaaaaaa visit www.example-scam-site.com now 9876543210 9876543211"),
]

reports = []
for i, (dist, cat, sev, status, hrs, desc) in enumerate(ROWS):
    if dist not in cent:
        raise SystemExit("unknown district in fixture: %s" % dist)
    lat, lon = near(dist)
    submitted = now - timedelta(hours=hrs)
    incident = submitted - timedelta(hours=random.randint(1, 8))

    timeline = [{"at": iso(submitted), "fromStatus": None, "toStatus": "SUBMITTED",
                 "reasonCode": None, "actorType": "citizen"}]
    updated = submitted
    if status != "SUBMITTED":
        t1 = submitted + timedelta(hours=2)
        timeline.append({"at": iso(t1), "fromStatus": "SUBMITTED", "toStatus": "TRIAGE",
                         "reasonCode": None, "actorType": "officer", "actorLabel": "officer"})
        updated = t1
        if status != "TRIAGE":
            t2 = t1 + timedelta(hours=6)
            reason = {"NEEDS_INFO": "insufficient_detail", "VERIFIED_FIR": "verified_on_site",
                      "REJECTED": "unverifiable", "DUPLICATE": "duplicate_of",
                      "CLOSED_NO_ACTION": "not_a_crime"}[status]
            timeline.append({"at": iso(t2), "fromStatus": "TRIAGE", "toStatus": status,
                             "reasonCode": reason, "actorType": "officer", "actorLabel": "officer"})
            updated = t2

    reports.append({
        "publicRef": "PR-DEMO%02d" % (i + 1),
        "reporterRef": "seed",
        "status": status,
        "category": cat,
        "description": desc,
        "incidentAt": iso(incident),
        "lat": lat, "lon": lon,
        "locationPrecision": "map_pin",
        "severitySelf": sev,
        "lang": "en",
        "district": dist,
        "dupOf": "PR-DEMO03" if status == "DUPLICATE" else None,
        "firNumber": ("FIR/2026/%05d" % (400 + i)) if status == "VERIFIED_FIR" else None,
        "exportedAt": None,
        "submittedAt": iso(submitted),
        "updatedAt": iso(updated),
        "attachments": [],
        "timeline": timeline,
    })

out = {
    "_comment": "Demo fixture for the citizen report queue. NOT a pipeline artefact, "
                "NOT on copy_data.py's COPY allowlist. Regenerate with gen_demo_reports.py.",
    "generated_at": iso(now),
    "reports": reports,
}
path = "frontend/public/data/demo_reports.json"
io.open(path, "w", encoding="utf-8").write(json.dumps(out, indent=2, ensure_ascii=False))
print("wrote %s  (%d reports)" % (path, len(reports)))
from collections import Counter
print("by status:", dict(Counter(r["status"] for r in reports)))

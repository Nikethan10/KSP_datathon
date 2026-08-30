# Data Store schema — citizen reporting

Create these seven tables in the Catalyst console (Data Store → New Table) before
deploying the function. Catalyst adds `ROWID`, `CREATORID`, `CREATEDTIME` and
`MODIFIEDTIME` to every table automatically — do not add them by hand.

Two constraints shape every design decision below:

- **ZCQL caps a SELECT at 300 rows and 20 columns, and truncates silently at 300.**
  No query in `index.js` uses `SELECT *`, and every list endpoint paginates.
- **There are no transactions.** A report plus its events are separate writes that
  can half-fail, so every write path is idempotent on a natural key.

---

## `reporters`

| Column | Type | Notes |
|---|---|---|
| `contact_type` | Var Char (16) | `email` today, `phone` later. This is what makes the channel swappable. |
| `contact_value` | Encrypted Text | The raw address. **Equality lookup only.** |
| `contact_hash` | Var Char (64), Unique, Search Index | HMAC-SHA256 with `OTP_PEPPER`. Every lookup and rate-limit key uses this. |
| `display_name` | Var Char (120), nullable | PII |
| `lang` | Var Char (2) | `en` / `kn` |
| `status` | Var Char (16) | `active` / `blocked` |
| `trust_score` | Int, default 50 | |
| `reports_count` | Int, default 0 | |
| `verified_count` | Int, default 0 | |
| `rejected_count` | Int, default 0 | |
| `last_report_at` | DateTime, nullable | |
| `blocked_reason` | Var Char (255), nullable | |

**Why the hash exists:** Encrypted Text supports only `=` and `!=` — no `LIKE`, no
ranges, no aggregates. Confidentiality lives in `contact_value`; every query runs
off `contact_hash`. The pepper is a function env variable and is never stored.

## `otp_challenges`

| Column | Type | Notes |
|---|---|---|
| `challenge_id` | Var Char (64), Unique, Search Index | |
| `contact_hash` | Var Char (64), Search Index | |
| `code_hash` | Var Char (64) | HMAC of the six digits. **The code itself is never stored.** |
| `purpose` | Var Char (16) | |
| `attempts` | Int, default 0 | |
| `max_attempts` | Int, default 5 | |
| `expires_at` | DateTime | |
| `consumed` | Boolean, default false | |
| `request_ip` | Var Char (45) | PII-adjacent |

Purge rows older than 24 h with a Cron job.

## `citizen_reports`

| Column | Type | Notes |
|---|---|---|
| `public_ref` | Var Char (16), Unique, Search Index | `PR-7F3K2Q`. **The only identifier ever shown. Never expose `ROWID`.** |
| `reporter_id` | Var Char (32), Search Index | `reporters.ROWID` |
| `status` | Var Char (24), Search Index | lifecycle state |
| `category` | Var Char (64) | one of the 20 `CrimeGroupName` values |
| `description` | Text (10k) | **Very likely PII** — names, numbers, addresses |
| `incident_at` | DateTime | citizen-stated |
| `lat` / `lon` | Double | **PII-adjacent — can identify a home** |
| `location_precision` | Var Char (16) | `gps` / `map_pin` / `address_only` |
| `cell_id` | Int, Search Index | derived server-side from `grid_params.json` |
| `district` | Var Char (64), Search Index | nearest centroid |
| `severity_self` | Var Char (16) | |
| `dup_group` | Var Char (32), nullable, Search Index | canonical `public_ref` |
| `spam_score` | Double, default 0 | |
| `assigned_officer` | Var Char (64), nullable | |
| `fir_number` | Var Char (64), nullable, Unique | set only on `VERIFIED_FIR` |
| `exported_at` | DateTime, nullable, Search Index | **the seal** — once set the row is frozen |
| `sealed_batch_id` | Var Char (64), nullable | |
| `closed_at` | DateTime, nullable | |
| `client_nonce` | Var Char (64), Unique, Search Index | idempotency key |

`cell_id` is the load-bearing column: it lets the console co-locate a report with
an FIR-derived hotspot cell **without ever joining them in storage**.

## `report_events` — append-only

| Column | Type |
|---|---|
| `report_id` | Var Char (32), Search Index |
| `from_status` | Var Char (24), nullable |
| `to_status` | Var Char (24) |
| `actor_type` | Var Char (16) — `citizen` / `officer` / `system` |
| `actor_id` | Var Char (64) |
| `reason_code` | Var Char (32) |
| `note` | Text, nullable — officer free text, **never shown to a reporter** |
| `occurred_at` | DateTime |

No updates, no deletes. This **is** the officer-actions table; a separate one
would duplicate it and immediately disagree with it.

## `report_attachments`

Designed, not yet used — the presign endpoints return an error rather than
pretending to succeed.

| Column | Type |
|---|---|
| `report_id` | Var Char (32), nullable until bound |
| `object_key` | Var Char (255), Unique |
| `bucket` / `mime` | Var Char (64) |
| `size_bytes` | Int |
| `sha256` | Var Char (64), Search Index — exact-duplicate media detection |
| `exif_stripped` | Boolean |
| `status` | Var Char (16) |
| `uploaded_at` | DateTime |

## `audit_log`

| Column | Type |
|---|---|
| `actor_type` / `actor_id` | Var Char (16) / (64) |
| `action` | Var Char (48) — `otp.request`, `report.read`, `report.transition`, `export.seal`, … |
| `entity_type` / `entity_id` | Var Char (32) / (64) |
| `ip` | Var Char (45) |
| `user_agent` | Var Char (255) |
| `outcome` | Var Char (16) |
| `detail` | Text — JSON blob, forensic, not queryable |
| `occurred_at` | DateTime |

**Deliberately separate from `report_events`.** That one is the case history an
officer reads; this is who-looked-at-what, including reads and denials. Different
retention, different audience.

## `officers`

| Column | Type |
|---|---|
| `auth_user_id` | Var Char (64), Unique, Search Index |
| `email` | Var Char (120) |
| `display_name` | Var Char (120) |
| `district_scope` | Var Char (64) — `*` for state-wide |
| `role` | Var Char (16) — `triage` / `supervisor` / `admin` |
| `active` | Boolean |

Catalyst Authentication holds identity; it does not hold jurisdiction. **Never
trust a district claim from the client.**

---

## Environment variables

Set these on the function in the Catalyst console — never in the repo.

| Name | Purpose |
|---|---|
| `OTP_PEPPER` | HMAC pepper for `contact_hash` and `code_hash`. Long random string. |
| `TOKEN_SECRET` | HMAC secret for citizen session tokens. Long random string. |
| `MAIL_SENDER_EMAIL` | Verified sender for Catalyst's own mail service. Tried first — on-stack, no third-party key. |
| `BREVO_API_KEY` | Optional override. Only used if the Catalyst send fails or is unconfigured. |
| `BREVO_SENDER_EMAIL` | **Must be a verified sender in Brevo or nothing delivers.** |
| `BREVO_SENDER_NAME` | Defaults to `PRAHARI`. |
| `OTP_DEMO_MODE` | `true` accepts the fixed code `000000` and sends no mail. |
| `ALLOW_UNAUTH_OFFICER` | `true` lets `X-Prahari-Role` set the officer role. **Prototype only.** Defaults to `false` so an unconfigured deployment is closed. |
| `PUBLIC_REPORT_LAYER` | `true` exposes the aggregated map layer without auth. Defaults to `false`. |

## Verify before trusting any of this

1. ~~Deploy a hello-world Advanced I/O function and `curl` it.~~ **Done** — the
   function is live at `/server/prahari_api/`, same origin as the client, so
   there is no CORS to solve. Original note kept below for the datacenter detail.

   **Deploy a hello-world Advanced I/O function and `curl` it.** The docs show
   `.catalystserverless.com`; this project is on the IN datacenter
   (`.catalystserverless.in`), and `HEAD` returns 400 here — probe with `GET`.
2. **Confirm the `stack` value.** `catalyst-config.json` says `node18`; the docs
   example shows `node16`. A wrong stack fails at deploy.
3. **Confirm whether Catalyst Auth's user context reaches an Advanced I/O
   function** called from a browser session. If it does not, officer auth becomes
   a second custom token system — a materially bigger build. This is the highest-
   value unknown in the whole design.
4. Check Development-environment quotas: Data Store rows, invocations/day.
5. **Provision a Cache segment.** Verified against the live deployment: seven
   consecutive OTP requests for one address all returned `SERVER` rather than
   `RATE_LIMITED` on the sixth, which means `hitLimit` is failing open. The SDK
   method names are right (`segment.getValue` / `segment.put` both exist on
   Segment in v2.5) — the segment itself is not provisioned. Rate limiting is
   absent until it is, and it fails silently by design so nothing will tell you.

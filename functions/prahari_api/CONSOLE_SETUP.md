# Console setup — create the tables

Catalyst allows table creation **only from the console**: there is no CLI command
(`ds:import` writes rows, `iac:import` only makes a new project), the Node SDK
exposes `getAllTables` / `getTableDetails` / `getAllColumns` and no `createTable`,
and the REST docs state it outright. So this is a click-through job, and this
page exists to make it a mechanical one.

`SCHEMA.md` explains *why* each column is shaped the way it is. This is just the
list, in the order the console asks for it.

**Where:** Catalyst console → project **PRAHARI** → Data Store → New Table.

**Check your work at any point:**

```bash
curl https://prahari-60076064719.development.catalystserverless.in/server/prahari_api/v1/health/ready
```

It names every table still missing and flips `ready` to `true` when the last one
lands. No redeploy needed — the function picks them up immediately.

Catalyst adds `ROWID`, `CREATORID`, `CREATEDTIME` and `MODIFIEDTIME` to every
table. **Do not add those by hand** — the API reads the built-in ones.

---

## 1. `reporters`

| Column | Type | Size | Flags |
|---|---|---|---|
| `contact_type` | Var Char | 16 | |
| `contact_value` | Encrypted Text | — | |
| `contact_hash` | Var Char | 64 | Unique, Search Index |
| `display_name` | Var Char | 120 | nullable |
| `lang` | Var Char | 2 | |
| `status` | Var Char | 16 | default `active` |
| `trust_score` | Int | — | default 50 |
| `reports_count` | Int | — | default 0 |
| `verified_count` | Int | — | default 0 |
| `rejected_count` | Int | — | default 0 |
| `last_report_at` | DateTime | — | nullable |
| `blocked_reason` | Var Char | 255 | nullable |

## 2. `otp_challenges`

| Column | Type | Size | Flags |
|---|---|---|---|
| `challenge_id` | Var Char | 64 | Unique, Search Index |
| `contact_hash` | Var Char | 64 | Search Index |
| `code_hash` | Var Char | 64 | |
| `purpose` | Var Char | 16 | |
| `attempts` | Int | — | default 0 |
| `max_attempts` | Int | — | default 5 |
| `expires_at` | DateTime | — | |
| `consumed` | Boolean | — | default false |
| `request_ip` | Var Char | 45 | |

## 3. `citizen_reports`

The big one — 19 columns. Every one is used by the API.

| Column | Type | Size | Flags |
|---|---|---|---|
| `public_ref` | Var Char | 16 | Unique, Search Index |
| `reporter_id` | Var Char | 32 | Search Index |
| `status` | Var Char | 24 | Search Index |
| `category` | Var Char | 64 | |
| `description` | Text | 10000 | |
| `incident_at` | DateTime | — | |
| `lat` | Double | — | |
| `lon` | Double | — | |
| `location_precision` | Var Char | 16 | |
| `cell_id` | Int | — | Search Index, nullable |
| `district` | Var Char | 64 | Search Index, nullable |
| `severity_self` | Var Char | 16 | |
| `dup_group` | Var Char | 32 | Search Index, nullable |
| `spam_score` | Double | — | default 0 |
| `assigned_officer` | Var Char | 64 | nullable |
| `fir_number` | Var Char | 64 | Unique, nullable |
| `exported_at` | DateTime | — | Search Index, nullable |
| `sealed_batch_id` | Var Char | 64 | nullable |
| `closed_at` | DateTime | — | nullable |
| `client_nonce` | Var Char | 64 | Unique, Search Index |

## 4. `report_events`

| Column | Type | Size | Flags |
|---|---|---|---|
| `report_id` | Var Char | 32 | Search Index |
| `from_status` | Var Char | 24 | nullable |
| `to_status` | Var Char | 24 | |
| `actor_type` | Var Char | 16 | |
| `actor_id` | Var Char | 64 | |
| `reason_code` | Var Char | 32 | |
| `note` | Text | 10000 | nullable |
| `occurred_at` | DateTime | — | |

## 5. `report_attachments`

Not used yet — the presign endpoints return an error rather than pretending to
work — but the API imports the table name, so create it.

| Column | Type | Size | Flags |
|---|---|---|---|
| `report_id` | Var Char | 32 | nullable |
| `object_key` | Var Char | 255 | Unique |
| `bucket` | Var Char | 64 | |
| `mime` | Var Char | 64 | |
| `size_bytes` | Int | — | |
| `sha256` | Var Char | 64 | Search Index |
| `exif_stripped` | Boolean | — | default false |
| `status` | Var Char | 16 | |
| `uploaded_at` | DateTime | — | |

## 6. `audit_log`

| Column | Type | Size | Flags |
|---|---|---|---|
| `actor_type` | Var Char | 16 | |
| `actor_id` | Var Char | 64 | |
| `action` | Var Char | 48 | |
| `entity_type` | Var Char | 32 | |
| `entity_id` | Var Char | 64 | |
| `ip` | Var Char | 45 | |
| `user_agent` | Var Char | 255 | |
| `outcome` | Var Char | 16 | |
| `detail` | Text | 10000 | |
| `occurred_at` | DateTime | — | |

## 7. `officers`

| Column | Type | Size | Flags |
|---|---|---|---|
| `auth_user_id` | Var Char | 64 | Unique, Search Index |
| `email` | Var Char | 120 | |
| `display_name` | Var Char | 120 | |
| `district_scope` | Var Char | 64 | |
| `role` | Var Char | 16 | |
| `active` | Boolean | — | default true |

---

## Then: environment variables

Function → `prahari_api` → Configuration. Two are required before anything real
happens; the rest have working defaults.

| Name | Set it to |
|---|---|
| `OTP_PEPPER` | A long random string. Changing it later invalidates every stored contact hash. |
| `TOKEN_SECRET` | A long random string. Changing it signs out every citizen session. |
| `MAIL_SENDER_EMAIL` | A verified sender, to send real codes through Catalyst's own mail service. |
| `OTP_DEMO_MODE` | `false` once mail works. While `true`, the code is always `000000`. |

Leave `ALLOW_UNAUTH_OFFICER` and `PUBLIC_REPORT_LAYER` at `false` — an
unconfigured deployment should be closed, not open.

## Then: switch the console over

The site currently runs on the local adapter, which is why the portal already
works end to end without any of the above. To point it at the real backend,
build with:

```bash
VITE_REPORTS_MODE=catalyst npm run build
```

and redeploy the client. Until then nothing calls these tables, which is why the
deployment is inert rather than broken.

## Still open

**Whether Catalyst Auth's user context reaches an Advanced I/O function.** The
officer endpoints assume it does. If it does not, officer identity becomes a
second custom token system — a materially bigger build than what is here. Worth
settling before relying on the triage queue with real users.

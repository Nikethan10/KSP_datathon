'use strict'

const catalyst = require('zcatalyst-sdk-node')
const { q } = require('./util')

/* Data Store access. Two hard constraints shape everything here:

   1. ZCQL caps a SELECT at 300 rows and 20 columns, and TRUNCATES SILENTLY at
      300. So no query in this file says SELECT * and none is written assuming it
      got everything — every list endpoint paginates.
   2. There are no transactions. A report plus its events plus its attachment
      bindings are separate writes that can half-fail, so every write path is
      idempotent on a natural key (public_ref, client_nonce, object_key). */

const T = {
  reporters: 'reporters',
  otp: 'otp_challenges',
  reports: 'citizen_reports',
  events: 'report_events',
  attachments: 'report_attachments',
  audit: 'audit_log',
  officers: 'officers',
}

const app = (req) => catalyst.initialize(req)

/** ZCQL hands back rows namespaced by table: [{ citizen_reports: {...} }]. */
function unwrap(rows, table) {
  return (rows || []).map((r) => r[table] || r)
}

async function query(req, zcql) {
  const rows = await app(req).zcql().executeZCQLQuery(zcql)
  return rows || []
}

async function selectFrom(req, table, columns, where, opts) {
  const o = opts || {}
  const cols = columns.join(', ')
  let sql = 'SELECT ' + cols + ' FROM ' + table
  if (where) sql += ' WHERE ' + where
  if (o.orderBy) sql += ' ORDER BY ' + o.orderBy
  // LIMIT offset,count — the ceiling is 300 whatever we ask for.
  const limit = Math.min(o.limit || 50, 300)
  sql += ' LIMIT ' + (o.offset ? o.offset + ',' + limit : String(limit))
  return unwrap(await query(req, sql), table)
}

async function insertRow(req, table, row) {
  const t = app(req).datastore().table(table)
  return t.insertRow(row)
}

async function updateRow(req, table, row) {
  const t = app(req).datastore().table(table)
  return t.updateRow(row)
}

async function findOne(req, table, columns, where) {
  const rows = await selectFrom(req, table, columns, where, { limit: 1 })
  return rows.length ? rows[0] : null
}

/* ── audit ──────────────────────────────────────────────────────────
   Separate from report_events on purpose. report_events is the case history an
   officer reads; this is who-looked-at-what, including reads and denials.
   Different retention, different audience. Never allowed to fail a request. */
async function audit(req, entry) {
  try {
    await insertRow(req, T.audit, {
      actor_type: entry.actorType || 'system',
      actor_id: entry.actorId || '',
      action: entry.action,
      entity_type: entry.entityType || '',
      entity_id: entry.entityId || '',
      ip: (req.headers['x-forwarded-for'] || '').split(',')[0].trim().slice(0, 45),
      user_agent: String(req.headers['user-agent'] || '').slice(0, 255),
      outcome: entry.outcome || 'ok',
      detail: entry.detail ? JSON.stringify(entry.detail).slice(0, 9000) : '',
      occurred_at: new Date().toISOString(),
    })
  } catch (e) {
    console.error('[audit] write failed:', e.message)
  }
}

/* ── rate limiting ──────────────────────────────────────────────────
   Counter per {scope, key, window} in Catalyst Cache. If the cache is
   unreachable this FAILS OPEN and says so in the log: a throttle that takes the
   whole portal down with it is worse than the abuse it prevents. The per-IP caps
   matter more with email than they did with SMS, because sending costs nothing
   and Brevo's free tier is a shared 300 a day. */
async function hitLimit(req, scope, key, max, windowSec) {
  const bucket = Math.floor(Date.now() / 1000 / windowSec)
  const cacheKey = ['rl', scope, key, bucket].join(':')
  try {
    const segment = app(req).cache().segment()
    const existing = await segment.getValue(cacheKey)
    const count = existing ? parseInt(existing, 10) || 0 : 0
    if (count >= max) {
      return { limited: true, retryAfterSec: windowSec - (Math.floor(Date.now() / 1000) % windowSec) }
    }
    // expiry is in hours; never below 1
    const hours = Math.max(1, Math.ceil(windowSec / 3600))
    /* put() creates and update() modifies — they are separate calls on Segment,
       and put on a key that already exists rejects. Using put for both meant the
       first request in a window stored 1 and every subsequent one threw, was
       caught by the fail-open guard, and sailed past the limit. The counter never
       advanced beyond 1, so nothing was ever limited. */
    if (existing === null || existing === undefined) {
      await segment.put(cacheKey, String(count + 1), hours)
    } else {
      await segment.update(cacheKey, String(count + 1), hours)
    }
    return { limited: false }
  } catch (e) {
    console.error('[ratelimit] cache unavailable, failing open:', e.message)
    return { limited: false, degraded: true }
  }
}

module.exports = {
  T, app, query, selectFrom, insertRow, updateRow, findOne, unwrap, audit, hitLimit, q,
}

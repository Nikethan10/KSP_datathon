'use strict'

const express = require('express')
const {
  ok, fail, env, hashContact, hashCode, signToken, verifyToken,
  publicRef, nowIso, q,
} = require('./lib/util')
const S = require('./lib/store')
const { T } = S
const LC = require('./lib/lifecycle')
const { cellIdFor, nearestDistrict, withinKarnataka } = require('./lib/geo')
const MOD = require('./lib/moderation')
const OTP = require('./lib/otp')

/* PRAHARI citizen reporting API.

   Advanced I/O rather than Basic I/O: Basic I/O only does JSON-in/JSON-out at a
   fixed /execute path with no header access, which makes bearer tokens
   impossible. Everything is versioned under /v1 from the first commit because
   Catalyst caches index.html, so a stale bundle WILL eventually meet a newer API
   and that should fail loudly rather than mysteriously. */

const app = express()
app.use(express.json({ limit: '256kb' }))

/* Served from the same host as the client (/app/ and /server/ are siblings), so
   production needs no CORS at all. Development runs against the local adapter
   instead — see frontend/src/lib/reports/index.ts. */

const REPORT_COLS = [
  'ROWID', 'public_ref', 'reporter_id', 'status', 'category', 'description',
  'incident_at', 'lat', 'lon', 'district', 'cell_id', 'severity_self',
]
const REPORT_COLS_META = [
  'ROWID', 'public_ref', 'status', 'category', 'incident_at', 'district',
  'cell_id', 'severity_self', 'dup_group', 'spam_score', 'fir_number', 'exported_at',
]

const OTP_TTL_SEC = 600
const OTP_RESEND_SEC = 60
const MAX_OTP_ATTEMPTS = 5

// ── helpers ────────────────────────────────────────────────────────

function bearer(req) {
  const h = req.headers.authorization || ''
  return h.startsWith('Bearer ') ? h.slice(7) : null
}

function citizen(req) {
  const claims = verifyToken(bearer(req))
  return claims && claims.scope === 'citizen' ? claims : null
}

/* Catalyst Authentication is the intended officer identity. Whether its user
   context propagates into an Advanced I/O function called from the browser is
   the one thing that most changes this design, and it has to be verified against
   a real deployment. Until then ALLOW_UNAUTH_OFFICER gates a header-supplied
   role, defaulting to OFF so an unconfigured deployment is closed, not open. */
async function officer(req) {
  try {
    const user = await S.app(req).userManagement().getCurrentUser()
    if (user && user.user_id) {
      const row = await S.findOne(
        req, T.officers,
        ['ROWID', 'auth_user_id', 'display_name', 'role', 'district_scope', 'active'],
        'auth_user_id = ' + q(String(user.user_id)),
      )
      if (row && String(row.active) !== 'false') {
        return { id: String(user.user_id), role: row.role || 'officer', scope: row.district_scope || '*' }
      }
      return { id: String(user.user_id), role: 'officer', scope: '*' }
    }
  } catch (e) {
    console.error('[auth] Catalyst user context unavailable:', e.message)
  }
  if (env('ALLOW_UNAUTH_OFFICER', 'false') === 'true') {
    const role = req.headers['x-prahari-role'] === 'supervisor' ? 'supervisor' : 'officer'
    return { id: 'unauthenticated', role, scope: '*' }
  }
  return null
}

const clientIp = (req) => (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown'

function toSummary(r, forOfficer) {
  const base = {
    publicRef: r.public_ref,
    status: r.status,
    category: r.category,
    incidentAt: r.incident_at,
    submittedAt: r.CREATEDTIME || r.created_at || r.incident_at,
    updatedAt: r.MODIFIEDTIME || r.updated_at || r.incident_at,
    district: r.district || null,
    cellId: r.cell_id === undefined ? null : Number(r.cell_id),
    severitySelf: r.severity_self,
  }
  if (!forOfficer) return base
  base.dupOf = r.dup_group || null
  base.spamScore = r.spam_score === undefined ? 0 : Number(r.spam_score)
  return base
}

async function timelineFor(req, reportRowId, forOfficer) {
  const rows = await S.selectFrom(
    req, T.events,
    ['ROWID', 'report_id', 'from_status', 'to_status', 'reason_code', 'actor_type', 'actor_id', 'note', 'occurred_at'],
    'report_id = ' + q(String(reportRowId)),
    { orderBy: 'occurred_at ASC', limit: 100 },
  )
  return rows.map((e) => {
    const base = {
      at: e.occurred_at,
      fromStatus: e.from_status || null,
      toStatus: e.to_status,
      reasonCode: e.reason_code || null,
      actorType: e.actor_type,
    }
    // The reporter sees that a decision was taken and why — never who took it,
    // and never the internal note.
    if (forOfficer) {
      base.actorLabel = e.actor_id || undefined
      base.note = e.note || undefined
    }
    return base
  })
}

async function reportByRef(req, ref) {
  return S.findOne(req, T.reports, REPORT_COLS.concat(['dup_group', 'spam_score', 'fir_number', 'exported_at', 'client_nonce', 'CREATEDTIME', 'MODIFIEDTIME']).slice(0, 20), 'public_ref = ' + q(ref))
}

async function writeEvent(req, reportRowId, from, to, reasonCode, actorType, actorId, note) {
  await S.insertRow(req, T.events, {
    report_id: reportRowId,
    from_status: from,
    to_status: to,
    reason_code: reasonCode || '',
    actor_type: actorType,
    actor_id: actorId || '',
    note: note || '',
    occurred_at: nowIso(),
  })
}

// ── health ─────────────────────────────────────────────────────────

app.get('/v1/health', (req, res) => {
  ok(res, { service: 'prahari_api', version: 'v1', otpDemoMode: OTP.isDemo() })
})

// ── citizen identity ───────────────────────────────────────────────

app.post('/v1/auth/otp/request', async (req, res) => {
  try {
    const contact = String((req.body && req.body.contact) || '').trim()
    const lang = (req.body && req.body.lang) === 'kn' ? 'kn' : 'en'
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contact)) return fail(res, 400, 'VALIDATION')

    const ch = hashContact(contact)
    const perContact = await S.hitLimit(req, 'otp_contact', ch, 5, 3600)
    if (perContact.limited) return fail(res, 429, 'RATE_LIMITED', perContact.retryAfterSec)
    const perIp = await S.hitLimit(req, 'otp_ip', clientIp(req), 20, 3600)
    if (perIp.limited) return fail(res, 429, 'RATE_LIMITED', perIp.retryAfterSec)

    const code = OTP.generateCode()
    const challengeId = require('crypto').randomUUID()
    await S.insertRow(req, T.otp, {
      challenge_id: challengeId,
      contact_hash: ch,
      code_hash: hashCode(code, challengeId),
      purpose: 'report',
      attempts: 0,
      max_attempts: MAX_OTP_ATTEMPTS,
      expires_at: new Date(Date.now() + OTP_TTL_SEC * 1000).toISOString(),
      consumed: false,
      request_ip: clientIp(req).slice(0, 45),
    })

    const sent = await OTP.sendCode(contact, code, lang)
    await S.audit(req, { actorType: 'citizen', action: 'otp.request', entityType: 'otp', entityId: challengeId })

    // Never reveals whether the address is already known.
    ok(res, {
      challengeId,
      expiresInSec: OTP_TTL_SEC,
      resendAfterSec: OTP_RESEND_SEC,
      demoMode: sent.demo,
    })
  } catch (e) {
    console.error('[otp/request]', e)
    fail(res, 500, 'SERVER')
  }
})

app.post('/v1/auth/otp/verify', async (req, res) => {
  try {
    const { challengeId, code } = req.body || {}
    if (!challengeId || !code) return fail(res, 400, 'VALIDATION')

    const row = await S.findOne(
      req, T.otp,
      ['ROWID', 'challenge_id', 'contact_hash', 'code_hash', 'attempts', 'max_attempts', 'expires_at', 'consumed'],
      'challenge_id = ' + q(String(challengeId)),
    )
    if (!row) return fail(res, 400, 'OTP_EXPIRED')
    if (String(row.consumed) === 'true') return fail(res, 400, 'OTP_EXPIRED')
    if (Date.parse(row.expires_at) < Date.now()) return fail(res, 400, 'OTP_EXPIRED')
    if (Number(row.attempts) >= Number(row.max_attempts)) return fail(res, 429, 'OTP_ATTEMPTS')

    if (hashCode(String(code).trim(), String(challengeId)) !== row.code_hash) {
      await S.updateRow(req, T.otp, { ROWID: row.ROWID, attempts: Number(row.attempts) + 1 })
      await S.audit(req, { actorType: 'citizen', action: 'otp.verify.fail', entityType: 'otp', entityId: challengeId, outcome: 'denied' })
      return fail(res, 400, 'OTP_INVALID')
    }

    await S.updateRow(req, T.otp, { ROWID: row.ROWID, consumed: true })

    let reporter = await S.findOne(
      req, T.reporters,
      ['ROWID', 'contact_hash', 'status', 'reports_count', 'verified_count', 'rejected_count', 'CREATEDTIME'],
      'contact_hash = ' + q(row.contact_hash),
    )
    if (!reporter) {
      const created = await S.insertRow(req, T.reporters, {
        contact_type: 'email',
        contact_hash: row.contact_hash,
        lang: (req.body && req.body.lang) === 'kn' ? 'kn' : 'en',
        status: 'active',
        trust_score: 50,
        reports_count: 0,
        verified_count: 0,
        rejected_count: 0,
      })
      reporter = Array.isArray(created) ? created[0] : created
    }
    if (reporter && reporter.status === 'blocked') return fail(res, 403, 'BLOCKED')

    const reporterRef = String(reporter.ROWID)
    const token = signToken({ sub: reporterRef, ph: row.contact_hash, scope: 'citizen' }, 86400)
    ok(res, { token, reporterRef, expiresAt: new Date(Date.now() + 86400000).toISOString() })
  } catch (e) {
    console.error('[otp/verify]', e)
    fail(res, 500, 'SERVER')
  }
})

// ── citizen reports ────────────────────────────────────────────────

const BLOCKED_CATEGORIES = ['Sexual Offences', 'Crimes Against Children', 'Kidnapping & Abduction']

app.post('/v1/reports', async (req, res) => {
  try {
    const me = citizen(req)
    if (!me) return fail(res, 401, 'UNAUTHENTICATED')

    const b = req.body || {}
    const category = String(b.category || '')
    const description = String(b.description || '').trim()
    const severity = String(b.severitySelf || 'routine')

    // These two are refusals, not validation errors: a queued web form is the
    // wrong channel for either.
    if (BLOCKED_CATEGORIES.indexOf(category) >= 0) return fail(res, 422, 'BLOCKED')
    if (severity === 'emergency') return fail(res, 422, 'BLOCKED')
    if (description.length < 10) return fail(res, 400, 'VALIDATION')
    if (typeof b.lat !== 'number' || typeof b.lon !== 'number') return fail(res, 400, 'VALIDATION')
    if (!b.clientNonce) return fail(res, 400, 'VALIDATION')

    const perReporter = await S.hitLimit(req, 'submit_reporter', me.sub, 3, 3600)
    if (perReporter.limited) return fail(res, 429, 'RATE_LIMITED', perReporter.retryAfterSec)
    const perIp = await S.hitLimit(req, 'submit_ip', clientIp(req), 30, 3600)
    if (perIp.limited) return fail(res, 429, 'RATE_LIMITED', perIp.retryAfterSec)

    /* Idempotency. There are no transactions, so a retried submit must return the
       original reference rather than create a twin. */
    const existing = await S.findOne(
      req, T.reports, ['ROWID', 'public_ref', 'status', 'dup_group'],
      'client_nonce = ' + q(String(b.clientNonce)),
    )
    if (existing) {
      return ok(res, { publicRef: existing.public_ref, status: existing.status, dupOf: existing.dup_group || undefined })
    }

    const cellId = cellIdFor(b.lat, b.lon)
    const inK = withinKarnataka(b.lat, b.lon)

    const reporter = await S.findOne(
      req, T.reporters,
      ['ROWID', 'reports_count', 'rejected_count', 'CREATEDTIME'],
      'ROWID = ' + q(String(me.sub)),
    )

    const spam = MOD.scoreSpam({
      description, category, severitySelf: severity,
      lat: b.lat, lon: b.lon, inKarnataka: inK,
      reporterAgeHours: reporter && reporter.CREATEDTIME
        ? (Date.now() - Date.parse(reporter.CREATEDTIME)) / 3600000 : 0,
      reporterReportsToday: 0,
      reporterReports: reporter ? Number(reporter.reports_count || 0) : 0,
      reporterRejected: reporter ? Number(reporter.rejected_count || 0) : 0,
    })

    // Candidates narrowed to the cell neighbourhood before any text comparison,
    // which keeps this well under the 300-row ZCQL ceiling.
    let dup = null
    if (cellId !== null) {
      const near = require('./lib/geo').neighbourCells(cellId)
      const cands = await S.selectFrom(
        req, T.reports,
        ['public_ref', 'status', 'category', 'description', 'incident_at', 'cell_id'],
        'category = ' + q(category) + ' AND cell_id IN (' + near.join(',') + ')',
        { limit: 100 },
      )
      dup = MOD.findDuplicate(
        { category, description, incidentAt: b.incidentAt, cellId },
        cands.map((c) => ({
          publicRef: c.public_ref, status: c.status, category: c.category,
          description: c.description, incidentAt: c.incident_at, cellId: Number(c.cell_id),
        })),
      )
    }

    const ref = publicRef()
    const created = await S.insertRow(req, T.reports, {
      public_ref: ref,
      reporter_id: me.sub,
      status: 'SUBMITTED',
      category,
      description,
      incident_at: b.incidentAt || nowIso(),
      lat: b.lat,
      lon: b.lon,
      location_precision: b.locationPrecision || 'address_only',
      cell_id: cellId,
      district: nearestDistrict(b.lat, b.lon),
      severity_self: severity,
      dup_group: dup ? dup.publicRef : '',
      spam_score: spam.score,
      client_nonce: String(b.clientNonce),
    })
    const row = Array.isArray(created) ? created[0] : created

    await writeEvent(req, row.ROWID, null, 'SUBMITTED', null, 'citizen', me.sub)
    if (reporter) {
      await S.updateRow(req, T.reporters, {
        ROWID: reporter.ROWID,
        reports_count: Number(reporter.reports_count || 0) + 1,
        last_report_at: nowIso(),
      })
    }
    await S.audit(req, { actorType: 'citizen', actorId: me.sub, action: 'report.create', entityType: 'report', entityId: ref })

    ok(res, { publicRef: ref, status: 'SUBMITTED', dupOf: dup ? dup.publicRef : undefined }, 201)
  } catch (e) {
    console.error('[reports/create]', e)
    fail(res, 500, 'SERVER')
  }
})

app.get('/v1/reports/mine', async (req, res) => {
  try {
    const me = citizen(req)
    if (!me) return fail(res, 401, 'UNAUTHENTICATED')
    const rows = await S.selectFrom(
      req, T.reports, REPORT_COLS_META,
      'reporter_id = ' + q(String(me.sub)),
      { orderBy: 'CREATEDTIME DESC', limit: 50 },
    )
    ok(res, rows.map((r) => toSummary(r, false)))
  } catch (e) {
    console.error('[reports/mine]', e)
    fail(res, 500, 'SERVER')
  }
})

app.get('/v1/reports/:ref', async (req, res) => {
  try {
    const me = citizen(req)
    if (!me) return fail(res, 401, 'UNAUTHENTICATED')
    const r = await reportByRef(req, req.params.ref)
    if (!r) return fail(res, 404, 'NOT_FOUND')
    if (String(r.reporter_id) !== String(me.sub)) return fail(res, 403, 'FORBIDDEN')

    ok(res, Object.assign(toSummary(r, false), {
      description: r.description,
      lat: Number(r.lat),
      lon: Number(r.lon),
      attachments: [],
      timeline: await timelineFor(req, r.ROWID, false),
      firNumber: r.fir_number || null,
      exportedAt: r.exported_at || null,
    }))
  } catch (e) {
    console.error('[reports/get]', e)
    fail(res, 500, 'SERVER')
  }
})

app.post('/v1/reports/:ref/withdraw', async (req, res) => {
  try {
    const me = citizen(req)
    if (!me) return fail(res, 401, 'UNAUTHENTICATED')
    const r = await reportByRef(req, req.params.ref)
    if (!r) return fail(res, 404, 'NOT_FOUND')
    if (String(r.reporter_id) !== String(me.sub)) return fail(res, 403, 'FORBIDDEN')

    const bad = LC.checkTransition(r.status, 'WITHDRAWN', 'citizen', { submittedAt: r.CREATEDTIME })
    if (bad) return fail(res, 409, bad)

    await S.updateRow(req, T.reports, { ROWID: r.ROWID, status: 'WITHDRAWN', closed_at: nowIso() })
    await writeEvent(req, r.ROWID, r.status, 'WITHDRAWN', null, 'citizen', me.sub)
    ok(res, { status: 'WITHDRAWN' })
  } catch (e) {
    console.error('[reports/withdraw]', e)
    fail(res, 500, 'SERVER')
  }
})

app.post('/v1/reports/:ref/reply', async (req, res) => {
  try {
    const me = citizen(req)
    if (!me) return fail(res, 401, 'UNAUTHENTICATED')
    const text = String((req.body && req.body.text) || '').trim()
    if (!text) return fail(res, 400, 'VALIDATION')

    const r = await reportByRef(req, req.params.ref)
    if (!r) return fail(res, 404, 'NOT_FOUND')
    if (String(r.reporter_id) !== String(me.sub)) return fail(res, 403, 'FORBIDDEN')
    if (r.status !== 'NEEDS_INFO') return fail(res, 409, 'ILLEGAL_TRANSITION')

    const limited = await S.hitLimit(req, 'reply_reporter', me.sub, 1, 3600)
    if (limited.limited) return fail(res, 429, 'RATE_LIMITED', limited.retryAfterSec)

    await S.updateRow(req, T.reports, {
      ROWID: r.ROWID,
      status: 'TRIAGE',
      description: (r.description + '\n\n[' + nowIso() + '] ' + text).slice(0, 9500),
    })
    await writeEvent(req, r.ROWID, 'NEEDS_INFO', 'TRIAGE', null, 'citizen', me.sub)
    ok(res, { status: 'TRIAGE' })
  } catch (e) {
    console.error('[reports/reply]', e)
    fail(res, 500, 'SERVER')
  }
})

// ── officer ────────────────────────────────────────────────────────

app.get('/v1/officer/queue', async (req, res) => {
  try {
    const who = await officer(req)
    if (!who) return fail(res, 401, 'UNAUTHENTICATED')

    const limit = Math.min(parseInt(req.query.limit, 10) || 25, 50)
    const offset = parseInt(req.query.cursor, 10) || 0
    const statuses = req.query.status
      ? String(req.query.status).split(',').filter((s) => LC.ALL_STATUSES.indexOf(s) >= 0)
      : null

    const where = []
    if (statuses && statuses.length) {
      where.push('status IN (' + statuses.map(q).join(',') + ')')
    }
    if (req.query.district) where.push('district = ' + q(String(req.query.district)))
    if (who.scope && who.scope !== '*') where.push('district = ' + q(who.scope))

    const rows = await S.selectFrom(
      req, T.reports, REPORT_COLS_META,
      where.length ? where.join(' AND ') : null,
      // Likely spam sinks to the bottom rather than disappearing — an officer
      // still has to be able to find it and disagree.
      { orderBy: 'spam_score ASC, CREATEDTIME DESC', limit: limit + 1, offset },
    )
    const hasMore = rows.length > limit
    ok(res, {
      items: rows.slice(0, limit).map((r) => toSummary(r, true)),
      nextCursor: hasMore ? String(offset + limit) : null,
    })
  } catch (e) {
    console.error('[officer/queue]', e)
    fail(res, 500, 'SERVER')
  }
})

app.get('/v1/officer/reports/:ref', async (req, res) => {
  try {
    const who = await officer(req)
    if (!who) return fail(res, 401, 'UNAUTHENTICATED')
    const r = await reportByRef(req, req.params.ref)
    if (!r) return fail(res, 404, 'NOT_FOUND')

    // Reading a citizen's free text is an auditable act.
    await S.audit(req, { actorType: 'officer', actorId: who.id, action: 'report.read', entityType: 'report', entityId: r.public_ref })

    ok(res, Object.assign(toSummary(r, true), {
      description: r.description,
      lat: Number(r.lat),
      lon: Number(r.lon),
      attachments: [],
      timeline: await timelineFor(req, r.ROWID, true),
      firNumber: r.fir_number || null,
      exportedAt: r.exported_at || null,
    }))
  } catch (e) {
    console.error('[officer/get]', e)
    fail(res, 500, 'SERVER')
  }
})

app.post('/v1/officer/reports/:ref/transition', async (req, res) => {
  try {
    const who = await officer(req)
    if (!who) return fail(res, 401, 'UNAUTHENTICATED')
    const b = req.body || {}
    const r = await reportByRef(req, req.params.ref)
    if (!r) return fail(res, 404, 'NOT_FOUND')

    const bad = LC.checkTransition(
      r.status, String(b.toStatus), who.role,
      { submittedAt: r.CREATEDTIME, exportedAt: r.exported_at, lastEventAt: r.MODIFIEDTIME },
      { reasonCode: b.reasonCode, firNumber: b.firNumber, dupOf: b.dupOf },
    )
    if (bad) return fail(res, bad === 'FORBIDDEN' ? 403 : 409, bad)
    if (b.reasonCode && LC.REASON_CODES.indexOf(String(b.reasonCode)) < 0) {
      return fail(res, 400, 'VALIDATION')
    }

    const patch = { ROWID: r.ROWID, status: b.toStatus }
    if (b.firNumber) patch.fir_number = String(b.firNumber)
    if (b.dupOf) patch.dup_group = String(b.dupOf)
    if (['REJECTED', 'CLOSED_NO_ACTION', 'DUPLICATE'].indexOf(String(b.toStatus)) >= 0) {
      patch.closed_at = nowIso()
    }
    await S.updateRow(req, T.reports, patch)
    await writeEvent(req, r.ROWID, r.status, b.toStatus, b.reasonCode, 'officer', who.id, b.note)

    if (r.reporter_id) {
      const rep = await S.findOne(req, T.reporters, ['ROWID', 'verified_count', 'rejected_count'], 'ROWID = ' + q(String(r.reporter_id)))
      if (rep) {
        const upd = { ROWID: rep.ROWID }
        if (b.toStatus === 'VERIFIED_FIR') upd.verified_count = Number(rep.verified_count || 0) + 1
        if (b.toStatus === 'REJECTED') upd.rejected_count = Number(rep.rejected_count || 0) + 1
        if (upd.verified_count !== undefined || upd.rejected_count !== undefined) {
          await S.updateRow(req, T.reporters, upd)
        }
      }
    }

    await S.audit(req, {
      actorType: 'officer', actorId: who.id, action: 'report.transition',
      entityType: 'report', entityId: r.public_ref,
      detail: { from: r.status, to: b.toStatus, reason: b.reasonCode },
    })

    const fresh = await reportByRef(req, req.params.ref)
    ok(res, Object.assign(toSummary(fresh, true), {
      description: fresh.description,
      lat: Number(fresh.lat),
      lon: Number(fresh.lon),
      attachments: [],
      timeline: await timelineFor(req, fresh.ROWID, true),
      firNumber: fresh.fir_number || null,
      exportedAt: fresh.exported_at || null,
    }))
  } catch (e) {
    console.error('[officer/transition]', e)
    fail(res, 500, 'SERVER')
  }
})

app.get('/v1/officer/stats', async (req, res) => {
  try {
    const who = await officer(req)
    if (!who) return fail(res, 401, 'UNAUTHENTICATED')
    const out = {}
    LC.ALL_STATUSES.forEach((s) => { out[s] = 0 })
    const rows = await S.query(req, 'SELECT COUNT(ROWID), status FROM ' + T.reports + ' GROUP BY status')
    S.unwrap(rows, T.reports).forEach((r) => {
      const key = r.status
      const n = Number(r['COUNT(ROWID)'] !== undefined ? r['COUNT(ROWID)'] : r.count)
      if (key in out && !Number.isNaN(n)) out[key] = n
    })
    ok(res, out)
  } catch (e) {
    console.error('[officer/stats]', e)
    fail(res, 500, 'SERVER')
  }
})

// ── the manual gate ────────────────────────────────────────────────

app.get('/v1/officer/export/verified', async (req, res) => {
  try {
    const who = await officer(req)
    if (!who) return fail(res, 401, 'UNAUTHENTICATED')
    if (who.role !== 'supervisor') return fail(res, 403, 'FORBIDDEN')

    /* Read-only on purpose. A supervisor is expected to read this before
       sealing, and reading must never change anything. */
    const rows = await S.selectFrom(
      req, T.reports,
      ['public_ref', 'fir_number', 'category', 'district', 'incident_at', 'lat', 'lon', 'MODIFIEDTIME'],
      "status = 'VERIFIED_FIR' AND exported_at IS NULL",
      { orderBy: 'MODIFIEDTIME ASC', limit: 300 },
    )
    ok(res, {
      batchId: require('crypto').randomUUID().slice(0, 8),
      since: req.query.since || null,
      rows: rows.map((r) => ({
        publicRef: r.public_ref,
        firNumber: r.fir_number || '',
        category: r.category,
        district: r.district || null,
        incidentAt: r.incident_at,
        lat: Number(r.lat),
        lon: Number(r.lon),
        verifiedBy: 'officer',
        verifiedAt: r.MODIFIEDTIME,
      })),
    })
  } catch (e) {
    console.error('[export/verified]', e)
    fail(res, 500, 'SERVER')
  }
})

app.post('/v1/officer/export/seal', async (req, res) => {
  try {
    const who = await officer(req)
    if (!who) return fail(res, 401, 'UNAUTHENTICATED')
    if (who.role !== 'supervisor') return fail(res, 403, 'FORBIDDEN')

    const { batchId, refs } = req.body || {}
    if (!batchId || !Array.isArray(refs) || !refs.length) return fail(res, 400, 'VALIDATION')

    const at = nowIso()
    let count = 0
    for (let i = 0; i < refs.length; i++) {
      const r = await reportByRef(req, String(refs[i]))
      if (!r || r.status !== 'VERIFIED_FIR' || r.exported_at) continue
      await S.updateRow(req, T.reports, { ROWID: r.ROWID, exported_at: at, sealed_batch_id: String(batchId) })
      count++
    }

    const payload = refs.slice().sort().join('|')
    const sha256 = require('crypto').createHash('sha256').update(payload).digest('hex')

    await S.audit(req, {
      actorType: 'officer', actorId: who.id, action: 'export.seal',
      entityType: 'batch', entityId: String(batchId), detail: { count, sha256 },
    })

    /* Sealed rows are frozen against further transitions — the pipeline may
       already have consumed them, and un-verifying one would desync the
       published analytics. No process pushes this anywhere: a person downloads
       the file and carries it across. */
    ok(res, { batchId: String(batchId), count, sha256, sealedBy: who.id, sealedAt: at })
  } catch (e) {
    console.error('[export/seal]', e)
    fail(res, 500, 'SERVER')
  }
})

// ── shared, de-identified ──────────────────────────────────────────

app.get('/v1/public/reports/layer', async (req, res) => {
  try {
    const who = await officer(req)
    /* Officer-only by default. A public map of unverified allegations is a
       reputational and legal hazard even aggregated; PUBLIC_REPORT_LAYER exists
       so that is a deliberate decision rather than an accident. */
    if (!who && env('PUBLIC_REPORT_LAYER', 'false') !== 'true') {
      return fail(res, 401, 'UNAUTHENTICATED')
    }
    const limited = await S.hitLimit(req, 'layer_ip', clientIp(req), 120, 3600)
    if (limited.limited) return fail(res, 429, 'RATE_LIMITED', limited.retryAfterSec)

    const rows = await S.selectFrom(
      req, T.reports,
      ['cell_id', 'lat', 'lon', 'category', 'status', 'CREATEDTIME'],
      "status != 'WITHDRAWN' AND status != 'REJECTED'",
      { orderBy: 'CREATEDTIME DESC', limit: 300 },
    )

    const weekAgo = Date.now() - 7 * 24 * 3600 * 1000
    const byCell = new Map()
    rows.forEach((r) => {
      if (r.cell_id === null || r.cell_id === undefined) return
      const id = Number(r.cell_id)
      let e = byCell.get(id)
      if (!e) { e = { n: 0, recent: 0, cats: {}, lat: Number(r.lat), lon: Number(r.lon) }; byCell.set(id, e) }
      e.n++
      if (Date.parse(r.CREATEDTIME) >= weekAgo) e.recent++
      e.cats[r.category] = (e.cats[r.category] || 0) + 1
    })

    // Aggregate only: no individual reports, no free text, no reporter.
    const out = []
    byCell.forEach((e, cellId) => {
      const top = Object.keys(e.cats).sort((a, b) => e.cats[b] - e.cats[a])[0]
      out.push({ cellId, lat: e.lat, lon: e.lon, nReports: e.n, nLast7d: e.recent, topCategory: top })
    })
    ok(res, out)
  } catch (e) {
    console.error('[public/layer]', e)
    fail(res, 500, 'SERVER')
  }
})

// ── attachments (not enabled) ──────────────────────────────────────

/* Stratus upload is designed but not built. These answer honestly rather than
   pretending to succeed — a silent no-op here would look like a working upload
   and lose evidence. */
app.post('/v1/reports/attachments/presign', (req, res) => fail(res, 501, 'SERVER'))
app.post('/v1/reports/attachments/:id/complete', (req, res) => fail(res, 501, 'SERVER'))

// ── fallthrough ────────────────────────────────────────────────────

app.use((req, res) => fail(res, 404, 'NOT_FOUND'))

module.exports = app

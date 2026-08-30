'use strict'

const crypto = require('crypto')

/* Responses carry an error CODE, never English prose. The console renders in
   English and Kannada, so any message baked in here would be untranslatable. */
function ok(res, data, status) {
  res.status(status || 200).json({ ok: true, data: data === undefined ? null : data })
}

function fail(res, status, code, retryAfterSec) {
  const body = { ok: false, error: { code } }
  if (retryAfterSec) body.error.retry_after_sec = retryAfterSec
  res.status(status).json(body)
}

const env = (k, fallback) => (process.env[k] && process.env[k].length ? process.env[k] : fallback)

/* The raw address is stored encrypted for confidentiality, but Catalyst's
   Encrypted Text supports only = and != — no LIKE, no ranges, no aggregates. So
   every lookup, dedupe and rate-limit key runs off this peppered hash instead.
   The pepper lives in a function env variable and never in a table. */
function hashContact(contact) {
  const pepper = env('OTP_PEPPER', 'dev-only-pepper')
  return crypto
    .createHmac('sha256', pepper)
    .update(String(contact).trim().toLowerCase())
    .digest('hex')
}

function hashCode(code, salt) {
  const pepper = env('OTP_PEPPER', 'dev-only-pepper')
  return crypto.createHmac('sha256', pepper + ':' + salt).update(String(code)).digest('hex')
}

/* Opaque, HMAC-signed, self-contained. Not a JWT — we need exactly three claims
   and no algorithm negotiation, which is one fewer thing to get wrong. */
function signToken(payload, ttlSec) {
  const secret = env('TOKEN_SECRET', 'dev-only-secret')
  const body = Object.assign({}, payload, {
    exp: Math.floor(Date.now() / 1000) + (ttlSec || 86400),
  })
  const raw = Buffer.from(JSON.stringify(body)).toString('base64url')
  const sig = crypto.createHmac('sha256', secret).update(raw).digest('base64url')
  return raw + '.' + sig
}

function verifyToken(token) {
  if (!token || typeof token !== 'string' || token.indexOf('.') < 0) return null
  const secret = env('TOKEN_SECRET', 'dev-only-secret')
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const expected = crypto.createHmac('sha256', secret).update(parts[0]).digest('base64url')
  // Constant-time compare; a length mismatch would make timingSafeEqual throw.
  const a = Buffer.from(parts[1])
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
  try {
    const body = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'))
    if (!body.exp || body.exp * 1000 < Date.now()) return null
    return body
  } catch (e) {
    return null
  }
}

/* No I, O, 0 or 1 — these get read aloud over a phone and written on paper. */
const REF_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
function publicRef() {
  const bytes = crypto.randomBytes(6)
  let out = ''
  for (let i = 0; i < 6; i++) out += REF_ALPHABET[bytes[i] % REF_ALPHABET.length]
  return 'PR-' + out
}

const nowIso = () => new Date().toISOString()

/* ZCQL takes single-quoted string literals and has no parameter binding, so every
   value that reaches a query goes through here.

   This used to escape quotes with a backslash. That was unsound: Zoho documents
   that values go in single quotes and documents no escape sequence at all, so
   whether `\'` escapes anything is a guess. If ZCQL follows standard SQL the
   backslash is literal, the string terminates early, and whatever follows is
   executed — an injection reachable from the `category` field of a submitted
   report.

   Since the escaping semantics are undefined, nothing that would need escaping
   is allowed through. Quotes, backslashes and control characters are rejected
   rather than encoded. Free text never comes through here: descriptions and
   notes are written with the SDK's insertRow/updateRow, which bind properly. */
const UNSAFE_IN_LITERAL = /['"\\\x00-\x1f]/

function q(value) {
  if (value === null || value === undefined) return 'NULL'
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('non-finite number in query')
    return String(value)
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value !== 'string') throw new Error('unsupported value type in query')
  if (UNSAFE_IN_LITERAL.test(value)) {
    throw new Error('unsafe character in query literal')
  }
  return "'" + value + "'"
}

/** Reject anything that is not a well-formed public reference before it is used
    in a query or a lookup. */
function isPublicRef(v) {
  return typeof v === 'string' && /^PR-[A-Z2-9]{6}$/.test(v)
}

module.exports = {
  ok, fail, env, hashContact, hashCode, signToken, verifyToken,
  publicRef, nowIso, q, isPublicRef,
}

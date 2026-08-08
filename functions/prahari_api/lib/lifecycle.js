'use strict'

/* The server's copy of the transition table. It is a byte-identical copy of
   frontend/src/lib/reports/lifecycle.fixture.json — the console draws its buttons
   from the TypeScript map, and a vitest pins all three together. If an officer
   ever sees a button the server rejects, that test is what should have failed
   first. */
const TABLE = require('../lifecycle.fixture.json').transitions

function hoursSince(iso, now) {
  if (!iso) return Infinity
  const t = Date.parse(iso)
  return Number.isNaN(t) ? Infinity : (now.getTime() - t) / 3600000
}

function guardSatisfied(guard, ctx) {
  if (!guard) return true
  const now = (ctx && ctx.now) || new Date()
  switch (guard) {
    case 'within24h':
      return hoursSince(ctx && ctx.submittedAt, now) <= 24
    case 'notSealed':
      return !(ctx && ctx.exportedAt)
    case 'after7d':
      return hoursSince(ctx && ctx.lastEventAt, now) >= 24 * 7
    default:
      // An unknown guard denies rather than waves through.
      return false
  }
}

function findTransition(from, to) {
  const list = TABLE[from] || []
  for (let i = 0; i < list.length; i++) if (list[i].to === to) return list[i]
  return null
}

function allowedTransitions(from, role, ctx) {
  return (TABLE[from] || []).filter(
    (t) => t.roles.indexOf(role) >= 0 && guardSatisfied(t.guard, ctx || {}),
  )
}

/** null when the move is legal, otherwise the error code to return. */
function checkTransition(from, to, role, ctx, fields) {
  const t = findTransition(from, to)
  if (!t) return 'ILLEGAL_TRANSITION'
  if (t.roles.indexOf(role) < 0) return 'FORBIDDEN'
  if (!guardSatisfied(t.guard, ctx || {})) {
    return t.guard === 'notSealed' ? 'SEALED' : 'FORBIDDEN'
  }
  const f = fields || {}
  if (t.reasonRequired && !f.reasonCode) return 'VALIDATION'
  if (t.firRequired && !f.firNumber) return 'VALIDATION'
  if (t.dupRequired && !f.dupOf) return 'VALIDATION'
  return null
}

const OPEN_STATUSES = ['SUBMITTED', 'TRIAGE', 'NEEDS_INFO']

const ALL_STATUSES = Object.keys(TABLE)

const REASON_CODES = [
  'insufficient_detail', 'outside_jurisdiction', 'duplicate_of', 'not_a_crime',
  'unverifiable', 'no_response', 'verified_on_site', 'referred_elsewhere',
  'supervisor_reopen',
]

module.exports = {
  TABLE, checkTransition, allowedTransitions, findTransition, guardSatisfied,
  OPEN_STATUSES, ALL_STATUSES, REASON_CODES,
}

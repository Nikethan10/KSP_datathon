'use strict'

const { neighbourCells } = require('./geo')

/* Duplicate and spam heuristics, mirroring frontend/src/lib/reports/moderation.ts
   so the local demo behaves like the deployed thing. Cheap and synchronous by
   design: this runs inside a submit and only has to help an officer triage
   faster. Nothing here auto-rejects or auto-merges — the machine proposes, a
   human disposes. */

const DUP_WINDOW_HOURS = 48
const DUP_TEXT_THRESHOLD = 0.55
const SPAM_FLAG_THRESHOLD = 0.6

/* Grapheme clusters, not word tokens. A whitespace tokeniser looks fine on
   English and quietly fails on Kannada, which would silently stop matching for
   half the reports. */
function graphemes(s) {
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    return Array.from(seg.segment(s), (g) => g.segment)
  }
  return Array.from(s)
}

function normaliseText(s) {
  return String(s || '').normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim()
}

function trigrams(s) {
  const g = graphemes(normaliseText(s))
  const out = new Set()
  if (g.length < 3) {
    if (g.length) out.add(g.join(''))
    return out
  }
  for (let i = 0; i <= g.length - 3; i++) out.add(g[i] + g[i + 1] + g[i + 2])
  return out
}

function jaccard(a, b) {
  if (!a.size || !b.size) return 0
  let inter = 0
  a.forEach((t) => { if (b.has(t)) inter++ })
  return inter / (a.size + b.size - inter)
}

/**
 * candidates: rows already narrowed to the same category and the cell
 * neighbourhood. Returns { publicRef, similarity } or null.
 */
function findDuplicate(input, candidates) {
  if (input.cellId === null || input.cellId === undefined) return null
  const near = new Set(neighbourCells(input.cellId))
  const t0 = Date.parse(input.incidentAt)
  const mine = trigrams(input.description)

  let best = null
  for (let i = 0; i < candidates.length; i++) {
    const r = candidates[i]
    if (r.status === 'WITHDRAWN' || r.status === 'DUPLICATE') continue
    if (r.category !== input.category) continue
    if (r.cellId === null || !near.has(r.cellId)) continue

    const dt = Math.abs(Date.parse(r.incidentAt) - t0) / 3600000
    if (!isFinite(dt) || dt > DUP_WINDOW_HOURS) continue

    const sim = jaccard(mine, trigrams(r.description))
    if (sim >= DUP_TEXT_THRESHOLD && (!best || sim > best.similarity)) {
      best = { publicRef: r.publicRef, similarity: Number(sim.toFixed(2)) }
    }
  }
  return best
}

const LOW_URGENCY = [
  'Cheating & Fraud', 'Motor Vehicle Offences', 'Gambling & Betting', 'Prohibition & Excise',
]

function longestRun(chars) {
  let best = 0
  let run = 0
  for (let i = 0; i < chars.length; i++) {
    run = i > 0 && chars[i] === chars[i - 1] ? run + 1 : 1
    if (run > best) best = run
  }
  return best
}

/** Additive, capped at 1. A high score sorts to the bottom and flags; it never
    rejects on its own. */
function scoreSpam(i) {
  const signals = []
  const add = (code, weight) => signals.push({ code, weight })
  const text = normaliseText(i.description)

  if (i.reporterAgeHours < 24 && i.reporterReportsToday >= 3) add('new_account_burst', 0.2)

  if (text.length < 20) add('too_short', 0.25)
  else {
    const chars = Array.from(text.replace(/\s/g, ''))
    const uniq = new Set(chars).size
    if (chars.length > 0 && uniq / chars.length < 0.1) add('repeated_chars', 0.25)
    else if (longestRun(chars) >= 10) add('char_run', 0.25)
  }

  if (!/[a-zಀ-೿]/.test(text)) add('no_letters', 0.3)

  if (i.reporterReports >= 3 && i.reporterRejected / i.reporterReports > 0.5) {
    add('poor_history', 0.3)
  }

  if (!i.inKarnataka) add('outside_bbox', 0.3)

  // Independent signals: a message carrying both a link and a pair of phone
  // numbers is more suspect than one carrying either.
  if (/\bhttps?:\/\/|www\./.test(text)) add('contains_url', 0.25)
  if ((text.match(/\d{10}/g) || []).length >= 2) add('multiple_numbers', 0.25)

  if (i.severitySelf === 'emergency' && LOW_URGENCY.indexOf(i.category) >= 0) {
    add('urgency_mismatch', 0.1)
  }

  const score = Math.min(1, signals.reduce((s, x) => s + x.weight, 0))
  return { score: Number(score.toFixed(2)), signals }
}

module.exports = {
  findDuplicate, scoreSpam, trigrams, jaccard, normaliseText,
  SPAM_FLAG_THRESHOLD, DUP_TEXT_THRESHOLD, DUP_WINDOW_HOURS,
}

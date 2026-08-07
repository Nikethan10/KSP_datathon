import type { CrimeCategory, ReportSummary, SeveritySelf } from './types'
import { neighbourCells, type GridParams } from './grid'

/* Duplicate and spam heuristics. Deliberately cheap and synchronous: this runs
   inside a submit request, and the point is to help an officer triage faster, not
   to be clever. Nothing here auto-rejects or auto-merges — the machine proposes,
   a human disposes. */

const DUP_WINDOW_HOURS = 48
const DUP_TEXT_THRESHOLD = 0.55

/* Grapheme clusters, not word tokens. A whitespace tokeniser looks fine on English
   and quietly fails on Kannada, where this form would silently stop matching for
   half the reports. Intl.Segmenter handles both; the fallback is code points,
   which is still correct for trigrams even if it splits combining marks. */
function graphemes(s: string): string[] {
  const Seg = (Intl as unknown as { Segmenter?: typeof Intl.Segmenter }).Segmenter
  if (Seg) {
    const seg = new Seg(undefined, { granularity: 'grapheme' })
    return Array.from(seg.segment(s), (g) => g.segment)
  }
  return Array.from(s)
}

export function normaliseText(s: string): string {
  return s.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim()
}

export function trigrams(s: string): Set<string> {
  const g = graphemes(normaliseText(s))
  const out = new Set<string>()
  if (g.length < 3) {
    if (g.length) out.add(g.join(''))
    return out
  }
  for (let i = 0; i <= g.length - 3; i++) out.add(g[i] + g[i + 1] + g[i + 2])
  return out
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0
  let inter = 0
  for (const t of a) if (b.has(t)) inter++
  return inter / (a.size + b.size - inter)
}

export interface DuplicateCandidate {
  publicRef: string
  similarity: number
}

export interface DuplicateInput {
  category: CrimeCategory
  description: string
  incidentAt: string
  cellId: number | null
}

/** Nearest match above the threshold, or null. Candidates are pre-filtered to the
    same cell or one of its eight neighbours, so this only ever sees a handful. */
export function findDuplicate(
  input: DuplicateInput,
  existing: Array<ReportSummary & { description: string }>,
  params: GridParams | null,
): DuplicateCandidate | null {
  if (input.cellId == null || !params) return null

  const near = new Set(neighbourCells(input.cellId, params))
  const t0 = Date.parse(input.incidentAt)
  const mine = trigrams(input.description)

  let best: DuplicateCandidate | null = null

  for (const r of existing) {
    if (r.status === 'WITHDRAWN' || r.status === 'DUPLICATE') continue
    if (r.category !== input.category) continue
    if (r.cellId == null || !near.has(r.cellId)) continue

    const dt = Math.abs(Date.parse(r.incidentAt) - t0) / 3_600_000
    if (!Number.isFinite(dt) || dt > DUP_WINDOW_HOURS) continue

    const sim = jaccard(mine, trigrams(r.description))
    if (sim >= DUP_TEXT_THRESHOLD && (!best || sim > best.similarity)) {
      best = { publicRef: r.publicRef, similarity: Number(sim.toFixed(2)) }
    }
  }
  return best
}

export interface SpamInput {
  description: string
  category: CrimeCategory
  severitySelf: SeveritySelf
  lat: number
  lon: number
  inKarnataka: boolean
  reporterAgeHours: number
  reporterReportsToday: number
  reporterReports: number
  reporterRejected: number
}

export interface SpamSignal {
  code: string
  weight: number
}

const LOW_URGENCY: readonly CrimeCategory[] = [
  'Cheating & Fraud',
  'Motor Vehicle Offences',
  'Gambling & Betting',
  'Prohibition & Excise',
]

/* Additive, capped at 1. A high score sorts a report to the bottom of the queue
   and flags it; it never rejects anything on its own. */
export function scoreSpam(i: SpamInput): { score: number; signals: SpamSignal[] } {
  const signals: SpamSignal[] = []
  const add = (code: string, weight: number) => signals.push({ code, weight })

  const text = normaliseText(i.description)

  if (i.reporterAgeHours < 24 && i.reporterReportsToday >= 3) add('new_account_burst', 0.2)

  if (text.length < 20) add('too_short', 0.25)
  else {
    const chars = Array.from(text.replace(/\s/g, ''))
    const uniq = new Set(chars).size
    if (chars.length > 0 && uniq / chars.length < 0.1) add('repeated_chars', 0.25)
    // A long run of one character is junk even when the rest of the message is
    // varied enough to keep the uniqueness ratio respectable.
    else if (longestRun(chars) >= 10) add('char_run', 0.25)
  }

  // No letters in either script is a strong junk signal.
  if (!/[a-zಀ-೿]/.test(text)) add('no_letters', 0.3)

  if (i.reporterReports >= 3 && i.reporterRejected / i.reporterReports > 0.5) {
    add('poor_history', 0.3)
  }

  if (!i.inKarnataka) add('outside_bbox', 0.3)

  /* Independent signals. A message carrying both a link and a pair of phone
     numbers is more suspect than one carrying either, so they must not exclude
     each other the way an else-if would. */
  if (/\bhttps?:\/\/|www\./.test(text)) add('contains_url', 0.25)
  if ((text.match(/\d{10}/g) ?? []).length >= 2) add('multiple_numbers', 0.25)

  if (i.severitySelf === 'emergency' && LOW_URGENCY.includes(i.category)) {
    add('urgency_mismatch', 0.1)
  }

  const score = Math.min(1, signals.reduce((s, x) => s + x.weight, 0))
  return { score: Number(score.toFixed(2)), signals }
}

function longestRun(chars: string[]): number {
  let best = 0
  let run = 0
  for (let i = 0; i < chars.length; i++) {
    run = i > 0 && chars[i] === chars[i - 1] ? run + 1 : 1
    if (run > best) best = run
  }
  return best
}

export const SPAM_FLAG_THRESHOLD = 0.6

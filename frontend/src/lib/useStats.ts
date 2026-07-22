import { useEffect, useState } from 'react'
import { fetchJson } from './data'

/* Single source of truth for the headline figures the platform asserts.

   Every one of these used to be typed by hand in four different places, so
   the UI would happily state "1,674,732 FIRs" even when the fetch that was
   supposed to prove it had 404'd. Now they come from meta.json, which
   copy_data.py derives from the pipeline outputs and the dataset itself.

   If the fetch fails, every field stays null and the UI renders a dash. A
   dash is a better look than a confident wrong number: it says the system
   knows when it does not know. */

export interface Stats {
  /** total FIRs the pipeline actually processed */
  firs: number | null
  /** territorial police districts (37) — NOT the 41 rows in District.csv */
  districts: number | null
  /** non-territorial units: CID, Coastal Security, Railways, ISD (4) */
  specialUnits: number | null
  /** names of those units, for the "excluded from map view" note */
  specialUnitNames: string[]
  /** police stations with at least one recorded FIR (1,074) */
  stations: number | null
  /** ISO date the analytics were computed — not when meta.json was written */
  computedAt: string | null
  loading: boolean
  error: boolean
}

interface MetaJson {
  computed_at?: string
  total_firs?: number
  n_districts?: number
  n_special_units?: number
  special_units?: string[]
  n_stations?: number
}

const EMPTY: Stats = {
  firs: null,
  districts: null,
  specialUnits: null,
  specialUnitNames: [],
  stations: null,
  computedAt: null,
  loading: true,
  error: false,
}

/* Cached at module scope so the landing page, the console header and the
   footer share one request instead of three. */
let cached: Promise<Stats> | null = null

function load(): Promise<Stats> {
  if (cached) return cached
  cached = fetchJson<MetaJson>('meta.json')
    .then((m) => ({
      firs: m.total_firs ?? null,
      districts: m.n_districts ?? null,
      specialUnits: m.n_special_units ?? null,
      specialUnitNames: m.special_units ?? [],
      stations: m.n_stations ?? null,
      computedAt: m.computed_at ? m.computed_at.slice(0, 10) : null,
      loading: false,
      error: false,
    }))
    .catch(() => {
      // Do not cache the failure — a later mount should be able to retry.
      cached = null
      return { ...EMPTY, loading: false, error: true }
    })
  return cached
}

export function useStats(): Stats {
  const [stats, setStats] = useState<Stats>(EMPTY)

  useEffect(() => {
    let alive = true
    load().then((s) => {
      if (alive) setStats(s)
    })
    return () => {
      alive = false
    }
  }, [])

  return stats
}

/** Render a figure, or an em-dash when we could not load it. */
export function stat(n: number | null, locale = 'en-IN'): string {
  return n === null ? '—' : n.toLocaleString(locale)
}

/* Substitute live figures into editorial copy so prose can never drift from
   the data either. Unknown values become an em-dash, same as the stat tiles. */
export function fillStats(text: string, s: Stats): string {
  return text
    .replace('{firs}', stat(s.firs))
    .replace('{districts}', stat(s.districts))
    .replace('{stations}', stat(s.stations))
}

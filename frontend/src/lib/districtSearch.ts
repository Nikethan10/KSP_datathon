/* District search that behaves the way an officer types.

   The old filter was a plain `name.toLowerCase().includes(query)`, which
   fails in two independent ways against the CCTNS district names:

     "kgf"       -> "k.g.f".includes("kgf") is false. Punctuation breaks it,
                    which is why typing a single "K" was the only way to
                    surface K.G.F at all.
     "banglore"  -> not a substring of "bengaluru city", and there was no
     "benguluru"    alias or fuzzy layer, so every colloquial spelling, every
                    pre-2014 name and every typo returned nothing.

   Three layers fix it: normalise away punctuation, an alias table for the
   names people actually use, and bounded edit distance for typos. */

/** Lowercase, strip everything that is not a letter or digit. */
export function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9ಀ-೿]+/g, '')
}

/* Colloquial names, pre-rename official names, and the misspellings that
   actually get typed. Karnataka renamed most of its cities in 2014 and the
   older forms are still in daily use — an officer who has said "Gulbarga"
   for twenty years should not get zero results. */
export const DISTRICT_ALIASES: Record<string, string[]> = {
  'BENGALURU CITY': [
    'bangalore', 'bangalore city', 'bangaluru', 'bengalooru', 'banglore',
    'bengaluru', 'blr', 'bengaluru urban', 'bangalore urban',
  ],
  'BENGALURU DIST': [
    'bangalore rural', 'bengaluru rural', 'bangalore district',
    'bengaluru district', 'bangalore dist', 'blr rural',
  ],
  'MYSURU CITY': ['mysore', 'mysore city', 'maisuru'],
  'MYSURU DIST': ['mysore district', 'mysore dist', 'mysuru district'],
  'MANGALURU CITY': ['mangalore', 'mangalore city', 'kudla'],
  'DAKSHINA KANNADA': ['south canara', 'south kanara', 'dakshin kannada', 'mangalore district'],
  'UTTARA KANNADA': ['north canara', 'north kanara', 'uttar kannada', 'karwar'],
  'BELAGAVI CITY': ['belgaum', 'belgaum city', 'belagavi'],
  'BELAGAVI DIST': ['belgaum district', 'belgaum dist', 'belagavi district'],
  'KALABURAGI': ['gulbarga', 'kalburgi', 'kalaburgi'],
  'KALABURAGI CITY': ['gulbarga city', 'kalburgi city'],
  'HUBBALLI DHARWAD CITY': [
    'hubli', 'hubli dharwad', 'hubballi', 'hubli city', 'hubballi dharwad',
    'twin cities',
  ],
  'VIJAYAPUR': ['bijapur', 'vijayapura', 'bijapur district'],
  'BALLARI': ['bellary', 'ballary'],
  'VIJAYANAGARA': ['hospet', 'hosapete', 'hospete'],
  'SHIVAMOGGA': ['shimoga', 'shivmogga'],
  'TUMAKURU': ['tumkur', 'tumakur'],
  'CHIKKAMAGALURU': ['chikmagalur', 'chickmagalur', 'chikkamagalur', 'chikmaglur'],
  'CHAMARAJANAGAR': ['chamrajnagar', 'chamarajnagara', 'chamraj nagar'],
  'CHICKBALLAPURA': [
    'chikkaballapura', 'chikballapur', 'chickballapur', 'chikballapura',
  ],
  'KODAGU': ['coorg', 'madikeri', 'mercara'],
  'DAVANAGERE': ['davangere', 'davanagere'],
  'BAGALKOT': ['bagalkote', 'bagalkot'],
  'RAMANAGARA': ['ramnagar', 'ramanagaram', 'ramanagar'],
  'RAICHUR': ['raichuru', 'raychur'],
  'YADGIR': ['yadagiri', 'yadgiri'],
  'CHITRADURGA': ['chitradurg'],
  'K.G.F': [
    'kgf', 'kolar gold fields', 'kolar gold field', 'robertsonpet',
    'oorgaum', 'k g f',
  ],
  'KOLAR': ['kolara'],
  'DHARWAD': ['dharwar'],
  'HAVERI': ['haveri'],
  'KOPPAL': ['koppala'],
  'GADAG': ['gadag betageri', 'gadagbetageri'],
  'UDUPI': ['udipi'],
  'BIDAR': ['beedar'],
  'MANDYA': ['mandya'],
  'HASSAN': ['hasan'],
  // Non-territorial units, searchable by what people call them.
  'CID': ['criminal investigation department', 'cid karnataka'],
  'COASTAL SECURITY POLICE': ['coastal security', 'csp', 'marine police'],
  'KARNATAKA RAILWAYS': ['railway police', 'railways', 'grp', 'railway'],
  'ISD BENGALURU': ['isd', 'internal security division', 'internal security'],
}

/** Normalised alias lookup, built once. */
const NORMALIZED_ALIASES: Record<string, string[]> = Object.fromEntries(
  Object.entries(DISTRICT_ALIASES).map(([k, v]) => [k, v.map(normalize)]),
)

/* Damerau-Levenshtein, capped: we only care whether the distance is within
   `max`, so the row scan bails as soon as every cell exceeds it. That keeps
   a per-keystroke scan over ~41 districts trivially cheap. */
export function editDistance(a: string, b: string, max = 2): number {
  if (a === b) return 0
  if (Math.abs(a.length - b.length) > max) return max + 1

  let prev2: number[] = []
  let prev: number[] = Array.from({ length: b.length + 1 }, (_, i) => i)
  let curr: number[] = []

  for (let i = 1; i <= a.length; i++) {
    curr = [i]
    let rowMin = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let v = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost)
      // transposition — "benguluru" vs "bengaluru" is one swap, not two edits
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, prev2[j - 2] + 1)
      }
      curr[j] = v
      if (v < rowMin) rowMin = v
    }
    if (rowMin > max) return max + 1
    prev2 = prev
    prev = curr
  }
  return prev[b.length]
}

/** Higher is better. 0 means no match. */
export const MatchScore = {
  None: 0,
  Fuzzy: 1,
  AliasFuzzy: 2,
  Substring: 3,
  Alias: 4,
  Prefix: 5,
  Exact: 6,
} as const
export type MatchScore = (typeof MatchScore)[keyof typeof MatchScore]

export interface Scored<T> {
  item: T
  score: MatchScore
  /** tie-break within a score band: shorter names first, then alphabetical */
  length: number
}

/**
 * Score one district against a query.
 *
 * `extraNames` carries the Kannada rendering. It is always considered,
 * regardless of the active language — a Kannada speaker browsing the English
 * UI should still be able to type ಬೆಂಗಳೂರು, and vice versa.
 */
export function scoreDistrict(
  district: string,
  query: string,
  extraNames: string[] = [],
): MatchScore {
  const q = normalize(query)
  if (!q) return MatchScore.None

  const candidates = [district, ...extraNames].map(normalize).filter(Boolean)

  for (const c of candidates) {
    if (c === q) return MatchScore.Exact
  }
  for (const c of candidates) {
    if (c.startsWith(q)) return MatchScore.Prefix
  }

  const aliases = NORMALIZED_ALIASES[district] ?? []
  for (const a of aliases) {
    if (a === q || a.startsWith(q)) return MatchScore.Alias
  }
  for (const c of candidates) {
    if (c.includes(q)) return MatchScore.Substring
  }
  for (const a of aliases) {
    if (a.includes(q)) return MatchScore.Substring
  }

  // Typo tolerance last, and only for queries long enough that an edit of 1-2
  // still means something. Two characters of slack on a three-letter query
  // would match nearly everything.
  if (q.length >= 4) {
    const max = q.length <= 5 ? 1 : 2
    for (const c of candidates) {
      if (editDistance(q, c, max) <= max) return MatchScore.Fuzzy
    }
    for (const a of aliases) {
      if (editDistance(q, a, max) <= max) return MatchScore.AliasFuzzy
    }
  }

  return MatchScore.None
}

/**
 * Rank a list of districts against a query.
 *
 * @param items      whatever carries the district (centroid, summary, string)
 * @param getName    pull the dataset district name off an item
 * @param getAliases extra searchable names, e.g. the Kannada rendering
 */
export function searchDistricts<T>(
  items: T[],
  query: string,
  getName: (item: T) => string,
  getAliases: (item: T) => string[] = () => [],
  limit = 8,
): T[] {
  const q = query.trim()
  if (!q) return []

  const scored: Scored<T>[] = []
  for (const item of items) {
    const name = getName(item)
    const score = scoreDistrict(name, q, getAliases(item))
    if (score !== MatchScore.None) scored.push({ item, score, length: name.length })
  }

  scored.sort((a, b) => b.score - a.score || a.length - b.length ||
    getName(a.item).localeCompare(getName(b.item)))

  return scored.slice(0, limit).map((s) => s.item)
}

/**
 * Free-text match for names that have no alias table — offender names, for
 * instance. Same normalisation and typo tolerance, applied per word so
 * "sodhi tripti" still finds "Tripti Sodhi".
 */
export function matchesName(name: string, query: string): boolean {
  const q = normalize(query)
  if (!q) return false

  const whole = normalize(name)
  if (whole.includes(q)) return true

  const words = name.split(/\s+/).map(normalize).filter(Boolean)
  if (words.some((w) => w.startsWith(q))) return true

  // every query word has to land somewhere, in any order
  const qWords = query.trim().split(/\s+/).map(normalize).filter(Boolean)
  if (qWords.length > 1) {
    return qWords.every((qw) => words.some((w) => w.includes(qw)))
  }

  if (q.length >= 4) {
    const max = q.length <= 5 ? 1 : 2
    return words.some((w) => editDistance(q, w, max) <= max)
  }
  return false
}

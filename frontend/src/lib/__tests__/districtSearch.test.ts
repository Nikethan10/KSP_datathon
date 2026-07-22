import { describe, it, expect } from 'vitest'
import {
  normalize,
  editDistance,
  scoreDistrict,
  searchDistricts,
  matchesName,
  MatchScore,
} from '../districtSearch'
import centroids from '../../../public/data/district_centroids.json'

/* The 37 territorial districts as shipped, plus the four non-territorial
   units that appear in district_summary.json. Reading the real file means
   this suite fails if the dataset's district names ever change under us. */
const DISTRICTS: string[] = [
  ...(centroids as { district: string }[]).map((d) => d.district),
  'CID',
  'COASTAL SECURITY POLICE',
  'KARNATAKA RAILWAYS',
  'ISD BENGALURU',
]

const top = (q: string): string | undefined =>
  searchDistricts(DISTRICTS, q, (d) => d, () => [], 5)[0]

describe('normalize', () => {
  it('strips the punctuation that broke K.G.F', () => {
    expect(normalize('K.G.F')).toBe('kgf')
    expect(normalize('k g f')).toBe('kgf')
  })

  it('collapses spacing and case', () => {
    expect(normalize('  Bengaluru   CITY ')).toBe('bengalurucity')
  })

  it('preserves Kannada characters', () => {
    expect(normalize('ಬೆಂಗಳೂರು')).toBe('ಬೆಂಗಳೂರು')
  })
})

describe('editDistance', () => {
  it('counts a transposition as one edit', () => {
    // this is precisely the "benguluru" vs "bengaluru" case
    expect(editDistance('benguluru', 'bengaluru')).toBe(1)
  })

  it('counts a deletion as one edit', () => {
    expect(editDistance('banglore', 'bangalore')).toBe(1)
  })

  it('bails out past the cap instead of computing the true distance', () => {
    expect(editDistance('abc', 'xyzxyzxyz', 2)).toBeGreaterThan(2)
  })

  it('is zero for identical strings', () => {
    expect(editDistance('kolar', 'kolar')).toBe(0)
  })
})

describe('reported failures', () => {
  // Every one of these returned nothing before districtSearch existed.
  it.each([
    ['banglore', 'BENGALURU CITY'],
    ['benguluru', 'BENGALURU CITY'],
    ['bengaluru', 'BENGALURU CITY'],
    ['bangalore', 'BENGALURU CITY'],
    ['kgf', 'K.G.F'],
    ['K.G.F', 'K.G.F'],
    ['k g f', 'K.G.F'],
  ])('%s resolves to %s', (query, expected) => {
    expect(top(query)).toBe(expected)
  })

  it('still finds Kolar itself, and ranks it above K.G.F', () => {
    const hits = searchDistricts(DISTRICTS, 'kolar', (d) => d, () => [], 5)
    expect(hits[0]).toBe('KOLAR')
    expect(hits).toContain('K.G.F')
  })
})

describe('pre-2014 and colloquial names', () => {
  it.each([
    ['mysore', 'MYSURU CITY'],
    ['gulbarga', 'KALABURAGI'],
    ['belgaum', 'BELAGAVI CITY'],
    ['hubli', 'HUBBALLI DHARWAD CITY'],
    ['bijapur', 'VIJAYAPUR'],
    ['bellary', 'BALLARI'],
    ['shimoga', 'SHIVAMOGGA'],
    ['tumkur', 'TUMAKURU'],
    ['chikmagalur', 'CHIKKAMAGALURU'],
    ['coorg', 'KODAGU'],
    ['mangalore', 'MANGALURU CITY'],
    ['hospet', 'VIJAYANAGARA'],
    ['kolar gold fields', 'K.G.F'],
  ])('%s resolves to %s', (query, expected) => {
    expect(top(query)).toBe(expected)
  })
})

describe('typos', () => {
  it.each([
    ['shivmoga', 'SHIVAMOGGA'],
    ['udipi', 'UDUPI'],
    ['raichuru', 'RAICHUR'],
    ['chitradurg', 'CHITRADURGA'],
    ['ramnagar', 'RAMANAGARA'],
    ['chamrajnagar', 'CHAMARAJANAGAR'],
  ])('%s resolves to %s', (query, expected) => {
    expect(top(query)).toBe(expected)
  })
})

describe('non-territorial units', () => {
  it('finds the railway police by a plain word', () => {
    expect(top('railway')).toBe('KARNATAKA RAILWAYS')
  })

  it('finds CID', () => {
    expect(top('cid')).toBe('CID')
  })
})

describe('negative cases', () => {
  it('returns nothing for gibberish rather than fuzzy-matching everything', () => {
    expect(searchDistricts(DISTRICTS, 'zzzzzz', (d) => d)).toHaveLength(0)
  })

  it('returns nothing for an empty or whitespace query', () => {
    expect(searchDistricts(DISTRICTS, '', (d) => d)).toHaveLength(0)
    expect(searchDistricts(DISTRICTS, '   ', (d) => d)).toHaveLength(0)
  })

  it('does not fuzzy-match very short queries into everything', () => {
    // 3 chars with 2 edits of slack would match most of the list
    const hits = searchDistricts(DISTRICTS, 'xyz', (d) => d)
    expect(hits).toHaveLength(0)
  })

  it('a single letter still prefix-matches, as it always did', () => {
    const hits = searchDistricts(DISTRICTS, 'k', (d) => d, () => [], 20)
    expect(hits).toContain('KOLAR')
    expect(hits).toContain('K.G.F')
  })
})

describe('ranking', () => {
  it('prefers an exact match over a prefix match', () => {
    expect(scoreDistrict('KOLAR', 'kolar')).toBe(MatchScore.Exact)
    expect(scoreDistrict('KOLAR', 'kol')).toBe(MatchScore.Prefix)
  })

  it('scores an alias above a mere substring', () => {
    expect(scoreDistrict('KALABURAGI', 'gulbarga')).toBe(MatchScore.Alias)
  })

  it('scores a typo lowest, so exact matches always win the slot', () => {
    expect(scoreDistrict('SHIVAMOGGA', 'shivmoga')).toBe(MatchScore.Fuzzy)
  })
})

describe('Kannada names', () => {
  it('matches the Kannada rendering even when passed as an extra name', () => {
    expect(scoreDistrict('BENGALURU CITY', 'ಬೆಂಗಳೂರು', ['ಬೆಂಗಳೂರು ನಗರ']))
      .toBeGreaterThan(MatchScore.None)
  })
})

describe('matchesName (offender search)', () => {
  it('matches a substring of the full name', () => {
    expect(matchesName('Tripti Sodhi', 'sodhi')).toBe(true)
  })

  it('matches words in any order', () => {
    expect(matchesName('Tripti Sodhi', 'sodhi tripti')).toBe(true)
  })

  it('tolerates a typo', () => {
    expect(matchesName('Tripti Sodhi', 'tripit')).toBe(true)
  })

  it('rejects an unrelated name', () => {
    expect(matchesName('Tripti Sodhi', 'ramesh')).toBe(false)
  })

  it('rejects an empty query', () => {
    expect(matchesName('Tripti Sodhi', '')).toBe(false)
  })
})

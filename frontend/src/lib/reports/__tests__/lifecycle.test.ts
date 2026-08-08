import { describe, it, expect } from 'vitest'
import {
  TRANSITIONS,
  allowedTransitions,
  checkTransition,
  guardSatisfied,
  type Role,
} from '../lifecycle'
import type { ReportStatus } from '../types'
import fixture from '../lifecycle.fixture.json'
import serverFixture from '../../../../../functions/prahari_api/lifecycle.fixture.json'

/* The Catalyst function will validate transitions against lifecycle.fixture.json.
   The console draws its buttons from TRANSITIONS. If those two ever disagree, an
   officer sees a button that the server rejects — so this suite pins them together.
   Change the table, change the fixture, or this fails. That is the point. */

type FixtureTransition = {
  to: string
  roles: string[]
  guard?: string
  reasonRequired?: boolean
  firRequired?: boolean
  dupRequired?: boolean
}

const fixtureMap = fixture.transitions as Record<string, FixtureTransition[]>

function normalise(t: {
  to: string
  roles: readonly string[]
  guard?: string
  reasonRequired?: boolean
  firRequired?: boolean
  dupRequired?: boolean
}) {
  return {
    to: t.to,
    roles: [...t.roles].sort(),
    guard: t.guard ?? null,
    reasonRequired: t.reasonRequired ?? false,
    firRequired: t.firRequired ?? false,
    dupRequired: t.dupRequired ?? false,
  }
}

describe('lifecycle / fixture parity', () => {
  it('covers exactly the same statuses', () => {
    expect(Object.keys(TRANSITIONS).sort()).toEqual(Object.keys(fixtureMap).sort())
  })

  /* The Catalyst function keeps its own copy, because a deployed function bundles
     only its own directory. This is what stops the two drifting: change one and
     this fails until both match. */
  it('matches the copy the Catalyst function deploys with', () => {
    expect(serverFixture).toEqual(fixture)
  })

  it('has identical transitions for every status', () => {
    for (const status of Object.keys(TRANSITIONS) as ReportStatus[]) {
      const ts = TRANSITIONS[status].map(normalise).sort((a, b) => a.to.localeCompare(b.to))
      const fx = fixtureMap[status].map(normalise).sort((a, b) => a.to.localeCompare(b.to))
      expect(ts, `status ${status}`).toEqual(fx)
    }
  })
})

describe('lifecycle rules', () => {
  const now = new Date('2026-08-29T12:00:00Z')

  it('lets an officer take a new report into triage', () => {
    expect(checkTransition('SUBMITTED', 'TRIAGE', 'officer')).toBeNull()
  })

  it('refuses a move that is not on the table', () => {
    expect(checkTransition('SUBMITTED', 'VERIFIED_FIR', 'officer')).toBe('ILLEGAL_TRANSITION')
  })

  it('refuses a legal move made by the wrong role', () => {
    // Reopening a rejected report is a supervisor decision.
    expect(checkTransition('REJECTED', 'TRIAGE', 'officer', {}, { reasonCode: 'supervisor_reopen' }))
      .toBe('FORBIDDEN')
    expect(checkTransition('REJECTED', 'TRIAGE', 'supervisor', {}, { reasonCode: 'supervisor_reopen' }))
      .toBeNull()
  })

  it('requires an FIR number to verify', () => {
    expect(checkTransition('TRIAGE', 'VERIFIED_FIR', 'officer', {}, { reasonCode: 'verified_on_site' }))
      .toBe('VALIDATION')
    expect(
      checkTransition('TRIAGE', 'VERIFIED_FIR', 'officer', {}, {
        reasonCode: 'verified_on_site',
        firNumber: 'FIR/2026/00412',
      }),
    ).toBeNull()
  })

  it('requires a duplicate target to mark a duplicate', () => {
    expect(checkTransition('SUBMITTED', 'DUPLICATE', 'officer', {}, { reasonCode: 'duplicate_of' }))
      .toBe('VALIDATION')
    expect(
      checkTransition('SUBMITTED', 'DUPLICATE', 'officer', {}, {
        reasonCode: 'duplicate_of',
        dupOf: 'PR-7F3K2Q',
      }),
    ).toBeNull()
  })

  it('lets a citizen withdraw inside 24 h and not after', () => {
    const fresh = { submittedAt: '2026-08-29T06:00:00Z', now }
    const stale = { submittedAt: '2026-08-20T06:00:00Z', now }
    expect(checkTransition('SUBMITTED', 'WITHDRAWN', 'citizen', fresh)).toBeNull()
    expect(checkTransition('SUBMITTED', 'WITHDRAWN', 'citizen', stale)).toBe('FORBIDDEN')
  })

  it('will not un-verify a report that has been sealed into an export batch', () => {
    const fields = { reasonCode: 'supervisor_reopen' }
    expect(checkTransition('VERIFIED_FIR', 'TRIAGE', 'supervisor', { exportedAt: null }, fields))
      .toBeNull()
    expect(
      checkTransition(
        'VERIFIED_FIR',
        'TRIAGE',
        'supervisor',
        { exportedAt: '2026-08-28T09:00:00Z' },
        fields,
      ),
    ).toBe('SEALED')
  })

  it('treats WITHDRAWN as terminal for everyone', () => {
    const roles: Role[] = ['citizen', 'officer', 'supervisor', 'system']
    for (const r of roles) {
      expect(allowedTransitions('WITHDRAWN', r), `role ${r}`).toEqual([])
    }
  })

  it('only auto-rejects an unanswered report after seven days', () => {
    expect(guardSatisfied('after7d', { lastEventAt: '2026-08-27T12:00:00Z', now })).toBe(false)
    expect(guardSatisfied('after7d', { lastEventAt: '2026-08-01T12:00:00Z', now })).toBe(true)
  })

  it('offers a citizen nothing to do on a report already in triage but past 24 h', () => {
    const ctx = { submittedAt: '2026-08-01T00:00:00Z', now }
    expect(allowedTransitions('TRIAGE', 'citizen', ctx)).toEqual([])
  })
})

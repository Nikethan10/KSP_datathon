import { describe, it, expect, beforeEach, vi } from 'vitest'
import gridParamsFixture from '../../../../public/data/grid_params.json'
import centroidsFixture from '../../../../public/data/district_centroids.json'
import demoReports from '../../../../public/data/demo_reports.json'

/* data.ts talks to the network and reads import.meta.env.BASE_URL. In here we
   hand it the real committed artefacts instead, so the adapter is exercised
   against the same shapes it will see in the browser. */
vi.mock('../../data', () => ({
  fetchJson: (name: string) => {
    if (name === 'grid_params.json') return Promise.resolve(gridParamsFixture)
    if (name === 'district_centroids.json') return Promise.resolve(centroidsFixture)
    if (name === 'demo_reports.json') return Promise.resolve(demoReports)
    return Promise.reject(new Error(`unexpected fetch: ${name}`))
  },
}))

import { LocalReportRepository } from '../local'
import { cellCenter, cellIdFor, type GridParams } from '../grid'
import { ReportError, type ReportDraft } from '../types'

function memoryStorage(): Storage {
  const m = new Map<string, string>()
  return {
    get length() { return m.size },
    key: (i: number) => [...m.keys()][i] ?? null,
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
  } as Storage
}

const BENGALURU = { lat: 12.9716, lon: 77.5946 }

function draft(over: Partial<ReportDraft> = {}): ReportDraft {
  return {
    category: 'Crimes Against Property',
    description: 'Someone forced the shutter of the shop on the corner overnight and took the till.',
    incidentAt: new Date().toISOString(),
    lat: BENGALURU.lat,
    lon: BENGALURU.lon,
    locationPrecision: 'map_pin',
    severitySelf: 'routine',
    lang: 'en',
    attachmentIds: [],
    clientNonce: crypto.randomUUID(),
    ...over,
  }
}

async function signedIn() {
  const repo = new LocalReportRepository()
  const c = await repo.requestOtp('reporter@example.com', 'en')
  expect(c.demoMode).toBe(true)
  await repo.verifyOtp(c.challengeId, '000000')
  return repo
}

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage())
  vi.stubGlobal('sessionStorage', memoryStorage())
})

describe('identity', () => {
  it('rejects a malformed address before issuing a challenge', async () => {
    const repo = new LocalReportRepository()
    await expect(repo.requestOtp('not-an-email', 'en')).rejects.toMatchObject({ code: 'VALIDATION' })
  })

  it('rejects a wrong code and accepts the demo code', async () => {
    const repo = new LocalReportRepository()
    const c = await repo.requestOtp('a@b.com', 'en')
    await expect(repo.verifyOtp(c.challengeId, '111111')).rejects.toMatchObject({ code: 'OTP_INVALID' })
    const s = await repo.verifyOtp(c.challengeId, '000000')
    expect(s.reporterRef).toBeTruthy()
    expect(repo.session()?.reporterRef).toBe(s.reporterRef)
  })

  it('burns a challenge after five wrong attempts', async () => {
    const repo = new LocalReportRepository()
    const c = await repo.requestOtp('a@b.com', 'en')
    for (let i = 0; i < 5; i++) {
      await expect(repo.verifyOtp(c.challengeId, '999999')).rejects.toBeInstanceOf(ReportError)
    }
    await expect(repo.verifyOtp(c.challengeId, '000000')).rejects.toMatchObject({ code: 'OTP_ATTEMPTS' })
  })

  it('refuses to submit without a session', async () => {
    const repo = new LocalReportRepository()
    await expect(repo.submitReport(draft())).rejects.toMatchObject({ code: 'UNAUTHENTICATED' })
  })
})

describe('submission', () => {
  it('accepts a report and returns a reference', async () => {
    const repo = await signedIn()
    const r = await repo.submitReport(draft())
    expect(r.publicRef).toMatch(/^PR-[A-Z2-9]{6}$/)
    expect(r.status).toBe('SUBMITTED')
  })

  it('is idempotent on the client nonce', async () => {
    const repo = await signedIn()
    const d = draft()
    const a = await repo.submitReport(d)
    const b = await repo.submitReport(d)
    expect(b.publicRef).toBe(a.publicRef)
    const mine = await repo.myReports()
    expect(mine.filter((m) => m.publicRef === a.publicRef)).toHaveLength(1)
  })

  it('refuses a category that must not be queued', async () => {
    const repo = await signedIn()
    await expect(repo.submitReport(draft({ category: 'Crimes Against Children' })))
      .rejects.toMatchObject({ code: 'BLOCKED' })
  })

  it('refuses an in-progress emergency rather than queueing it', async () => {
    const repo = await signedIn()
    await expect(repo.submitReport(draft({ severitySelf: 'emergency' })))
      .rejects.toMatchObject({ code: 'BLOCKED' })
  })

  it('refuses an empty description', async () => {
    const repo = await signedIn()
    await expect(repo.submitReport(draft({ description: 'x' })))
      .rejects.toMatchObject({ code: 'VALIDATION' })
  })

  it('flags a near-identical nearby report as a duplicate', async () => {
    const repo = await signedIn()
    const at = new Date().toISOString()
    await repo.submitReport(draft({
      description: 'Chain snatching near the temple street bus stop this morning, two men on a black bike.',
      incidentAt: at,
    }))
    const second = await repo.submitReport(draft({
      description: 'Chain snatching near the temple street bus stop this morning, two men on a black bike.',
      incidentAt: at,
    }))
    expect(second.dupOf).toBeTruthy()
  })

  it('scores obvious junk above the flag threshold', async () => {
    const repo = await signedIn()
    const r = await repo.submitReport(draft({
      description: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa www.example.com 9876543210 9876543211',
    }))
    const seen = await repo.officerGetReport(r.publicRef)
    expect(seen.spamScore).toBeGreaterThanOrEqual(0.6)
  })
})

describe('officer triage', () => {
  it('seeds a populated queue so a cold browser is not empty', async () => {
    const repo = new LocalReportRepository()
    const page = await repo.officerQueue({})
    expect(page.items.length).toBeGreaterThan(5)
  })

  it('filters by status and paginates', async () => {
    const repo = new LocalReportRepository()
    const submitted = await repo.officerQueue({ status: ['SUBMITTED'] })
    expect(submitted.items.every((i) => i.status === 'SUBMITTED')).toBe(true)

    const first = await repo.officerQueue({ limit: 3 })
    expect(first.items).toHaveLength(3)
    expect(first.nextCursor).toBe('3')
  })

  it('sorts likely spam to the bottom instead of hiding it', async () => {
    const repo = new LocalReportRepository()
    const page = await repo.officerQueue({ limit: 50 })
    const scores = page.items.map((i) => i.spamScore ?? 0)
    expect(scores).toEqual([...scores].sort((a, b) => a - b))
  })

  it('refuses a transition that is not on the lifecycle table', async () => {
    const repo = new LocalReportRepository()
    const page = await repo.officerQueue({ status: ['SUBMITTED'] })
    const ref = page.items[0].publicRef
    await expect(
      repo.officerTransition(ref, { toStatus: 'VERIFIED_FIR', reasonCode: 'verified_on_site', firNumber: 'FIR/1' }),
    ).rejects.toMatchObject({ code: 'ILLEGAL_TRANSITION' })
  })

  it('requires an FIR number to verify', async () => {
    const repo = new LocalReportRepository()
    const page = await repo.officerQueue({ status: ['TRIAGE'] })
    const ref = page.items[0].publicRef
    await expect(
      repo.officerTransition(ref, { toStatus: 'VERIFIED_FIR', reasonCode: 'verified_on_site' }),
    ).rejects.toMatchObject({ code: 'VALIDATION' })
  })
})

describe('the full loop, end to end', () => {
  it('carries a report from submit through verify to a sealed batch', async () => {
    const repo = await signedIn()

    const { publicRef } = await repo.submitReport(draft())

    await repo.officerTransition(publicRef, { toStatus: 'TRIAGE', reasonCode: 'insufficient_detail' })
    const verified = await repo.officerTransition(publicRef, {
      toStatus: 'VERIFIED_FIR',
      reasonCode: 'verified_on_site',
      firNumber: 'FIR/2026/00999',
    })
    expect(verified.status).toBe('VERIFIED_FIR')
    expect(verified.exportedAt).toBeNull()

    const batch = await repo.officerExportVerified()
    expect(batch.rows.some((r) => r.publicRef === publicRef)).toBe(true)

    // The export itself must not mutate anything.
    expect((await repo.officerGetReport(publicRef)).exportedAt).toBeNull()

    const manifest = await repo.officerSealExport(batch.batchId, batch.rows.map((r) => r.publicRef))
    expect(manifest.count).toBe(batch.rows.length)
    expect(manifest.sha256).toMatch(/^[0-9a-f]{64}$/)

    const sealed = await repo.officerGetReport(publicRef)
    expect(sealed.exportedAt).toBeTruthy()

    // An officer cannot walk it back at all — that is supervisor territory.
    await expect(
      repo.officerTransition(publicRef, { toStatus: 'TRIAGE', reasonCode: 'supervisor_reopen' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })

    // And a supervisor cannot either, once sealed — the pipeline may have it.
    await expect(
      repo.officerTransition(
        publicRef,
        { toStatus: 'TRIAGE', reasonCode: 'supervisor_reopen' },
        'supervisor',
      ),
    ).rejects.toMatchObject({ code: 'SEALED' })

    // And it does not appear in a second export batch.
    const again = await repo.officerExportVerified()
    expect(again.rows.some((r) => r.publicRef === publicRef)).toBe(false)
  })
})

describe('what the citizen is allowed to see', () => {
  it('hides officer identity and internal notes from the reporter timeline', async () => {
    const repo = await signedIn()
    const { publicRef } = await repo.submitReport(draft())
    await repo.officerTransition(publicRef, {
      toStatus: 'TRIAGE',
      reasonCode: 'insufficient_detail',
      note: 'internal: cross-check with station log',
    })

    const asOfficer = await repo.officerGetReport(publicRef)
    expect(asOfficer.timeline.some((e) => e.note)).toBe(true)

    const asCitizen = await repo.getMyReport(publicRef)
    expect(asCitizen.timeline.every((e) => !e.note && !e.actorLabel)).toBe(true)
    // The reason code survives, so they still learn why.
    expect(asCitizen.timeline.some((e) => e.reasonCode === 'insufficient_detail')).toBe(true)
  })

  it('will not show one reporter another reporter\'s report', async () => {
    const repo = await signedIn()
    const { publicRef } = await repo.submitReport(draft())
    repo.signOut()
    const c = await repo.requestOtp('someone.else@example.com', 'en')
    await repo.verifyOtp(c.challengeId, '000000')
    await expect(repo.getMyReport(publicRef)).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('lets a reporter withdraw inside 24 h', async () => {
    const repo = await signedIn()
    const { publicRef } = await repo.submitReport(draft())
    await repo.withdrawReport(publicRef)
    expect((await repo.getMyReport(publicRef)).status).toBe('WITHDRAWN')
  })
})

describe('role separation', () => {
  it('does not let an officer reopen a rejected report', async () => {
    const repo = new LocalReportRepository()
    const page = await repo.officerQueue({ status: ['REJECTED'], limit: 50 })
    const ref = page.items[0].publicRef
    await expect(
      repo.officerTransition(ref, { toStatus: 'TRIAGE', reasonCode: 'supervisor_reopen' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    const ok = await repo.officerTransition(
      ref, { toStatus: 'TRIAGE', reasonCode: 'supervisor_reopen' }, 'supervisor',
    )
    expect(ok.status).toBe('TRIAGE')
  })
})

describe('answering a request for more information', () => {
  it('records the reply on the timeline without rewriting the description', async () => {
    const repo = await signedIn()
    const { publicRef } = await repo.submitReport(draft())
    const before = (await repo.getMyReport(publicRef)).description

    await repo.officerTransition(publicRef, { toStatus: 'TRIAGE', reasonCode: 'insufficient_detail' })
    await repo.officerTransition(publicRef, { toStatus: 'NEEDS_INFO', reasonCode: 'insufficient_detail' })
    await repo.replyToReport(publicRef, 'The shutter was cut, not forced.')

    const after = await repo.getMyReport(publicRef)
    expect(after.status).toBe('TRIAGE')
    // The narrative the duplicate detector fingerprints is untouched...
    expect(after.description).toBe(before)
    // ...and the reporter can still see what they wrote.
    expect(after.timeline.some((e) => e.citizenReply?.includes('shutter was cut'))).toBe(true)
  })
})

describe('the map layer', () => {
  it('aggregates to cells and carries no free text', async () => {
    const repo = new LocalReportRepository()
    const cells = await repo.reportLayer()
    expect(cells.length).toBeGreaterThan(0)
    for (const c of cells) {
      expect(c.nReports).toBeGreaterThan(0)
      expect(Object.keys(c).sort()).toEqual(
        ['cellId', 'lat', 'lon', 'nLast7d', 'nReports', 'topCategory'].sort(),
      )
    }
  })

  /* The whole point of aggregating. Publishing the reporter's own coordinates
     for a single-report cell would expose where they stood, to GPS accuracy. */
  it('publishes the cell centre, never a reporter position', async () => {
    const repo = await signedIn()
    const lat = 12.98765, lon = 77.61234
    await repo.submitReport(draft({ lat, lon }))
    const cells = await repo.reportLayer()

    const params = gridParamsFixture as unknown as GridParams
    const cellId = cellIdFor(lat, lon, params)!
    const cell = cells.find((c) => c.cellId === cellId)!
    expect(cell).toBeTruthy()

    const centre = cellCenter(cellId, params)
    expect(cell.lat).toBeCloseTo(centre.lat, 10)
    expect(cell.lon).toBeCloseTo(centre.lon, 10)
    expect(cell.lat).not.toBeCloseTo(lat, 6)
    expect(cell.lon).not.toBeCloseTo(lon, 6)
  })

  it('excludes withdrawn and rejected reports', async () => {
    const repo = new LocalReportRepository()
    const before = (await repo.reportLayer()).reduce((s, c) => s + c.nReports, 0)
    const all = await repo.officerQueue({ limit: 50 })
    const rejected = all.items.filter((i) => i.status === 'REJECTED').length
    const withdrawn = all.items.filter((i) => i.status === 'WITHDRAWN').length
    const open = all.items.length - rejected - withdrawn
    expect(before).toBe(open)
  })
})

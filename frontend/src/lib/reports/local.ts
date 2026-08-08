import type { Lang } from '../i18n'
import { fetchJson } from '../data'
import { cellCenter, cellIdFor, loadGridParams, withinKarnataka, type GridParams } from './grid'
import { checkTransition, type Role } from './lifecycle'
import { findDuplicate, scoreSpam } from './moderation'
import type { ReportRepository } from './repository'
import {
  ATTACHMENT_LIMITS,
  ReportError,
  isBlockedCategory,
  type Attachment,
  type CitizenReportCell,
  type CitizenSession,
  type ExportManifest,
  type OtpChallenge,
  type Page,
  type QueueFilter,
  type ReportDetail,
  type ReportDraft,
  type ReportEvent,
  type ReportStatus,
  type ReportSummary,
  type TransitionRequest,
  type VerifiedExport,
  type VerifiedExportRow,
} from './types'

/* A complete, working implementation backed by localStorage. It exists so the
   whole report -> triage -> verify -> seal loop can be built, demonstrated and
   tested before any credential exists, and so `npm run dev` never has to reach a
   remote origin (which would mean CORS on every request).

   It is not a stub. It enforces the same lifecycle table, runs the same duplicate
   and spam heuristics, and injects latency so loading and error states get
   exercised — a demo that behaves unlike the real thing is worse than none. */

const STORE_KEY = 'prahari_reports_v1'
const SESSION_KEY = 'prahari_report_session'
const DEMO_OTP = '000000'
const OTP_TTL_SEC = 600
const OTP_RESEND_SEC = 60
const QUEUE_LIMIT_MAX = 50

interface StoredReport {
  publicRef: string
  reporterRef: string
  status: ReportStatus
  category: string
  description: string
  incidentAt: string
  lat: number
  lon: number
  locationPrecision: ReportDraft['locationPrecision']
  severitySelf: ReportDraft['severitySelf']
  lang: Lang
  cellId: number | null
  district: string | null
  dupOf: string | null
  spamScore: number
  firNumber: string | null
  exportedAt: string | null
  sealedBatchId: string | null
  clientNonce: string
  submittedAt: string
  updatedAt: string
  attachments: Attachment[]
  timeline: ReportEvent[]
}

interface StoredReporter {
  reporterRef: string
  contactHash: string
  lang: Lang
  createdAt: string
  reports: number
  verified: number
  rejected: number
}

interface Store {
  version: 1
  seeded: boolean
  reporters: StoredReporter[]
  reports: StoredReport[]
}

interface Challenge {
  challengeId: string
  contactHash: string
  lang: Lang
  expiresAt: number
  attempts: number
}

const emptyStore = (): Store => ({ version: 1, seeded: false, reporters: [], reports: [] })

function readStore(): Store {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (!raw) return emptyStore()
    const s = JSON.parse(raw) as Store
    return s && s.version === 1 ? s : emptyStore()
  } catch {
    return emptyStore()
  }
}

function writeStore(s: Store): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(s))
  } catch {
    /* Private browsing, or quota. The session keeps working in memory. */
  }
}

/* Not a security boundary — localStorage is readable either way. It exists so the
   shape matches the server, where the equivalent is a peppered HMAC and the raw
   contact is stored encrypted. */
function hashContact(contact: string): string {
  const s = contact.trim().toLowerCase()
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return `c${(h >>> 0).toString(36)}`
}

const REF_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no I/O/0/1

function randomRef(): string {
  let out = ''
  const buf = new Uint32Array(6)
  crypto.getRandomValues(buf)
  for (let i = 0; i < 6; i++) out += REF_ALPHABET[buf[i] % REF_ALPHABET.length]
  return `PR-${out}`
}

/* Six characters of a 32-symbol alphabet is ~1.07e9 values, which sounds ample
   until you remember the birthday bound puts a 50% collision around 38k
   reports. Every read path resolves a reference with .find(), so a collision
   would hand one citizen another's report. Draw against the store instead of
   trusting the odds. */
function publicRef(taken: ReadonlySet<string>): string {
  for (let i = 0; i < 50; i++) {
    const ref = randomRef()
    if (!taken.has(ref)) return ref
  }
  // Astronomically unlikely; fall back to something that cannot collide.
  return `PR-${Date.now().toString(36).toUpperCase()}`
}

const uid = () => crypto.randomUUID()
const nowIso = () => new Date().toISOString()

/** 120-350 ms, so every screen has to handle a real pending state. */
const latency = () => new Promise<void>((r) => setTimeout(r, 120 + Math.random() * 230))

function summarise(r: StoredReport, officer: boolean): ReportSummary {
  const base: ReportSummary = {
    publicRef: r.publicRef,
    status: r.status,
    category: r.category,
    incidentAt: r.incidentAt,
    submittedAt: r.submittedAt,
    updatedAt: r.updatedAt,
    district: r.district,
    cellId: r.cellId,
    severitySelf: r.severitySelf,
  }
  if (!officer) return base
  return {
    ...base,
    dupOf: r.dupOf,
    spamScore: r.spamScore,
    attachmentCount: r.attachments.length,
  }
}

/* A reporter sees that a decision was taken and why, never who took it or what
   they wrote internally. */
function redactTimeline(t: ReportEvent[]): ReportEvent[] {
  return t.map((e) => ({
    at: e.at,
    fromStatus: e.fromStatus,
    toStatus: e.toStatus,
    reasonCode: e.reasonCode,
    actorType: e.actorType,
    // Their own words survive redaction; the officer's note does not.
    citizenReply: e.citizenReply,
  }))
}

function detail(r: StoredReport, officer: boolean): ReportDetail {
  return {
    ...summarise(r, officer),
    description: r.description,
    lat: r.lat,
    lon: r.lon,
    attachments: r.attachments,
    timeline: officer ? r.timeline : redactTimeline(r.timeline),
    firNumber: r.firNumber,
    exportedAt: r.exportedAt,
  }
}

export class LocalReportRepository implements ReportRepository {
  private store = readStore()
  private challenges = new Map<string, Challenge>()
  private blobs = new Map<string, Blob>()
  private pendingAttachments = new Map<string, Attachment>()
  private params: GridParams | null = null
  private centroids: { district: string; lat: number; lon: number }[] | null = null
  private ready: Promise<void> | null = null

  readonly isDemo = true

  private async init(): Promise<void> {
    if (!this.ready) {
      this.ready = (async () => {
        this.params = await loadGridParams().catch(() => null)
        this.centroids = await fetchJson<{ district: string; lat: number; lon: number }[]>(
          'district_centroids.json',
        ).catch(() => null)
        await this.seed()
      })()
    }
    return this.ready
  }

  /* A cold browser with an empty queue makes the triage side impossible to show.
     demo_reports.json is a committed fixture for exactly that, and it is not on
     copy_data.py's allowlist — it is not a pipeline artefact and must never be
     mistaken for one. */
  private async seed(): Promise<void> {
    if (this.store.seeded) return
    const seedRows = await fetchJson<{ reports: Partial<StoredReport>[] }>(
      'demo_reports.json',
    ).catch(() => null)

    /* Only record the seed as done once it actually succeeded. Setting the flag
       unconditionally meant one failed fetch — offline, a slow first paint, a
       404 mid-deploy — persisted an empty queue to localStorage that no later
       visit would ever retry. */
    if (!seedRows?.reports?.length) return

    const taken = new Set(this.store.reports.map((r) => r.publicRef))
    for (const row of seedRows.reports) {
      const r = this.materialise(row, taken)
      if (r) {
        taken.add(r.publicRef)
        this.store.reports.push(r)
      }
    }
    this.store.seeded = true
    writeStore(this.store)
  }

  private materialise(row: Partial<StoredReport>, taken: ReadonlySet<string>): StoredReport | null {
    if (!row.description || !row.category || typeof row.lat !== 'number') return null
    const submittedAt = row.submittedAt ?? nowIso()
    const lon = row.lon ?? 0

    /* Score the fixture rows the same way a live submission is scored, rather
       than defaulting them to zero. Otherwise the seeded junk report sits in the
       queue looking legitimate and the spam signal never appears in a demo. */
    const spam = row.spamScore ?? scoreSpam({
      description: row.description,
      category: row.category,
      severitySelf: row.severitySelf ?? 'routine',
      lat: row.lat,
      lon,
      inKarnataka: this.params ? withinKarnataka(row.lat, lon, this.params) : true,
      reporterAgeHours: Infinity,
      reporterReportsToday: 0,
      reporterReports: 0,
      reporterRejected: 0,
    }).score

    return {
      publicRef: row.publicRef ?? publicRef(taken),
      reporterRef: row.reporterRef ?? 'seed',
      status: row.status ?? 'SUBMITTED',
      category: row.category,
      description: row.description,
      incidentAt: row.incidentAt ?? submittedAt,
      lat: row.lat,
      lon,
      locationPrecision: row.locationPrecision ?? 'map_pin',
      severitySelf: row.severitySelf ?? 'routine',
      lang: row.lang ?? 'en',
      cellId: this.params ? cellIdFor(row.lat, lon, this.params) : null,
      district: row.district ?? this.nearestDistrict(row.lat, lon),
      dupOf: row.dupOf ?? null,
      spamScore: spam,
      firNumber: row.firNumber ?? null,
      exportedAt: row.exportedAt ?? null,
      sealedBatchId: row.sealedBatchId ?? null,
      clientNonce: row.clientNonce ?? uid(),
      submittedAt,
      updatedAt: row.updatedAt ?? submittedAt,
      attachments: row.attachments ?? [],
      timeline: row.timeline ?? [
        { at: submittedAt, fromStatus: null, toStatus: row.status ?? 'SUBMITTED', reasonCode: null, actorType: 'citizen' },
      ],
    }
  }

  private nearestDistrict(lat: number, lon: number): string | null {
    if (!this.centroids?.length) return null
    let best: string | null = null
    let bestD = Infinity
    for (const c of this.centroids) {
      const dy = c.lat - lat
      const dx = (c.lon - lon) * 0.96 // rough lon compression at ~15N
      const d = dy * dy + dx * dx
      if (d < bestD) { bestD = d; best = c.district }
    }
    return best
  }

  private persist(): void {
    writeStore(this.store)
  }

  private reporterFor(ref: string): StoredReporter | undefined {
    return this.store.reporters.find((r) => r.reporterRef === ref)
  }

  private requireSession(): CitizenSession {
    const s = this.session()
    if (!s) throw new ReportError('UNAUTHENTICATED')
    return s
  }

  // ── identity ──────────────────────────────────────────────────────

  async requestOtp(contact: string, lang: Lang): Promise<OtpChallenge> {
    await this.init()
    await latency()
    const trimmed = contact.trim()
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) throw new ReportError('VALIDATION')

    const challengeId = uid()
    this.challenges.set(challengeId, {
      challengeId,
      contactHash: hashContact(trimmed),
      lang,
      expiresAt: Date.now() + OTP_TTL_SEC * 1000,
      attempts: 0,
    })
    return {
      challengeId,
      expiresInSec: OTP_TTL_SEC,
      resendAfterSec: OTP_RESEND_SEC,
      demoMode: true,
    }
  }

  async verifyOtp(challengeId: string, code: string): Promise<CitizenSession> {
    await this.init()
    await latency()
    const c = this.challenges.get(challengeId)
    if (!c) throw new ReportError('OTP_EXPIRED')
    if (Date.now() > c.expiresAt) {
      this.challenges.delete(challengeId)
      throw new ReportError('OTP_EXPIRED')
    }
    if (c.attempts >= 5) {
      this.challenges.delete(challengeId)
      throw new ReportError('OTP_ATTEMPTS')
    }
    if (code.trim() !== DEMO_OTP) {
      c.attempts++
      throw new ReportError('OTP_INVALID')
    }
    this.challenges.delete(challengeId)

    let reporter = this.store.reporters.find((r) => r.contactHash === c.contactHash)
    if (!reporter) {
      reporter = {
        reporterRef: uid(),
        contactHash: c.contactHash,
        lang: c.lang,
        createdAt: nowIso(),
        reports: 0,
        verified: 0,
        rejected: 0,
      }
      this.store.reporters.push(reporter)
      this.persist()
    }

    const session: CitizenSession = {
      token: `local.${reporter.reporterRef}`,
      reporterRef: reporter.reporterRef,
      expiresAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
    }
    /* sessionStorage, not localStorage: an OTP session should not outlive the tab. */
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(session)) } catch { /* ignore */ }
    return session
  }

  session(): CitizenSession | null {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY)
      if (!raw) return null
      const s = JSON.parse(raw) as CitizenSession
      return Date.parse(s.expiresAt) > Date.now() ? s : null
    } catch {
      return null
    }
  }

  signOut(): void {
    try { sessionStorage.removeItem(SESSION_KEY) } catch { /* ignore */ }
  }

  // ── attachments ───────────────────────────────────────────────────

  async presignAttachment(meta: { mime: string; sizeBytes: number; sha256: string }) {
    await latency()
    if (!(ATTACHMENT_LIMITS.mimes as readonly string[]).includes(meta.mime)) {
      throw new ReportError('ATTACHMENT_TYPE')
    }
    if (meta.sizeBytes > ATTACHMENT_LIMITS.maxBytes) {
      throw new ReportError('ATTACHMENT_TOO_LARGE')
    }
    const attachmentId = uid()
    this.pendingAttachments.set(attachmentId, {
      id: attachmentId,
      mime: meta.mime,
      sizeBytes: meta.sizeBytes,
      status: 'pending',
    })
    return { attachmentId, uploadUrl: `local://${attachmentId}`, maxBytes: ATTACHMENT_LIMITS.maxBytes }
  }

  async uploadAttachment(uploadUrl: string, file: Blob, onProgress?: (p: number) => void) {
    const id = uploadUrl.replace('local://', '')
    onProgress?.(10)
    await latency()
    this.blobs.set(id, file)
    onProgress?.(100)
  }

  async completeAttachment(attachmentId: string): Promise<Attachment> {
    await latency()
    const a = this.pendingAttachments.get(attachmentId)
    if (!a) throw new ReportError('NOT_FOUND')
    const blob = this.blobs.get(attachmentId)
    const stored: Attachment = {
      ...a,
      status: 'stored',
      url: blob ? URL.createObjectURL(blob) : undefined,
    }
    this.pendingAttachments.set(attachmentId, stored)
    return stored
  }

  // ── citizen ───────────────────────────────────────────────────────

  async submitReport(draft: ReportDraft) {
    await this.init()
    const session = this.requireSession()
    await latency()

    if (isBlockedCategory(draft.category)) throw new ReportError('BLOCKED')
    if (draft.severitySelf === 'emergency') throw new ReportError('BLOCKED')
    if (!draft.description.trim() || draft.description.trim().length < 10) {
      throw new ReportError('VALIDATION')
    }

    /* Idempotency. With no transactions on the real backend, a retried submit has
       to return the original reference rather than create a twin. */
    const existing = this.store.reports.find((r) => r.clientNonce === draft.clientNonce)
    if (existing) {
      return { publicRef: existing.publicRef, status: existing.status, dupOf: existing.dupOf ?? undefined }
    }

    const reporter = this.reporterFor(session.reporterRef)
    const cellId = this.params ? cellIdFor(draft.lat, draft.lon, this.params) : null
    const inK = this.params ? withinKarnataka(draft.lat, draft.lon, this.params) : true

    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
    const reportsToday = this.store.reports.filter(
      (r) => r.reporterRef === session.reporterRef && Date.parse(r.submittedAt) >= todayStart.getTime(),
    ).length

    const { score } = scoreSpam({
      description: draft.description,
      category: draft.category,
      severitySelf: draft.severitySelf,
      lat: draft.lat,
      lon: draft.lon,
      inKarnataka: inK,
      reporterAgeHours: reporter
        ? (Date.now() - Date.parse(reporter.createdAt)) / 3_600_000
        : 0,
      reporterReportsToday: reportsToday,
      reporterReports: reporter?.reports ?? 0,
      reporterRejected: reporter?.rejected ?? 0,
    })

    const dup = findDuplicate(
      { category: draft.category, description: draft.description, incidentAt: draft.incidentAt, cellId },
      this.store.reports.map((r) => ({ ...summarise(r, true), description: r.description })),
      this.params,
    )

    const at = nowIso()
    const report: StoredReport = {
      publicRef: publicRef(new Set(this.store.reports.map((r) => r.publicRef))),
      reporterRef: session.reporterRef,
      status: 'SUBMITTED',
      category: draft.category,
      description: draft.description.trim(),
      incidentAt: draft.incidentAt,
      lat: draft.lat,
      lon: draft.lon,
      locationPrecision: draft.locationPrecision,
      severitySelf: draft.severitySelf,
      lang: draft.lang,
      cellId,
      district: this.nearestDistrict(draft.lat, draft.lon),
      dupOf: dup?.publicRef ?? null,
      spamScore: score,
      firNumber: null,
      exportedAt: null,
      sealedBatchId: null,
      clientNonce: draft.clientNonce,
      submittedAt: at,
      updatedAt: at,
      attachments: draft.attachmentIds
        .map((id) => this.pendingAttachments.get(id))
        .filter((a): a is Attachment => !!a),
      timeline: [{ at, fromStatus: null, toStatus: 'SUBMITTED', reasonCode: null, actorType: 'citizen' }],
    }

    this.store.reports.unshift(report)
    if (reporter) reporter.reports++
    this.persist()

    return { publicRef: report.publicRef, status: report.status, dupOf: dup?.publicRef }
  }

  async myReports(): Promise<ReportSummary[]> {
    await this.init()
    const s = this.requireSession()
    await latency()
    return this.store.reports
      .filter((r) => r.reporterRef === s.reporterRef)
      .map((r) => summarise(r, false))
  }

  async getMyReport(ref: string): Promise<ReportDetail> {
    await this.init()
    const s = this.requireSession()
    await latency()
    const r = this.store.reports.find((x) => x.publicRef === ref)
    if (!r) throw new ReportError('NOT_FOUND')
    if (r.reporterRef !== s.reporterRef) throw new ReportError('FORBIDDEN')
    return detail(r, false)
  }

  async replyToReport(ref: string, text: string): Promise<void> {
    await this.init()
    const s = this.requireSession()
    await latency()
    const r = this.store.reports.find((x) => x.publicRef === ref)
    if (!r) throw new ReportError('NOT_FOUND')
    if (r.reporterRef !== s.reporterRef) throw new ReportError('FORBIDDEN')
    if (!text.trim()) throw new ReportError('VALIDATION')

    const bad = checkTransition('NEEDS_INFO', 'TRIAGE', 'citizen', { submittedAt: r.submittedAt })
    if (r.status !== 'NEEDS_INFO' || bad) throw new ReportError('ILLEGAL_TRANSITION')

    /* Kept on the event rather than appended to `description`. Splicing it into
       the narrative permanently altered the text findDuplicate fingerprints, so
       answering a question could stop a report matching a genuine duplicate it
       had matched moments earlier. */
    const at = nowIso()
    r.timeline.push({
      at,
      fromStatus: 'NEEDS_INFO',
      toStatus: 'TRIAGE',
      reasonCode: null,
      actorType: 'citizen',
      citizenReply: text.trim(),
    })
    r.status = 'TRIAGE'
    r.updatedAt = at
    this.persist()
  }

  async withdrawReport(ref: string): Promise<void> {
    await this.init()
    const s = this.requireSession()
    await latency()
    const r = this.store.reports.find((x) => x.publicRef === ref)
    if (!r) throw new ReportError('NOT_FOUND')
    if (r.reporterRef !== s.reporterRef) throw new ReportError('FORBIDDEN')

    const bad = checkTransition(r.status, 'WITHDRAWN', 'citizen', { submittedAt: r.submittedAt })
    if (bad) throw new ReportError(bad === 'SEALED' ? 'SEALED' : 'ILLEGAL_TRANSITION')

    const at = nowIso()
    r.timeline.push({ at, fromStatus: r.status, toStatus: 'WITHDRAWN', reasonCode: null, actorType: 'citizen' })
    r.status = 'WITHDRAWN'
    r.updatedAt = at
    this.persist()
  }

  // ── officer ───────────────────────────────────────────────────────

  async officerQueue(filter: QueueFilter): Promise<Page<ReportSummary>> {
    await this.init()
    await latency()
    const limit = Math.min(filter.limit ?? 25, QUEUE_LIMIT_MAX)
    const offset = filter.cursor ? Number(filter.cursor) || 0 : 0

    let rows = [...this.store.reports]
    if (filter.status?.length) rows = rows.filter((r) => filter.status!.includes(r.status))
    if (filter.district) rows = rows.filter((r) => r.district === filter.district)
    if (filter.since) {
      const t = Date.parse(filter.since)
      rows = rows.filter((r) => Date.parse(r.submittedAt) >= t)
    }

    /* Likely-spam sinks to the bottom rather than disappearing — an officer still
       has to be able to find it and disagree. */
    rows.sort((a, b) => a.spamScore - b.spamScore || Date.parse(b.submittedAt) - Date.parse(a.submittedAt))

    const page = rows.slice(offset, offset + limit)
    return {
      items: page.map((r) => summarise(r, true)),
      nextCursor: offset + limit < rows.length ? String(offset + limit) : null,
    }
  }

  async officerGetReport(ref: string): Promise<ReportDetail> {
    await this.init()
    await latency()
    const r = this.store.reports.find((x) => x.publicRef === ref)
    if (!r) throw new ReportError('NOT_FOUND')
    return detail(r, true)
  }

  /* Synchronous core, so a bulk call can apply many without paying the
     simulated latency once per row. Throws the same ReportError the async
     wrapper does; the caller persists. */
  private applyTransition(ref: string, t: TransitionRequest, role: Role): StoredReport {
    const r = this.store.reports.find((x) => x.publicRef === ref)
    if (!r) throw new ReportError('NOT_FOUND')

    const bad = checkTransition(
      r.status,
      t.toStatus,
      role,
      { submittedAt: r.submittedAt, exportedAt: r.exportedAt, lastEventAt: r.updatedAt },
      { reasonCode: t.reasonCode, firNumber: t.firNumber, dupOf: t.dupOf },
    )
    if (bad) throw new ReportError(bad)

    const at = nowIso()
    r.timeline.push({
      at,
      fromStatus: r.status,
      toStatus: t.toStatus,
      reasonCode: t.reasonCode,
      actorType: 'officer',
      actorLabel: role,
      note: t.note,
    })

    const reporter = this.reporterFor(r.reporterRef)
    if (reporter) {
      if (t.toStatus === 'VERIFIED_FIR') reporter.verified++
      if (t.toStatus === 'REJECTED') reporter.rejected++
    }

    r.status = t.toStatus
    if (t.firNumber) r.firNumber = t.firNumber
    if (t.dupOf) r.dupOf = t.dupOf
    r.updatedAt = at
    return r
  }

  /* Defaults to `officer`, not `supervisor`. The lifecycle table restricts
     reopening a closed report and un-verifying an FIR to supervisors, and
     defaulting to the wider role meant that restriction was never once
     enforced — every caller silently had the run of the table. */
  async officerTransition(ref: string, t: TransitionRequest, role: Role = 'officer'): Promise<ReportDetail> {
    await this.init()
    await latency()
    const r = this.applyTransition(ref, t, role)
    this.persist()
    return detail(r, true)
  }

  /* A real backend does a bulk transition in one round trip, so the simulated
     latency is paid once here rather than 25 times inside the loop. */
  async officerBulkTransition(refs: string[], t: TransitionRequest, role: Role = 'officer') {
    await this.init()
    await latency()
    const failed: string[] = []
    let updated = 0
    for (const ref of refs.slice(0, 25)) {
      try {
        this.applyTransition(ref, t, role)
        updated++
      } catch {
        failed.push(ref)
      }
    }
    this.persist()
    return { updated, failed }
  }

  async officerStats(): Promise<Record<ReportStatus, number>> {
    await this.init()
    await latency()
    const base: Record<ReportStatus, number> = {
      SUBMITTED: 0, TRIAGE: 0, NEEDS_INFO: 0, DUPLICATE: 0,
      REJECTED: 0, VERIFIED_FIR: 0, CLOSED_NO_ACTION: 0, WITHDRAWN: 0,
    }
    for (const r of this.store.reports) base[r.status]++
    return base
  }

  // ── the manual gate ───────────────────────────────────────────────

  async officerExportVerified(since?: string): Promise<VerifiedExport> {
    await this.init()
    await latency()
    const t = since ? Date.parse(since) : 0
    const rows: VerifiedExportRow[] = this.store.reports
      .filter((r) => r.status === 'VERIFIED_FIR' && !r.exportedAt && Date.parse(r.updatedAt) >= t)
      .map((r) => ({
        publicRef: r.publicRef,
        firNumber: r.firNumber ?? '',
        category: r.category,
        district: r.district,
        incidentAt: r.incidentAt,
        lat: r.lat,
        lon: r.lon,
        verifiedBy: r.timeline.find((e) => e.toStatus === 'VERIFIED_FIR')?.actorLabel ?? 'officer',
        verifiedAt: r.timeline.find((e) => e.toStatus === 'VERIFIED_FIR')?.at ?? r.updatedAt,
      }))
    return { batchId: uid().slice(0, 8), since: since ?? null, rows }
  }

  async officerSealExport(batchId: string, refs: string[]): Promise<ExportManifest> {
    await this.init()
    await latency()
    const at = nowIso()
    const sealed: string[] = []
    for (const ref of refs) {
      const r = this.store.reports.find((x) => x.publicRef === ref)
      if (!r || r.status !== 'VERIFIED_FIR' || r.exportedAt) continue
      r.exportedAt = at
      r.sealedBatchId = batchId
      sealed.push(ref)
    }
    this.persist()

    /* Digest what was actually frozen. Hashing the requested list meant the
       manifest could attest rows that were skipped for being the wrong status
       or already exported — and this digest is the integrity record for what
       gets handed to the pipeline. */
    const count = sealed.length
    const payload = sealed.slice().sort().join('|')
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload))
    const sha256 = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')

    return { batchId, count, sha256, sealedBy: 'supervisor', sealedAt: at }
  }

  // ── shared, de-identified ─────────────────────────────────────────

  async reportLayer(opts?: { since?: string }): Promise<CitizenReportCell[]> {
    await this.init()
    await latency()
    if (!this.params) return []
    const since = opts?.since ? Date.parse(opts.since) : 0
    const weekAgo = Date.now() - 7 * 24 * 3600 * 1000

    const byCell = new Map<number, { n: number; recent: number; cats: Map<string, number> }>()
    for (const r of this.store.reports) {
      if (r.cellId == null) continue
      if (r.status === 'WITHDRAWN' || r.status === 'REJECTED') continue
      if (Date.parse(r.submittedAt) < since) continue
      let e = byCell.get(r.cellId)
      if (!e) {
        e = { n: 0, recent: 0, cats: new Map() }
        byCell.set(r.cellId, e)
      }
      e.n++
      if (Date.parse(r.submittedAt) >= weekAgo) e.recent++
      e.cats.set(r.category, (e.cats.get(r.category) ?? 0) + 1)
    }

    /* The cell centre, never the reporter's own coordinates. Seeding this from
       the first report in the cell published a GPS-accurate position for any
       cell holding a single report — which is most of them — and quietly undid
       the aggregation this layer exists to provide. */
    return Array.from(byCell.entries()).map(([cellId, e]) => {
      const centre = cellCenter(cellId, this.params!)
      return {
        cellId,
        lat: centre.lat,
        lon: centre.lon,
        nReports: e.n,
        nLast7d: e.recent,
        topCategory: [...e.cats.entries()].sort((a, b) => b[1] - a[1])[0][0],
      }
    })
  }
}

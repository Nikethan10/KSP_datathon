import type { Lang } from '../i18n'

/* Citizen reports are deliberately kept out of `data.ts`. That module loads the
   pipeline's precomputed artefacts — immutable, cached forever, statistically
   defensible. These are unverified public submissions. Keeping them in a separate
   module means the boundary is visible in the import graph, not just in a comment. */

export type ReportStatus =
  | 'SUBMITTED'
  | 'TRIAGE'
  | 'NEEDS_INFO'
  | 'DUPLICATE'
  | 'REJECTED'
  | 'VERIFIED_FIR'
  | 'CLOSED_NO_ACTION'
  | 'WITHDRAWN'

/** One of the 20 CrimeGroupName values the pipeline uses. Sharing that vocabulary
    means `tc()` translates a category for free and a verified report converts to an
    FIR row with no mapping table in between. */
export type CrimeCategory = string

export type SeveritySelf = 'emergency' | 'urgent' | 'routine'
export type ActorType = 'citizen' | 'officer' | 'system'
export type LocationPrecision = 'gps' | 'map_pin' | 'address_only'

/* Categories carrying statutory identity-disclosure restrictions (POCSO and
   related). A queued web form is the wrong channel for these: legally exposed and
   operationally useless, since nobody is watching the queue at 3 AM. Selecting one
   ends the flow and points the reporter at 112 or a station. */
export const BLOCKED_CATEGORIES: readonly CrimeCategory[] = [
  'Sexual Offences',
  'Crimes Against Children',
  'Kidnapping & Abduction',
]

export function isBlockedCategory(c: CrimeCategory): boolean {
  return BLOCKED_CATEGORIES.includes(c)
}

/** Drawn above the hotspot layer, in a hue neither SIG_COLORS nor EMERGING_COLORS
    uses, so a report never reads as a measurement. */
export const CITIZEN_REPORT_COLOR: [number, number, number, number] = [86, 190, 200, 90]
export const CITIZEN_REPORT_STROKE: [number, number, number, number] = [235, 245, 247, 200]

export interface ReportDraft {
  category: CrimeCategory
  description: string
  incidentAt: string
  lat: number
  lon: number
  locationPrecision: LocationPrecision
  severitySelf: SeveritySelf
  lang: Lang
  attachmentIds: string[]
  /** Idempotency key. The store has no transactions, so a retried submit must
      return the original reference rather than creating a twin. */
  clientNonce: string
}

export interface ReportSummary {
  publicRef: string
  status: ReportStatus
  category: CrimeCategory
  incidentAt: string
  submittedAt: string
  updatedAt: string
  district: string | null
  cellId: number | null
  severitySelf: SeveritySelf
  /* Officer-side only — absent from anything the citizen receives. */
  dupOf?: string | null
  spamScore?: number
  attachmentCount?: number
  reporterTrust?: number
}

export interface ReportEvent {
  at: string
  fromStatus: ReportStatus | null
  toStatus: ReportStatus
  reasonCode: string | null
  actorType: ActorType
  /** Omitted from the citizen's redacted timeline — they see that a decision was
      made, never which officer made it. */
  actorLabel?: string
  note?: string
  /** What the reporter wrote when answering a request for more information.
      Unlike `note` this survives redaction — it is their own text. */
  citizenReply?: string
}

export interface Attachment {
  id: string
  mime: string
  sizeBytes: number
  status: 'pending' | 'stored' | 'rejected' | 'quarantined'
  /** Short-lived presigned GET. Officer side only; never handed to a citizen. */
  url?: string
}

export interface ReportDetail extends ReportSummary {
  description: string
  lat: number
  lon: number
  attachments: Attachment[]
  timeline: ReportEvent[]
  firNumber: string | null
  /** Once set, this row has been sealed into an export batch and can no longer
      leave VERIFIED_FIR — the pipeline may already have consumed it. */
  exportedAt: string | null
}

export interface TransitionRequest {
  toStatus: ReportStatus
  reasonCode: string
  note?: string
  firNumber?: string
  dupOf?: string
}

export interface QueueFilter {
  status?: ReportStatus[]
  district?: string
  since?: string
  cursor?: string | null
  /** Server caps this at 50. */
  limit?: number
}

export interface Page<T> {
  items: T[]
  nextCursor: string | null
}

export interface OtpChallenge {
  challengeId: string
  expiresInSec: number
  resendAfterSec: number
  /** True when no mail is actually sent and a fixed code is accepted. The UI must
      show this plainly so a demo is never mistaken for a live system. */
  demoMode: boolean
}

export interface CitizenSession {
  token: string
  reporterRef: string
  expiresAt: string
}

/** The shared map layer: aggregated to the 1 km cell, de-identified, no free text.
    Individual reports never reach a map that anyone but a triaging officer sees. */
export interface CitizenReportCell {
  cellId: number
  lat: number
  lon: number
  nReports: number
  nLast7d: number
  topCategory: CrimeCategory
}

export interface VerifiedExportRow {
  publicRef: string
  firNumber: string
  category: CrimeCategory
  district: string | null
  incidentAt: string
  lat: number
  lon: number
  verifiedBy: string
  verifiedAt: string
}

export interface VerifiedExport {
  batchId: string
  since: string | null
  rows: VerifiedExportRow[]
}

export interface ExportManifest {
  batchId: string
  count: number
  sha256: string
  sealedBy: string
  sealedAt: string
}

export type ReportErrorCode =
  | 'RATE_LIMITED'
  | 'OTP_INVALID'
  | 'OTP_EXPIRED'
  | 'OTP_ATTEMPTS'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'ILLEGAL_TRANSITION'
  | 'VALIDATION'
  | 'ATTACHMENT_TOO_LARGE'
  | 'ATTACHMENT_TYPE'
  | 'BLOCKED'
  | 'SEALED'
  | 'OFFLINE'
  | 'SERVER'

/* The server answers with a code, never English prose — the client has to be able
   to render the message in Kannada too. */
export class ReportError extends Error {
  readonly code: ReportErrorCode
  readonly retryAfterSec?: number

  constructor(code: ReportErrorCode, retryAfterSec?: number) {
    super(code)
    this.name = 'ReportError'
    this.code = code
    this.retryAfterSec = retryAfterSec
  }
}

export const ATTACHMENT_LIMITS = {
  maxBytes: 5 * 1024 * 1024,
  maxPerReport: 3,
  mimes: ['image/jpeg', 'image/png', 'image/webp'] as const,
}

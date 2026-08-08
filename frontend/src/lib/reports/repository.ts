import type { Lang } from '../i18n'
import type { Role } from './lifecycle'
import type {
  Attachment,
  CitizenReportCell,
  CitizenSession,
  ExportManifest,
  OtpChallenge,
  Page,
  ReportDetail,
  ReportDraft,
  ReportStatus,
  ReportSummary,
  QueueFilter,
  TransitionRequest,
  VerifiedExport,
} from './types'

/* One interface, two implementations: LocalReportRepository (localStorage, no
   credentials, fully demoable) and CatalystReportRepository (the real backend).
   Every screen is written against this, so swapping backends is one line in
   index.ts rather than a rewrite. */

export interface ReportRepository {
  // ── citizen identity ──────────────────────────────────────────────
  requestOtp(contact: string, lang: Lang): Promise<OtpChallenge>
  verifyOtp(challengeId: string, code: string): Promise<CitizenSession>
  session(): CitizenSession | null
  signOut(): void

  // ── attachments ───────────────────────────────────────────────────
  presignAttachment(meta: {
    mime: string
    sizeBytes: number
    sha256: string
  }): Promise<{ attachmentId: string; uploadUrl: string; maxBytes: number }>
  uploadAttachment(
    uploadUrl: string,
    file: Blob,
    onProgress?: (pct: number) => void,
  ): Promise<void>
  completeAttachment(attachmentId: string): Promise<Attachment>

  // ── citizen reports ───────────────────────────────────────────────
  submitReport(draft: ReportDraft): Promise<{
    publicRef: string
    status: ReportStatus
    dupOf?: string
  }>
  myReports(): Promise<ReportSummary[]>
  getMyReport(publicRef: string): Promise<ReportDetail>
  replyToReport(publicRef: string, text: string): Promise<void>
  withdrawReport(publicRef: string): Promise<void>

  // ── officer ───────────────────────────────────────────────────────
  officerQueue(filter: QueueFilter): Promise<Page<ReportSummary>>
  officerGetReport(publicRef: string): Promise<ReportDetail>
  /* `role` is explicit rather than defaulted at the call site: the lifecycle
     table restricts several transitions to supervisors, and a caller that
     forgets to pass one should get the narrower role, not the wider one. */
  officerTransition(publicRef: string, t: TransitionRequest, role?: Role): Promise<ReportDetail>
  officerBulkTransition(
    refs: string[],
    t: TransitionRequest,
    role?: Role,
  ): Promise<{ updated: number; failed: string[] }>
  officerStats(): Promise<Record<ReportStatus, number>>

  // ── the manual gate ───────────────────────────────────────────────
  /** Read-only. Mutates nothing — a supervisor is expected to read this before sealing. */
  officerExportVerified(since?: string): Promise<VerifiedExport>
  /** Stamps exportedAt on the listed rows, freezing them against further edits. */
  officerSealExport(batchId: string, refs: string[]): Promise<ExportManifest>

  // ── shared, de-identified ─────────────────────────────────────────
  /** Aggregated to the 1 km cell. Never individual reports, never free text. */
  reportLayer(opts?: { since?: string }): Promise<CitizenReportCell[]>
}

import type { Lang } from '../i18n'
import type { Role } from './lifecycle'
import type { ReportRepository } from './repository'
import {
  ReportError,
  type Attachment,
  type CitizenReportCell,
  type CitizenSession,
  type ExportManifest,
  type OtpChallenge,
  type Page,
  type QueueFilter,
  type ReportDetail,
  type ReportDraft,
  type ReportStatus,
  type ReportSummary,
  type ReportErrorCode,
  type TransitionRequest,
  type VerifiedExport,
} from './types'

/* Talks to the Advanced I/O function at /server/prahari_api/v1.

   Same-origin in production — the client is served from /app/ and the function
   from /server/ on the same host — so there is no CORS here at all. Development
   defaults to the local adapter precisely so it never meets that wall. */

const SESSION_KEY = 'prahari_report_session'

interface Envelope<T> {
  ok: boolean
  data?: T
  error?: { code: ReportErrorCode; retry_after_sec?: number }
}

export class CatalystReportRepository implements ReportRepository {
  private base: string

  constructor(base: string) {
    this.base = base.replace(/\/$/, '')
  }

  // ── plumbing ──────────────────────────────────────────────────────

  private token(): string | null {
    return this.session()?.token ?? null
  }

  private async call<T>(
    path: string,
    init: { method?: string; body?: unknown; auth?: boolean; role?: Role } = {},
  ): Promise<T> {
    const headers: Record<string, string> = {}
    if (init.body !== undefined) headers['content-type'] = 'application/json'
    if (init.auth) {
      const t = this.token()
      if (!t) throw new ReportError('UNAUTHENTICATED')
      headers.authorization = `Bearer ${t}`
    }
    /* Only honoured when the deployment sets ALLOW_UNAUTH_OFFICER, which is off
       by default. Real officer identity comes from Catalyst Authentication. */
    if (init.role) headers['x-prahari-role'] = init.role

    let res: Response
    try {
      res = await fetch(`${this.base}${path}`, {
        method: init.method ?? 'GET',
        headers,
        credentials: 'include',
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
      })
    } catch {
      throw new ReportError('OFFLINE')
    }

    let env: Envelope<T> | null = null
    try {
      env = (await res.json()) as Envelope<T>
    } catch {
      throw new ReportError(res.ok ? 'SERVER' : 'SERVER')
    }

    if (!res.ok || !env.ok) {
      const code = env?.error?.code ?? 'SERVER'
      throw new ReportError(code, env?.error?.retry_after_sec)
    }
    return env.data as T
  }

  // ── citizen identity ──────────────────────────────────────────────

  async requestOtp(contact: string, lang: Lang): Promise<OtpChallenge> {
    return this.call<OtpChallenge>('/auth/otp/request', {
      method: 'POST',
      body: { contact, lang },
    })
  }

  async verifyOtp(challengeId: string, code: string): Promise<CitizenSession> {
    const s = await this.call<CitizenSession>('/auth/otp/verify', {
      method: 'POST',
      body: { challengeId, code },
    })
    /* sessionStorage, not localStorage: an OTP session should not outlive the tab. */
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(s)) } catch { /* private mode */ }
    return s
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
    try { sessionStorage.removeItem(SESSION_KEY) } catch { /* private mode */ }
  }

  // ── attachments ───────────────────────────────────────────────────
  /* Stratus upload is designed but not built. The server returns an error rather
     than a fake success, and these surface it unchanged. */

  async presignAttachment(): Promise<{ attachmentId: string; uploadUrl: string; maxBytes: number }> {
    throw new ReportError('SERVER')
  }

  async uploadAttachment(): Promise<void> {
    throw new ReportError('SERVER')
  }

  async completeAttachment(): Promise<Attachment> {
    throw new ReportError('SERVER')
  }

  // ── citizen reports ───────────────────────────────────────────────

  async submitReport(d: ReportDraft) {
    return this.call<{ publicRef: string; status: ReportStatus; dupOf?: string }>('/reports', {
      method: 'POST',
      auth: true,
      body: d,
    })
  }

  async myReports(): Promise<ReportSummary[]> {
    return this.call<ReportSummary[]>('/reports/mine', { auth: true })
  }

  async getMyReport(publicRef: string): Promise<ReportDetail> {
    return this.call<ReportDetail>(`/reports/${encodeURIComponent(publicRef)}`, { auth: true })
  }

  async replyToReport(publicRef: string, text: string): Promise<void> {
    await this.call(`/reports/${encodeURIComponent(publicRef)}/reply`, {
      method: 'POST', auth: true, body: { text },
    })
  }

  async withdrawReport(publicRef: string): Promise<void> {
    await this.call(`/reports/${encodeURIComponent(publicRef)}/withdraw`, {
      method: 'POST', auth: true,
    })
  }

  // ── officer ───────────────────────────────────────────────────────

  async officerQueue(f: QueueFilter): Promise<Page<ReportSummary>> {
    const p = new URLSearchParams()
    if (f.status?.length) p.set('status', f.status.join(','))
    if (f.district) p.set('district', f.district)
    if (f.since) p.set('since', f.since)
    if (f.cursor) p.set('cursor', f.cursor)
    if (f.limit) p.set('limit', String(f.limit))
    const qs = p.toString()
    return this.call<Page<ReportSummary>>(`/officer/queue${qs ? `?${qs}` : ''}`)
  }

  async officerGetReport(publicRef: string): Promise<ReportDetail> {
    return this.call<ReportDetail>(`/officer/reports/${encodeURIComponent(publicRef)}`)
  }

  async officerTransition(
    publicRef: string,
    t: TransitionRequest,
    role: Role = 'officer',
  ): Promise<ReportDetail> {
    return this.call<ReportDetail>(
      `/officer/reports/${encodeURIComponent(publicRef)}/transition`,
      { method: 'POST', body: t, role },
    )
  }

  async officerBulkTransition(refs: string[], t: TransitionRequest) {
    /* No bulk endpoint on the server yet. Doing it client-side keeps the
       per-report lifecycle checks and audit rows intact, which a bulk shortcut
       would have to reimplement. */
    const failed: string[] = []
    let updated = 0
    for (const ref of refs.slice(0, 25)) {
      try {
        await this.officerTransition(ref, t)
        updated++
      } catch {
        failed.push(ref)
      }
    }
    return { updated, failed }
  }

  async officerStats(): Promise<Record<ReportStatus, number>> {
    return this.call<Record<ReportStatus, number>>('/officer/stats')
  }

  // ── the manual gate ───────────────────────────────────────────────

  async officerExportVerified(since?: string): Promise<VerifiedExport> {
    const qs = since ? `?since=${encodeURIComponent(since)}` : ''
    return this.call<VerifiedExport>(`/officer/export/verified${qs}`, { role: 'supervisor' })
  }

  async officerSealExport(batchId: string, refs: string[]): Promise<ExportManifest> {
    return this.call<ExportManifest>('/officer/export/seal', {
      method: 'POST', body: { batchId, refs }, role: 'supervisor',
    })
  }

  // ── shared, de-identified ─────────────────────────────────────────

  async reportLayer(opts?: { since?: string }): Promise<CitizenReportCell[]> {
    const qs = opts?.since ? `?since=${encodeURIComponent(opts.since)}` : ''
    return this.call<CitizenReportCell[]>(`/public/reports/layer${qs}`)
  }
}

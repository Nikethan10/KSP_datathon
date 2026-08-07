import { useCallback, useEffect, useState } from 'react'
import SiteShell from './SiteShell'
import PageHeader from './PageHeader'
import { Section } from './primitives'
import { useI18n } from '../lib/i18n'
import { reports, REPORTS_DEMO_MODE } from '../lib/reports'
import { ReportError, type ReportDetail, type ReportSummary } from '../lib/reports/types'

/* A reporter who hears nothing files the same thing again. This page exists to
   stop that, and it is cheap: the OTP already binds a report to an address, so
   showing them their own list costs one lookup. */

const inputCls =
  'w-full rounded-lg border border-slate-700/70 bg-slate-900/40 px-3 py-2.5 text-[14px] ' +
  'text-slate-100 placeholder:text-slate-500 focus:border-slate-500 focus:outline-none transition-colors'
const labelCls = 'block text-[12px] font-semibold text-slate-200 mb-1.5'

function errKey(e: unknown): string {
  return e instanceof ReportError ? `report.err.${e.code}` : 'report.err.SERVER'
}

function fmt(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString()
}

export default function ReportStatusPage() {
  const { t, tc, td, lang } = useI18n()

  const [signedIn, setSignedIn] = useState(() => !!reports.session())
  const [email, setEmail] = useState('')
  const [challengeId, setChallengeId] = useState<string | null>(null)
  const [code, setCode] = useState('')

  const [list, setList] = useState<ReportSummary[] | null>(null)
  const [open, setOpen] = useState<ReportDetail | null>(null)
  const [reply, setReply] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      setList(await reports.myReports())
    } catch (e) {
      setError(errKey(e))
    }
  }, [])

  useEffect(() => { if (signedIn) void load() }, [signedIn, load])

  async function sendCode() {
    setError(null); setBusy(true)
    try {
      const c = await reports.requestOtp(email, lang)
      setChallengeId(c.challengeId)
    } catch (e) { setError(errKey(e)) } finally { setBusy(false) }
  }

  async function verify() {
    if (!challengeId) return
    setError(null); setBusy(true)
    try {
      await reports.verifyOtp(challengeId, code)
      setSignedIn(true)
    } catch (e) { setError(errKey(e)) } finally { setBusy(false) }
  }

  async function openRef(ref: string) {
    setError(null); setBusy(true)
    try {
      setOpen(await reports.getMyReport(ref))
      setReply('')
    } catch (e) { setError(errKey(e)) } finally { setBusy(false) }
  }

  async function withdraw(ref: string) {
    setError(null); setBusy(true)
    try {
      await reports.withdrawReport(ref)
      await load()
      await openRef(ref)
    } catch (e) { setError(errKey(e)) } finally { setBusy(false) }
  }

  async function sendReply(ref: string) {
    setError(null); setBusy(true)
    try {
      await reports.replyToReport(ref, reply)
      setReply('')
      await load()
      await openRef(ref)
    } catch (e) { setError(errKey(e)) } finally { setBusy(false) }
  }

  const canWithdraw =
    open &&
    (open.status === 'SUBMITTED' || open.status === 'TRIAGE') &&
    (Date.now() - Date.parse(open.submittedAt)) / 3_600_000 <= 24

  return (
    <SiteShell>
      <PageHeader
        stamp={t('reportStatus.stamp')}
        title={t('reportStatus.title')}
        lede={t('reportStatus.lede')}
      />

      <Section className="!pt-10">
        <div className="max-w-3xl">
          {REPORTS_DEMO_MODE && (
            <div className="mb-7 rounded-lg border border-amber-500/40 bg-amber-500/5 px-4 py-3">
              <p className="text-[13px] leading-relaxed text-amber-200">{t('report.demoBanner')}</p>
            </div>
          )}

          {!signedIn ? (
            <div className="site-card p-6 max-w-md">
              <p className="text-[13px] leading-relaxed text-slate-400 mb-5">
                {t('reportStatus.signInFirst')}
              </p>
              <label className={labelCls} htmlFor="rs-email">{t('report.email.label')}</label>
              <div className="flex gap-2">
                <input
                  id="rs-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputCls}
                />
                <button
                  onClick={sendCode}
                  disabled={busy || !email}
                  className="site-btn site-btn-ghost shrink-0 disabled:opacity-40"
                >
                  {t('report.otp.send')}
                </button>
              </div>

              {challengeId && (
                <div className="mt-5">
                  <label className={labelCls} htmlFor="rs-otp">{t('report.otp.label')}</label>
                  <div className="flex gap-2">
                    <input
                      id="rs-otp"
                      inputMode="numeric"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      className={`${inputCls} tabular-nums tracking-[0.3em]`}
                    />
                    <button
                      onClick={verify}
                      disabled={busy || code.length < 6}
                      className="site-btn site-btn-primary shrink-0 disabled:opacity-40"
                    >
                      {t('report.otp.verify')}
                    </button>
                  </div>
                  {REPORTS_DEMO_MODE && (
                    <p className="mt-1.5 text-[12px] text-slate-500">{t('report.otp.demoHint')}</p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="grid gap-7 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
              <div>
                <div className="stamp mb-3">{t('reportStatus.mine')}</div>
                {list === null ? (
                  <p className="text-[13px] text-slate-500">…</p>
                ) : list.length === 0 ? (
                  <p className="text-[13px] text-slate-500">{t('reportStatus.none')}</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {list.map((r) => (
                      <li key={r.publicRef}>
                        <button
                          onClick={() => openRef(r.publicRef)}
                          className={`w-full text-left rounded-lg border px-3.5 py-3 transition-colors ${
                            open?.publicRef === r.publicRef
                              ? 'border-slate-400 bg-slate-800/50'
                              : 'border-slate-700/70 hover:border-slate-500'
                          }`}
                        >
                          <div className="flex items-baseline justify-between gap-3">
                            <span className="text-[13px] font-semibold tabular-nums text-slate-100">
                              {r.publicRef}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              {t(`rstatus.${r.status}`)}
                            </span>
                          </div>
                          <div className="mt-1 text-[12px] text-slate-500">
                            {tc(r.category)}
                            {r.district ? ` · ${td(r.district)}` : ''}
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                {!open ? (
                  <p className="text-[13px] text-slate-500">{t('triage.selectHint')}</p>
                ) : (
                  <div className="site-card p-6">
                    <div className="flex items-baseline justify-between gap-4">
                      <span className="text-[18px] font-semibold tabular-nums text-slate-50">
                        {open.publicRef}
                      </span>
                      <span className="text-[12px] text-slate-300">
                        {t(`rstatus.${open.status}`)}
                      </span>
                    </div>

                    <dl className="mt-4 grid grid-cols-2 gap-3 text-[12px]">
                      <div>
                        <dt className="text-slate-500">{t('reportStatus.filed')}</dt>
                        <dd className="text-slate-300">{fmt(open.submittedAt)}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">{t('reportStatus.updated')}</dt>
                        <dd className="text-slate-300">{fmt(open.updatedAt)}</dd>
                      </div>
                    </dl>

                    {open.firNumber && (
                      <p className="mt-4 text-[13px] text-emerald-300">
                        {t('triage.firNumber')}: {open.firNumber}
                      </p>
                    )}

                    <div className="stamp mt-6 mb-2">{t('reportStatus.timeline')}</div>
                    <ol className="flex flex-col gap-2">
                      {open.timeline.map((e, i) => (
                        <li key={i} className="text-[12px] text-slate-400">
                          <span className="tabular-nums text-slate-500">{fmt(e.at)}</span>
                          {' — '}
                          <span className="text-slate-200">{t(`rstatus.${e.toStatus}`)}</span>
                          {e.reasonCode && (
                            <span className="text-slate-500"> · {t(`reason.${e.reasonCode}`)}</span>
                          )}
                        </li>
                      ))}
                    </ol>

                    {open.status === 'NEEDS_INFO' && (
                      <div className="mt-6">
                        <label className={labelCls} htmlFor="rs-reply">
                          {t('reportStatus.reply')}
                        </label>
                        <textarea
                          id="rs-reply"
                          rows={3}
                          value={reply}
                          onChange={(e) => setReply(e.target.value)}
                          className={inputCls}
                        />
                        <button
                          onClick={() => sendReply(open.publicRef)}
                          disabled={busy || !reply.trim()}
                          className="mt-2 site-btn site-btn-primary disabled:opacity-40"
                        >
                          {t('reportStatus.send')}
                        </button>
                      </div>
                    )}

                    {canWithdraw && (
                      <button
                        onClick={() => withdraw(open.publicRef)}
                        disabled={busy}
                        className="mt-6 site-btn site-btn-ghost"
                      >
                        {t('reportStatus.withdraw')}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {error && <p className="mt-5 text-[13px] text-red-300">{t(error)}</p>}
        </div>
      </Section>
    </SiteShell>
  )
}

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useI18n } from '../lib/i18n'
import { reports, REPORTS_DEMO_MODE } from '../lib/reports'
import { allowedTransitions, OPEN_STATUSES, REASON_CODES, type Role } from '../lib/reports/lifecycle'
import { SPAM_FLAG_THRESHOLD } from '../lib/reports/moderation'
import {
  ReportError,
  type ReportDetail,
  type ReportStatus,
  type ReportSummary,
  type VerifiedExport,
} from '../lib/reports/types'

/* The admin side of the portal. Deliberately reads nothing from data.ts: this is
   live operational state, and the artefact cache in there never revalidates.

   Nothing on this screen feeds the analytics. A verified report becomes an FIR
   only when a supervisor seals a batch and a person carries the file across. */

const inputCls =
  'w-full rounded-md border border-slate-700/70 bg-slate-900/40 px-2.5 py-1.5 text-[12px] ' +
  'text-slate-200 focus:border-slate-500 focus:outline-none transition-colors'

function fmt(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString()
}

function errKey(e: unknown): string {
  return e instanceof ReportError ? `report.err.${e.code}` : 'report.err.SERVER'
}

export default function ReportsView() {
  const { t, tc, td } = useI18n()

  const [filter, setFilter] = useState<'open' | 'all'>('open')
  /* Stands in for authentication, which does not exist yet. Least privilege by
     default: reopening a closed report and un-verifying an FIR are
     supervisor-only in the lifecycle table, and until Catalyst Auth is wired up
     this switch is what makes that distinction real rather than decorative. */
  const [role, setRole] = useState<Role>('officer')
  const [items, setItems] = useState<ReportSummary[] | null>(null)
  const [stats, setStats] = useState<Record<ReportStatus, number> | null>(null)
  const [openRef, setOpenRef] = useState<string | null>(null)
  const [open, setOpen] = useState<ReportDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // decision form
  const [toStatus, setToStatus] = useState<ReportStatus | ''>('')
  const [reasonCode, setReasonCode] = useState('')
  const [note, setNote] = useState('')
  const [firNumber, setFirNumber] = useState('')
  const [dupOf, setDupOf] = useState('')

  // export
  const [batch, setBatch] = useState<VerifiedExport | null>(null)
  const [sealMsg, setSealMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const [page, s] = await Promise.all([
        reports.officerQueue({
          status: filter === 'open' ? [...OPEN_STATUSES] : undefined,
          limit: 50,
        }),
        reports.officerStats(),
      ])
      setItems(page.items)
      setStats(s)
    } catch (e) {
      setError(errKey(e))
    }
  }, [filter])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    if (!openRef) { setOpen(null); return }
    let cancelled = false
    reports
      .officerGetReport(openRef)
      .then((d) => { if (!cancelled) { setOpen(d); setToStatus(''); setReasonCode(''); setNote(''); setFirNumber(''); setDupOf(d.dupOf ?? '') } })
      .catch((e) => { if (!cancelled) setError(errKey(e)) })
    return () => { cancelled = true }
  }, [openRef])

  /* The console offers exactly what this role may do, and the repository checks
     the same table again — the buttons are a mirror, not the authority. */
  const options = useMemo(
    () =>
      open
        ? allowedTransitions(open.status, role, {
            submittedAt: open.submittedAt,
            exportedAt: open.exportedAt,
            lastEventAt: open.updatedAt,
          })
        : [],
    [open, role],
  )

  const chosen = options.find((o) => o.to === toStatus)

  async function apply() {
    if (!open || !toStatus) return
    setBusy(true); setError(null)
    try {
      const updated = await reports.officerTransition(open.publicRef, {
        toStatus,
        reasonCode,
        note: note || undefined,
        firNumber: firNumber || undefined,
        dupOf: dupOf || undefined,
      }, role)
      setOpen(updated)
      setToStatus(''); setReasonCode(''); setNote('')
      await load()
    } catch (e) {
      setError(errKey(e))
    } finally {
      setBusy(false)
    }
  }

  async function loadBatch() {
    setBusy(true); setError(null); setSealMsg(null)
    try {
      setBatch(await reports.officerExportVerified())
    } catch (e) { setError(errKey(e)) } finally { setBusy(false) }
  }

  async function seal() {
    if (!batch) return
    setBusy(true); setError(null)
    try {
      const m = await reports.officerSealExport(batch.batchId, batch.rows.map((r) => r.publicRef))
      setSealMsg(
        t('triage.sealedOk').replace('{n}', String(m.count)).replace('{batch}', m.batchId),
      )
      setBatch(null)
      await load()
      if (openRef) setOpen(await reports.officerGetReport(openRef))
    } catch (e) { setError(errKey(e)) } finally { setBusy(false) }
  }

  return (
    <div className="h-full flex flex-col lg:flex-row min-h-0">
      {/* queue */}
      <aside className="shrink-0 w-full lg:w-[340px] xl:w-[380px] flex flex-col min-h-0 border-b lg:border-b-0 lg:border-r border-slate-800/70">
        <div className="shrink-0 px-3 pt-3 pb-2.5 border-b border-slate-800/70">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[9.5px] font-semibold uppercase tracking-[0.18em] text-slate-300">
              {t('triage.queue')}
            </span>
            <div className="flex gap-1">
              {(['open', 'all'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-2 py-0.5 rounded text-[10px] transition-colors ${
                    filter === f ? 'bg-slate-700 text-slate-100' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {t(f === 'open' ? 'triage.filterOpen' : 'triage.filterAll')}
                </button>
              ))}
            </div>
          </div>

          {/* Until Catalyst Auth is wired up this is what the officer/supervisor
              split rests on. Labelled as a stand-in so nobody mistakes it for
              access control. */}
          <div className="mt-2 flex items-center gap-1.5">
            <span className="text-[9px] uppercase tracking-wider text-slate-500 shrink-0">
              {t('triage.actingAs')}
            </span>
            {(['officer', 'supervisor'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRole(r)}
                className={`px-1.5 py-0.5 rounded text-[9.5px] transition-colors ${
                  role === r ? 'bg-slate-700 text-slate-100' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {t(`triage.role.${r}`)}
              </button>
            ))}
          </div>
          {stats && (
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[9.5px] tabular-nums text-slate-500">
              {OPEN_STATUSES.map((s) => (
                <span key={s}>{t(`rstatus.${s}`)} {stats[s]}</span>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {items === null ? (
            <p className="px-3 py-3 text-[11px] text-slate-500">…</p>
          ) : items.length === 0 ? (
            <p className="px-3 py-3 text-[11px] text-slate-500">{t('triage.empty')}</p>
          ) : (
            <ul>
              {items.map((r) => (
                <li key={r.publicRef}>
                  <button
                    onClick={() => setOpenRef(r.publicRef)}
                    className={`w-full text-left px-3 py-2.5 border-b border-slate-800/50 transition-colors ${
                      openRef === r.publicRef ? 'bg-slate-700/40' : 'hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[11.5px] font-semibold tabular-nums text-slate-100">
                        {r.publicRef}
                      </span>
                      <span className="text-[9.5px] text-slate-400">{t(`rstatus.${r.status}`)}</span>
                    </div>
                    <div className="mt-0.5 text-[10.5px] text-slate-400 truncate">
                      {tc(r.category)}{r.district ? ` · ${td(r.district)}` : ''}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {r.dupOf && (
                        <span className="px-1.5 py-px rounded bg-amber-500/15 text-amber-300 text-[9px]">
                          {t('triage.dupOf').replace('{ref}', r.dupOf)}
                        </span>
                      )}
                      {(r.spamScore ?? 0) >= SPAM_FLAG_THRESHOLD && (
                        <span className="px-1.5 py-px rounded bg-red-500/15 text-red-300 text-[9px]">
                          {t('triage.spamFlag')}
                        </span>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      {/* detail */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="px-4 py-3 border-b border-slate-800/70">
          <p className="text-[10.5px] leading-relaxed text-slate-400 max-w-3xl">
            {t('triage.notAnalysis')}
          </p>
          {REPORTS_DEMO_MODE && (
            <p className="mt-1 text-[10px] text-amber-300/80">{t('report.demoBanner')}</p>
          )}
        </div>

        {!open ? (
          <p className="px-4 py-4 text-[12px] text-slate-500">{t('triage.selectHint')}</p>
        ) : (
          <div className="px-4 py-4 max-w-3xl flex flex-col gap-5">
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-[18px] font-semibold tabular-nums text-slate-50">
                {open.publicRef}
              </span>
              <span className="text-[11px] text-slate-300">{t(`rstatus.${open.status}`)}</span>
            </div>

            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
              <div>
                <dt className="text-slate-500">{t('triage.reported')}</dt>
                <dd className="text-slate-300">{fmt(open.submittedAt)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">{t('triage.incident')}</dt>
                <dd className="text-slate-300">{fmt(open.incidentAt)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">{t('report.district.label')}</dt>
                <dd className="text-slate-300">{open.district ? td(open.district) : '—'}</dd>
              </div>
              <div>
                <dt className="text-slate-500">{t('report.category.label')}</dt>
                <dd className="text-slate-300">{tc(open.category)}</dd>
              </div>
            </dl>

            <div>
              <div className="text-[9.5px] font-semibold uppercase tracking-[0.18em] text-slate-400 mb-1.5">
                {t('triage.description')}
              </div>
              <p className="text-[12.5px] leading-relaxed text-slate-200 whitespace-pre-wrap">
                {open.description}
              </p>
            </div>

            <div>
              <div className="text-[9.5px] font-semibold uppercase tracking-[0.18em] text-slate-400 mb-1.5">
                {t('triage.history')}
              </div>
              <ol className="flex flex-col gap-1">
                {open.timeline.map((e, i) => (
                  <li key={i} className="text-[11px] text-slate-400">
                    <span className="tabular-nums text-slate-500">{fmt(e.at)}</span>
                    {' — '}
                    <span className="text-slate-200">{t(`rstatus.${e.toStatus}`)}</span>
                    {e.reasonCode && <span className="text-slate-500"> · {t(`reason.${e.reasonCode}`)}</span>}
                    {e.note && <span className="text-slate-500"> · {e.note}</span>}
                  </li>
                ))}
              </ol>
            </div>

            {open.exportedAt ? (
              <p className="text-[11.5px] text-amber-300">{t('triage.sealed')}</p>
            ) : options.length === 0 ? (
              <p className="text-[11.5px] text-slate-500">{t('triage.noActions')}</p>
            ) : (
              <div className="rounded-lg border border-slate-700/70 p-3.5">
                <div className="text-[9.5px] font-semibold uppercase tracking-[0.18em] text-slate-400 mb-2.5">
                  {t('triage.action')}
                </div>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {options.map((o) => (
                    <button
                      key={o.to}
                      onClick={() => setToStatus(o.to)}
                      className={`px-2.5 py-1 rounded-md text-[11px] border transition-colors ${
                        toStatus === o.to
                          ? 'border-slate-400 bg-slate-700/60 text-slate-50'
                          : 'border-slate-700/70 text-slate-300 hover:border-slate-500'
                      }`}
                    >
                      {t(`rstatus.${o.to}`)}
                    </button>
                  ))}
                </div>

                {chosen && (
                  <div className="flex flex-col gap-2.5">
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1" htmlFor="tr-reason">
                        {t('triage.reason')}
                      </label>
                      <select
                        id="tr-reason"
                        value={reasonCode}
                        onChange={(e) => setReasonCode(e.target.value)}
                        className={inputCls}
                      >
                        <option value="">—</option>
                        {REASON_CODES.map((rc) => (
                          <option key={rc} value={rc}>{t(`reason.${rc}`)}</option>
                        ))}
                      </select>
                    </div>

                    {chosen.firRequired && (
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-1" htmlFor="tr-fir">
                          {t('triage.firNumber')}
                        </label>
                        <input
                          id="tr-fir"
                          value={firNumber}
                          onChange={(e) => setFirNumber(e.target.value)}
                          className={inputCls}
                        />
                      </div>
                    )}

                    {chosen.dupRequired && (
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-1" htmlFor="tr-dup">
                          {t('triage.dupRef')}
                        </label>
                        <input
                          id="tr-dup"
                          value={dupOf}
                          onChange={(e) => setDupOf(e.target.value)}
                          className={inputCls}
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1" htmlFor="tr-note">
                        {t('triage.note')}
                      </label>
                      <input
                        id="tr-note"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        className={inputCls}
                      />
                      <p className="mt-1 text-[10px] text-slate-500">{t('triage.noteHint')}</p>
                    </div>

                    <button
                      onClick={apply}
                      disabled={busy}
                      className="self-start px-3 py-1.5 rounded-md bg-slate-100 text-slate-900 text-[11.5px] font-semibold disabled:opacity-40"
                    >
                      {t('triage.apply')}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* the manual gate */}
            <div className="rounded-lg border border-slate-700/70 p-3.5">
              <div className="text-[9.5px] font-semibold uppercase tracking-[0.18em] text-slate-400 mb-2">
                {t('triage.export')}
              </div>
              <p className="text-[11px] leading-relaxed text-slate-400 mb-3">
                {t('triage.exportBody')}
              </p>
              {role !== 'supervisor' ? (
                <p className="text-[11px] text-amber-300">{t('triage.sealNeedsSupervisor')}</p>
              ) : !batch ? (
                <button
                  onClick={loadBatch}
                  disabled={busy}
                  className="px-3 py-1.5 rounded-md border border-slate-600 text-[11.5px] text-slate-200 disabled:opacity-40"
                >
                  {t('triage.export')}
                </button>
              ) : batch.rows.length === 0 ? (
                <p className="text-[11.5px] text-slate-500">{t('triage.exportNone')}</p>
              ) : (
                <div>
                  <ul className="mb-3 flex flex-col gap-1">
                    {batch.rows.map((r) => (
                      <li key={r.publicRef} className="text-[11px] tabular-nums text-slate-300">
                        {r.publicRef} · {r.firNumber} · {tc(r.category)}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={seal}
                    disabled={busy}
                    className="px-3 py-1.5 rounded-md bg-amber-500/90 text-slate-900 text-[11.5px] font-semibold disabled:opacity-40"
                  >
                    {t('triage.seal')}
                  </button>
                </div>
              )}
              {sealMsg && <p className="mt-2 text-[11.5px] text-emerald-300">{sealMsg}</p>}
            </div>

            {error && <p className="text-[11.5px] text-red-300">{t(error)}</p>}
          </div>
        )}
      </div>
    </div>
  )
}

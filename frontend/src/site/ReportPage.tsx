import { useEffect, useMemo, useState } from 'react'
import SiteShell from './SiteShell'
import PageHeader from './PageHeader'
import { Section } from './primitives'
import { useI18n } from '../lib/i18n'
import { CRIME_CATEGORIES } from '../lib/crimeTypes'
import { fetchJson } from '../lib/data'
import { reports, REPORTS_DEMO_MODE } from '../lib/reports'
import {
  ReportError,
  isBlockedCategory,
  type SeveritySelf,
} from '../lib/reports/types'

/* Three steps, in the order a person actually thinks: what happened, where and
   when, then who is filing it. Verification comes last on purpose — asking for
   an email address before someone has said anything loses reports. */

type Step = 'what' | 'where' | 'verify' | 'done'
type Halt = 'emergency' | 'category'

const inputCls =
  'w-full rounded-lg border border-slate-700/70 bg-slate-900/40 px-3 py-2.5 text-[14px] ' +
  'text-slate-100 placeholder:text-slate-500 focus:border-slate-500 focus:outline-none transition-colors'
const labelCls = 'block text-[12px] font-semibold text-slate-200 mb-1.5'
const hintCls = 'mt-1.5 text-[12px] leading-relaxed text-slate-500'

function errKey(e: unknown): string {
  return e instanceof ReportError ? `report.err.${e.code}` : 'report.err.SERVER'
}

/** A dead end, not a validation message. Both cases mean "do not use this form". */
function Halted({ kind, onBack }: { kind: Halt; onBack: () => void }) {
  const { t } = useI18n()
  const isEmergency = kind === 'emergency'
  return (
    <div className="site-card p-7 border-red-500/40">
      <div className="stamp !text-red-300">
        {t(isEmergency ? 'report.emergency.title' : 'report.blocked.title')}
      </div>
      <p className="mt-4 text-[15px] leading-relaxed text-slate-200">
        {t(isEmergency ? 'report.emergency.body' : 'report.blocked.body')}
      </p>
      <div className="mt-6 flex items-center gap-4">
        <a href="tel:112" className="site-btn site-btn-primary !text-[15px] !px-7">
          112
        </a>
        <button onClick={onBack} className="site-btn site-btn-ghost">
          {t('report.emergency.back')}
        </button>
      </div>
    </div>
  )
}

export default function ReportPage() {
  const { t, tc, td, lang } = useI18n()

  const [step, setStep] = useState<Step>('what')
  const [halt, setHalt] = useState<Halt | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // what
  const [category, setCategory] = useState('')
  const [severity, setSeverity] = useState<SeveritySelf | ''>('')
  const [description, setDescription] = useState('')

  // where / when
  const [districts, setDistricts] = useState<{ district: string; lat: number; lon: number }[]>([])
  const [district, setDistrict] = useState('')
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null)
  const [gpsError, setGpsError] = useState(false)
  const [incidentAt, setIncidentAt] = useState(() =>
    new Date(Date.now() - 3600_000).toISOString().slice(0, 16),
  )

  // verify
  const [email, setEmail] = useState('')
  const [challengeId, setChallengeId] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [verified, setVerified] = useState(() => !!reports.session())
  const [consent, setConsent] = useState(false)

  // done
  const [ref, setRef] = useState<string | null>(null)
  const [dupOf, setDupOf] = useState<string | null>(null)

  /* One nonce per attempt, not per click. A double submit has to resolve to the
     same report rather than two. */
  const [nonce, setNonce] = useState(() => crypto.randomUUID())

  useEffect(() => {
    fetchJson<{ district: string; lat: number; lon: number }[]>('district_centroids.json')
      .then(setDistricts)
      .catch(() => setDistricts([]))
  }, [])

  const categories = useMemo(
    () => [...CRIME_CATEGORIES].sort((a, b) => tc(a).localeCompare(tc(b))),
    [tc],
  )

  function chooseSeverity(s: SeveritySelf) {
    setSeverity(s)
    /* The hard stop. A form nobody is watching at 3 AM must never look like an
       alternative to calling. */
    if (s === 'emergency') setHalt('emergency')
  }

  function chooseCategory(c: string) {
    setCategory(c)
    if (isBlockedCategory(c)) setHalt('category')
  }

  function resetHalt() {
    if (halt === 'emergency') setSeverity('')
    if (halt === 'category') setCategory('')
    setHalt(null)
  }

  function useGps() {
    setGpsError(false)
    navigator.geolocation?.getCurrentPosition(
      (p) => setCoords({ lat: p.coords.latitude, lon: p.coords.longitude }),
      () => setGpsError(true),
      { timeout: 8000 },
    )
  }

  async function sendCode() {
    setError(null)
    setBusy(true)
    try {
      const c = await reports.requestOtp(email, lang)
      setChallengeId(c.challengeId)
    } catch (e) {
      setError(errKey(e))
    } finally {
      setBusy(false)
    }
  }

  async function verifyCode() {
    if (!challengeId) return
    setError(null)
    setBusy(true)
    try {
      await reports.verifyOtp(challengeId, code)
      setVerified(true)
    } catch (e) {
      setError(errKey(e))
    } finally {
      setBusy(false)
    }
  }

  async function submit() {
    setError(null)
    setBusy(true)
    try {
      const centre = districts.find((d) => d.district === district)
      const lat = coords?.lat ?? centre?.lat
      const lon = coords?.lon ?? centre?.lon
      if (lat == null || lon == null) {
        setError('report.err.VALIDATION')
        return
      }
      const res = await reports.submitReport({
        category,
        description,
        incidentAt: new Date(incidentAt).toISOString(),
        lat,
        lon,
        locationPrecision: coords ? 'gps' : 'address_only',
        severitySelf: (severity || 'routine') as SeveritySelf,
        lang,
        attachmentIds: [],
        clientNonce: nonce,
      })
      setRef(res.publicRef)
      setDupOf(res.dupOf ?? null)
      setStep('done')
    } catch (e) {
      setError(errKey(e))
    } finally {
      setBusy(false)
    }
  }

  function fileAnother() {
    setStep('what')
    setCategory(''); setSeverity(''); setDescription('')
    setDistrict(''); setCoords(null); setConsent(false)
    setRef(null); setDupOf(null); setError(null)
    setNonce(crypto.randomUUID())
  }

  const canLeaveWhat = category && severity && description.trim().length >= 10
  const canLeaveWhere = !!district || !!coords
  const canSubmit = verified && consent && !busy

  return (
    <SiteShell>
      <PageHeader
        stamp={t('report.stamp')}
        title={t('report.title')}
        lede={t('report.lede')}
      />

      <Section className="!pt-10">
        <div className="max-w-2xl">
          {REPORTS_DEMO_MODE && (
            <div className="mb-7 rounded-lg border border-amber-500/40 bg-amber-500/5 px-4 py-3">
              <p className="text-[13px] leading-relaxed text-amber-200">
                {t('report.demoBanner')}
              </p>
            </div>
          )}

          {halt ? (
            <Halted kind={halt} onBack={resetHalt} />
          ) : step === 'done' ? (
            <div className="site-card p-7">
              <div className="stamp !text-emerald-300">{t('report.done.title')}</div>
              <div className="mt-5 text-[12px] uppercase tracking-[0.16em] text-slate-500">
                {t('report.done.refLabel')}
              </div>
              <div className="mt-1.5 text-[28px] font-semibold tabular-nums text-slate-50">
                {ref}
              </div>
              <p className="mt-4 text-[14px] leading-relaxed text-slate-400">
                {t('report.done.body')}
              </p>
              {dupOf && (
                <p className="mt-3 text-[13px] leading-relaxed text-amber-300/90">
                  {t('report.done.dup')}
                </p>
              )}
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <a href="#/report-status" className="site-btn site-btn-primary">
                  {t('report.done.track')}
                </a>
                <button onClick={fileAnother} className="site-btn site-btn-ghost">
                  {t('report.done.another')}
                </button>
              </div>
            </div>
          ) : (
            <>
              <ol className="flex items-center gap-2 mb-8">
                {(['what', 'where', 'verify'] as Step[]).map((s, i) => {
                  const active = s === step
                  const done = (['what', 'where', 'verify'] as Step[]).indexOf(step) > i
                  return (
                    <li key={s} className="flex items-center gap-2">
                      <span
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-semibold ${
                          active
                            ? 'bg-slate-100 text-slate-900'
                            : done
                              ? 'bg-slate-700 text-slate-200'
                              : 'border border-slate-700 text-slate-500'
                        }`}
                      >
                        {i + 1}
                      </span>
                      <span
                        className={`text-[12px] ${active ? 'text-slate-100' : 'text-slate-500'}`}
                      >
                        {t(`report.step.${s}`)}
                      </span>
                      {i < 2 && <span className="w-6 h-px bg-slate-700 ml-1" />}
                    </li>
                  )
                })}
              </ol>

              {step === 'what' && (
                <div className="flex flex-col gap-6">
                  <div>
                    <label className={labelCls} htmlFor="rp-severity">
                      {t('report.severity.label')}
                    </label>
                    <div id="rp-severity" className="flex flex-col gap-2">
                      {(['emergency', 'urgent', 'routine'] as SeveritySelf[]).map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => chooseSeverity(s)}
                          className={`text-left rounded-lg border px-3.5 py-2.5 text-[14px] transition-colors ${
                            severity === s
                              ? 'border-slate-400 bg-slate-800/60 text-slate-50'
                              : 'border-slate-700/70 text-slate-300 hover:border-slate-500'
                          }`}
                        >
                          {t(`report.severity.${s}`)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className={labelCls} htmlFor="rp-category">
                      {t('report.category.label')}
                    </label>
                    <select
                      id="rp-category"
                      value={category}
                      onChange={(e) => chooseCategory(e.target.value)}
                      className={inputCls}
                    >
                      <option value="">{t('report.category.placeholder')}</option>
                      {categories.map((c) => (
                        <option key={c} value={c}>{tc(c)}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className={labelCls} htmlFor="rp-desc">
                      {t('report.description.label')}
                    </label>
                    <textarea
                      id="rp-desc"
                      rows={5}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder={t('report.description.placeholder')}
                      className={inputCls}
                    />
                    <p className={hintCls}>{t('report.description.hint')}</p>
                  </div>

                  <div>
                    <button
                      disabled={!canLeaveWhat}
                      onClick={() => setStep('where')}
                      className="site-btn site-btn-primary disabled:opacity-40"
                    >
                      {t('report.step.where')}
                    </button>
                  </div>
                </div>
              )}

              {step === 'where' && (
                <div className="flex flex-col gap-6">
                  <div>
                    <label className={labelCls} htmlFor="rp-district">
                      {t('report.district.label')}
                    </label>
                    <select
                      id="rp-district"
                      value={district}
                      onChange={(e) => setDistrict(e.target.value)}
                      className={inputCls}
                    >
                      <option value="">{t('report.district.placeholder')}</option>
                      {districts.map((d) => (
                        <option key={d.district} value={d.district}>{td(d.district)}</option>
                      ))}
                    </select>
                    <p className={hintCls}>{t('report.location.hint')}</p>
                  </div>

                  <div>
                    <button type="button" onClick={useGps} className="site-btn site-btn-ghost">
                      {t('report.location.useGps')}
                    </button>
                    {coords && (
                      <span className="ml-3 text-[12px] text-emerald-300 tabular-nums">
                        {coords.lat.toFixed(4)}, {coords.lon.toFixed(4)}
                      </span>
                    )}
                    {gpsError && (
                      <span className="ml-3 text-[12px] text-amber-300">
                        {t('report.location.gpsFailed')}
                      </span>
                    )}
                  </div>

                  <div>
                    <label className={labelCls} htmlFor="rp-when">
                      {t('report.when.label')}
                    </label>
                    <input
                      id="rp-when"
                      type="datetime-local"
                      value={incidentAt}
                      onChange={(e) => setIncidentAt(e.target.value)}
                      className={inputCls}
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <button onClick={() => setStep('what')} className="site-btn site-btn-ghost">
                      {t('report.emergency.back')}
                    </button>
                    <button
                      disabled={!canLeaveWhere}
                      onClick={() => setStep('verify')}
                      className="site-btn site-btn-primary disabled:opacity-40"
                    >
                      {t('report.step.verify')}
                    </button>
                  </div>
                </div>
              )}

              {step === 'verify' && (
                <div className="flex flex-col gap-6">
                  {!verified && (
                    <>
                      <div>
                        <label className={labelCls} htmlFor="rp-email">
                          {t('report.email.label')}
                        </label>
                        <div className="flex gap-2">
                          <input
                            id="rp-email"
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
                        <p className={hintCls}>{t('report.email.hint')}</p>
                      </div>

                      {challengeId && (
                        <div>
                          <label className={labelCls} htmlFor="rp-otp">
                            {t('report.otp.label')}
                          </label>
                          <div className="flex gap-2">
                            <input
                              id="rp-otp"
                              inputMode="numeric"
                              value={code}
                              onChange={(e) => setCode(e.target.value)}
                              className={`${inputCls} tabular-nums tracking-[0.3em]`}
                            />
                            <button
                              onClick={verifyCode}
                              disabled={busy || code.length < 6}
                              className="site-btn site-btn-primary shrink-0 disabled:opacity-40"
                            >
                              {t('report.otp.verify')}
                            </button>
                          </div>
                          {REPORTS_DEMO_MODE && (
                            <p className={hintCls}>{t('report.otp.demoHint')}</p>
                          )}
                        </div>
                      )}
                    </>
                  )}

                  {verified && (
                    <p className="text-[13px] text-emerald-300">{t('report.otp.verified')}</p>
                  )}

                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={consent}
                      onChange={(e) => setConsent(e.target.checked)}
                      className="mt-1 shrink-0"
                    />
                    <span className="text-[13px] leading-relaxed text-slate-400">
                      {t('report.consent')}
                    </span>
                  </label>

                  <div className="flex items-center gap-3">
                    <button onClick={() => setStep('where')} className="site-btn site-btn-ghost">
                      {t('report.emergency.back')}
                    </button>
                    <button
                      disabled={!canSubmit}
                      onClick={submit}
                      className="site-btn site-btn-primary disabled:opacity-40"
                    >
                      {busy ? t('report.submitting') : t('report.submit')}
                    </button>
                  </div>
                </div>
              )}

              {error && (
                <p className="mt-5 text-[13px] text-red-300">{t(error)}</p>
              )}
            </>
          )}
        </div>
      </Section>
    </SiteShell>
  )
}

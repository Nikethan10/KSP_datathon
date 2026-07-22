import { useMemo } from 'react'
import { useI18n } from '../lib/i18n'
import type { OffenderDossier } from '../lib/data'

/* The investigation workspace.

   Deliberately carries NO predictive score on the person. Everything here is
   a fact already on record — how many FIRs name them, who they were charged
   alongside, which districts, when. TRUST states that PRAHARI scores places
   and times and never people; a risk number in this header would make that
   claim false, and it is the strongest claim the project has.

   Two things a police workspace would normally show are also absent because
   the dataset does not contain them: vehicle links (no vehicle table exists
   in any of the 27 tables) and MO similarity (BriefFacts is templated text
   generated from the structured fields, so similarity over it would just be
   crime-type overlap wearing a lab coat). */

function Fact({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="text-[18px] font-semibold tabular-nums text-slate-50 leading-none">
        {value}
      </div>
      <div className="mt-1.5 text-[8.5px] font-mono-data uppercase tracking-[0.16em] text-slate-500">
        {label}
      </div>
    </div>
  )
}

function Block({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-slate-800/70 px-5 py-4">
      <div className="flex items-baseline justify-between gap-4 mb-3">
        <h3 className="text-[9.5px] font-semibold uppercase tracking-[0.18em] text-slate-300">
          {title}
        </h3>
        {note && <span className="text-[9px] text-slate-600">{note}</span>}
      </div>
      {children}
    </section>
  )
}

/** Horizontal bar, sized against the largest value in its group. */
function Bar({ label, count, peak }: { label: string; count: number; peak: number }) {
  return (
    <div className="flex items-center gap-2.5 text-[11px]">
      <span className="w-40 shrink-0 truncate text-slate-300">{label}</span>
      <div className="flex-1 h-1.5 rounded bg-slate-800/70 overflow-hidden">
        <div
          className="h-full rounded bg-slate-500"
          style={{ width: `${Math.max(4, (count / peak) * 100)}%` }}
        />
      </div>
      <span className="w-7 text-right tabular-nums text-slate-500">{count}</span>
    </div>
  )
}

const yearOf = (iso: string | null): number | null => {
  if (!iso) return null
  const y = Number(iso.slice(0, 4))
  return Number.isFinite(y) ? y : null
}

export default function InvestigationWorkspace({
  subject,
  allOffenders,
}: {
  subject: OffenderDossier
  allOffenders: OffenderDossier[]
}) {
  const { t, tc, td } = useI18n()

  const byId = useMemo(() => {
    const m = new Map<string, OffenderDossier>()
    for (const o of allOffenders) m.set(o.offender_id, o)
    return m
  }, [allOffenders])

  const firstYear = yearOf(subject.first_incident)
  const lastYear = yearOf(subject.last_incident)
  const arrestYear = yearOf(subject.last_arrest)

  const crimePeak = Math.max(...subject.crime_types.map((c) => c.count), 1)
  const districtPeak = Math.max(...subject.districts.map((d) => d.count), 1)

  const dash = (v: string | number | null | undefined) =>
    v === null || v === undefined || v === '' ? '—' : String(v)

  return (
    <div className="pb-8">
      {/* ── identity ────────────────────────────────────────────────── */}
      <header className="px-5 pt-5 pb-4">
        <h2 className="text-[20px] font-semibold text-slate-50 leading-tight">{subject.name}</h2>
        <p className="mt-1 text-[10.5px] tabular-nums text-slate-500">
          {t('workspace.idLine')
            .replace('{id}', subject.offender_id)
            .replace('{age}', dash(subject.age))}
        </p>

        <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-5">
          <Fact value={String(subject.total_cases)} label={t('workspace.fLinkedFirs')} />
          <Fact value={String(subject.n_associates)} label={t('workspace.fCoAccused')} />
          <Fact value={String(subject.n_districts)} label={t('workspace.fDistricts')} />
          <Fact value={String(subject.arrest_records)} label={t('workspace.fArrests')} />
          <Fact value={dash(subject.last_arrest)} label={t('workspace.fLastArrest')} />
          <Fact
            value={subject.career_years ? `${subject.career_years}y` : '—'}
            label={t('workspace.fSpan')}
          />
        </div>

        <p className="mt-4 text-[10px] leading-relaxed text-slate-500 max-w-2xl">
          {t('workspace.noScoreNote')}
        </p>
      </header>

      {/* ── timeline ────────────────────────────────────────────────── */}
      <Block title={t('workspace.timeline')} note={t('workspace.timelineNote')}>
        {firstYear && lastYear ? (
          <div>
            <div className="relative h-9">
              <div className="absolute left-0 right-0 top-4 h-px bg-slate-800" />
              <div
                className="absolute top-[13px] h-[3px] rounded-full bg-slate-500"
                style={{ left: '0%', right: '0%' }}
              />
              {[firstYear, arrestYear, lastYear]
                .filter((y): y is number => y !== null)
                .map((y, i, arr) => {
                  const span = Math.max(lastYear - firstYear, 1)
                  const pct = ((y - firstYear) / span) * 100
                  const isArrest = arr.length === 3 && i === 1
                  return (
                    <div
                      key={`${y}-${i}`}
                      className="absolute -translate-x-1/2 flex flex-col items-center"
                      style={{ left: `${Math.min(98, Math.max(2, pct))}%` }}
                    >
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ background: isArrest ? '#d99a3c' : '#c9a35c', marginTop: 9 }}
                      />
                      <span className="mt-1.5 text-[9px] tabular-nums text-slate-500">{y}</span>
                    </div>
                  )
                })}
            </div>
            <div className="mt-2 flex gap-5 text-[9.5px] text-slate-500">
              <span>
                {t('workspace.tFirst')} {dash(subject.first_incident)}
              </span>
              <span>
                {t('workspace.tLast')} {dash(subject.last_incident)}
              </span>
              {subject.last_arrest && (
                <span className="text-amber-500/80">
                  {t('workspace.tArrest')} {subject.last_arrest}
                </span>
              )}
            </div>
          </div>
        ) : (
          <p className="text-[11px] text-slate-500">{t('workspace.noTimeline')}</p>
        )}
      </Block>

      {/* ── associations ────────────────────────────────────────────── */}
      <Block
        title={t('workspace.associations')}
        note={t('workspace.associationsNote')}
      >
        {subject.associates.length === 0 ? (
          <p className="text-[11px] text-slate-500">{t('workspace.noAssociates')}</p>
        ) : (
          <ul className="space-y-1.5">
            {subject.associates.slice(0, 10).map((a) => {
              const linked = byId.get(a.offender_id)
              return (
                <li
                  key={a.offender_id}
                  className="flex items-baseline gap-3 text-[11px] border-b border-slate-800/40 pb-1.5 last:border-0"
                >
                  <span className="flex-1 truncate text-slate-200">{a.name}</span>
                  {linked && (
                    <span className="tabular-nums text-slate-600 shrink-0">
                      {t('workspace.aTotalCases').replace('{n}', String(linked.total_cases))}
                    </span>
                  )}
                  <span className="tabular-nums text-slate-400 shrink-0">
                    {t('workspace.aShared').replace('{n}', String(a.shared_cases))}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </Block>

      {/* ── pattern ─────────────────────────────────────────────────── */}
      <Block title={t('workspace.pattern')} note={t('workspace.patternNote')}>
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <div className="mb-2 text-[9px] uppercase tracking-[0.16em] text-slate-500">
              {t('workspace.byOffence')}
            </div>
            <div className="space-y-1.5">
              {subject.crime_types.slice(0, 6).map((c) => (
                <Bar key={c.type} label={tc(c.type)} count={c.count} peak={crimePeak} />
              ))}
            </div>
          </div>
          <div>
            <div className="mb-2 text-[9px] uppercase tracking-[0.16em] text-slate-500">
              {t('workspace.byDistrict')}
            </div>
            <div className="space-y-1.5">
              {subject.districts.slice(0, 6).map((d) => (
                <Bar key={d.district} label={td(d.district)} count={d.count} peak={districtPeak} />
              ))}
            </div>
          </div>
        </div>

        {subject.heinous_pct > 0 && (
          <p className="mt-4 text-[10.5px] text-slate-400">
            {t('workspace.heinous').replace('{n}', subject.heinous_pct.toFixed(0))}
          </p>
        )}
      </Block>
    </div>
  )
}

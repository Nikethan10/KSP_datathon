import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../lib/i18n'
import { fetchJson, type OffenderIndex, type OffenderDossier } from '../lib/data'
import { matchesName } from '../lib/districtSearch'
import InvestigationWorkspace from '../components/InvestigationWorkspace'

/* INVESTIGATE — search opens a workspace, not a result card.

   The point of this section is what happens *after* the search. An officer
   who finds a person needs their timeline, who they are linked to, where
   those links sit, and which cases connect them — on one surface, without
   navigating away. */

export default function InvestigateView() {
  const { t } = useI18n()
  const [q, setQ] = useState('')
  const [offenders, setOffenders] = useState<OffenderDossier[]>([])
  const [selected, setSelected] = useState<OffenderDossier | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    fetchJson<OffenderIndex>('offender_index.json')
      .then((d) => {
        if (!alive) return
        setOffenders(d.offenders)
        setLoading(false)
      })
      .catch(() => {
        if (!alive) return
        setFailed(true)
        setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [])

  const results = useMemo(() => {
    const query = q.trim()
    if (!query) return []
    return offenders
      .filter((o) => matchesName(o.name, query))
      .sort((a, b) => b.total_cases - a.total_cases)
      .slice(0, 40)
  }, [q, offenders])

  return (
    <div className="h-full grid grid-cols-1 lg:grid-cols-[300px_1fr] divide-x divide-slate-800/70">
      {/* ── search rail ─────────────────────────────────────────────── */}
      <aside className="flex flex-col min-h-0">
        <div className="shrink-0 px-3 pt-3 pb-2 border-b border-slate-800/70">
          <label
            htmlFor="investigate-search"
            className="block text-[9.5px] font-semibold uppercase tracking-[0.18em] text-slate-300 mb-1.5"
          >
            {t('investigate.searchLabel')}
          </label>
          <input
            id="investigate-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('investigate.searchPlaceholder')}
            className="w-full h-8 px-2.5 rounded-md border border-slate-700/70 bg-slate-900/40 text-[12px] text-slate-200 placeholder:text-slate-500 focus:border-slate-500 focus:outline-none transition-colors"
          />
          <p className="mt-1.5 text-[9.5px] leading-snug text-slate-500">
            {t('investigate.searchHint')}
          </p>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {failed ? (
            <p className="px-3 py-3 text-[11px] text-slate-500">{t('investigate.loadFailed')}</p>
          ) : loading ? (
            <p className="px-3 py-3 text-[11px] text-slate-500">{t('common.loading')}</p>
          ) : !q.trim() ? (
            <p className="px-3 py-3 text-[11px] leading-relaxed text-slate-500">
              {t('investigate.empty')}
            </p>
          ) : results.length === 0 ? (
            <p className="px-3 py-3 text-[11px] text-slate-500">{t('investigate.noResults')}</p>
          ) : (
            <ul>
              {results.map((o) => {
                const active = selected?.offender_id === o.offender_id
                return (
                  <li key={o.offender_id}>
                    <button
                      onClick={() => setSelected(o)}
                      className={`w-full text-left px-3 py-2 border-b border-slate-800/50 transition-colors ${
                        active ? 'bg-slate-700/40' : 'hover:bg-slate-800/40'
                      }`}
                    >
                      <div className="text-[12px] text-slate-200 truncate">{o.name}</div>
                      {/* Facts on record only — never a predictive score. */}
                      <div className="mt-0.5 text-[9.5px] tabular-nums text-slate-500">
                        {t('investigate.rowMeta')
                          .replace('{cases}', String(o.total_cases))
                          .replace('{districts}', String(o.n_districts))}
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </aside>

      {/* ── workspace ───────────────────────────────────────────────── */}
      <div className="min-h-0 overflow-y-auto">
        {selected ? (
          <InvestigationWorkspace subject={selected} allOffenders={offenders} />
        ) : (
          <div className="h-full flex items-center justify-center px-8">
            <p className="max-w-md text-center text-[12px] leading-relaxed text-slate-500">
              {t('investigate.placeholder')}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

import type { HotspotScope } from '../lib/data'

interface Props {
  crimeTypes: string[]
  crimeType: string | null
  onCrimeType: (t: string | null) => void
  view3D: boolean
  onView3D: (v: boolean) => void
  sigOnly: boolean
  onSigOnly: (v: boolean) => void
  scope: HotspotScope
  onScope: (s: HotspotScope) => void
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors border ${
        value
          ? 'bg-sky-500/20 border-sky-400/40 text-sky-300'
          : 'bg-transparent border-slate-600/50 text-slate-400 hover:border-slate-500'
      }`}
    >
      {label}
    </button>
  )
}

export default function FilterBar({
  crimeTypes, crimeType, onCrimeType, view3D, onView3D, sigOnly, onSigOnly,
  scope, onScope,
}: Props) {
  return (
    <div className="flex items-center gap-2">
      <select
        value={crimeType ?? ''}
        onChange={(e) => onCrimeType(e.target.value || null)}
        className="glass rounded-md px-3 py-1.5 text-xs text-slate-200 outline-none cursor-pointer max-w-56"
      >
        <option value="">All crime types</option>
        {crimeTypes.map((t) => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>
      <div
        className="glass rounded-md flex overflow-hidden"
        title="State view: cells compared against the whole-Karnataka baseline. District view: each cell compared against its own district — reveals local hotspots everywhere."
      >
        {(['state', 'district'] as HotspotScope[]).map((s) => (
          <button
            key={s}
            onClick={() => onScope(s)}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              scope === s
                ? 'bg-sky-500/25 text-sky-300'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {s === 'state' ? 'State view' : 'District view'}
          </button>
        ))}
      </div>
      <Toggle label="3D" value={view3D} onChange={onView3D} />
      <Toggle label="Significant only" value={sigOnly} onChange={onSigOnly} />
    </div>
  )
}

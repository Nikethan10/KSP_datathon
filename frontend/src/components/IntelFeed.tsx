import { useState } from 'react'
import type { FeedItem } from '../lib/insights'

interface Props {
  items: FeedItem[]
  onDistrictClick?: (district: string) => void
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#f59e0b',
  info: '#38bdf8',
}

const ICON_PATHS: Record<string, string> = {
  alert: 'M12 9v4m0 4h.01M12 2L2 22h20L12 2Z',
  trend: 'M3 17l6-6 4 4 8-8M14 7h7v7',
  network: 'M12 2a4 4 0 0 0-4 4c0 1.1.5 2.1 1.2 2.8L12 22l2.8-13.2A4 4 0 0 0 12 2Z',
  patrol: 'M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8Z',
}

export default function IntelFeed({ items, onDistrictClick }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null)

  if (items.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-xs text-slate-500">
        No active intelligence alerts
      </div>
    )
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-0.5 pr-0.5">
        {items.map((item) => {
          const color = SEVERITY_COLORS[item.severity] ?? SEVERITY_COLORS.info
          const isExpanded = expanded === item.id
          return (
            <button
              key={item.id}
              onClick={() => setExpanded(isExpanded ? null : item.id)}
              className="feed-item text-left w-full rounded-md px-2 py-1.5 border-l-2 transition-all hover:bg-slate-800/60"
              style={{ borderLeftColor: color, background: isExpanded ? 'rgba(39,44,51,0.7)' : 'transparent' }}
            >
              <div className="flex items-start gap-1.5">
                <span className="text-[9px] tabular-nums text-slate-500 shrink-0 mt-px w-14 whitespace-nowrap">
                  {item.timestamp}
                </span>
                <svg viewBox="0 0 24 24" width="11" height="11" fill="none" className="shrink-0 mt-0.5" aria-hidden>
                  <path d={ICON_PATHS[item.icon] ?? ICON_PATHS.alert} stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] text-slate-200 leading-snug">{item.title}</div>
                  {isExpanded && (
                    <div className="mt-1 text-[9.5px] text-slate-400 leading-snug">
                      {item.detail}
                      {onDistrictClick && (
                        <span
                          onClick={(e) => { e.stopPropagation(); onDistrictClick(item.district) }}
                          className="ml-1.5 text-sky-400 hover:text-sky-300 cursor-pointer"
                        >
                          View district →
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

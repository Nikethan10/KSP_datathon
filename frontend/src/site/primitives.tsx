import type { ReactNode } from 'react'
import { useReveal } from '../lib/useReveal'

/* Shared furniture for the site surface. Every section carries a monospace
   file stamp and a hairline rule that draws itself — the "declassified
   dossier" motif that separates this surface from the console. */

export function Section({
  id,
  stamp,
  title,
  lede,
  children,
  className = '',
}: {
  id?: string
  stamp?: string
  title?: ReactNode
  lede?: ReactNode
  children?: ReactNode
  className?: string
}) {
  const ref = useReveal<HTMLElement>()
  return (
    <section id={id} ref={ref} className={`reveal site-wrap py-20 md:py-28 ${className}`}>
      {(stamp || title) && (
        <header className="max-w-3xl">
          {stamp && <div className="stamp">{stamp}</div>}
          {stamp && <div className="rule-scan mt-3 mb-7" />}
          {title && (
            <h2 className="text-[clamp(26px,4vw,40px)] font-semibold text-slate-50 leading-[1.12]">
              {title}
            </h2>
          )}
          {lede && (
            <p className="mt-5 text-[15px] md:text-[16px] leading-relaxed text-slate-400">{lede}</p>
          )}
        </header>
      )}
      {children}
    </section>
  )
}

/** Wraps any block so it reveals on scroll, with an optional stagger. */
export function Reveal({
  delay = 0,
  className = '',
  children,
}: {
  delay?: number
  className?: string
  children: ReactNode
}) {
  const ref = useReveal<HTMLDivElement>()
  return (
    <div
      ref={ref}
      className={`reveal ${className}`}
      style={{ ['--reveal-delay' as string]: `${delay}ms` }}
    >
      {children}
    </div>
  )
}

/** A figure that a brass redaction bar wipes off when it scrolls into view. */
export function RedactedFigure({
  value,
  label,
  note,
  delay = 0,
}: {
  value: string
  label: string
  note?: string
  delay?: number
}) {
  return (
    <Reveal delay={delay} className="site-card p-6">
      <div className="redact inline-block">
        <span className="redact-bar" />
        <span className="block text-[clamp(30px,4.4vw,44px)] font-semibold tabular-nums text-slate-50 leading-none">
          {value}
        </span>
      </div>
      <div className="mt-4 text-[12px] font-cond uppercase tracking-[0.16em] text-slate-300">
        {label}
      </div>
      {note && <div className="mt-1.5 text-[12px] leading-relaxed text-slate-500">{note}</div>}
    </Reveal>
  )
}

/** Dossier-style card: monospace index, title, body. No icons, no emoji.

    `compact` keeps the index, meta and title but moves the body to a native
    tooltip. Eleven of these with full bodies made one grid taller than the rest
    of the page put together; the index and title still carry the claim, and the
    elaboration is one hover away — the same trade FilterBar already makes with
    `sense.scopeTooltip`. */
export function DossierCard({
  index,
  title,
  body,
  meta,
  delay = 0,
  muted = false,
  compact = false,
}: {
  index: string
  title: string
  body: string
  meta?: string
  delay?: number
  muted?: boolean
  compact?: boolean
}) {
  return (
    <Reveal delay={delay} className="h-full">
      <article
        title={compact ? body : undefined}
        className={`site-card h-full flex flex-col ${compact ? 'p-4' : 'p-6'} ${
          muted ? 'opacity-70' : ''
        }`}
      >
        <div className="flex items-baseline justify-between gap-3">
          <span className="stamp">{index}</span>
          {meta && (
            <span className="text-[9px] font-mono-data uppercase tracking-[0.18em] text-slate-500 shrink-0">
              {meta}
            </span>
          )}
        </div>
        <h3
          className={`font-semibold text-slate-100 leading-snug ${
            compact ? 'mt-2.5 text-[14px]' : 'mt-4 text-[16px]'
          }`}
        >
          {title}
        </h3>
        {!compact && (
          <p className="mt-3 text-[13.5px] leading-relaxed text-slate-400">{body}</p>
        )}
      </article>
    </Reveal>
  )
}

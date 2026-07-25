import type { ReactNode } from 'react'
import { useReveal } from '../lib/useReveal'

export default function PageHeader({
  stamp,
  title,
  lede,
}: {
  stamp: string
  title: ReactNode
  lede: ReactNode
}) {
  const ref = useReveal<HTMLDivElement>()
  return (
    <div ref={ref} className="reveal site-grid relative overflow-hidden border-b border-slate-800/70">
      <div className="site-wrap relative pt-16 pb-14 md:pt-24 md:pb-20">
        <div className="stamp">{stamp}</div>
        <div className="rule-scan mt-3 mb-7 max-w-md" />
        <h1 className="text-[clamp(30px,5vw,52px)] font-semibold text-slate-50 leading-[1.06] max-w-3xl">
          {title}
        </h1>
        <p className="mt-6 text-[16px] leading-relaxed text-slate-400 max-w-2xl">{lede}</p>
      </div>
    </div>
  )
}

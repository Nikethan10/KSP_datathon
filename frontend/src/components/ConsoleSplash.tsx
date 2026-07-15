import { useState } from 'react'
import SentinelMark from './SentinelMark'

/* Shown while the console chunk (deck.gl + maplibre + three, ~610 KB gzip)
   downloads. Never waited on -- it is torn down the moment the console is
   ready, typically after 1-3 s of a 6 s clip.

   Sizing history worth keeping: the supplied clip was 10 s / 2.7 MB, and
   at that size it competed with the console chunk and pushed its load from
   6.9 s to 10.3 s -- the loading animation was making loading slower. It is
   now re-encoded to 6 s / 960px / ~110 KB (make_brand_assets notes; see
   the ffmpeg call in the session log), which is smaller than the CSS
   bundle and cannot meaningfully contend for bandwidth.

   Do not add <link rel="prefetch"> for the clip: measured, it was not
   reused by this element and simply downloaded the file a second time.

   The brand layer underneath renders immediately and the video fades in
   only once it can play, so a slow or blocked video degrades to a composed
   splash rather than a black rectangle. */
export default function ConsoleSplash() {
  const [videoReady, setVideoReady] = useState(false)
  const base = import.meta.env.BASE_URL

  return (
    <div className="absolute inset-0 z-50 overflow-hidden bg-[#15181c]">
      <video
        className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700"
        style={{ opacity: videoReady ? 0.7 : 0 }}
        src={`${base}brand/loading.mp4`}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        onCanPlay={() => setVideoReady(true)}
        aria-hidden
      />

      {/* keeps the brand legible over whatever frame is showing */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 70% 60% at 50% 50%, rgba(21,24,28,0.35), rgba(21,24,28,0.88) 75%)',
        }}
      />

      <div className="relative h-full flex flex-col items-center justify-center gap-5">
        <SentinelMark size={64} />
        <div className="flex flex-col items-center gap-3">
          <span className="text-[17px] font-bold tracking-[0.2em] text-slate-100">
            PRAHARI <span className="brand-accent">ಪ್ರಹರಿ</span>
          </span>
          <span className="text-[10px] font-mono-data uppercase tracking-[0.34em] text-slate-400">
            Initialising console<span className="caret">_</span>
          </span>
        </div>
        <div className="w-40 h-px overflow-hidden bg-slate-700/50 rounded-full">
          <div className="splash-bar h-full w-1/3 rounded-full" style={{ background: 'var(--brand)' }} />
        </div>
      </div>
    </div>
  )
}

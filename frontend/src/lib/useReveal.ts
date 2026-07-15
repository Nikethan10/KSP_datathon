import { useEffect, useRef } from 'react'

/* Reveal-on-scroll for the site surface.

   `.reveal` starts at opacity 0, so a reveal that never runs means
   invisible content — the failure mode is a blank page, not a missing
   flourish. IntersectionObserver is the usual tool here but it depends on
   the page compositing, which is not guaranteed in background tabs,
   prerenderers, or embedded webviews.

   So this uses a plain geometry check driven by one shared scroll
   listener. At ~40 elements the cost is irrelevant, and it is correct
   everywhere: if scripting runs at all, the content becomes visible. */

const watched = new Set<HTMLElement>()
let listening = false
let queued = false

function flush() {
  queued = false
  const vh = window.innerHeight
  for (const el of watched) {
    // Top edge is the only test needed: anything above the fold has either
    // entered view or been scrolled past, and both should be visible.
    if (el.getBoundingClientRect().top < vh * 0.92) {
      el.classList.add('in')
      watched.delete(el)
    }
  }
  if (watched.size === 0) stop()
}

function schedule() {
  if (queued) return
  queued = true
  // Coalesce bursts of scroll events into one layout read. A timer rather
  // than rAF on purpose — rAF is suspended wherever the page is not
  // painting, which is precisely where a stalled reveal hides content.
  setTimeout(flush, 16)
}

function start() {
  if (listening) return
  listening = true
  window.addEventListener('scroll', schedule, { passive: true })
  window.addEventListener('resize', schedule, { passive: true })
}

function stop() {
  if (!listening) return
  listening = false
  window.removeEventListener('scroll', schedule)
  window.removeEventListener('resize', schedule)
}

export function useReveal<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    // Anything already on screen reveals right away — no scroll required,
    // and no dependency on a frame ever being painted. An element with no
    // layout yet reports top 0 and reveals too, which is the safe default.
    if (el.getBoundingClientRect().top < window.innerHeight) {
      el.classList.add('in')
      return
    }

    watched.add(el)
    start()
    return () => {
      watched.delete(el)
      if (watched.size === 0) stop()
    }
  }, [])

  return ref
}

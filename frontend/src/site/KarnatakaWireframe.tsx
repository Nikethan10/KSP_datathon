import { useEffect, useRef } from 'react'
import { fetchJson } from '../lib/data'
import type { DistrictCentroid } from '../lib/data'

type Ring = [number, number][]

interface GeoFeature {
  geometry: { type: string; coordinates: unknown }
}
interface GeoJson {
  features: GeoFeature[]
}

/* Karnataka drawn as a brass hairline survey plot, with hotspot cells
   igniting across it in sequence. Canvas 2D on purpose: the landing route
   must not pull in deck.gl (~800 kB) just to draw an outline.

   No real hotspot geometry is used here — the ignition points are district
   centroids, so nothing case-level or personal reaches the public page. */
export default function KarnatakaWireframe({ className = '' }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf = 0
    let disposed = false
    let rings: Ring[] = []
    let points: { lon: number; lat: number; phase: number; weight: number }[] = []

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const collectRings = (geo: GeoJson) => {
      const out: Ring[] = []
      for (const f of geo.features) {
        const { type, coordinates } = f.geometry
        if (type === 'Polygon') {
          for (const r of coordinates as Ring[]) out.push(r)
        } else if (type === 'MultiPolygon') {
          for (const poly of coordinates as Ring[][]) for (const r of poly) out.push(r)
        }
      }
      return out
    }

    // Fit the whole state into the canvas box, preserving aspect.
    let bounds = { minLon: 74, maxLon: 78.6, minLat: 11.5, maxLat: 18.5 }
    const computeBounds = () => {
      let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity
      for (const r of rings) {
        for (const [lon, lat] of r) {
          if (lon < minLon) minLon = lon
          if (lon > maxLon) maxLon = lon
          if (lat < minLat) minLat = lat
          if (lat > maxLat) maxLat = lat
        }
      }
      if (Number.isFinite(minLon)) bounds = { minLon, maxLon, minLat, maxLat }
    }

    let project = (lon: number, lat: number): [number, number] => [lon, lat]

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      if (!w || !h) return
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      const { minLon, maxLon, minLat, maxLat } = bounds
      const pad = 0.06
      const spanLon = maxLon - minLon || 1
      const spanLat = maxLat - minLat || 1
      // latitude compressed slightly so the state reads as a map, not a stretch
      const scale = Math.min((w * (1 - pad * 2)) / spanLon, (h * (1 - pad * 2)) / spanLat)
      const offX = (w - spanLon * scale) / 2
      const offY = (h - spanLat * scale) / 2
      project = (lon, lat) => [
        offX + (lon - minLon) * scale,
        offY + (maxLat - lat) * scale,
      ]
    }

    const draw = (now: number) => {
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      ctx.clearRect(0, 0, w, h)

      // district hairlines
      ctx.lineWidth = 1
      ctx.strokeStyle = 'rgba(201, 163, 92, 0.22)'
      for (const r of rings) {
        ctx.beginPath()
        for (let i = 0; i < r.length; i++) {
          const [x, y] = project(r[i][0], r[i][1])
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.stroke()
      }

      // hotspot cells igniting on a slow loop
      const cycle = 7000
      for (const p of points) {
        const [x, y] = project(p.lon, p.lat)
        let a: number
        if (reduced) {
          a = 0.45
        } else {
          const t = ((now / cycle + p.phase) % 1)
          // quick ignite, long decay
          a = t < 0.12 ? t / 0.12 : Math.max(0, 1 - (t - 0.12) / 0.55)
        }
        if (a <= 0.01) continue

        const r = 1.6 + p.weight * 3.2
        const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 5)
        glow.addColorStop(0, `rgba(201, 163, 92, ${0.34 * a})`)
        glow.addColorStop(1, 'rgba(201, 163, 92, 0)')
        ctx.fillStyle = glow
        ctx.beginPath()
        ctx.arc(x, y, r * 5, 0, Math.PI * 2)
        ctx.fill()

        ctx.fillStyle = `rgba(226, 196, 138, ${0.85 * a})`
        ctx.beginPath()
        ctx.arc(x, y, r, 0, Math.PI * 2)
        ctx.fill()
      }

      if (!disposed) raf = requestAnimationFrame(draw)
    }

    const onResize = () => {
      resize()
      // Repaint straight away rather than waiting on the loop, which may be
      // suspended if the page is not currently painting. Cancel the pending
      // frame first so draw() does not fork a second loop.
      if (rings.length) {
        cancelAnimationFrame(raf)
        draw(performance.now())
      }
    }

    Promise.all([
      fetchJson<GeoJson>('karnataka_districts.json'),
      fetchJson<DistrictCentroid[]>('district_centroids.json'),
    ])
      .then(([geo, centroids]) => {
        if (disposed) return
        rings = collectRings(geo)
        computeBounds()
        points = centroids.map((c, i) => ({
          lon: c.lon,
          lat: c.lat,
          phase: (i * 0.137) % 1,
          weight: 0.3 + ((i * 37) % 100) / 140,
        }))
        resize()
        // Paint once synchronously so the outline exists even where frames
        // never come (background tab, prerender, reduced motion), then
        // hand over to the animation loop.
        draw(0)
      })
      .catch(() => {
        /* leave the canvas empty — the hero reads fine without it */
      })

    window.addEventListener('resize', onResize)
    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={`w-full h-full ${className}`}
    />
  )
}

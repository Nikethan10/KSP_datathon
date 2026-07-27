import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import { MapboxOverlay } from '@deck.gl/mapbox'
import { ScatterplotLayer } from '@deck.gl/layers'
import { KARNATAKA_CENTER, KARNATAKA_ZOOM } from '../lib/data'
import { loadKarnatakaOverlay, karnatakaMaskLayers } from '../lib/basemap'
import type { KarnatakaOverlay } from '../lib/basemap'

/* [lon, lat, risk] and [lon, lat, dayOfWeek] — packed as tuples rather than
   objects because a week ships a few thousand of each. */
export type ReplayCell = [number, number, number]
/** [lon, lat, dayOfWeek, captured] — capture decided in backtest.py */
export type ReplayIncident = [number, number, number, 0 | 1]

interface Props {
  cells: ReplayCell[]
  incidents: ReplayIncident[]
  /** 0-6; incidents up to and including this day are revealed */
  revealDay: number
  /** true once every day has been revealed */
  complete: boolean
}

const OSM_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '&copy; OpenStreetMap contributors',
    },
  },
  layers: [
    {
      id: 'osm',
      type: 'raster',
      source: 'osm',
      paint: {
        'raster-saturation': -0.85,
        'raster-brightness-max': 0.55,
        'raster-contrast': 0.15,
      },
    },
  ],
}

export default function ReplayMap({ cells, incidents, revealDay, complete }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const overlayRef = useRef<MapboxOverlay | null>(null)
  const [overlay, setOverlay] = useState<KarnatakaOverlay | null>(null)

  useEffect(() => {
    loadKarnatakaOverlay().then(setOverlay).catch(() => {})
  }, [])

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: OSM_STYLE,
      center: KARNATAKA_CENTER,
      zoom: KARNATAKA_ZOOM,
      attributionControl: false,
    })
    map.addControl(new maplibregl.NavigationControl(), 'bottom-right')
    const deck = new MapboxOverlay({ layers: [] })
    map.addControl(deck)
    mapRef.current = map
    overlayRef.current = deck
    return () => {
      overlayRef.current = null
      mapRef.current = null
      map.remove()
    }
  }, [])

  useEffect(() => {
    const deck = overlayRef.current
    if (!deck) return

    const shown = incidents.filter((i) => i[2] <= revealDay)

    deck.setProps({
      layers: [
        ...karnatakaMaskLayers(overlay),

        /* The forecast, drawn first and left standing. Brass, low opacity —
           it is the backdrop the week plays out against, not the subject. */
        new ScatterplotLayer<ReplayCell>({
          id: 'replay-forecast',
          data: cells,
          getPosition: (d) => [d[0], d[1]],
          getRadius: 900,
          radiusUnits: 'meters',
          getFillColor: [201, 163, 92, 58],
          getLineColor: [201, 163, 92, 120],
          lineWidthMinPixels: 0.5,
          stroked: true,
          filled: true,
          pickable: false,
        }),

        /* What actually happened. Red outside the forecast, green inside —
           so a judge reads hit and miss without consulting a legend. */
        new ScatterplotLayer<ReplayIncident>({
          id: 'replay-actual',
          data: shown,
          getPosition: (d) => [d[0], d[1]],
          getRadius: complete ? 260 : 320,
          radiusUnits: 'meters',
          radiusMinPixels: 1.6,
          getFillColor: (d) => (d[3] ? [94, 201, 138, 205] : [229, 72, 77, 205]),
          pickable: false,
          updateTriggers: { getRadius: [complete] },
        }),
      ],
    })
  }, [cells, incidents, revealDay, complete, overlay])

  /* maplibre-gl.css sets `.maplibregl-map { position: relative }`, which beats
     an `absolute inset-0` class on the same element and collapses it to zero
     height. Inline width/height on an inner div is how the other maps here
     avoid it. */
  return (
    <div className="absolute inset-0">
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import { MapboxOverlay } from '@deck.gl/mapbox'
import { ArcLayer, PathLayer, ScatterplotLayer } from '@deck.gl/layers'
import { KARNATAKA_CENTER, KARNATAKA_ZOOM } from '../lib/data'
import { loadKarnatakaOverlay, karnatakaMaskLayers } from '../lib/basemap'
import type { KarnatakaOverlay } from '../lib/basemap'
import type { Spree, Corridor } from '../lib/data'

interface Props {
  sprees: Spree[]
  corridors: Corridor[]
  showSprees: boolean
  showCorridors: boolean
  selectedSpree: number | null
  flyTarget: { lat: number; lon: number; zoom?: number } | null
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

interface SpreePath {
  spree_id: number
  crime_type: string
  n_cases: number
  path: [number, number][]
}

export default function PatternsMap({
  sprees, corridors, showSprees, showCorridors, selectedSpree, flyTarget,
}: Props) {
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
    })
    map.addControl(new maplibregl.NavigationControl(), 'bottom-right')
    const overlay = new MapboxOverlay({ layers: [] })
    map.addControl(overlay)
    mapRef.current = map
    overlayRef.current = overlay
    return () => {
      overlayRef.current = null
      mapRef.current = null
      map.remove()
    }
  }, [])

  useEffect(() => {
    const deckOverlay = overlayRef.current
    if (!deckOverlay) return

    const maxOffenders = Math.max(1, ...corridors.map((c) => c.n_offenders))

    const spreePaths: SpreePath[] = sprees.map((s) => ({
      spree_id: s.spree_id,
      crime_type: s.crime_type,
      n_cases: s.n_cases,
      path: s.points.map((p) => [p.lon, p.lat] as [number, number]),
    }))

    const spreePoints = sprees.flatMap((s) =>
      s.points.map((p) => ({ ...p, spree_id: s.spree_id, crime_type: s.crime_type })),
    )

    const isSel = (id: number) => selectedSpree === null || selectedSpree === id

    const layers = [
      ...karnatakaMaskLayers(overlay),
      ...(showCorridors
        ? [
            new ArcLayer<Corridor>({
              id: 'corridors',
              data: corridors,
              getSourcePosition: (d) => [d.from_lon, d.from_lat],
              getTargetPosition: (d) => [d.to_lon, d.to_lat],
              getSourceColor: [201, 163, 92, 190],
              getTargetColor: [232, 121, 249, 190],
              getWidth: (d) => 1 + (d.n_offenders / maxOffenders) * 7,
              widthUnits: 'pixels',
              getHeight: 0.35,
              pickable: true,
            }),
          ]
        : []),
      ...(showSprees
        ? [
            new PathLayer<SpreePath>({
              id: 'spree-paths',
              data: spreePaths,
              getPath: (d) => d.path,
              getColor: (d) => (isSel(d.spree_id) ? [251, 146, 60, 210] : [251, 146, 60, 45]),
              getWidth: (d) => (selectedSpree === d.spree_id ? 3.2 : 1.8),
              widthUnits: 'pixels',
              pickable: true,
            }),
            new ScatterplotLayer({
              id: 'spree-points',
              data: spreePoints,
              getPosition: (d) => [d.lon, d.lat],
              getRadius: (d) => (selectedSpree === d.spree_id ? 340 : 220),
              radiusUnits: 'meters' as const,
              getFillColor: (d) =>
                isSel(d.spree_id) ? [239, 68, 68, 230] : [239, 68, 68, 55],
              stroked: true,
              getLineColor: [255, 255, 255, 160],
              getLineWidth: 0.8,
              lineWidthUnits: 'pixels' as const,
              pickable: true,
            }),
          ]
        : []),
    ]

    deckOverlay.setProps({
      layers,
      getTooltip: ({ object }: { object?: Corridor | SpreePath | (Spree['points'][number] & { spree_id: number; crime_type: string }) }) => {
        if (!object) return null
        const style = {
          background: 'rgba(29,33,38,0.96)',
          color: '#e6edf3',
          borderRadius: '6px',
          border: '1px solid rgba(201,163,92,0.28)',
        }
        if ('from_district' in object) {
          return {
            html: `<div style="font-family:ui-sans-serif,system-ui;font-size:12px">
              <div style="font-weight:600">${object.from_district} ↔ ${object.to_district}</div>
              <div>${object.n_offenders} offenders · ${object.n_transitions} movements</div>
            </div>`,
            style,
          }
        }
        if ('path' in object) {
          return {
            html: `<div style="font-family:ui-sans-serif,system-ui;font-size:12px">
              <div style="font-weight:600">Spree #${object.spree_id} — ${object.crime_type}</div>
              <div>${object.n_cases} linked cases</div>
            </div>`,
            style,
          }
        }
        return {
          html: `<div style="font-family:ui-sans-serif,system-ui;font-size:12px">
            <div style="font-weight:600">Spree #${object.spree_id}</div>
            <div>${object.crime_type} · ${object.date}</div>
          </div>`,
          style,
        }
      },
    })
  }, [sprees, corridors, showSprees, showCorridors, selectedSpree, overlay])

  useEffect(() => {
    if (!flyTarget || !mapRef.current) return
    mapRef.current.flyTo({
      center: [flyTarget.lon, flyTarget.lat],
      zoom: flyTarget.zoom ?? 11.5,
      duration: 1500,
      essential: true,
    })
  }, [flyTarget])

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  )
}

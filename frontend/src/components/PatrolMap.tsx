import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import { MapboxOverlay } from '@deck.gl/mapbox'
import { HeatmapLayer } from '@deck.gl/aggregation-layers'
import { ScatterplotLayer, TextLayer } from '@deck.gl/layers'
import type { RiskCell, PatrolAllocation } from '../lib/data'

interface Props {
  cells: RiskCell[]
  patrols: PatrolAllocation[]
  radiusKm: number
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
        // darker, near-neutral base so the risk field and the white beat rings
        // both read clearly (city tiles are much lighter at this zoom)
        'raster-saturation': -0.92,
        'raster-brightness-max': 0.38,
        'raster-contrast': 0.1,
      },
    },
  ],
}

// ACT view opens on the deployment scope: Bengaluru City
const BENGALURU: [number, number] = [77.59, 12.97]

export default function PatrolMap({ cells, patrols, radiusKm, flyTarget }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const overlayRef = useRef<MapboxOverlay | null>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: OSM_STYLE,
      center: BENGALURU,
      zoom: 10.8,
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
    const overlay = overlayRef.current
    if (!overlay) return

    const layers = [
      // risk field — context underneath, so it must not shout over the beats
      new HeatmapLayer<RiskCell>({
        id: 'risk-heat',
        data: cells,
        getPosition: (d) => [d.cell_lon, d.cell_lat],
        getWeight: (d) => d.mean_risk,
        radiusPixels: 62,      // wider kernel -> smooth field instead of dotty blobs
        intensity: 0.85,
        threshold: 0.06,
        opacity: 0.72,
        colorRange: [
          // cool end: muted slate-blue -> olive-teal (no navy, no cyan)
          [59, 80, 92, 55],
          [91, 122, 140, 95],
          [92, 138, 110, 125],
          // hot end keeps its hue (real risk magnitude), eased back in alpha
          [250, 204, 21, 150],
          [249, 115, 22, 180],
          [239, 68, 68, 215],
        ],
      }),
      // dark casing under the beat ring — keeps it legible over red/orange heat
      new ScatterplotLayer<PatrolAllocation>({
        id: 'patrol-cover-casing',
        data: patrols,
        getPosition: (d) => [d.center_lon, d.center_lat],
        getRadius: radiusKm * 1000,
        radiusUnits: 'meters',
        stroked: true,
        filled: false,
        getLineColor: [8, 10, 13, 205],
        getLineWidth: 5,
        lineWidthUnits: 'pixels',
      }),
      // patrol coverage circles (true metres). Warm off-white, NOT brass —
      // brass sits in the same hue band as the heatmap's yellow and vanishes.
      new ScatterplotLayer<PatrolAllocation>({
        id: 'patrol-cover',
        data: patrols,
        getPosition: (d) => [d.center_lon, d.center_lat],
        getRadius: radiusKm * 1000,
        radiusUnits: 'meters',
        stroked: true,
        filled: true,
        getFillColor: [201, 163, 92, 20],
        getLineColor: [244, 239, 230, 255],
        getLineWidth: 2.4,
        lineWidthUnits: 'pixels',
        pickable: true,
      }),
      // patrol centre dots — white core in a dark casing reads on any background
      new ScatterplotLayer<PatrolAllocation>({
        id: 'patrol-dot',
        data: patrols,
        getPosition: (d) => [d.center_lon, d.center_lat],
        getRadius: 7.5,
        radiusUnits: 'pixels',
        getFillColor: [244, 239, 230, 255],
        stroked: true,
        getLineColor: [8, 10, 13, 255],
        getLineWidth: 2.5,
        lineWidthUnits: 'pixels',
      }),
      new TextLayer<PatrolAllocation>({
        id: 'patrol-label',
        data: patrols,
        getPosition: (d) => [d.center_lon, d.center_lat],
        getText: (d) => `P${d.patrol_id}`,
        getSize: 13,
        getColor: [255, 255, 255, 255],
        getPixelOffset: [0, -18],
        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        fontWeight: 700,
        outlineWidth: 3,
        outlineColor: [10, 14, 20, 255],
      }),
    ]

    overlay.setProps({
      layers,
      getTooltip: ({ object }: { object?: PatrolAllocation }) => {
        if (!object || !('patrol_id' in object)) return null
        const area = Math.PI * radiusKm * radiusKm // km²
        const circ = 2 * Math.PI * radiusKm // km (beat perimeter)
        return {
          html: `<div style="font-family:ui-sans-serif,system-ui;font-size:12px;line-height:1.5">
            <div style="font-weight:600">Patrol ${object.patrol_id}</div>
            <div style="color:#c9a35c">beat: ${radiusKm.toFixed(1)} km radius &middot; ${area.toFixed(1)} km²</div>
            <div style="color:#8a939e;font-size:11px">Ø ${(radiusKm * 2).toFixed(1)} km across &middot; ${circ.toFixed(1)} km perimeter</div>
            <div style="margin-top:2px">${object.cells_covered} hot cells &middot; risk ${object.risk_covered.toFixed(1)}</div>
          </div>`,
          style: {
            background: 'rgba(29,33,38,0.96)',
            color: '#e6edf3',
            borderRadius: '6px',
            border: '1px solid rgba(201,163,92,0.28)',
          },
        }
      },
    })
  }, [cells, patrols, radiusKm])

  useEffect(() => {
    if (!flyTarget || !mapRef.current) return
    mapRef.current.flyTo({
      center: [flyTarget.lon, flyTarget.lat],
      zoom: flyTarget.zoom ?? 12.5,
      duration: 1400,
      essential: true,
    })
  }, [flyTarget])

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  )
}

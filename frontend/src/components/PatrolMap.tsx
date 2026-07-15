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
        'raster-saturation': -0.85,
        'raster-brightness-max': 0.55,
        'raster-contrast': 0.15,
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
      new HeatmapLayer<RiskCell>({
        id: 'risk-heat',
        data: cells,
        getPosition: (d) => [d.cell_lon, d.cell_lat],
        getWeight: (d) => d.mean_risk,
        radiusPixels: 50,
        intensity: 1.2,
        threshold: 0.05,
        colorRange: [
          [30, 58, 138, 70],
          [14, 116, 144, 120],
          [16, 185, 129, 150],
          [250, 204, 21, 185],
          [249, 115, 22, 215],
          [239, 68, 68, 255],
        ],
      }),
      // patrol coverage circles (true metres)
      new ScatterplotLayer<PatrolAllocation>({
        id: 'patrol-cover',
        data: patrols,
        getPosition: (d) => [d.center_lon, d.center_lat],
        getRadius: radiusKm * 1000,
        radiusUnits: 'meters',
        stroked: true,
        filled: true,
        getFillColor: [56, 189, 248, 25],
        getLineColor: [125, 211, 252, 220],
        getLineWidth: 2,
        lineWidthUnits: 'pixels',
        pickable: true,
      }),
      // patrol centre dots
      new ScatterplotLayer<PatrolAllocation>({
        id: 'patrol-dot',
        data: patrols,
        getPosition: (d) => [d.center_lon, d.center_lat],
        getRadius: 7,
        radiusUnits: 'pixels',
        getFillColor: [14, 165, 233, 255],
        stroked: true,
        getLineColor: [255, 255, 255, 230],
        getLineWidth: 1.5,
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
      getTooltip: ({ object }: { object?: PatrolAllocation }) =>
        object && 'patrol_id' in object
          ? {
              html: `<div style="font-family:ui-sans-serif,system-ui;font-size:12px">
                <div style="font-weight:600">Patrol ${object.patrol_id}</div>
                <div>${object.cells_covered} cells &middot; risk ${object.risk_covered.toFixed(1)}</div>
              </div>`,
              style: {
                background: 'rgba(13,17,23,0.92)',
                color: '#e6edf3',
                borderRadius: '6px',
                border: '1px solid rgba(56,189,248,0.25)',
              },
            }
          : null,
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

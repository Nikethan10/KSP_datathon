import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import { MapboxOverlay } from '@deck.gl/mapbox'
import { HeatmapLayer } from '@deck.gl/aggregation-layers'
import { ScatterplotLayer } from '@deck.gl/layers'
import { KARNATAKA_CENTER, KARNATAKA_ZOOM } from '../lib/data'
import type { RiskCell } from '../lib/data'

interface Props {
  cells: RiskCell[]
  showPriority: boolean
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

export default function RiskMap({ cells, showPriority, flyTarget }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const overlayRef = useRef<MapboxOverlay | null>(null)

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
    const overlay = overlayRef.current
    if (!overlay || cells.length === 0) return

    // top 5% cells by predicted risk = "priority cells" (the PAI story)
    const sorted = [...cells].sort((a, b) => b.mean_risk - a.mean_risk)
    const priority = sorted.slice(0, Math.ceil(cells.length * 0.05))

    const layers = [
      new HeatmapLayer<RiskCell>({
        id: 'risk-heat',
        data: cells,
        getPosition: (d) => [d.cell_lon, d.cell_lat],
        getWeight: (d) => d.mean_risk,
        radiusPixels: 42,
        intensity: 1.15,
        threshold: 0.04,
        colorRange: [
          [30, 58, 138, 90],
          [14, 116, 144, 140],
          [16, 185, 129, 170],
          [250, 204, 21, 200],
          [249, 115, 22, 225],
          [239, 68, 68, 255],
        ],
      }),
      ...(showPriority
        ? [
            new ScatterplotLayer<RiskCell>({
              id: 'priority-cells',
              data: priority,
              getPosition: (d) => [d.cell_lon, d.cell_lat],
              getRadius: 600,
              radiusUnits: 'meters' as const,
              stroked: true,
              filled: false,
              getLineColor: [248, 250, 252, 200],
              getLineWidth: 1.4,
              lineWidthUnits: 'pixels' as const,
              pickable: true,
            }),
          ]
        : []),
    ]

    overlay.setProps({
      layers,
      getTooltip: ({ object }: { object?: RiskCell }) =>
        object
          ? {
              html: `<div style="font-family:ui-sans-serif,system-ui;font-size:12px">
                <div style="font-weight:600">Priority cell</div>
                <div>risk score ${object.mean_risk.toFixed(3)}</div>
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
  }, [cells, showPriority])

  useEffect(() => {
    if (!flyTarget || !mapRef.current) return
    mapRef.current.flyTo({
      center: [flyTarget.lon, flyTarget.lat],
      zoom: flyTarget.zoom ?? 9.5,
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

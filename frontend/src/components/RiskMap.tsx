import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import { MapboxOverlay } from '@deck.gl/mapbox'
import { HeatmapLayer } from '@deck.gl/aggregation-layers'
import { ScatterplotLayer } from '@deck.gl/layers'
import { KARNATAKA_CENTER, KARNATAKA_ZOOM } from '../lib/data'
import { loadKarnatakaOverlay, karnatakaMaskLayers } from '../lib/basemap'
import type { KarnatakaOverlay } from '../lib/basemap'
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
    if (!deckOverlay || cells.length === 0) return

    // top 5% cells by predicted risk = "priority cells" (the PAI story)
    const sorted = [...cells].sort((a, b) => b.mean_risk - a.mean_risk)
    const priority = sorted.slice(0, Math.ceil(cells.length * 0.05))

    const layers = [
      ...karnatakaMaskLayers(overlay),
      new HeatmapLayer<RiskCell>({
        id: 'risk-heat',
        data: cells,
        getPosition: (d) => [d.cell_lon, d.cell_lat],
        getWeight: (d) => d.mean_risk,
        radiusPixels: 42,
        intensity: 1.15,
        threshold: 0.04,
        colorRange: [
          // cool end: muted slate-blue -> olive-teal (no navy, no cyan)
          [59, 80, 92, 90],
          [91, 122, 140, 140],
          [92, 138, 110, 170],
          // hot end unchanged — this encodes real risk magnitude
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

    deckOverlay.setProps({
      layers,
      getTooltip: ({ object }: { object?: RiskCell }) =>
        object
          ? {
              html: `<div style="font-family:ui-sans-serif,system-ui;font-size:12px">
                <div style="font-weight:600">Priority cell</div>
                <div>risk score ${object.mean_risk.toFixed(3)}</div>
              </div>`,
              style: {
                background: 'rgba(29,33,38,0.96)',
                color: '#e6edf3',
                borderRadius: '6px',
                border: '1px solid rgba(201,163,92,0.28)',
              },
            }
          : null,
    })
  }, [cells, showPriority, overlay])

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

import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import { MapboxOverlay } from '@deck.gl/mapbox'
import { ColumnLayer, ScatterplotLayer, GeoJsonLayer } from '@deck.gl/layers'
import {
  SIG_COLORS, SIG_LABELS, KARNATAKA_CENTER, KARNATAKA_ZOOM,
} from '../lib/data'
import type { HotspotPoint, Significance } from '../lib/data'

interface Props {
  hotspots: HotspotPoint[]
  boundaries: GeoJSON.FeatureCollection | null
  view3D: boolean
  sigOnly: boolean
  flyTarget: { lat: number; lon: number; zoom?: number } | null
  onDistrictClick: (boundaryName: string) => void
}

// real OSM raster tiles, darkened for the command-center theme
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

function elevation(count: number): number {
  return Math.log2(1 + count) * 260
}

function radiusFlat(count: number): number {
  return 120 + Math.log2(1 + count) * 160
}

export default function MapView({
  hotspots, boundaries, view3D, sigOnly, flyTarget, onDistrictClick,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const overlayRef = useRef<MapboxOverlay | null>(null)

  // init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: OSM_STYLE,
      center: KARNATAKA_CENTER,
      zoom: KARNATAKA_ZOOM,
      pitch: 45,
      bearing: -10,
    })
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right')
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

  // update deck layers when data/toggles change
  useEffect(() => {
    const overlay = overlayRef.current
    if (!overlay) return

    const data = sigOnly ? hotspots.filter((h) => h.sig !== 'not_sig') : hotspots

    const common = {
      pickable: true,
      getFillColor: (d: HotspotPoint) => SIG_COLORS[d.sig as Significance],
    }

    const hotspotLayer = view3D
      ? new ColumnLayer<HotspotPoint>({
          id: 'hotspots-3d',
          data,
          diskResolution: 6,
          radius: 480,
          extruded: true,
          getPosition: (d) => d.position,
          getElevation: (d) => elevation(d.count),
          getFillColor: common.getFillColor,
          pickable: true,
          material: { ambient: 0.55, diffuse: 0.6, shininess: 30 },
        })
      : new ScatterplotLayer<HotspotPoint>({
          id: 'hotspots-flat',
          data,
          getPosition: (d) => d.position,
          getRadius: (d) => radiusFlat(d.count),
          getFillColor: common.getFillColor,
          radiusUnits: 'meters',
          pickable: true,
          stroked: false,
        })

    const layers: (ColumnLayer<HotspotPoint> | ScatterplotLayer<HotspotPoint> | GeoJsonLayer)[] = [hotspotLayer]

    if (boundaries) {
      layers.unshift(
        new GeoJsonLayer({
          id: 'districts',
          data: boundaries,
          stroked: true,
          filled: true,
          getFillColor: [56, 189, 248, 4],
          getLineColor: [56, 189, 248, 110],
          getLineWidth: 1.2,
          lineWidthUnits: 'pixels',
          pickable: true,
          autoHighlight: true,
          highlightColor: [56, 189, 248, 35],
          onClick: (info) => {
            const name = info.object?.properties?.district
            if (name) onDistrictClick(name)
          },
        }),
      )
    }

    overlay.setProps({
      layers,
      getTooltip: ({ object }: { object?: HotspotPoint | { properties?: { district?: string } } }) => {
        if (!object) return null
        if ('sig' in object) {
          const h = object as HotspotPoint
          return {
            html: `<div style="font-family:ui-sans-serif,system-ui;font-size:12px">
              <div style="font-weight:600;margin-bottom:2px">${SIG_LABELS[h.sig]}</div>
              <div>${h.count.toLocaleString()} cases</div>
              <div>Gi* z = ${h.z.toFixed(2)}, p = ${h.p.toFixed(3)}</div>
            </div>`,
            style: {
              background: 'rgba(13,17,23,0.92)',
              color: '#e6edf3',
              borderRadius: '6px',
              border: '1px solid rgba(56,189,248,0.25)',
            },
          }
        }
        const d = (object as { properties?: { district?: string } }).properties?.district
        return d
          ? {
              html: `<div style="font-family:ui-sans-serif,system-ui;font-size:12px;font-weight:600">${d}</div>`,
              style: {
                background: 'rgba(13,17,23,0.92)',
                color: '#7dd3fc',
                borderRadius: '6px',
                border: '1px solid rgba(56,189,248,0.25)',
              },
            }
          : null
      },
    })
  }, [hotspots, boundaries, view3D, sigOnly, onDistrictClick])

  // fly on request
  useEffect(() => {
    if (!flyTarget || !mapRef.current) return
    mapRef.current.flyTo({
      center: [flyTarget.lon, flyTarget.lat],
      zoom: flyTarget.zoom ?? 9.5,
      duration: 1600,
      essential: true,
    })
  }, [flyTarget])

  // outer div holds the layout (maplibre overrides position on its own container)
  return (
    <div className="absolute inset-0">
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  )
}

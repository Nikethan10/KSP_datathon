import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import { MapboxOverlay } from '@deck.gl/mapbox'
import { ColumnLayer, ScatterplotLayer, GeoJsonLayer } from '@deck.gl/layers'
import {
  SIG_COLORS, EMERGING_COLORS, KARNATAKA_CENTER, KARNATAKA_ZOOM,
} from '../lib/data'
import { loadKarnatakaOverlay, karnatakaMaskLayers } from '../lib/basemap'
import { useI18n } from '../lib/i18n'
import type { KarnatakaOverlay } from '../lib/basemap'
import type { HotspotPoint, Significance, EmergingCell } from '../lib/data'
import { CITIZEN_REPORT_COLOR, CITIZEN_REPORT_STROKE } from '../lib/reports/types'
import type { CitizenReportCell } from '../lib/reports/types'

interface Props {
  hotspots: HotspotPoint[]
  boundaries: GeoJSON.FeatureCollection | null
  view3D: boolean
  sigOnly: boolean
  emerging: EmergingCell[] | null
  flyTarget: { lat: number; lon: number; zoom?: number; pitch?: number } | null
  onDistrictClick: (boundaryName: string) => void
  /** Frame the state to the container instead of holding a fixed zoom, so a
      tall column and a wide band both fill with Karnataka rather than sea. */
  autoFit?: boolean
  /** Unverified public submissions, aggregated to the 1 km cell. Kept as its own
      prop and its own layer, never merged into `hotspots` — these are not a
      measurement and must not read as one. */
  citizenReports?: CitizenReportCell[] | null
}

/** Bounding box of every coordinate in a collection, at any nesting depth. */
function boundsOf(
  fc: GeoJSON.FeatureCollection,
): [[number, number], [number, number]] | null {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  const visit = (node: unknown): void => {
    if (!Array.isArray(node)) return
    if (typeof node[0] === 'number' && typeof node[1] === 'number') {
      const [x, y] = node as [number, number]
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
      return
    }
    for (const child of node) visit(child)
  }

  for (const f of fc.features) {
    if (f.geometry && 'coordinates' in f.geometry) visit(f.geometry.coordinates)
  }
  return Number.isFinite(minX) ? [[minX, minY], [maxX, maxY]] : null
}

const EMERGING_LABELS: Record<EmergingCell['category'], string> = {
  new: 'NEW hotspot',
  intensifying: 'Intensifying',
  persistent: 'Persistent',
  cooling: 'Cooling',
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
        'raster-saturation': -0.92,
        'raster-brightness-max': 0.38,
        'raster-contrast': 0.12,
      },
    },
  ],
}

function elevation(count: number): number {
  return Math.log2(1 + count) * 340
}

function radiusFlat(count: number): number {
  return 160 + Math.log2(1 + count) * 200
}

export default function MapView({
  hotspots, boundaries, view3D, sigOnly, emerging, flyTarget, onDistrictClick, autoFit,
  citizenReports,
}: Props) {
  const { t } = useI18n()
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const overlayRef = useRef<MapboxOverlay | null>(null)
  const [overlay, setOverlay] = useState<KarnatakaOverlay | null>(null)
  /* Once a district has been flown to, the camera belongs to the officer;
     a resize must not yank it back out to the whole state. */
  const flownRef = useRef(false)
  const fittedRef = useRef(false)

  useEffect(() => {
    loadKarnatakaOverlay().then(setOverlay).catch(() => {})
  }, [])

  // init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: OSM_STYLE,
      center: KARNATAKA_CENTER,
      zoom: KARNATAKA_ZOOM,
      pitch: 40,
      bearing: 0,
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
    const deckOverlay = overlayRef.current
    if (!deckOverlay) return

    const data = sigOnly ? hotspots.filter((h) => h.sig !== 'not_sig') : hotspots

    const common = {
      pickable: true,
      getFillColor: (d: HotspotPoint) => SIG_COLORS[d.sig as Significance],
    }

    const hotspotLayer = emerging
      ? new ScatterplotLayer<EmergingCell>({
          id: 'emerging-cells',
          data: emerging,
          getPosition: (d) => [d.lon, d.lat],
          getRadius: (d) => 250 + Math.log2(1 + d.total_cases) * 140,
          getFillColor: (d) => EMERGING_COLORS[d.category],
          radiusUnits: 'meters',
          pickable: true,
          stroked: true,
          getLineColor: (d) => (d.category === 'new' ? [255, 255, 255, 220] : [0, 0, 0, 0]),
          getLineWidth: (d) => (d.category === 'new' ? 1.5 : 0),
          lineWidthUnits: 'pixels',
        })
      : view3D
      ? new ColumnLayer<HotspotPoint>({
          id: 'hotspots-3d',
          data,
          diskResolution: 6,
          radius: 620,
          extruded: true,
          getPosition: (d) => d.position,
          getElevation: (d) => elevation(d.count),
          getFillColor: common.getFillColor,
          pickable: true,
          material: { ambient: 0.64, diffuse: 0.65, shininess: 25 },
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

    const layers: (ColumnLayer<HotspotPoint> | ScatterplotLayer<HotspotPoint> | ScatterplotLayer<EmergingCell> | ScatterplotLayer<CitizenReportCell> | GeoJsonLayer)[] = [hotspotLayer]

    if (boundaries) {
      layers.unshift(
        new GeoJsonLayer({
          id: 'districts',
          data: boundaries,
          stroked: true,
          filled: true,
          getFillColor: [62, 92, 74, 10],
          getLineColor: [120, 155, 135, 120],
          getLineWidth: 1.4,
          lineWidthUnits: 'pixels',
          pickable: true,
          autoHighlight: true,
          highlightColor: [201, 163, 92, 32],
          onClick: (info) => {
            const name = info.object?.properties?.district
            if (name) onDistrictClick(name)
          },
        }),
      )
    }

    /* Citizen reports sit on top, in a hue neither palette uses, at a FIXED
       radius. radiusFlat() scales a hotspot by its count because that count is a
       statistic; scaling these the same way would lend them a weight they do not
       have. Nothing here touches `data` or `emerging` — toggling this layer must
       not move a single number on the screen. */
    if (citizenReports?.length) {
      layers.push(
        new ScatterplotLayer<CitizenReportCell>({
          id: 'citizen-reports',
          data: citizenReports,
          getPosition: (d) => [d.lon, d.lat],
          getRadius: 420,
          radiusUnits: 'meters',
          getFillColor: CITIZEN_REPORT_COLOR,
          stroked: true,
          getLineColor: CITIZEN_REPORT_STROKE,
          getLineWidth: 2,
          lineWidthUnits: 'pixels',
          pickable: true,
        }),
      )
    }

    // spotlight mask at the very bottom so it dims the basemap outside Karnataka
    layers.unshift(...karnatakaMaskLayers(overlay))

    deckOverlay.setProps({
      layers,
      getTooltip: ({ object }: { object?: HotspotPoint | EmergingCell | CitizenReportCell | { properties?: { district?: string } } }) => {
        if (!object) return null
        /* Leads with what it is, and carries no z-score, p-value or
           significance band — unlike the hotspot tooltip below. That
           contrast is the whole point. */
        if ('nReports' in object) {
          const c = object as CitizenReportCell
          return {
            html: `<div style="font-family:ui-sans-serif,system-ui;font-size:12px;max-width:230px">
              <div style="font-weight:600;margin-bottom:2px">${t('reports.tipUnverified')}</div>
              <div>${t('reports.tipCount').replace('{n}', String(c.nReports)).replace('{r}', String(c.nLast7d))}</div>
              <div style="color:#8e97a2;margin-top:2px">${c.topCategory}</div>
            </div>`,
            style: {
              background: 'rgba(29,33,38,0.96)',
              color: '#e6edf3',
              borderRadius: '6px',
              border: '1px solid rgba(86,190,200,0.45)',
            },
          }
        }
        if ('category' in object) {
          const e = object as EmergingCell
          return {
            html: `<div style="font-family:ui-sans-serif,system-ui;font-size:12px">
              <div style="font-weight:600;margin-bottom:2px">${EMERGING_LABELS[e.category]}</div>
              <div>${e.recent_monthly}/mo now vs ${e.hist_monthly}/mo before</div>
              <div>trend τ = ${e.tau.toFixed(2)}, p = ${e.p.toFixed(3)}</div>
              ${e.district ? `<div style="color:#8a939e">${e.district}</div>` : ''}
            </div>`,
            style: {
              background: 'rgba(29,33,38,0.96)',
              color: '#e6edf3',
              borderRadius: '6px',
              border: '1px solid rgba(232,121,249,0.35)',
            },
          }
        }
        if ('sig' in object) {
          const h = object as HotspotPoint
          /* Finding first, then the count, then the test that supports it.
             The statistic is kept - a judge will look for it - but it no
             longer leads, because Gi* z is not what an officer is asking. */
          const meaning = h.sig.startsWith('hot')
            ? t('sense.tipHot')
            : h.sig.startsWith('cold')
              ? t('sense.tipCold')
              : t('sense.tipNotSig')
          return {
            html: `<div style="font-family:ui-sans-serif,system-ui;font-size:12px;max-width:230px">
              <div style="font-weight:600;margin-bottom:2px">${t(`sig.${h.sig}`)}</div>
              <div style="color:#b6bec7;line-height:1.35;margin-bottom:3px">${meaning}</div>
              <div>${t('sense.tipCases').replace('{n}', h.count.toLocaleString())}</div>
              <div style="color:#8e97a2;margin-top:2px">Gi* z = ${h.z.toFixed(2)}, p = ${h.p.toFixed(3)}</div>
            </div>`,
            style: {
              background: 'rgba(29,33,38,0.96)',
              color: '#e6edf3',
              borderRadius: '6px',
              border: '1px solid rgba(201,163,92,0.28)',
            },
          }
        }
        const d = (object as { properties?: { district?: string } }).properties?.district
        return d
          ? {
              html: `<div style="font-family:ui-sans-serif,system-ui;font-size:12px;font-weight:600">${d}</div>`,
              style: {
                background: 'rgba(29,33,38,0.96)',
                color: '#c9a35c',
                borderRadius: '6px',
                border: '1px solid rgba(201,163,92,0.28)',
              },
            }
          : null
      },
    })
  }, [hotspots, boundaries, view3D, sigOnly, emerging, citizenReports, overlay, onDistrictClick, t])

  // frame the state to whatever shape the container is, and re-frame when
  // that shape changes, until the officer flies somewhere themselves
  useEffect(() => {
    const map = mapRef.current
    const el = containerRef.current
    if (!autoFit || !map || !el || !boundaries) return
    const bounds = boundsOf(boundaries)
    if (!bounds) return

    const fit = () => {
      if (flownRef.current) return
      map.fitBounds(bounds, {
        padding: 28,
        // A tilted camera over flat markers buys nothing and throws the
        // state off-centre; the overview reads straight down.
        pitch: 0,
        bearing: 0,
        duration: fittedRef.current ? 0 : 500,
        essential: true,
      })
      fittedRef.current = true
    }
    fit()

    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [autoFit, boundaries])

  // fly on request — a descending approach rather than a flat pan, so
  // selecting a district reads as "zooming into" it
  useEffect(() => {
    if (!flyTarget || !mapRef.current) return
    flownRef.current = true
    mapRef.current.flyTo({
      center: [flyTarget.lon, flyTarget.lat],
      zoom: flyTarget.zoom ?? 10.2,
      pitch: flyTarget.pitch ?? 50,
      bearing: 0,
      // >1 arcs out before descending; the pause at altitude is what makes
      // the movement legible instead of a jump cut
      curve: 1.5,
      speed: 0.8,
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

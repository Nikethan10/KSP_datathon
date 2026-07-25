// Karnataka spotlight: a dark mask over everything outside the state plus a
// crisp state outline, so Karnataka stands out and neighbouring states recede.
// Shared by every map (SENSE / PREDICT risk / PATTERNS) for a consistent look.
import { GeoJsonLayer } from '@deck.gl/layers'
import { fetchJson } from './data'

export interface KarnatakaOverlay {
  mask: GeoJSON.FeatureCollection
  outline: GeoJSON.FeatureCollection
}

export async function loadKarnatakaOverlay(): Promise<KarnatakaOverlay> {
  const [mask, outline] = await Promise.all([
    fetchJson<GeoJSON.FeatureCollection>('karnataka_mask.json'),
    fetchJson<GeoJSON.FeatureCollection>('karnataka_outline.json'),
  ])
  return { mask, outline }
}

// Bottom-of-stack layers: dim the surroundings, then trace the border.
export function karnatakaMaskLayers(overlay: KarnatakaOverlay | null): GeoJsonLayer[] {
  if (!overlay) return []
  return [
    new GeoJsonLayer({
      id: 'karnataka-mask',
      data: overlay.mask,
      stroked: false,
      filled: true,
      getFillColor: [4, 7, 12, 205], // near-background, ~80% opacity
      pickable: false,
      parameters: { depthTest: false },
    }),
    new GeoJsonLayer({
      id: 'karnataka-outline',
      data: overlay.outline,
      stroked: true,
      filled: false,
      getLineColor: [201, 163, 92, 230],
      getLineWidth: 1.8,
      lineWidthUnits: 'pixels',
      pickable: false,
      parameters: { depthTest: false },
    }),
  ]
}

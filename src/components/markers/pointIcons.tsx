import L from 'leaflet'
import type { PointType } from '../../types/database.js'

// ---------------------------------------------------------------------------
// EDIT HERE to change how each point type looks. This is the one place that
// controls it — no CSS file involved. To add a new marker kind (e.g. mando,
// out-of-bounds — see architecture.md §5), add a PointType in
// types/database.ts, add it to the `type` check constraint in the migration,
// then add one entry here.
// ---------------------------------------------------------------------------
export type PointIconShape = 'square' | 'circle' | 'ring' | 'image'

export type PointIconConfig = {
  /** Fill color — any valid CSS color. Ignored when shape is 'image'. */
  color: string
  /** Visual shape. 'ring' = circle with a dashed inner ring. 'image' = your own
   *  SVG/PNG artwork, via imageUrl below. */
  shape: PointIconShape
  /** Overall size in pixels (both width and height). */
  size: number
  /**
   * Path to a custom image, required when shape is 'image'. Put the file in
   * /public/icons/ and reference it as '/icons/your-file.svg' — Vite serves
   * anything in /public/ at that same path, unmodified, no import needed.
   * (Alternative: `import url from '../../assets/your-file.svg?url'` if you'd
   * rather Vite fingerprint/bundle it — more setup, same result either way.)
   */
  imageUrl?: string
}

export const POINT_ICON_CONFIG: Record<PointType, PointIconConfig> = {
  tee: { color: '#2563eb', shape: 'square', size: 26 },
  // Swapped to a custom SVG as a demonstration — swap `imageUrl` for your own
  // artwork whenever you have real basket art. The CSS-drawn 'ring' shape
  // (color, shape: 'ring', no imageUrl) still works too, if you want it back.
  basket: { color: '#f97316', shape: 'image', size: 28, imageUrl: '/icons/basket-placeholder.svg' },
}
// ---------------------------------------------------------------------------

// 'default' and 'selected' are implemented — see architecture.md §4 for the
// rest of the marker visual-state table (candidate/dimmed/dragging/
// micromove-*/alternative). Add a variant by giving it a style entry below;
// buildPointHtml already applies whatever's there — extend it if a future
// variant needs more than opacity/an outer ring (e.g. a pulse animation).
export type PointIconVariant = 'default' | 'selected'

const POINT_ICON_VARIANT_STYLES: Record<PointIconVariant, { opacity?: number; ringColor?: string }> = {
  default: {},
  // Used while a point is included in the hole currently being built/edited —
  // see the hole-builder flow.
  selected: { ringColor: '#22c55e' },
}

function buildPointHtml(config: PointIconConfig, variant: PointIconVariant): string {
  const variantStyle = POINT_ICON_VARIANT_STYLES[variant]
  const ringShadow = variantStyle.ringColor ? `, 0 0 0 3px ${variantStyle.ringColor}` : ''

  // box-sizing: border-box + width/height: 100% keep the border inside the size
  // Leaflet assumes for anchor math — without it, a border is added on top of
  // the declared size, inflating the rendered box and visibly shifting the
  // marker away from its true coordinate. Applied once here, for every shape,
  // so a newly-added shape can't reintroduce that bug.
  const base = `box-sizing: border-box; width: 100%; height: 100%; opacity: ${variantStyle.opacity ?? 1}; background: ${config.color}; border: 2px solid rgba(255,255,255,0.9); box-shadow: 0 1px 4px rgba(0,0,0,0.45)${ringShadow};`

  if (config.shape === 'square') {
    return `<div style="${base} border-radius: 6px;"></div>`
  }

  if (config.shape === 'circle') {
    return `<div style="${base} border-radius: 50%;"></div>`
  }

  if (config.shape === 'image' && config.imageUrl) {
    // No border/background/box-shadow here — those are for the CSS-drawn
    // shapes above. An image icon is just... the image, at the configured
    // size, with a drop-shadow standing in for the box-shadow the other
    // shapes get, plus the same selection ring via a wrapper when needed.
    const img = `<img src="${config.imageUrl}" width="${config.size}" height="${config.size}" style="display: block; opacity: ${variantStyle.opacity ?? 1}; filter: drop-shadow(0 1px 3px rgba(0,0,0,0.5));" />`
    if (!variantStyle.ringColor) return img
    return `<div style="box-sizing: border-box; width: 100%; height: 100%; border-radius: 50%; box-shadow: 0 0 0 3px ${variantStyle.ringColor};">${img}</div>`
  }

  // 'ring': the dashed inner ring is a child of its own small wrapper, which can
  // safely use position:relative without touching the outer element Leaflet
  // itself manages — that one is never given a `position` override, and stays
  // the position:absolute Leaflet's own stylesheet sets on it. (An earlier
  // version set position:relative directly on the Leaflet-managed element,
  // which broke Leaflet's positioning entirely for every basket marker after
  // the first — see markers.css's git history if curious.)
  return `<div style="${base} border-radius: 50%; position: relative;">
    <div style="position: absolute; inset: 5px; border: 2px dashed rgba(255,255,255,0.85); border-radius: 50%;"></div>
  </div>`
}

const iconCache = new Map<string, L.DivIcon>()

export function getPointIcon(type: PointType, variant: PointIconVariant = 'default'): L.DivIcon {
  const key = `${type}-${variant}`
  const cached = iconCache.get(key)
  if (cached) return cached

  const config = POINT_ICON_CONFIG[type]
  const icon = L.divIcon({
    html: buildPointHtml(config, variant),
    // Kept for debuggability (inspecting the DOM shows the type/variant at a
    // glance) even though color/shape no longer depend on CSS — see
    // markers.css for the one rule this still needs (Leaflet's default
    // divIcon background/border reset).
    className: `marker-icon marker-${type} marker-variant-${variant}`,
    iconSize: [config.size, config.size],
    iconAnchor: [config.size / 2, config.size / 2],
  })
  iconCache.set(key, icon)
  return icon
}

const holeLabelCache = new Map<string, L.DivIcon>()

function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

/** Label shown at a hole's line midpoint (its number or name). */
export function getHoleLabelIcon(text: string): L.DivIcon {
  const cached = holeLabelCache.get(text)
  if (cached) return cached

  const icon = L.divIcon({
    html: `<div class="hole-label">${escapeHtml(text)}</div>`,
    className: 'hole-label-wrapper',
    iconAnchor: [0, 0],
  })
  holeLabelCache.set(text, icon)
  return icon
}

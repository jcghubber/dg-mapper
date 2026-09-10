/**
 * Averages a set of lat/lng points. Used for the v1 "midpoint" hole-line style —
 * centroid of all tees to centroid of all baskets (see architecture.md §2). Callers
 * must only pass a non-empty array; centroid of zero points is undefined (NaN), and
 * call sites already skip rendering a hole with zero tees or baskets rather than
 * calling this with an empty array.
 */
export function centroid(points: { lat: number; lng: number }[]): [number, number] {
  const n = points.length
  const lat = points.reduce((sum, p) => sum + p.lat, 0) / n
  const lng = points.reduce((sum, p) => sum + p.lng, 0) / n
  return [lat, lng]
}

/**
 * `points.location` is a PostGIS `geography(Point, 4326)` column. Supabase's REST API
 * (PostgREST) doesn't transform geography values on the way in or out — reads use the
 * generated `lat`/`lng` columns instead (see the migration), but writes still need to
 * target `location` directly, and PostGIS's geography type parses a well-known-text
 * string natively, so a plain string is all that's needed — no RPC function required.
 */

/**
 * Builds the EWKT (Extended Well-Known Text) string PostGIS expects for a
 * `geography(Point, 4326)` column, e.g. `SRID=4326;POINT(149.1244 -35.3075)`.
 *
 * Note the coordinate order: longitude first, then latitude — the opposite of the
 * conventional (lat, lng) order used almost everywhere else in this codebase
 * (Leaflet's LatLng, our own function signatures, etc). This function takes
 * (lat, lng) to match that convention and reorders internally, specifically to
 * avoid every call site needing to remember to flip the order themselves.
 */
export function toLocationEWKT(lat: number, lng: number): string {
  return `SRID=4326;POINT(${lng} ${lat})`
}

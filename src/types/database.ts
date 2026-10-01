/**
 * Hand-written types matching supabase/migrations/0001_points_holes_schema.sql.
 * Keep these in sync manually for now; once the Supabase CLI is set up against
 * the real project, `supabase gen types typescript` can generate (and should
 * eventually replace) this file directly from the live schema.
 */

/** Common audit fields present on every table. */
export type AuditFields = {
  created_at: string
  modified_at: string
  created_by: string
  modified_by: string
  is_deleted: boolean
}

export type PointType = 'tee' | 'basket'

export type HoleStatus = 'included' | 'alternative' | 'private'

export type LineStyle = 'midpoint' // future: 'diverge' | 'converge' | 'multi_path' | 'corridor'

/** A point's effective public-visibility status — derived, not stored (see architecture.md §1). */
export type EffectiveVisibility = 'included' | 'alternative' | 'hidden'

export type Course = AuditFields & {
  id: string
  name: string
  is_public: boolean
  /** Generated column — plain latitude in degrees, read-only. Always present:
   *  hq_location is not-null in the schema (with a Canberra default), so
   *  every course always has somewhere to center the map on. */
  hq_lat: number
  hq_lng: number
}

export type Point = AuditFields & {
  id: string
  course_id: string
  type: PointType
  name: string
  /** Generated column — plain longitude in degrees, read-only. */
  lng: number
  /** Generated column — plain latitude in degrees, read-only. */
  lat: number
  is_public_alternative: boolean
  metadata: Record<string, unknown>
}

export type Hole = AuditFields & {
  id: string
  course_id: string
  number: number | null
  name: string | null
  status: HoleStatus
  line_style: LineStyle
  metadata: Record<string, unknown>
}

export type HoleTee = AuditFields & {
  hole_id: string
  tee_id: string
}

export type HoleBasket = AuditFields & {
  hole_id: string
  basket_id: string
}

/** Raw hole shape as returned by the DB layer — tee/basket associations as IDs only. */
export type HoleWithPointIds = Hole & {
  teeIds: string[]
  basketIds: string[]
}

/**
 * A hole with its tee/basket associations resolved to full Point objects, joined
 * against a single live points list (see useCourseData). Not returned directly by
 * the DB layer — embedding full point copies per-hole would create a second,
 * independently-stale source of truth for point data (e.g. a moved point's new
 * location wouldn't be reflected here without a separate refetch).
 */
export type HoleWithPoints = Hole & {
  tees: Point[]
  baskets: Point[]
}

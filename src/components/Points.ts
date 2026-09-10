import { supabase } from '../supabase.js'
import { toLocationEWKT } from '../geo.js'
import type { Point, PointType } from '../../types/database.js'

export const POINT_COLUMNS =
  'id, course_id, type, name, lat, lng, is_public_alternative, metadata, created_at, modified_at, created_by, modified_by, is_deleted'

export async function fetchPoints(courseId: string, opts: { includeDeleted?: boolean } = {}): Promise<Point[]> {
  let query = supabase.from('points').select(POINT_COLUMNS).eq('course_id', courseId)

  if (!opts.includeDeleted) {
    query = query.eq('is_deleted', false)
  }

  const { data, error } = await query.order('created_at', { ascending: true })
  if (error) throw error
  return data as Point[]
}

export type CreatePointInput = {
  courseId: string
  type: PointType
  name: string
  lat: number
  lng: number
  isPublicAlternative?: boolean
}

export async function createPoint(input: CreatePointInput): Promise<Point> {
  const { data, error } = await supabase
    .from('points')
    .insert({
      course_id: input.courseId,
      type: input.type,
      name: input.name,
      location: toLocationEWKT(input.lat, input.lng),
      is_public_alternative: input.isPublicAlternative ?? false,
    })
    .select(POINT_COLUMNS)
    .single()

  if (error) throw error
  return data as Point
}

/** Used by the grab-move and micromove flows to commit a new location. */
export async function updatePointLocation(pointId: string, lat: number, lng: number): Promise<Point> {
  const { data, error } = await supabase
    .from('points')
    .update({ location: toLocationEWKT(lat, lng) })
    .eq('id', pointId)
    .select(POINT_COLUMNS)
    .single()

  if (error) throw error
  return data as Point
}

export async function renamePoint(pointId: string, name: string): Promise<Point> {
  const { data, error } = await supabase
    .from('points')
    .update({ name })
    .eq('id', pointId)
    .select(POINT_COLUMNS)
    .single()

  if (error) throw error
  return data as Point
}

export async function setPointPublicAlternative(pointId: string, isPublicAlternative: boolean): Promise<Point> {
  const { data, error } = await supabase
    .from('points')
    .update({ is_public_alternative: isPublicAlternative })
    .eq('id', pointId)
    .select(POINT_COLUMNS)
    .single()

  if (error) throw error
  return data as Point
}

export async function softDeletePoint(pointId: string): Promise<void> {
  const { error } = await supabase.from('points').update({ is_deleted: true }).eq('id', pointId)
  if (error) throw error
}

export async function restorePoint(pointId: string): Promise<void> {
  const { error } = await supabase.from('points').update({ is_deleted: false }).eq('id', pointId)
  if (error) throw error
}
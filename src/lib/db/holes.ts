import { supabase } from '../supabase.js'
import type { Hole, HoleStatus, HoleWithPointIds } from '../../types/database.js'

const HOLE_COLUMNS =
  'id, course_id, number, name, status, line_style, metadata, created_at, modified_at, created_by, modified_by, is_deleted'

// Raw shape returned by the nested select before we flatten it. PostgREST embeds are
// LEFT JOINs by default (no `!inner`), so a hole with zero live tees or baskets still
// comes back with an empty array rather than being excluded — deliberately, since the
// architecture calls for rendering such holes as incomplete rather than making them
// disappear. Only IDs are selected here, not full point rows — see HoleWithPointIds
// for why: embedding full point copies here would create a second, independently
// stale source of truth for point data alongside usePoints' list.
type RawHoleRow = Hole & {
  hole_tees: { is_deleted: boolean; tee_id: string }[] | null
  hole_baskets: { is_deleted: boolean; basket_id: string }[] | null
}

function flattenHole(row: RawHoleRow): HoleWithPointIds {
  const { hole_tees, hole_baskets, ...hole } = row

  // Soft-deleted join rows are filtered out here rather than in SQL — see
  // architecture.md's note that soft-deleting a point doesn't cascade to its join
  // rows, so this filtering has to happen in the app. (Filtering out associations
  // to a soft-deleted *point* itself happens downstream in useCourseData, once IDs
  // are joined against the live points list.)
  const teeIds = (hole_tees ?? []).filter((ht) => !ht.is_deleted).map((ht) => ht.tee_id)
  const basketIds = (hole_baskets ?? []).filter((hb) => !hb.is_deleted).map((hb) => hb.basket_id)

  return { ...hole, teeIds, basketIds }
}

export async function fetchHoles(courseId: string, opts: { includeDeleted?: boolean } = {}): Promise<HoleWithPointIds[]> {
  let query = supabase
    .from('holes')
    .select(`${HOLE_COLUMNS}, hole_tees(is_deleted, tee_id), hole_baskets(is_deleted, basket_id)`)
    .eq('course_id', courseId)

  if (!opts.includeDeleted) {
    query = query.eq('is_deleted', false)
  }

  const { data, error } = await query.order('number', { ascending: true, nullsFirst: false })
  if (error) throw error
  return (data as unknown as RawHoleRow[]).map(flattenHole)
}

export async function fetchHole(holeId: string): Promise<HoleWithPointIds | null> {
  const { data, error } = await supabase
    .from('holes')
    .select(`${HOLE_COLUMNS}, hole_tees(is_deleted, tee_id), hole_baskets(is_deleted, basket_id)`)
    .eq('id', holeId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null
  return flattenHole(data as unknown as RawHoleRow)
}

/** Adds/reactivates the given tees on a hole and soft-deletes any not in the list. */
export async function setHoleTees(holeId: string, teeIds: string[]): Promise<void> {
  if (teeIds.length > 0) {
    const rows = teeIds.map((teeId) => ({ hole_id: holeId, tee_id: teeId, is_deleted: false }))
    const { error } = await supabase.from('hole_tees').upsert(rows, { onConflict: 'hole_id,tee_id' })
    if (error) throw error
  }

  let removeQuery = supabase.from('hole_tees').update({ is_deleted: true }).eq('hole_id', holeId)
  if (teeIds.length > 0) {
    removeQuery = removeQuery.not('tee_id', 'in', `(${teeIds.join(',')})`)
  }
  const { error: removeError } = await removeQuery
  if (removeError) throw removeError
}

/** Adds/reactivates the given baskets on a hole and soft-deletes any not in the list. */
export async function setHoleBaskets(holeId: string, basketIds: string[]): Promise<void> {
  if (basketIds.length > 0) {
    const rows = basketIds.map((basketId) => ({ hole_id: holeId, basket_id: basketId, is_deleted: false }))
    const { error } = await supabase.from('hole_baskets').upsert(rows, { onConflict: 'hole_id,basket_id' })
    if (error) throw error
  }

  let removeQuery = supabase.from('hole_baskets').update({ is_deleted: true }).eq('hole_id', holeId)
  if (basketIds.length > 0) {
    removeQuery = removeQuery.not('basket_id', 'in', `(${basketIds.join(',')})`)
  }
  const { error: removeError } = await removeQuery
  if (removeError) throw removeError
}

export type CreateHoleInput = {
  courseId: string
  name?: string
  number?: number
  status?: HoleStatus
  teeIds: string[]
  basketIds: string[]
}

/** Creates a hole and its tee/basket associations, then returns it fully assembled. */
export async function createHole(input: CreateHoleInput): Promise<HoleWithPointIds> {
  const { data, error } = await supabase
    .from('holes')
    .insert({
      course_id: input.courseId,
      name: input.name ?? null,
      number: input.number ?? null,
      status: input.status ?? 'included',
    })
    .select(HOLE_COLUMNS)
    .single()

  if (error) throw error
  const hole = data as Hole

  await Promise.all([setHoleTees(hole.id, input.teeIds), setHoleBaskets(hole.id, input.basketIds)])

  const full = await fetchHole(hole.id)
  if (!full) throw new Error('Hole was created but could not be re-fetched.')
  return full
}

export type UpdateHoleInput = {
  holeId: string
  name?: string | null
  number?: number | null
  status?: HoleStatus
  teeIds?: string[]
  basketIds?: string[]
}

/** Updates a hole's own fields and/or its tee/basket associations (whichever are provided). */
export async function updateHole(input: UpdateHoleInput): Promise<HoleWithPointIds> {
  const patch: Partial<Pick<Hole, 'name' | 'number' | 'status'>> = {}
  if (input.name !== undefined) patch.name = input.name
  if (input.number !== undefined) patch.number = input.number
  if (input.status !== undefined) patch.status = input.status

  if (Object.keys(patch).length > 0) {
    const { error } = await supabase.from('holes').update(patch).eq('id', input.holeId)
    if (error) throw error
  }

  const reconciliations: Promise<void>[] = []
  if (input.teeIds !== undefined) reconciliations.push(setHoleTees(input.holeId, input.teeIds))
  if (input.basketIds !== undefined) reconciliations.push(setHoleBaskets(input.holeId, input.basketIds))
  if (reconciliations.length > 0) await Promise.all(reconciliations)

  const full = await fetchHole(input.holeId)
  if (!full) throw new Error('Hole not found after update.')
  return full
}

export async function softDeleteHole(holeId: string): Promise<void> {
  const { error } = await supabase.from('holes').update({ is_deleted: true }).eq('id', holeId)
  if (error) throw error
}

export async function restoreHole(holeId: string): Promise<void> {
  const { error } = await supabase.from('holes').update({ is_deleted: false }).eq('id', holeId)
  if (error) throw error
}

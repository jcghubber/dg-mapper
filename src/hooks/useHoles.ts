import { useCallback, useEffect, useState } from 'react'
import * as holesDb from '../lib/db/holes.js'
import type { HoleWithPointIds } from '../types/database.js'

/**
 * Hole metadata and tee/basket *associations* (as IDs), independent of point data.
 * Most consumers want `useCourseData` instead, which joins these IDs against the
 * live points list to get actual point objects that stay in sync when a point moves.
 * This lower-level hook is exposed for cases that only care about hole associations
 * themselves (e.g. an editing UI that just needs to know which IDs are selected).
 */
export function useHoles(courseId: string | null) {
  const [holes, setHoles] = useState<HoleWithPointIds[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    if (!courseId) {
      setHoles([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const data = await holesDb.fetchHoles(courseId)
      setHoles(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [courseId])

  useEffect(() => {
    void refetch()
  }, [refetch])

  const addHole = useCallback(
    async (input: Omit<holesDb.CreateHoleInput, 'courseId'>) => {
      if (!courseId) throw new Error('No active course')
      const created = await holesDb.createHole({ ...input, courseId })
      setHoles((current) => [...current, created])
      return created
    },
    [courseId],
  )

  const editHole = useCallback(async (input: holesDb.UpdateHoleInput) => {
    const updated = await holesDb.updateHole(input)
    setHoles((current) => current.map((h) => (h.id === updated.id ? updated : h)))
    return updated
  }, [])

  const removeHole = useCallback(async (holeId: string) => {
    await holesDb.softDeleteHole(holeId)
    setHoles((current) => current.filter((h) => h.id !== holeId))
  }, [])

  const undoRemoveHole = useCallback(
    async (holeId: string) => {
      await holesDb.restoreHole(holeId)
      await refetch()
    },
    [refetch],
  )

  return { holes, loading, error, refetch, addHole, editHole, removeHole, undoRemoveHole }
}

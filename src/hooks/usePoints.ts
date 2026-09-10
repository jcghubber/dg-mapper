import { useCallback, useEffect, useState } from 'react'
import * as pointsDb from '../lib/db/points.js'
import type { Point } from '../types/database.js'

export function usePoints(courseId: string | null) {
  const [points, setPoints] = useState<Point[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    if (!courseId) {
      setPoints([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const data = await pointsDb.fetchPoints(courseId)
      setPoints(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [courseId])

  useEffect(() => {
    void refetch()
  }, [refetch])

  const addPoint = useCallback(
    async (input: Omit<pointsDb.CreatePointInput, 'courseId'>) => {
      if (!courseId) throw new Error('No active course')
      const created = await pointsDb.createPoint({ ...input, courseId })
      setPoints((current) => [...current, created])
      return created
    },
    [courseId],
  )

  const movePoint = useCallback(async (pointId: string, lat: number, lng: number) => {
    const updated = await pointsDb.updatePointLocation(pointId, lat, lng)
    setPoints((current) => current.map((p) => (p.id === pointId ? updated : p)))
    return updated
  }, [])

  const renamePoint = useCallback(async (pointId: string, name: string) => {
    const updated = await pointsDb.renamePoint(pointId, name)
    setPoints((current) => current.map((p) => (p.id === pointId ? updated : p)))
    return updated
  }, [])

  const setPublicAlternative = useCallback(async (pointId: string, value: boolean) => {
    const updated = await pointsDb.setPointPublicAlternative(pointId, value)
    setPoints((current) => current.map((p) => (p.id === pointId ? updated : p)))
    return updated
  }, [])

  const removePoint = useCallback(async (pointId: string) => {
    await pointsDb.softDeletePoint(pointId)
    setPoints((current) => current.filter((p) => p.id !== pointId))
  }, [])

  // Restoring isn't a simple local patch — the row is already gone from `points` by
  // the time undo is available (e.g. via a "point deleted, undo?" toast), so there's
  // nothing to update in place. A full refetch is the simplest correct way to bring
  // it back with current data.
  const undoRemovePoint = useCallback(
    async (pointId: string) => {
      await pointsDb.restorePoint(pointId)
      await refetch()
    },
    [refetch],
  )

  return {
    points,
    loading,
    error,
    refetch,
    addPoint,
    movePoint,
    renamePoint,
    setPublicAlternative,
    removePoint,
    undoRemovePoint,
  }
}

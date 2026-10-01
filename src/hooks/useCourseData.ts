import { useMemo } from 'react'
import { usePoints } from './usePoints.js'
import { useHoles } from './useHoles.js'
import type { HoleWithPoints, Point } from '../types/database.js'

/**
 * The primary hook for course-editing UI: combines `usePoints` and `useHoles` into a
 * single source of truth. A hole's `tees`/`baskets` are resolved here, on every render,
 * against the *same* live points list `usePoints` returns — so moving a point via
 * `movePoint` is immediately reflected in every hole it belongs to, with no separate
 * refetch or stale copy anywhere.
 *
 * `useHoles` on its own only carries ID associations for exactly this reason: any hook
 * that resolves those IDs to full Point objects itself risks holding a second,
 * independently-stale copy of point data.
 */
export function useCourseData(courseId: string | null) {
  const pointsApi = usePoints(courseId)
  const holesApi = useHoles(courseId)

  const holes = useMemo<HoleWithPoints[]>(() => {
    const pointsById = new Map<string, Point>(pointsApi.points.map((p) => [p.id, p]))

    return holesApi.holes.map((hole) => {
      const { teeIds, basketIds, ...rest } = hole
      return {
        ...rest,
        // A point can be soft-deleted without its join row being touched (see
        // architecture.md) — filtering against pointsById (already scoped to
        // non-deleted points by usePoints) drops those references here, exactly
        // where the doc calls for a hole to render as incomplete rather than error.
        tees: teeIds.map((id) => pointsById.get(id)).filter((p): p is Point => p !== undefined),
        baskets: basketIds.map((id) => pointsById.get(id)).filter((p): p is Point => p !== undefined),
      }
    })
  }, [holesApi.holes, pointsApi.points])

  return {
    points: pointsApi.points,
    holes,
    loading: pointsApi.loading || holesApi.loading,
    error: pointsApi.error ?? holesApi.error,
    refetch: async () => {
      await Promise.all([pointsApi.refetch(), holesApi.refetch()])
    },

    // Point mutations
    addPoint: pointsApi.addPoint,
    movePoint: pointsApi.movePoint,
    renamePoint: pointsApi.renamePoint,
    setPointPublicAlternative: pointsApi.setPublicAlternative,
    removePoint: pointsApi.removePoint,
    undoRemovePoint: pointsApi.undoRemovePoint,

    // Hole mutations
    addHole: holesApi.addHole,
    editHole: holesApi.editHole,
    removeHole: holesApi.removeHole,
    undoRemoveHole: holesApi.undoRemoveHole,
  }
}

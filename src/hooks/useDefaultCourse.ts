import { useCallback, useEffect, useRef, useState } from 'react'
import { createCourse, fetchMyCourses, setCourseHqLocation } from '../lib/db/courses.js'
import type { Course } from '../types/database.js'

/**
 * Temporary stand-in for real course management/selection UI, which doesn't exist yet.
 * Ensures the logged-in user has at least one course to work with: returns their first
 * course if they have one, or silently creates "My Course" if not (using defaultHq —
 * typically wherever the map happens to be centered — as its starting HQ location,
 * since a brand-new course has no holes/points yet to derive one from). Replace this
 * with real course selection once that UI exists.
 */
export function useDefaultCourse(userId: string | null, defaultHq: { lat: number; lng: number }) {
  const [course, setCourse] = useState<Course | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Captured via ref rather than an effect dependency: defaultHq changes on every
  // pan/zoom (it tracks the live map position in App.tsx), but auto-creation should
  // only ever happen once, the first time a logged-in user turns out to have no
  // course yet — not re-run every time the map moves.
  const defaultHqRef = useRef(defaultHq)
  defaultHqRef.current = defaultHq

  useEffect(() => {
    if (!userId) {
      setCourse(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    ;(async () => {
      try {
        const courses = await fetchMyCourses()
        if (cancelled) return

        if (courses.length > 0) {
          setCourse(courses[0]!)
        } else {
          const created = await createCourse('My Course', defaultHqRef.current)
          if (!cancelled) setCourse(created)
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [userId])

  const updateHq = useCallback(
    async (lat: number, lng: number) => {
      if (!course) throw new Error('No active course')
      const updated = await setCourseHqLocation(course.id, lat, lng)
      setCourse(updated)
      return updated
    },
    [course],
  )

  return { course, courseId: course?.id ?? null, loading, error, updateHq }
}

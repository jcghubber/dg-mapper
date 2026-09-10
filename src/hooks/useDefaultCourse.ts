import { useEffect, useState } from 'react'
import { createCourse, fetchMyCourses } from '../lib/db/courses.js'
import type { Course } from '../types/database.js'

/**
 * Temporary stand-in for real course management/selection UI, which doesn't exist yet.
 * Ensures the logged-in user has at least one course to work with: returns their first
 * course if they have one, or silently creates "My Course" if not. Replace this with
 * real course selection once that UI exists — this is here purely so the marker layer
 * has a real course_id to render against.
 */
export function useDefaultCourse(userId: string | null) {
  const [course, setCourse] = useState<Course | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
          const created = await createCourse('My Course')
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

  return { course, courseId: course?.id ?? null, loading, error }
}

import { supabase } from '../supabase.js'
import type { Course } from '../../types/database.js'

const COURSE_COLUMNS = 'id, name, is_public, created_at, modified_at, created_by, modified_by, is_deleted'

/** Courses created by the current user (their own course list — not public courses by others). */
export async function fetchMyCourses(): Promise<Course[]> {
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError
  const userId = userData.user?.id
  if (!userId) return []

  const { data, error } = await supabase
    .from('courses')
    .select(COURSE_COLUMNS)
    .eq('created_by', userId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data as Course[]
}

export async function fetchCourse(courseId: string): Promise<Course | null> {
  const { data, error } = await supabase
    .from('courses')
    .select(COURSE_COLUMNS)
    .eq('id', courseId)
    .maybeSingle()

  if (error) throw error
  return data as Course | null
}

export async function createCourse(name: string): Promise<Course> {
  const { data, error } = await supabase
    .from('courses')
    .insert({ name })
    .select(COURSE_COLUMNS)
    .single()

  if (error) throw error
  return data as Course
}

export async function renameCourse(courseId: string, name: string): Promise<Course> {
  const { data, error } = await supabase
    .from('courses')
    .update({ name })
    .eq('id', courseId)
    .select(COURSE_COLUMNS)
    .single()

  if (error) throw error
  return data as Course
}

export async function setCoursePublic(courseId: string, isPublic: boolean): Promise<Course> {
  const { data, error } = await supabase
    .from('courses')
    .update({ is_public: isPublic })
    .eq('id', courseId)
    .select(COURSE_COLUMNS)
    .single()

  if (error) throw error
  return data as Course
}

export async function softDeleteCourse(courseId: string): Promise<void> {
  const { error } = await supabase.from('courses').update({ is_deleted: true }).eq('id', courseId)
  if (error) throw error
}

export async function restoreCourse(courseId: string): Promise<void> {
  const { error } = await supabase.from('courses').update({ is_deleted: false }).eq('id', courseId)
  if (error) throw error
}

import type { PointType } from '../types/database.js'

export type LatLng = { lat: number; lng: number }

/**
 * The course-edit interaction state machine — see architecture.md §3. Only
 * 'idle' | 'placing' | 'naming' are wired up to anything yet (the add-point
 * flow). 'building' | 'grabbing' | 'micromove' are declared now so the type
 * matches the full design up front, but nothing dispatches into them yet —
 * they'll be wired up as the hole-builder, grab-move, and micromove flows are
 * built in later stages.
 */
export type EditMode =
  | { kind: 'idle' }
  | { kind: 'placing'; latlng: LatLng }
  | { kind: 'naming'; latlng: LatLng; pointType: PointType }
  | { kind: 'building'; editingHoleId: string | null; selectedTees: string[]; selectedBaskets: string[] }
  | { kind: 'grabbing'; pointId: string; liveLatLng: LatLng; hasMoved: boolean }
  | { kind: 'micromove'; selectedPointId: string | null }

export type EditModeAction =
  | { type: 'START_PLACING'; latlng: LatLng }
  | { type: 'CHOOSE_POINT_TYPE'; pointType: PointType }
  | { type: 'START_BUILDING_FROM_POINT'; pointId: string; pointType: PointType }
  | { type: 'START_EDITING_HOLE'; holeId: string; teeIds: string[]; basketIds: string[] }
  | { type: 'TOGGLE_POINT_IN_SELECTION'; pointId: string; pointType: PointType }
  | { type: 'CANCEL' }
  | { type: 'RESET' }

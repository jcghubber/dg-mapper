import { Fragment, useEffect, useRef, useState } from 'react'
import type L from 'leaflet'
import { Marker, Polyline, Popup } from 'react-leaflet'
import { Button, Stack, Text } from '@mantine/core'
import { IconTrash } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { centroid } from '../lib/geometry.js'
import { getHoleLabelIcon, getPointIcon } from './markers/pointIcons.js'
import './markers/markers.css'
import { useLongPressOnElement } from '../hooks/useLongPressOnElement.js'
import { useEditModeDispatch, useEditModeState } from '../hooks/useEditMode.js'
import type { HoleWithPoints, Point } from '../types/database.js'

type Props = {
  points: Point[]
  holes: HoleWithPoints[]
  removePoint: (pointId: string) => Promise<void>
  isEditMode: boolean
}

function PointMarker({
  point,
  removePoint,
  isEditMode,
}: {
  point: Point
  removePoint: Props['removePoint']
  isEditMode: boolean
}) {
  const markerRef = useRef<L.Marker | null>(null)
  const [element, setElement] = useState<HTMLElement | null>(null)
  const mode = useEditModeState()
  const dispatch = useEditModeDispatch()

  // Leaflet creates the marker's DOM node once it's actually added to the
  // map, which happens after this component's own render — grabbing it here
  // (and re-rendering once it's available) is what lets useLongPressOnElement
  // below attach to the real element rather than nothing.
  useEffect(() => {
    setElement(markerRef.current?.getElement() ?? null)
  }, [])

  const isBuilding = mode.kind === 'building'
  const isSelected = isBuilding && (mode.selectedTees.includes(point.id) || mode.selectedBaskets.includes(point.id))

  useLongPressOnElement(
    element,
    () => dispatch({ type: 'START_BUILDING_FROM_POINT', pointId: point.id, pointType: point.type }),
    { enabled: isEditMode && mode.kind === 'idle' },
  )

  const handleDelete = async () => {
    try {
      // Close first — deleting removes the marker (and its popup's anchor) from
      // the map, so closing after the fact has nothing left to close.
      markerRef.current?.closePopup()
      await removePoint(point.id)
    } catch (err) {
      notifications.show({
        color: 'red',
        message: err instanceof Error ? err.message : 'Failed to delete point.',
      })
    }
  }

  return (
    <Marker
      ref={markerRef}
      position={[point.lat, point.lng]}
      icon={getPointIcon(point.type, isSelected ? 'selected' : 'default')}
      eventHandlers={{
        click: () => {
          // While building a hole, a plain tap toggles this point in/out of the
          // selection instead of opening the info popup — there's no Popup
          // child rendered below in that state, so Leaflet's own default
          // click-opens-popup behavior has nothing to open anyway.
          if (isBuilding) {
            dispatch({ type: 'TOGGLE_POINT_IN_SELECTION', pointId: point.id, pointType: point.type })
          }
        },
      }}
    >
      {!isBuilding ? (
        <Popup>
          <Stack gap={6} miw={140}>
            <div>
              <Text fw={700} size="sm">
                {point.name}
              </Text>
              <Text size="xs" c="dimmed">
                {point.type === 'tee' ? 'Tee' : 'Basket'}
              </Text>
            </div>
            {/* Delete is an editing action — a non-owner in view mode gets read-only
                info only, matching architecture.md §3's "different, not-yet-specified
                behavior" for use mode (tapping a marker isn't an editing gesture there). */}
            {isEditMode ? (
              <Button
                color="red"
                variant="light"
                size="xs"
                leftSection={<IconTrash size={14} />}
                onClick={handleDelete}
              >
                Delete
              </Button>
            ) : null}
          </Stack>
        </Popup>
      ) : null}
    </Marker>
  )
}

function HoleLabel({ hole, midpoint, label, isEditMode }: { hole: HoleWithPoints; midpoint: [number, number]; label: string; isEditMode: boolean }) {
  const markerRef = useRef<L.Marker | null>(null)
  const [element, setElement] = useState<HTMLElement | null>(null)
  const mode = useEditModeState()
  const dispatch = useEditModeDispatch()

  useEffect(() => {
    setElement(markerRef.current?.getElement() ?? null)
  }, [])

  useLongPressOnElement(
    element,
    () =>
      dispatch({
        type: 'START_EDITING_HOLE',
        holeId: hole.id,
        teeIds: hole.tees.map((p) => p.id),
        basketIds: hole.baskets.map((p) => p.id),
      }),
    { enabled: isEditMode && mode.kind === 'idle' },
  )

  return <Marker ref={markerRef} position={midpoint} icon={getHoleLabelIcon(label)} />
}

export default function CourseLayer({ points, holes, removePoint, isEditMode }: Props) {
  return (
    <>
      {points.map((point) => (
        <PointMarker key={point.id} point={point} removePoint={removePoint} isEditMode={isEditMode} />
      ))}

      {holes.map((hole) => {
        if (hole.tees.length === 0 || hole.baskets.length === 0) return null

        const teeCenter = centroid(hole.tees)
        const basketCenter = centroid(hole.baskets)
        const midpoint: [number, number] = [
          (teeCenter[0] + basketCenter[0]) / 2,
          (teeCenter[1] + basketCenter[1]) / 2,
        ]
        const label = hole.name ?? (hole.number !== null ? `Hole ${hole.number}` : 'Hole')

        return (
          <Fragment key={hole.id}>
            <Polyline positions={[teeCenter, basketCenter]} pathOptions={{ color: '#2563eb', weight: 3 }} />
            <HoleLabel hole={hole} midpoint={midpoint} label={label} isEditMode={isEditMode} />
          </Fragment>
        )
      })}
    </>
  )
}

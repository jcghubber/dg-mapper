import { Fragment, useRef } from 'react'
import type L from 'leaflet'
import { Marker, Polyline, Popup } from 'react-leaflet'
import { Button, Stack, Text } from '@mantine/core'
import { IconTrash } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { centroid } from '../lib/geometry.js'
import { getHoleLabelIcon, getPointIcon } from './markers/pointIcons.js'
import './markers/markers.css'
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
    <Marker ref={markerRef} position={[point.lat, point.lng]} icon={getPointIcon(point.type)}>
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
    </Marker>
  )
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
            <Marker position={midpoint} icon={getHoleLabelIcon(label)} />
          </Fragment>
        )
      })}
    </>
  )
}

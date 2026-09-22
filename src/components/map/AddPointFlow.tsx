import { useRef } from 'react'
import { Popup } from 'react-leaflet'
import { Button, Group, Stack, Text } from '@mantine/core'
import { useLongPressOnMap } from '../../hooks/useLongPressOnMap.js'
import { useEditModeDispatch, useEditModeState } from '../../hooks/useEditMode.js'
import type { PointType } from '../../types/database.js'

type Props = {
  enabled: boolean
}

/**
 * Tee/basket picker shown at the target location once a point placement starts
 * (via long-press or the crosshair button). Deliberately a standalone Popup
 * (position prop, no backing Marker) rather than Marker+Popup with an
 * imperative openPopup() ref call — the latter caused the popup to silently
 * self-destruct shortly after opening (confirmed via DOM mutation tracing).
 * The standalone Popup doesn't exhibit that.
 */
export default function AddPointFlow({ enabled }: Props) {
  const mode = useEditModeState()
  const dispatch = useEditModeDispatch()

  // Leaflet fires the popup's 'remove' event both when the *user* dismisses it
  // (close button, tapping elsewhere on the map) and when *we* unmount it
  // ourselves after CHOOSE_POINT_TYPE moves on to the naming step. Without this
  // flag, picking a type would immediately cancel itself right back to idle —
  // the remove event doesn't distinguish who caused it, so this does instead.
  const suppressNextCancelRef = useRef(false)

  useLongPressOnMap(
    (latlng) => dispatch({ type: 'START_PLACING', latlng: { lat: latlng.lat, lng: latlng.lng } }),
    { enabled: enabled && mode.kind === 'idle' },
  )

  if (mode.kind !== 'placing') return null

  const choosePointType = (pointType: PointType) => {
    suppressNextCancelRef.current = true
    dispatch({ type: 'CHOOSE_POINT_TYPE', pointType })
  }

  return (
    <Popup
      position={[mode.latlng.lat, mode.latlng.lng]}
      closeButton
      eventHandlers={{
        remove: () => {
          if (suppressNextCancelRef.current) {
            suppressNextCancelRef.current = false
            return
          }
          dispatch({ type: 'CANCEL' })
        },
      }}
    >
      <Stack gap={8} miw={160}>
        <Text size="sm" fw={700}>
          Add a point here
        </Text>
        <Group gap={6} wrap="nowrap">
          <Button size="xs" color="blue" onClick={() => choosePointType('tee')}>
            Tee
          </Button>
          <Button size="xs" color="orange" onClick={() => choosePointType('basket')}>
            Basket
          </Button>
        </Group>
      </Stack>
    </Popup>
  )
}

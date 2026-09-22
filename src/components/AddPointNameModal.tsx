import { useEffect, useState, type FormEvent } from 'react'
import { Button, Group, Modal, Stack, TextInput } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useEditModeDispatch, useEditModeState } from '../hooks/useEditMode.js'
import type { LatLng } from '../context/editModeTypes.js'
import type { CreatePointInput } from '../lib/db/points.js'
import type { Point, PointType } from '../types/database.js'

type Props = {
  addPoint: (input: Omit<CreatePointInput, 'courseId'>) => Promise<Point>
}

export default function AddPointNameModal({ addPoint }: Props) {
  const mode = useEditModeState()
  const dispatch = useEditModeDispatch()
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  const isNaming = mode.kind === 'naming'

  // Preserved across the modal's close animation: by the time Mantine's Modal
  // finishes transitioning out after RESET, `mode` has already gone back to
  // 'idle', which has no `pointType`/`latlng` to read — this keeps the last
  // known values around long enough for that animation to render sensibly,
  // and is only updated while actually in the naming step.
  const [snapshot, setSnapshot] = useState<{ latlng: LatLng; pointType: PointType } | null>(null)

  useEffect(() => {
    if (mode.kind === 'naming') {
      setSnapshot({ latlng: mode.latlng, pointType: mode.pointType })
      setName('')
    }
  }, [mode])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!snapshot) return

    setSaving(true)
    try {
      const trimmed = name.trim()
      await addPoint({
        type: snapshot.pointType,
        name: trimmed || (snapshot.pointType === 'tee' ? 'Tee' : 'Basket'),
        lat: snapshot.latlng.lat,
        lng: snapshot.latlng.lng,
      })
      notifications.show({
        color: 'green',
        message: `${snapshot.pointType === 'tee' ? 'Tee' : 'Basket'} added.`,
      })
      dispatch({ type: 'RESET' })
    } catch (err) {
      notifications.show({
        color: 'red',
        message: err instanceof Error ? err.message : 'Failed to add point.',
      })
    } finally {
      setSaving(false)
    }
  }

  const typeLabel = snapshot?.pointType === 'tee' ? 'tee' : snapshot?.pointType === 'basket' ? 'basket' : 'point'

  return (
    <Modal
      opened={isNaming}
      onClose={() => dispatch({ type: 'CANCEL' })}
      title={`Name this ${typeLabel}`}
      centered
      radius="lg"
    >
      <form onSubmit={handleSubmit}>
        <Stack gap="sm">
          <TextInput
            label="Name"
            placeholder={typeLabel === 'tee' ? 'e.g. Hole 1 Tee' : typeLabel === 'basket' ? 'e.g. Hole 1 Basket' : ''}
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
            autoFocus
          />
          <Group justify="flex-end" gap="sm">
            <Button variant="default" type="button" onClick={() => dispatch({ type: 'CANCEL' })}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              Add
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  )
}

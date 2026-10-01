import { useEffect, useState } from 'react'
import { Button, Group, NumberInput, Paper, Stack, Text, TextInput } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useEditModeDispatch, useEditModeState } from '../hooks/useEditMode.js'
import type { CreateHoleInput, UpdateHoleInput } from '../lib/db/holes.js'
import type { HoleWithPointIds, HoleWithPoints } from '../types/database.js'

type Props = {
  holes: HoleWithPoints[]
  addHole: (input: Omit<CreateHoleInput, 'courseId'>) => Promise<HoleWithPointIds>
  editHole: (input: UpdateHoleInput) => Promise<HoleWithPointIds>
}

export default function HoleBuilderPanel({ holes, addHole, editHole }: Props) {
  const mode = useEditModeState()
  const dispatch = useEditModeDispatch()
  const [name, setName] = useState('')
  const [number, setNumber] = useState<number | ''>('')
  const [saving, setSaving] = useState(false)

  const isBuilding = mode.kind === 'building'
  const editingHole = isBuilding && mode.editingHoleId ? holes.find((h) => h.id === mode.editingHoleId) : null

  // Pre-fill from the existing hole when modifying one; reset to blank when
  // starting a fresh hole. Only runs on the actual transition into building
  // (keyed on editingHoleId), not every re-render while still building —
  // otherwise typing in the name field would keep getting overwritten.
  useEffect(() => {
    if (isBuilding) {
      setName(editingHole?.name ?? '')
      setNumber(editingHole?.number ?? '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBuilding, mode.kind === 'building' ? mode.editingHoleId : null])

  if (!isBuilding) return null

  const teeCount = mode.selectedTees.length
  const basketCount = mode.selectedBaskets.length
  const canConfirm = teeCount > 0 && basketCount > 0

  const handleConfirm = async () => {
    setSaving(true)
    try {
      if (mode.editingHoleId) {
        await editHole({
          holeId: mode.editingHoleId,
          name: name.trim() || null,
          number: number === '' ? null : number,
          teeIds: mode.selectedTees,
          basketIds: mode.selectedBaskets,
        })
        notifications.show({ color: 'green', message: 'Hole updated.' })
      } else {
        await addHole({
          ...(name.trim() ? { name: name.trim() } : {}),
          ...(number !== '' ? { number } : {}),
          teeIds: mode.selectedTees,
          basketIds: mode.selectedBaskets,
        })
        notifications.show({ color: 'green', message: 'Hole created.' })
      }
      dispatch({ type: 'RESET' })
    } catch (err) {
      notifications.show({
        color: 'red',
        message: err instanceof Error ? err.message : 'Failed to save hole.',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Paper className="hole-builder-panel" shadow="lg" radius="lg" p="md" withBorder>
      <Stack gap="sm">
        <Text fw={700} size="sm">
          {mode.editingHoleId ? 'Edit hole' : 'Define a new hole'}
        </Text>
        <Text size="xs" c="dimmed">
          Tap tees and baskets on the map to include them — {teeCount} tee{teeCount === 1 ? '' : 's'},{' '}
          {basketCount} basket{basketCount === 1 ? '' : 's'} selected.
        </Text>

        <Group grow>
          <TextInput
            label="Name"
            placeholder="e.g. Hole 1"
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
          />
          <NumberInput
            label="Number"
            placeholder="1"
            value={number}
            onChange={(value) => setNumber(typeof value === 'number' ? value : '')}
            min={1}
          />
        </Group>

        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={() => dispatch({ type: 'CANCEL' })}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} loading={saving} disabled={!canConfirm}>
            {mode.editingHoleId ? 'Save changes' : 'Create hole'}
          </Button>
        </Group>

        {!canConfirm ? (
          <Text size="xs" c="dimmed">
            Select at least one tee and one basket to continue.
          </Text>
        ) : null}
      </Stack>
    </Paper>
  )
}

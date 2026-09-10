import { useState, type FormEvent } from 'react'
import { Alert, Button, Group, Modal, PasswordInput, Stack, Text } from '@mantine/core'
import { IconAlertCircle, IconInfoCircle } from '@tabler/icons-react'
import { supabase } from '../lib/supabase.js'

type Props = {
  onDone: (success?: boolean) => void
}

export default function ResetPasswordConfirm({ onDone }: Props) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setNotice('')

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setIsSubmitting(true)

    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) {
        setError(updateError.message || 'Unable to update password')
        setIsSubmitting(false)
        return
      }

      // Clear url fragment to avoid repeated processing
      try {
        window.history.replaceState(null, '', window.location.pathname + window.location.search)
      } catch {
        // ignore — cosmetic cleanup only
      }

      setNotice('Password updated. You are now signed in.')
      setIsSubmitting(false)
      onDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setIsSubmitting(false)
    }
  }

  return (
    <Modal
      opened
      onClose={() => onDone(false)}
      title="Reset your password"
      centered
      radius="lg"
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Enter a new password to update your account.
        </Text>

        <form onSubmit={submit}>
          <Stack gap="sm">
            <PasswordInput
              label="New password"
              value={password}
              onChange={(event) => setPassword(event.currentTarget.value)}
              required
            />
            <PasswordInput
              label="Confirm password"
              value={confirm}
              onChange={(event) => setConfirm(event.currentTarget.value)}
              required
            />

            {error ? (
              <Alert color="red" icon={<IconAlertCircle size={16} />} variant="light">
                {error}
              </Alert>
            ) : null}
            {notice ? (
              <Alert color="blue" icon={<IconInfoCircle size={16} />} variant="light">
                {notice}
              </Alert>
            ) : null}

            <Group justify="flex-end" gap="sm">
              <Button variant="default" type="button" onClick={() => onDone(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={isSubmitting}>
                {isSubmitting ? 'Updating…' : 'Set new password'}
              </Button>
            </Group>
          </Stack>
        </form>
      </Stack>
    </Modal>
  )
}

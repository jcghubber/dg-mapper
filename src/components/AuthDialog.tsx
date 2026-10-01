import type { Dispatch, FormEvent, SetStateAction } from 'react'
import { Alert, Anchor, Button, Group, Modal, PasswordInput, Stack, Text, TextInput } from '@mantine/core'
import { IconAlertCircle, IconInfoCircle } from '@tabler/icons-react'

type AuthMode = 'login' | 'signup' | 'reset' | 'magic-link'

type AuthDialogProps = {
  showLoginDialog: boolean
  authMode: AuthMode
  authEmail: string
  authPassword: string
  authError: string
  authNotice: string
  isAuthenticating: boolean
  setAuthMode: Dispatch<SetStateAction<AuthMode>>
  setAuthEmail: Dispatch<SetStateAction<string>>
  setAuthPassword: Dispatch<SetStateAction<string>>
  setAuthError: Dispatch<SetStateAction<string>>
  setAuthNotice: Dispatch<SetStateAction<string>>
  setShowLoginDialog: Dispatch<SetStateAction<boolean>>
  handleLogin: (event: FormEvent<HTMLFormElement>) => Promise<void>
  handleSignup: (event: FormEvent<HTMLFormElement>) => Promise<void>
  handleResetPassword: (event: FormEvent<HTMLFormElement>) => Promise<void>
  handleMagicLinkLogin: (event: FormEvent<HTMLFormElement>) => Promise<void>
}

const TITLES: Record<AuthMode, string> = {
  login: 'Log in',
  signup: 'Create account',
  'magic-link': 'Email me a sign-in link',
  reset: 'Reset password',
}

const DESCRIPTIONS: Record<AuthMode, string> = {
  login: 'Sign in to access user options.',
  signup: 'Create an account with your email and password.',
  'magic-link': 'We will email you a secure link that signs you in instantly.',
  reset: 'Enter your email and we will send you a reset link.',
}

const SUBMIT_LABELS: Record<AuthMode, string> = {
  login: 'Log in',
  signup: 'Create account',
  'magic-link': 'Send sign-in link',
  reset: 'Send reset link',
}

const SUBMITTING_LABELS: Record<AuthMode, string> = {
  login: 'Signing in…',
  signup: 'Creating account…',
  'magic-link': 'Sending sign-in link…',
  reset: 'Sending reset link…',
}

function AuthDialog({
  showLoginDialog,
  authMode,
  authEmail,
  authPassword,
  authError,
  authNotice,
  isAuthenticating,
  setAuthMode,
  setAuthEmail,
  setAuthPassword,
  setAuthError,
  setAuthNotice,
  setShowLoginDialog,
  handleLogin,
  handleSignup,
  handleResetPassword,
  handleMagicLinkLogin,
}: AuthDialogProps) {
  const submitHandler =
    authMode === 'login'
      ? handleLogin
      : authMode === 'signup'
      ? handleSignup
      : authMode === 'magic-link'
      ? handleMagicLinkLogin
      : handleResetPassword

  const resetStatus = () => {
    setAuthError('')
    setAuthNotice('')
  }

  return (
    <Modal
      opened={showLoginDialog}
      onClose={() => setShowLoginDialog(false)}
      title={TITLES[authMode]}
      centered
      radius="lg"
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          {DESCRIPTIONS[authMode]}
        </Text>

        <form onSubmit={submitHandler}>
          <Stack gap="sm">
            <TextInput
              label="Email"
              type="email"
              value={authEmail}
              onChange={(event) => setAuthEmail(event.currentTarget.value)}
              placeholder="you@example.com"
              required
            />

            {authMode !== 'reset' && authMode !== 'magic-link' ? (
              <PasswordInput
                label="Password"
                value={authPassword}
                onChange={(event) => setAuthPassword(event.currentTarget.value)}
                placeholder="••••••••"
                required
              />
            ) : null}

            {authError ? (
              <Alert color="red" icon={<IconAlertCircle size={16} />} variant="light">
                {authError}
              </Alert>
            ) : null}
            {authNotice ? (
              <Alert color="blue" icon={<IconInfoCircle size={16} />} variant="light">
                {authNotice}
              </Alert>
            ) : null}

            <Group justify="flex-end" gap="sm">
              <Button variant="default" type="button" onClick={() => setShowLoginDialog(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={isAuthenticating}>
                {isAuthenticating ? SUBMITTING_LABELS[authMode] : SUBMIT_LABELS[authMode]}
              </Button>
            </Group>

            <Stack gap={4} mt="xs">
              <Anchor
                component="button"
                type="button"
                size="sm"
                onClick={() => {
                  if (authMode === 'reset') {
                    setAuthMode('login')
                  } else {
                    setAuthMode((current) => (current === 'login' ? 'signup' : 'login'))
                  }
                  resetStatus()
                }}
              >
                {authMode === 'login'
                  ? 'Need an account? Create one'
                  : authMode === 'signup'
                  ? 'Already have an account? Log in'
                  : 'Back to log in'}
              </Anchor>

              {authMode === 'login' ? (
                <>
                  <Anchor
                    component="button"
                    type="button"
                    size="sm"
                    onClick={() => {
                      setAuthMode('reset')
                      resetStatus()
                    }}
                  >
                    Forgot password?
                  </Anchor>
                  <Anchor
                    component="button"
                    type="button"
                    size="sm"
                    onClick={() => {
                      setAuthMode('magic-link')
                      resetStatus()
                    }}
                  >
                    Email me a sign-in link
                  </Anchor>
                </>
              ) : null}
            </Stack>
          </Stack>
        </form>
      </Stack>
    </Modal>
  )
}

export default AuthDialog

import type { Dispatch, FormEvent, RefObject, SetStateAction } from 'react'
import './AuthDialog.css'

type AuthMode = 'login' | 'signup' | 'reset' | 'magic-link'

type AuthDialogProps = {
  showLoginDialog: boolean
  loginDialogRef: RefObject<HTMLDivElement | null>
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

function AuthDialog({
  showLoginDialog,
  loginDialogRef,
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
  if (!showLoginDialog) {
    return null
  }

  const submitHandler =
    authMode === 'login'
      ? handleLogin
      : authMode === 'signup'
      ? handleSignup
      : authMode === 'magic-link'
      ? handleMagicLinkLogin
      : handleResetPassword

  return (
    <div className="dialog-backdrop" role="dialog" aria-modal="true">
      <div className="login-dialog" ref={loginDialogRef}>
        <h2>
          {authMode === 'login'
            ? 'Log in'
            : authMode === 'signup'
            ? 'Create account'
            : authMode === 'magic-link'
            ? 'Email me a sign-in link'
            : 'Reset password'}
        </h2>
        <p>
          {authMode === 'login'
            ? 'Sign in to access user options.'
            : authMode === 'signup'
            ? 'Create an account with your email and password.'
            : authMode === 'magic-link'
            ? 'We will email you a secure link that signs you in instantly.'
            : 'Enter your email and we will send you a reset link.'}
        </p>

        <form className="login-form" onSubmit={submitHandler}>
          <label htmlFor="login-email">Email</label>
          <input
            id="login-email"
            type="email"
            value={authEmail}
            onChange={(event) => setAuthEmail(event.target.value)}
            placeholder="you@example.com"
            required
          />

          {authMode !== 'reset' && authMode !== 'magic-link' ? (
            <>
              <label htmlFor="login-password">Password</label>
              <input
                id="login-password"
                type="password"
                value={authPassword}
                onChange={(event) => setAuthPassword(event.target.value)}
                placeholder="••••••••"
                required
              />
            </>
          ) : null}

          {authError ? <p className="status-text error">{authError}</p> : null}
          {authNotice ? <p className="status-text">{authNotice}</p> : null}

          <div className="dialog-actions-row">
            <button type="submit" className="dialog-action-button" disabled={isAuthenticating}>
              {isAuthenticating
                ? authMode === 'login'
                  ? 'Signing in…'
                  : authMode === 'signup'
                  ? 'Creating account…'
                  : authMode === 'magic-link'
                  ? 'Sending sign-in link…'
                  : 'Sending reset link…'
                : authMode === 'login'
                ? 'Log in'
                : authMode === 'signup'
                ? 'Create account'
                : authMode === 'magic-link'
                ? 'Send sign-in link'
                : 'Send reset link'}
            </button>
            <button type="button" className="dialog-secondary-button" onClick={() => setShowLoginDialog(false)}>
              Cancel
            </button>
          </div>

          <button
            type="button"
            className="dialog-switch-mode"
            onClick={() => {
              if (authMode === 'reset') {
                setAuthMode('login')
              } else {
                setAuthMode((current) => (current === 'login' ? 'signup' : 'login'))
              }
              setAuthError('')
              setAuthNotice('')
            }}
          >
            {authMode === 'login'
              ? 'Need an account? Create one'
              : authMode === 'signup'
              ? 'Already have an account? Log in'
              : authMode === 'magic-link'
              ? 'Back to log in'
              : 'Back to log in'}
          </button>

          {authMode === 'login' ? (
            <>
              <button
                type="button"
                className="dialog-switch-mode"
                onClick={() => {
                  setAuthMode('reset')
                  setAuthError('')
                  setAuthNotice('')
                }}
              >
                Forgot password?
              </button>
              <button
                type="button"
                className="dialog-switch-mode"
                onClick={() => {
                  setAuthMode('magic-link')
                  setAuthError('')
                  setAuthNotice('')
                }}
              >
                Email me a sign-in link
              </button>
            </>
          ) : null}
        </form>
      </div>
    </div>
  )
}

export default AuthDialog

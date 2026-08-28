import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase.js'
import './AuthDialog.css'

type Props = {
  onDone: (success?: boolean) => void
}

export default function ResetPasswordConfirm({ onDone }: Props) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
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
      const { error } = await supabase.auth.updateUser({ password })
      if (error) {
        setError(error.message || 'Unable to update password')
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
    <div className="dialog-backdrop" role="dialog" aria-modal="true">
      <div className="login-dialog">
        <h2>Reset your password</h2>
        <p>Enter a new password to update your account.</p>

        <form className="login-form" onSubmit={submit}>
          <label htmlFor="new-password">New password</label>
          <input id="new-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />

          <label htmlFor="confirm-password">Confirm password</label>
          <input id="confirm-password" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />

          {error ? <p className="status-text error">{error}</p> : null}
          {notice ? <p className="status-text">{notice}</p> : null}

          <div className="dialog-actions-row">
            <button type="submit" className="dialog-action-button" disabled={isSubmitting}>
              {isSubmitting ? 'Updating…' : 'Set new password'}
            </button>
            <button type="button" className="dialog-secondary-button" onClick={() => onDone(false)}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

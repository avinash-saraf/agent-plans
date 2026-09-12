import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Eye, EyeOff, LoaderCircle, LogOut } from 'lucide-react'
import { authenticate, getProfile, type AuthSession } from '../lib/auth'
import { ApiError } from '../lib/api'
import { IconButton } from './IconButton'
import { Modal } from './Modal'

export function AccountDialog({
  session,
  onClose,
  onSession,
}: {
  session: AuthSession | null
  onClose: () => void
  onSession: (session: AuthSession | null) => void
}) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const request = useRef<AbortController | null>(null)
  useEffect(() => () => request.current?.abort(), [])
  const accessToken = session?.accessToken
  useEffect(() => {
    if (!accessToken) return
    const controller = new AbortController()
    void getProfile(accessToken, controller.signal).catch((error) => {
      if (!controller.signal.aborted && error instanceof ApiError && error.status === 401) {
        onSession(null)
        setError('Your session expired. Please sign in again.')
      }
    })
    return () => controller.abort()
  }, [accessToken, onSession])
  return (
    <Modal
      open
      onClose={onClose}
      title={
        session ? 'Your account' : mode === 'login' ? 'Welcome back' : 'A little more together'
      }
    >
      {session ? (
        <div className="account-panel">
          <div className="account-identity">
            <span className="account-monogram">{session.user.name.slice(0, 1).toUpperCase()}</span>
            <div>
              <h3>{session.user.name}</h3>
              <p>{session.user.email}</p>
            </div>
          </div>
          <p className="account-note">
            Your account is connected. Group profiles in this preview still stay on this device.
          </p>
          <button className="button secondary" onClick={() => onSession(null)}>
            <LogOut size={17} />
            Sign out
          </button>
        </div>
      ) : (
        <form
          className="account-form"
          onSubmit={async (event) => {
            event.preventDefault()
            if (busy) return
            const fields = new FormData(event.currentTarget)
            const name = String(fields.get('name') ?? '').trim()
            const email = String(fields.get('email') ?? '').trim()
            const password = String(fields.get('password') ?? '')
            if (mode === 'register' && name.length < 2) {
              setError('Use at least two characters for your name.')
              return
            }
            if (mode === 'register' && new TextEncoder().encode(password).length > 72) {
              setError('Please use a shorter password.')
              return
            }
            const controller = new AbortController()
            request.current = controller
            setBusy(true)
            setError('')
            try {
              const result = await authenticate(mode, { name, email, password }, controller.signal)
              const user = await getProfile(result.accessToken, controller.signal)
              if (!controller.signal.aborted) onSession({ ...result, user })
            } catch (error) {
              if (!controller.signal.aborted)
                setError(
                  error instanceof ApiError
                    ? error.message
                    : 'Something went wrong. Please try again.',
                )
            } finally {
              if (!controller.signal.aborted) setBusy(false)
            }
          }}
        >
          {mode === 'register' && (
            <div className="form-field">
              <label htmlFor="account-name">Name</label>
              <input
                id="account-name"
                name="name"
                autoComplete="name"
                minLength={2}
                maxLength={100}
                required
                disabled={busy}
              />
            </div>
          )}
          <div className="form-field">
            <label htmlFor="account-email">Email</label>
            <input
              id="account-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              disabled={busy}
            />
          </div>
          <div className="form-field">
            <label htmlFor="account-password">Password</label>
            <div className="password-input">
              <input
                id="account-password"
                name="password"
                type={visible ? 'text' : 'password'}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                minLength={mode === 'register' ? 8 : undefined}
                maxLength={72}
                required
                disabled={busy}
              />
              <IconButton
                label={visible ? 'Hide password' : 'Show password'}
                onClick={() => setVisible((value) => !value)}
              >
                {visible ? <EyeOff size={18} /> : <Eye size={18} />}
              </IconButton>
            </div>
            {mode === 'register' && <small>At least 8 characters.</small>}
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="button primary" type="submit" disabled={busy}>
            {busy ? <LoaderCircle className="spin" size={17} /> : null}
            {mode === 'login' ? 'Sign in' : 'Create account'}
            {!busy && <ArrowRight size={17} />}
          </button>
          <button
            className="text-button account-alternate"
            type="button"
            disabled={busy}
            onClick={() => {
              setMode((value) => (value === 'login' ? 'register' : 'login'))
              setError('')
            }}
          >
            {mode === 'login' ? 'Create an account' : 'Already have an account?'}
          </button>
        </form>
      )}
    </Modal>
  )
}

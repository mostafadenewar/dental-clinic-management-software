import { useState } from 'react'
import { Eye, EyeSlash, Tooth, SignIn, CircleNotch } from '@phosphor-icons/react'
import { useAuthStore } from './authStore'
import { useBackendReady } from '../api/client'
import './login.css'

const DEMO_ACCOUNTS = [
  { role: 'Admin', username: 'admin', password: 'admin123' },
  { role: 'Dentist', username: 'dr.smith', password: 'smith123' },
  { role: 'Front Desk', username: 'front', password: 'front123' },
]

const Login = () => {
  const ready = useBackendReady()
  const login = useAuthStore((s) => s.login)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!ready) {
    return (
      <div className="login-page">
        <div className="login-card login-waiting">
          <div className="login-logo">
            <Tooth size={26} weight="fill" color="#ffffff" />
          </div>
          <CircleNotch size={20} className="login-spinner" />
          <p>Starting backend…</p>
        </div>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await login(username.trim(), password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
      setBusy(false)
    }
  }

  const fillDemo = (u: string, p: string) => {
    setUsername(u)
    setPassword(p)
    setError(null)
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <div className="login-logo">
            <Tooth size={26} weight="fill" color="#ffffff" />
          </div>
          <div className="login-brand-text">
            <h1>DCMS</h1>
            <span>Dental Clinic Management</span>
          </div>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="ui-field">
            <label className="ui-label" htmlFor="login-username">Username</label>
            <input
              id="login-username"
              className="ui-input"
              type="text"
              autoComplete="username"
              placeholder="e.g. admin"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="ui-field">
            <label className="ui-label" htmlFor="login-password">Password</label>
            <div className="login-password-wrap">
              <input
                id="login-password"
                className="ui-input"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="login-eye"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? <EyeSlash size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {error && <div className="login-error">{error}</div>}

          <button type="submit" className="login-submit" disabled={busy}>
            {busy ? <CircleNotch size={15} className="login-spinner" /> : <SignIn size={15} weight="bold" />}
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="login-demo">
          <span className="login-demo-title">Demo accounts</span>
          <div className="login-demo-row">
            {DEMO_ACCOUNTS.map((a) => (
              <button
                key={a.username}
                type="button"
                className="login-demo-item"
                onClick={() => fillDemo(a.username, a.password)}
              >
                <strong>{a.role}</strong>
                <span>{a.username}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login
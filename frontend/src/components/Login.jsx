import { useState } from 'react'
import SangitaLogo from './SangitaLogo.jsx'
 
export default function Login({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)
 
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!username.trim() || !password.trim()) {
      setError('Please enter both fields.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      })
      const data = await res.json()
      if (res.ok) onLogin(data.token, data.username, data.role)
      else setError(data.error || 'Login failed.')
    } catch {
      setError('Cannot reach server. Is it running?')
    } finally {
      setLoading(false)
    }
  }
 
  return (
    <div className="login-page">
      <div className="login-bg" />
      <div className="login-grid" />
      <div className="login-wrapper">
        <h1 className="login-warning-header">
          Warning! &quot;This is a private website for personal use&quot; If you dont have the permission from Owner of the WebSite please exit
        </h1>
        <div className="login-card">
          <div className="login-logo">
          <div className="login-logo-icon">
            <SangitaLogo size={36} color="var(--emerald)" />
          </div>
          <span className="login-logo-name">Sangita</span>
        </div>
        <p className="login-tagline">Your personal music server</p>
        <form onSubmit={handleSubmit}>
          <div className="login-field">
            <label className="login-label" htmlFor="u">Username</label>
            <input
              id="u"
              className="login-input"
              type="text"
              autoComplete="username"
              placeholder="admin"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoFocus
            />
          </div>
          <div className="login-field">
            <label className="login-label" htmlFor="p">Password</label>
            <input
              id="p"
              className="login-input"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>
          {error && <div className="login-error">{error}</div>}
          <button className="login-btn" type="submit" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
      </div>
    </div>
  )
}

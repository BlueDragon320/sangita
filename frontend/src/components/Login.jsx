import React, { useState } from 'react'
import SangitaLogo from './SangitaLogo.jsx'
import ThemeSelector from './ThemeSelector.jsx'

export default function Login({ onLogin, currentTheme, onSelectTheme }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const [internalTheme, setInternalTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      return document.documentElement.getAttribute('data-theme') || localStorage.getItem('sangita_theme') || 'amoled'
    }
    return 'amoled'
  })

  const activeTheme = currentTheme || internalTheme

  const handleSelectTheme = (newTheme) => {
    if (onSelectTheme) {
      onSelectTheme(newTheme)
    } else {
      setInternalTheme(newTheme)
      if (typeof window !== 'undefined') {
        document.documentElement.setAttribute('data-theme', newTheme)
        try {
          localStorage.setItem('sangita_theme', newTheme)
        } catch (e) {}
      }
    }
  }

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
      <div className="login-theme-selector" data-testid="login-theme-selector">
        <ThemeSelector theme={activeTheme} onSelectTheme={handleSelectTheme} />
      </div>
      <div className="login-bg" />
      <div className="login-grid" />
      <div className="login-wrapper">
        <h1 className="login-warning-header">
          Warning! &quot;This is a private website for personal use&quot; If you dont have the permission from Owner of the WebSite please exit
        </h1>
        <div className="login-card">
          <div className="login-logo">
            <div className="login-logo-icon">
              <SangitaLogo size={36} color="var(--accent)" />
            </div>
            <span className="login-logo-name">Sangita</span>
          </div>
          <p className="login-tagline">Your personal music server</p>
          <form onSubmit={handleSubmit} noValidate>
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
                required
                disabled={loading}
                aria-invalid={!!error}
                aria-describedby={error ? "login-error-msg" : undefined}
                data-testid="login-username-input"
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
                required
                disabled={loading}
                aria-invalid={!!error}
                aria-describedby={error ? "login-error-msg" : undefined}
                data-testid="login-password-input"
              />
            </div>
            {error && (
              <div id="login-error-msg" className="login-error" role="alert">
                {error}
              </div>
            )}
            <button className="login-btn" type="submit" disabled={loading} data-testid="login-submit-btn">
              {loading ? (
                <span className="login-btn-loading">
                  <span className="spinner-inline" data-testid="login-spinner" aria-hidden="true" />
                  Signing in…
                </span>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

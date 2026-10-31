import React, { useState } from 'react'
import SangitaLogo from './SangitaLogo.jsx'
import ThemeSelector from './ThemeSelector.jsx'

export default function Login({ onLogin, currentTheme, onSelectTheme }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
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
      <div className="login-wrapper">
        <div className="login-warning-header" role="note">
          Private website for personal use. Access is restricted to authorized accounts.
        </div>
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
              <div className="login-input-wrapper">
                <input
                  id="p"
                  className="login-input login-input-password"
                  type={showPassword ? 'text' : 'password'}
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
                <button
                  type="button"
                  className="login-password-toggle"
                  onClick={() => setShowPassword(prev => !prev)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
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
                'Sign in'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

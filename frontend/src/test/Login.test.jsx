import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import Login from '../components/Login.jsx'

describe('Login Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
  })

  it('renders login page with form elements, warning banner, and theme selector', () => {
    render(<Login onLogin={vi.fn()} />)

    expect(screen.getByText(/private website for personal use/i)).toBeInTheDocument()
    expect(screen.getByText('Sangita')).toBeInTheDocument()
    expect(screen.getByTestId('sangita-logo')).toBeInTheDocument()
    expect(screen.getByText('Your personal music server')).toBeInTheDocument()

    const usernameInput = screen.getByTestId('login-username-input')
    const passwordInput = screen.getByTestId('login-password-input')
    const submitBtn = screen.getByTestId('login-submit-btn')

    expect(usernameInput).toBeInTheDocument()
    expect(usernameInput).toHaveAttribute('required')
    expect(usernameInput).toHaveAttribute('aria-invalid', 'false')

    expect(passwordInput).toBeInTheDocument()
    expect(passwordInput).toHaveAttribute('required')
    expect(passwordInput).toHaveAttribute('aria-invalid', 'false')

    expect(submitBtn).toBeInTheDocument()
    expect(submitBtn).toHaveTextContent(/sign in/i)

    // ThemeSelector is present in the top corner
    expect(screen.getByTestId('login-theme-selector')).toBeInTheDocument()
    expect(screen.getByTestId('theme-selector-btn')).toBeInTheDocument()
  })

  it('shows validation error with role="alert" when submitting empty fields', () => {
    render(<Login onLogin={vi.fn()} />)

    const submitBtn = screen.getByTestId('login-submit-btn')
    fireEvent.click(submitBtn)

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Please enter both fields.')
    expect(alert).toHaveAttribute('id', 'login-error-msg')

    const usernameInput = screen.getByTestId('login-username-input')
    const passwordInput = screen.getByTestId('login-password-input')

    expect(usernameInput).toHaveAttribute('aria-invalid', 'true')
    expect(usernameInput).toHaveAttribute('aria-describedby', 'login-error-msg')
    expect(passwordInput).toHaveAttribute('aria-invalid', 'true')
    expect(passwordInput).toHaveAttribute('aria-describedby', 'login-error-msg')
  })

  it('submits credentials and invokes onLogin on success', async () => {
    const handleLogin = vi.fn()
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ token: 'mock-token-xyz', username: 'blue', role: 'admin' }),
    })

    render(<Login onLogin={handleLogin} />)

    fireEvent.change(screen.getByTestId('login-username-input'), { target: { value: 'blue' } })
    fireEvent.change(screen.getByTestId('login-password-input'), { target: { value: 'secret123' } })

    fireEvent.click(screen.getByTestId('login-submit-btn'))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'blue', password: 'secret123' }),
      })
      expect(handleLogin).toHaveBeenCalledWith('mock-token-xyz', 'blue', 'admin')
    })
  })

  it('disables inputs and displays inline spinner while loading', async () => {
    let resolveLogin
    global.fetch = vi.fn().mockImplementation(() => new Promise((resolve) => {
      resolveLogin = resolve
    }))

    render(<Login onLogin={vi.fn()} />)

    fireEvent.change(screen.getByTestId('login-username-input'), { target: { value: 'admin' } })
    fireEvent.change(screen.getByTestId('login-password-input'), { target: { value: 'password' } })

    fireEvent.click(screen.getByTestId('login-submit-btn'))

    expect(screen.getByTestId('login-username-input')).toBeDisabled()
    expect(screen.getByTestId('login-password-input')).toBeDisabled()
    expect(screen.getByTestId('login-submit-btn')).toBeDisabled()
    expect(screen.getByTestId('login-spinner')).toBeInTheDocument()
    expect(screen.getByTestId('login-submit-btn')).toHaveTextContent('Signing in…')

    resolveLogin({
      ok: true,
      json: async () => ({ token: 'token', username: 'admin', role: 'admin' }),
    })

    await waitFor(() => {
      expect(screen.getByTestId('login-submit-btn')).not.toHaveTextContent('Signing in…')
    })
  })

  it('displays API error message in alert when login fails', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Invalid username or password' }),
    })

    render(<Login onLogin={vi.fn()} />)

    fireEvent.change(screen.getByTestId('login-username-input'), { target: { value: 'wronguser' } })
    fireEvent.change(screen.getByTestId('login-password-input'), { target: { value: 'wrongpass' } })

    fireEvent.click(screen.getByTestId('login-submit-btn'))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Invalid username or password')
  })

  it('handles server network failure gracefully', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network offline'))

    render(<Login onLogin={vi.fn()} />)

    fireEvent.change(screen.getByTestId('login-username-input'), { target: { value: 'admin' } })
    fireEvent.change(screen.getByTestId('login-password-input'), { target: { value: 'pass' } })

    fireEvent.click(screen.getByTestId('login-submit-btn'))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Cannot reach server. Is it running?')
  })

  it('allows user to change color theme before signing in', () => {
    const handleSelectTheme = vi.fn()
    render(<Login onLogin={vi.fn()} currentTheme="dark" onSelectTheme={handleSelectTheme} />)

    const themeBtn = screen.getByTestId('theme-selector-btn')
    fireEvent.click(themeBtn)

    const lightOption = screen.getByTestId('theme-option-light')
    fireEvent.click(lightOption)

    expect(handleSelectTheme).toHaveBeenCalledWith('light')
  })

  it('toggles password visibility when the show/hide password button is clicked', () => {
    render(<Login onLogin={vi.fn()} />)
    const passwordInput = screen.getByTestId('login-password-input')
    const toggleBtn = screen.getByRole('button', { name: /show password/i })
    expect(passwordInput).toHaveAttribute('type', 'password')

    fireEvent.click(toggleBtn)
    expect(passwordInput).toHaveAttribute('type', 'text')
    expect(screen.getByRole('button', { name: /hide password/i })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /hide password/i }))
    expect(passwordInput).toHaveAttribute('type', 'password')
  })
})

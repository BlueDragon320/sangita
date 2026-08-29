import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import Header from '../components/Header.jsx'

describe('Header Component & Theme Toggle', () => {
  const MockThemeIcon = ({ theme }) => <span data-testid="theme-icon">{theme}</span>

  it('renders search input, home button, devices and theme button', () => {
    render(
      <Header
        view="music"
        onSelectView={vi.fn()}
        isAdmin={true}
        searchQuery=""
        onSearchChange={vi.fn()}
        theme="dark"
        onCycleTheme={vi.fn()}
        ThemeIcon={MockThemeIcon}
        username="admin"
        onLogout={vi.fn()}
        onOpenDevices={vi.fn()}
        deviceCount={3}
      />
    )

    expect(screen.getByPlaceholderText('serach songs pal')).toBeInTheDocument()
    expect(screen.getByText('admin')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('calls onCycleTheme when the theme toggle button is clicked', () => {
    const handleCycleTheme = vi.fn()
    render(
      <Header
        view="music"
        onSelectView={vi.fn()}
        isAdmin={false}
        searchQuery=""
        onSearchChange={vi.fn()}
        theme="dark"
        onCycleTheme={handleCycleTheme}
        ThemeIcon={MockThemeIcon}
        username="user"
        onLogout={vi.fn()}
        onOpenDevices={vi.fn()}
        deviceCount={1}
      />
    )

    const themeBtn = screen.getByTitle('Toggle Theme')
    fireEvent.click(themeBtn)
    expect(handleCycleTheme).toHaveBeenCalledTimes(1)
  })

  it('triggers onSearchChange when typing in the search box', () => {
    const handleSearch = vi.fn()
    render(
      <Header
        view="music"
        onSelectView={vi.fn()}
        isAdmin={false}
        searchQuery="Beatles"
        onSearchChange={handleSearch}
        theme="dark"
        onCycleTheme={vi.fn()}
        ThemeIcon={MockThemeIcon}
        username="user"
        onLogout={vi.fn()}
        onOpenDevices={vi.fn()}
        deviceCount={1}
      />
    )

    const searchInput = screen.getByPlaceholderText('serach songs pal')
    fireEvent.change(searchInput, { target: { value: 'Mozart' } })
    expect(handleSearch).toHaveBeenCalledWith('Mozart')

    const clearBtn = screen.getByTitle('Clear search')
    fireEvent.click(clearBtn)
    expect(handleSearch).toHaveBeenCalledWith('')
  })

  it('opens user profile dropdown and triggers logout', () => {
    const handleLogout = vi.fn()
    render(
      <Header
        view="music"
        onSelectView={vi.fn()}
        isAdmin={false}
        searchQuery=""
        onSearchChange={vi.fn()}
        theme="dark"
        onCycleTheme={vi.fn()}
        ThemeIcon={MockThemeIcon}
        username="blue"
        onLogout={handleLogout}
        onOpenDevices={vi.fn()}
        deviceCount={1}
      />
    )

    const userProfile = screen.getByText('blue')
    fireEvent.click(userProfile)

    const logoutBtn = screen.getByText('Sign Out')
    expect(logoutBtn).toBeInTheDocument()

    fireEvent.click(logoutBtn)
    expect(handleLogout).toHaveBeenCalledTimes(1)
  })

  it('calls onSelectView with home when home button is clicked', () => {
    const handleSelectView = vi.fn()
    render(
      <Header
        view="music"
        onSelectView={handleSelectView}
        isAdmin={false}
        searchQuery=""
        onSearchChange={vi.fn()}
        theme="dark"
        onCycleTheme={vi.fn()}
        ThemeIcon={MockThemeIcon}
        username="blue"
        onLogout={vi.fn()}
        onOpenDevices={vi.fn()}
        deviceCount={1}
      />
    )

    const homeBtn = screen.getByTestId('header-home-btn')
    fireEvent.click(homeBtn)
    expect(handleSelectView).toHaveBeenCalledWith('home')
  })
})

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
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

    expect(screen.getByPlaceholderText('Search songs or playlists')).toBeInTheDocument()
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

    const searchInput = screen.getByPlaceholderText('Search songs or playlists')
    fireEvent.change(searchInput, { target: { value: 'Mozart' } })
    expect(handleSearch).toHaveBeenCalledWith('Mozart')

    const clearBtn = screen.getByTitle('Clear search')
    fireEvent.click(clearBtn)
    expect(handleSearch).toHaveBeenCalledWith('')
  })

  it('opens user profile dropdown and triggers logout without admin button', () => {
    const handleLogout = vi.fn()
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
    expect(screen.queryByText('Admin Panel')).not.toBeInTheDocument()

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

  it('renders ThemeSelector when setTheme is provided and allows direct selection of 3 themes', () => {
    const handleSetTheme = vi.fn()
    render(
      <Header
        view="music"
        onSelectView={vi.fn()}
        isAdmin={false}
        searchQuery=""
        onSearchChange={vi.fn()}
        theme="amoled"
        setTheme={handleSetTheme}
        onCycleTheme={vi.fn()}
        ThemeIcon={MockThemeIcon}
        username="blue"
        onLogout={vi.fn()}
        onOpenDevices={vi.fn()}
        deviceCount={1}
      />
    )

    // Verify ThemeSelector is rendered
    const selectorTrigger = screen.getByTestId('theme-selector-btn')
    expect(selectorTrigger).toBeInTheDocument()
    expect(selectorTrigger).toHaveAttribute('aria-haspopup', 'listbox')

    // Open ThemeSelector
    fireEvent.click(selectorTrigger)

    // Verify all 3 options are displayed in menu
    const menu = screen.getByTestId('theme-selector-menu')
    expect(within(menu).getByText('Pure AMOLED Black')).toBeInTheDocument()
    expect(within(menu).getByText('Dark Obsidian')).toBeInTheDocument()
    expect(within(menu).getByText('Light Zinc')).toBeInTheDocument()

    // Select Dark Obsidian
    fireEvent.click(screen.getByTestId('theme-option-dark'))
    expect(handleSetTheme).toHaveBeenCalledWith('dark')
  })

  it('closes ThemeSelector menu when Escape key is pressed', () => {
    render(
      <Header
        view="music"
        onSelectView={vi.fn()}
        isAdmin={false}
        searchQuery=""
        onSearchChange={vi.fn()}
        theme="amoled"
        setTheme={vi.fn()}
        onCycleTheme={vi.fn()}
        ThemeIcon={MockThemeIcon}
        username="blue"
        onLogout={vi.fn()}
        onOpenDevices={vi.fn()}
        deviceCount={1}
      />
    )

    const trigger = screen.getByTestId('theme-selector-btn')
    fireEvent.click(trigger)
    expect(screen.getByTestId('theme-selector-menu')).toBeInTheDocument()

    const menu = screen.getByTestId('theme-selector-menu')
    fireEvent.keyDown(menu, { key: 'Escape' })
    expect(screen.queryByTestId('theme-selector-menu')).not.toBeInTheDocument()
  })

  it('renders mobile menu button when onOpenMobileMenu is provided and triggers callback', () => {
    const handleOpenMobile = vi.fn()
    render(
      <Header
        view="music"
        onSelectView={vi.fn()}
        isAdmin={false}
        searchQuery=""
        onSearchChange={vi.fn()}
        theme="amoled"
        onCycleTheme={vi.fn()}
        ThemeIcon={MockThemeIcon}
        username="blue"
        onLogout={vi.fn()}
        onOpenDevices={vi.fn()}
        deviceCount={1}
        onOpenMobileMenu={handleOpenMobile}
      />
    )

    const mobileBtn = screen.getByTestId('header-mobile-menu-btn')
    expect(mobileBtn).toBeInTheDocument()
    expect(mobileBtn).toHaveAttribute('aria-label', 'Open library navigation')
    fireEvent.click(mobileBtn)
    expect(handleOpenMobile).toHaveBeenCalledTimes(1)
  })

  it('has accessible home button with aria-label', () => {
    render(
      <Header
        view="music"
        onSelectView={vi.fn()}
        isAdmin={false}
        searchQuery=""
        onSearchChange={vi.fn()}
        theme="amoled"
        onCycleTheme={vi.fn()}
        ThemeIcon={MockThemeIcon}
        username="blue"
        onLogout={vi.fn()}
        onOpenDevices={vi.fn()}
        deviceCount={1}
      />
    )

    const homeBtn = screen.getByTestId('header-home-btn')
    expect(homeBtn).toHaveAttribute('aria-label', 'Home Dashboard')
  })

  it('clears search and blurs input on Escape keydown, clear button has aria-label', () => {
    const handleSearch = vi.fn()
    render(
      <Header
        view="music"
        onSelectView={vi.fn()}
        isAdmin={false}
        searchQuery="Beatles"
        onSearchChange={handleSearch}
        theme="amoled"
        onCycleTheme={vi.fn()}
        ThemeIcon={MockThemeIcon}
        username="blue"
        onLogout={vi.fn()}
        onOpenDevices={vi.fn()}
        deviceCount={1}
      />
    )

    const searchInput = screen.getByTestId('header-search-input')
    expect(searchInput).toHaveAttribute('aria-label', 'Search songs or playlists')

    const clearBtn = screen.getByTestId('header-search-clear')
    expect(clearBtn).toHaveAttribute('aria-label', 'Clear search')

    const blurSpy = vi.spyOn(searchInput, 'blur')
    fireEvent.keyDown(searchInput, { key: 'Escape' })
    expect(handleSearch).toHaveBeenCalledWith('')
    expect(blurSpy).toHaveBeenCalled()
  })

  it('supports keyboard navigation on user profile widget with Enter and Space keys', () => {
    render(
      <Header
        view="music"
        onSelectView={vi.fn()}
        isAdmin={false}
        searchQuery=""
        onSearchChange={vi.fn()}
        theme="amoled"
        onCycleTheme={vi.fn()}
        ThemeIcon={MockThemeIcon}
        username="blue"
        onLogout={vi.fn()}
        onOpenDevices={vi.fn()}
        deviceCount={1}
      />
    )

    const profileWidget = screen.getByTestId('header-user-profile')
    expect(profileWidget).toHaveAttribute('role', 'button')
    expect(profileWidget).toHaveAttribute('tabIndex', '0')
    expect(profileWidget).toHaveAttribute('aria-haspopup', 'menu')
    expect(profileWidget).toHaveAttribute('aria-expanded', 'false')

    // Open using Enter key
    fireEvent.keyDown(profileWidget, { key: 'Enter' })
    expect(screen.getByTestId('dropdown-logout-btn')).toBeInTheDocument()
    expect(profileWidget).toHaveAttribute('aria-expanded', 'true')

    // Close using Space key
    fireEvent.keyDown(profileWidget, { key: ' ' })
    expect(screen.queryByTestId('dropdown-logout-btn')).not.toBeInTheDocument()
    expect(profileWidget).toHaveAttribute('aria-expanded', 'false')
  })
})

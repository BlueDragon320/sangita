import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import React from 'react'
import ThemeSelector, { THEME_OPTIONS } from '../components/ThemeSelector.jsx'

describe('ThemeSelector Component', () => {
  const MockThemeIcon = ({ theme }) => <span data-testid="mock-icon">{theme}</span>

  it('renders theme cycle button when only onCycleTheme is provided', () => {
    const handleCycle = vi.fn()
    render(
      <ThemeSelector
        theme="dark"
        onCycleTheme={handleCycle}
        ThemeIcon={MockThemeIcon}
      />
    )

    const btn = screen.getByTestId('admin-theme-btn')
    expect(btn).toBeInTheDocument()
    expect(btn).toHaveAttribute('tabIndex', '0')
    expect(btn).toHaveAttribute('aria-label', 'Cycle color theme')
    expect(btn).toHaveAttribute('title', 'Cycle color theme')
    expect(screen.getByTestId('mock-icon')).toHaveTextContent('dark')

    fireEvent.click(btn)
    expect(handleCycle).toHaveBeenCalledTimes(1)
  })

  it('provides ONE clean interactive trigger without any extra native select dropdown', () => {
    const handleSelect = vi.fn()
    render(
      <ThemeSelector
        theme="dark"
        onSelectTheme={handleSelect}
      />
    )

    // Verify trigger button exists and has appropriate ARIA attributes and tabIndex
    const trigger = screen.getByTestId('theme-selector-btn')
    expect(trigger).toBeInTheDocument()
    expect(trigger).toHaveAttribute('tabIndex', '0')
    expect(trigger).toHaveAttribute('aria-haspopup', 'listbox')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(trigger).toHaveAttribute('aria-label', 'Select color theme')

    // Ensure NO native select element exists (Issue 2 fix)
    expect(document.querySelector('select')).not.toBeInTheDocument()
    expect(screen.queryByTestId('theme-select')).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()

    // Ensure only one button is rendered initially
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(1)
  })

  it('opens custom themed listbox menu and allows option selection', () => {
    const handleSelect = vi.fn()
    render(
      <ThemeSelector
        theme="dark"
        onSelectTheme={handleSelect}
      />
    )

    const trigger = screen.getByTestId('theme-selector-btn')
    fireEvent.click(trigger)

    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    const menu = screen.getByTestId('theme-selector-menu')
    expect(menu).toBeInTheDocument()
    expect(menu).toHaveAttribute('role', 'listbox')

    // Verify all 3 options are present
    expect(within(menu).getByText('Pure AMOLED Black')).toBeInTheDocument()
    expect(within(menu).getByText('Dark Obsidian')).toBeInTheDocument()
    expect(within(menu).getByText('Light Zinc')).toBeInTheDocument()

    // Dark option is currently selected
    expect(screen.getByTestId('theme-option-dark')).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByTestId('theme-check-dark')).toBeInTheDocument()

    // Select Pure AMOLED Black
    fireEvent.click(screen.getByTestId('theme-option-amoled'))
    expect(handleSelect).toHaveBeenCalledWith('amoled')
    expect(screen.queryByTestId('theme-selector-menu')).not.toBeInTheDocument()
  })

  it('supports full keyboard navigation flow: Enter to open, Arrow keys to navigate, Enter to select', () => {
    const handleSelect = vi.fn()
    render(
      <ThemeSelector
        theme="amoled"
        onSelectTheme={handleSelect}
      />
    )

    const trigger = screen.getByTestId('theme-selector-btn')

    // Open via Enter key
    fireEvent.keyDown(trigger, { key: 'Enter' })
    expect(screen.getByTestId('theme-selector-menu')).toBeInTheDocument()

    const menu = screen.getByTestId('theme-selector-menu')

    // Navigate down from 0 (amoled) to 1 (dark)
    fireEvent.keyDown(menu, { key: 'ArrowDown' })
    expect(screen.getByTestId('theme-option-dark')).toHaveClass('focused')

    // Navigate down from 1 (dark) to 2 (light)
    fireEvent.keyDown(menu, { key: 'ArrowDown' })
    expect(screen.getByTestId('theme-option-light')).toHaveClass('focused')

    // Navigate up back to 1 (dark)
    fireEvent.keyDown(menu, { key: 'ArrowUp' })
    expect(screen.getByTestId('theme-option-dark')).toHaveClass('focused')

    // Select focused option (dark) using Enter
    fireEvent.keyDown(menu, { key: 'Enter' })
    expect(handleSelect).toHaveBeenCalledWith('dark')
    expect(screen.queryByTestId('theme-selector-menu')).not.toBeInTheDocument()
  })

  it('closes menu and refocuses trigger on Escape key', () => {
    render(
      <ThemeSelector
        theme="amoled"
        onSelectTheme={vi.fn()}
      />
    )

    const trigger = screen.getByTestId('theme-selector-btn')
    fireEvent.click(trigger)
    expect(screen.getByTestId('theme-selector-menu')).toBeInTheDocument()

    const menu = screen.getByTestId('theme-selector-menu')
    fireEvent.keyDown(menu, { key: 'Escape' })
    expect(screen.queryByTestId('theme-selector-menu')).not.toBeInTheDocument()
  })

  it('closes menu when Tab key is pressed', () => {
    render(
      <ThemeSelector
        theme="amoled"
        onSelectTheme={vi.fn()}
      />
    )

    const trigger = screen.getByTestId('theme-selector-btn')
    fireEvent.click(trigger)
    expect(screen.getByTestId('theme-selector-menu')).toBeInTheDocument()

    const menu = screen.getByTestId('theme-selector-menu')
    fireEvent.keyDown(menu, { key: 'Tab' })
    expect(screen.queryByTestId('theme-selector-menu')).not.toBeInTheDocument()
  })

  it('previews each theme accent color in the swatch dot', () => {
    render(<ThemeSelector theme="amoled" onSelectTheme={vi.fn()} />)
    fireEvent.click(screen.getByTestId('theme-selector-btn'))

    const amoledDot = screen.getByTestId('theme-swatch-dot-amoled')
    const darkDot = screen.getByTestId('theme-swatch-dot-dark')
    const lightDot = screen.getByTestId('theme-swatch-dot-light')

    expect(amoledDot).toBeInTheDocument()
    expect(darkDot).toBeInTheDocument()
    expect(lightDot).toBeInTheDocument()
    expect(amoledDot).toHaveStyle({ backgroundColor: 'rgb(102, 163, 191)' })
    expect(darkDot).toHaveStyle({ backgroundColor: 'rgb(102, 163, 191)' })
    expect(lightDot).toHaveStyle({ backgroundColor: 'rgb(3, 47, 114)' })
  })
})

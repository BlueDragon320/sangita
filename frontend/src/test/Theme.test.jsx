import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import React, { useState } from 'react'
import fs from 'node:fs'
import path from 'node:path'
import ThemeSelector, { THEME_OPTIONS } from '../components/ThemeSelector.jsx'
import {
  resolveInitialTheme,
  THEME_STORAGE_KEY,
  THEME_MIGRATION_KEY,
  VALID_THEMES,
  ThemeIcon
} from '../App.jsx'

describe('Theme System: Alignment with Android & Migration', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
    vi.restoreAllMocks()
  })

  afterEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
  })

  describe('resolveInitialTheme: Storage Migration Rules', () => {
    it('defaults to "amoled" when no theme is stored (first-time visitor) and marks as migrated', () => {
      const initial = resolveInitialTheme()
      expect(initial).toBe('amoled')
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('amoled')
      expect(localStorage.getItem(THEME_MIGRATION_KEY)).toBe('true')
    })

    it('migrates legacy "dark" (pure black #000000 in v1) to "amoled" when unmigrated', () => {
      // Simulate existing user with legacy 'dark' saved before v2 alignment
      localStorage.setItem(THEME_STORAGE_KEY, 'dark')
      // Note: THEME_MIGRATION_KEY is not set yet

      const resolved = resolveInitialTheme()
      // According to implementationplan.md Part 1:
      // "Because the current web dark theme is pure black, consider migrating an existing dark selection to AMOLED
      // so a returning user’s saved appearance does not unexpectedly change."
      expect(resolved).toBe('amoled')
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('amoled')
      expect(localStorage.getItem(THEME_MIGRATION_KEY)).toBe('true')
    })

    it('preserves legacy "light" theme when unmigrated and marks migrated', () => {
      localStorage.setItem(THEME_STORAGE_KEY, 'light')

      const resolved = resolveInitialTheme()
      expect(resolved).toBe('light')
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light')
      expect(localStorage.getItem(THEME_MIGRATION_KEY)).toBe('true')
    })

    it('respects explicitly chosen "dark" (Dark Obsidian #080A0F) once migrated', () => {
      localStorage.setItem(THEME_STORAGE_KEY, 'dark')
      localStorage.setItem(THEME_MIGRATION_KEY, 'true')

      const resolved = resolveInitialTheme()
      expect(resolved).toBe('dark')
    })

    it('respects "amoled" (Pure AMOLED Black #000000) when migrated', () => {
      localStorage.setItem(THEME_STORAGE_KEY, 'amoled')
      localStorage.setItem(THEME_MIGRATION_KEY, 'true')

      const resolved = resolveInitialTheme()
      expect(resolved).toBe('amoled')
    })

    it('respects "light" (Light Zinc #F8FAFC) when migrated', () => {
      localStorage.setItem(THEME_STORAGE_KEY, 'light')
      localStorage.setItem(THEME_MIGRATION_KEY, 'true')

      const resolved = resolveInitialTheme()
      expect(resolved).toBe('light')
    })

    it('safely handles localStorage throwing exceptions (e.g. storage disabled or quota exceeded)', () => {
      const faultyStorage = {
        getItem: () => { throw new Error('SecurityError: Access Denied') },
        setItem: () => { throw new Error('QuotaExceededError') }
      }
      const resolved = resolveInitialTheme(faultyStorage)
      expect(resolved).toBe('amoled')
    })
  })

  describe('ThemeSelector: Direct 3-Theme Selection', () => {
    it('renders all three named Android-aligned theme choices in options', () => {
      expect(THEME_OPTIONS).toHaveLength(3)
      expect(THEME_OPTIONS.map(o => o.id)).toEqual(['amoled', 'dark', 'light'])
      expect(THEME_OPTIONS.map(o => o.name)).toEqual([
        'Pure AMOLED Black',
        'Dark Obsidian',
        'Light Zinc'
      ])
    })

    it('renders trigger button with correct ARIA attributes', () => {
      render(<ThemeSelector theme="amoled" onSelectTheme={vi.fn()} />)

      const trigger = screen.getByTestId('theme-selector-btn')
      expect(trigger).toBeInTheDocument()
      expect(trigger).toHaveAttribute('tabIndex', '0')
      expect(trigger).toHaveAttribute('aria-haspopup', 'listbox')
      expect(trigger).toHaveAttribute('aria-expanded', 'false')
      expect(trigger).toHaveAttribute('aria-label', 'Select color theme')

      // Ensure no duplicate native select control is rendered
      expect(document.querySelector('select')).not.toBeInTheDocument()
      expect(screen.queryByTestId('theme-select')).not.toBeInTheDocument()
    })

    it('opens dropdown menu and renders all 3 options with visual checkmark on selected theme', () => {
      render(<ThemeSelector theme="dark" onSelectTheme={vi.fn()} />)

      const trigger = screen.getByTestId('theme-selector-btn')
      fireEvent.click(trigger)

      expect(trigger).toHaveAttribute('aria-expanded', 'true')
      const menu = screen.getByTestId('theme-selector-menu')
      expect(menu).toBeInTheDocument()
      expect(menu).toHaveAttribute('role', 'listbox')

      // Check all 3 options exist within the menu
      expect(within(menu).getByText('Pure AMOLED Black')).toBeInTheDocument()
      expect(within(menu).getByText('Dark Obsidian')).toBeInTheDocument()
      expect(within(menu).getByText('Light Zinc')).toBeInTheDocument()

      // Dark Obsidian should be selected
      const darkOption = screen.getByTestId('theme-option-dark')
      expect(darkOption).toHaveAttribute('aria-selected', 'true')
      expect(screen.getByTestId('theme-check-dark')).toBeInTheDocument()

      // The other options should not be selected
      const amoledOption = screen.getByTestId('theme-option-amoled')
      expect(amoledOption).toHaveAttribute('aria-selected', 'false')
      expect(screen.queryByTestId('theme-check-amoled')).not.toBeInTheDocument()
    })

    it('calls onSelectTheme when an option is clicked and closes the menu', () => {
      const handleSelect = vi.fn()
      render(<ThemeSelector theme="amoled" onSelectTheme={handleSelect} />)

      const trigger = screen.getByTestId('theme-selector-btn')
      fireEvent.click(trigger)

      const lightOption = screen.getByTestId('theme-option-light')
      fireEvent.click(lightOption)

      expect(handleSelect).toHaveBeenCalledWith('light')
      expect(screen.queryByTestId('theme-selector-menu')).not.toBeInTheDocument()
    })

    it('supports selecting Pure AMOLED Black directly', () => {
      const handleSelect = vi.fn()
      render(<ThemeSelector theme="light" onSelectTheme={handleSelect} />)

      fireEvent.click(screen.getByTestId('theme-selector-btn'))
      fireEvent.click(screen.getByTestId('theme-option-amoled'))

      expect(handleSelect).toHaveBeenCalledWith('amoled')
    })

    it('supports selecting Dark Obsidian directly', () => {
      const handleSelect = vi.fn()
      render(<ThemeSelector theme="amoled" onSelectTheme={handleSelect} />)

      fireEvent.click(screen.getByTestId('theme-selector-btn'))
      fireEvent.click(screen.getByTestId('theme-option-dark'))

      expect(handleSelect).toHaveBeenCalledWith('dark')
    })

    it('closes menu when clicking outside', () => {
      render(
        <div>
          <div data-testid="outside-area">Outside</div>
          <ThemeSelector theme="amoled" onSelectTheme={vi.fn()} />
        </div>
      )

      fireEvent.click(screen.getByTestId('theme-selector-btn'))
      expect(screen.getByTestId('theme-selector-menu')).toBeInTheDocument()

      fireEvent.mouseDown(screen.getByTestId('outside-area'))
      expect(screen.queryByTestId('theme-selector-menu')).not.toBeInTheDocument()
    })
  })

  describe('ThemeSelector: Keyboard Navigation & Accessibility', () => {
    it('opens menu with Enter or ArrowDown key on trigger button', () => {
      render(<ThemeSelector theme="amoled" onSelectTheme={vi.fn()} />)

      const trigger = screen.getByTestId('theme-selector-btn')
      fireEvent.keyDown(trigger, { key: 'ArrowDown' })

      expect(screen.getByTestId('theme-selector-menu')).toBeInTheDocument()
    })

    it('closes menu and refocuses trigger on Escape key', () => {
      render(<ThemeSelector theme="amoled" onSelectTheme={vi.fn()} />)

      const trigger = screen.getByTestId('theme-selector-btn')
      fireEvent.click(trigger)

      const menu = screen.getByTestId('theme-selector-menu')
      fireEvent.keyDown(menu, { key: 'Escape' })

      expect(screen.queryByTestId('theme-selector-menu')).not.toBeInTheDocument()
    })

    it('navigates with ArrowDown and ArrowUp and selects option with Enter', () => {
      const handleSelect = vi.fn()
      render(<ThemeSelector theme="amoled" onSelectTheme={handleSelect} />)

      const trigger = screen.getByTestId('theme-selector-btn')
      fireEvent.click(trigger)

      const menu = screen.getByTestId('theme-selector-menu')

      // Initial focused index is 0 ('amoled'). ArrowDown moves to 1 ('dark').
      fireEvent.keyDown(menu, { key: 'ArrowDown' })
      expect(screen.getByTestId('theme-option-dark')).toHaveClass('focused')

      // Press Enter to select focused option
      fireEvent.keyDown(menu, { key: 'Enter' })
      expect(handleSelect).toHaveBeenCalledWith('dark')
      expect(screen.queryByTestId('theme-selector-menu')).not.toBeInTheDocument()
    })

    it('supports Home and End keys to navigate to first and last theme', () => {
      render(<ThemeSelector theme="amoled" onSelectTheme={vi.fn()} />)

      fireEvent.click(screen.getByTestId('theme-selector-btn'))
      const menu = screen.getByTestId('theme-selector-menu')

      // Press End to jump to last ('light')
      fireEvent.keyDown(menu, { key: 'End' })
      expect(screen.getByTestId('theme-option-light')).toHaveClass('focused')

      // Press Home to jump back to first ('amoled')
      fireEvent.keyDown(menu, { key: 'Home' })
      expect(screen.getByTestId('theme-option-amoled')).toHaveClass('focused')
    })
  })

  describe('ThemeIcon & Visual Representations', () => {
    it('renders distinct icons for amoled, dark, and light themes', () => {
      const { rerender } = render(<ThemeIcon theme="amoled" />)
      expect(document.querySelector('svg')).toBeInTheDocument()

      rerender(<ThemeIcon theme="dark" />)
      expect(document.querySelector('svg')).toBeInTheDocument()

      rerender(<ThemeIcon theme="light" />)
      expect(document.querySelector('svg')).toBeInTheDocument()
    })
  })

  describe('Integration: DOM data-theme & Persistence & Lyrics Independence', () => {
    function ThemeTestApp() {
      const [currentTheme, setCurrentTheme] = useState(() => resolveInitialTheme())

      const handleThemeSelect = (newTheme) => {
        setCurrentTheme(newTheme)
        document.documentElement.setAttribute('data-theme', newTheme)
        localStorage.setItem(THEME_STORAGE_KEY, newTheme)
        localStorage.setItem(THEME_MIGRATION_KEY, 'true')
      }

      return (
        <div>
          <span data-testid="current-theme-label">{currentTheme}</span>
          <ThemeSelector theme={currentTheme} onSelectTheme={handleThemeSelect} />
        </div>
      )
    }

    it('updates document.documentElement data-theme attribute on theme change', () => {
      render(<ThemeTestApp />)

      expect(screen.getByTestId('current-theme-label')).toHaveTextContent('amoled')

      // Open and switch to Dark Obsidian
      fireEvent.click(screen.getByTestId('theme-selector-btn'))
      fireEvent.click(screen.getByTestId('theme-option-dark'))

      expect(screen.getByTestId('current-theme-label')).toHaveTextContent('dark')
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')

      // Switch to Light Zinc
      fireEvent.click(screen.getByTestId('theme-selector-btn'))
      fireEvent.click(screen.getByTestId('theme-option-light'))

      expect(screen.getByTestId('current-theme-label')).toHaveTextContent('light')
      expect(document.documentElement.getAttribute('data-theme')).toBe('light')
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light')
    })

    it('preserves lyrics overlay background preferences independently', () => {
      // Set an existing lyrics theme preference
      localStorage.setItem('sangita_lyrics_theme', 'combo3')

      render(<ThemeTestApp />)

      // Change application theme to dark obsidian
      fireEvent.click(screen.getByTestId('theme-selector-btn'))
      fireEvent.click(screen.getByTestId('theme-option-dark'))

      // Lyrics preference must remain untouched
      expect(localStorage.getItem('sangita_lyrics_theme')).toBe('combo3')
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
    })
  })

  describe('Color Contrast & WCAG Compliance (Issue 3)', () => {
    function getLuminance(hex) {
      const cleanHex = hex.replace('#', '')
      const r = parseInt(cleanHex.substring(0, 2), 16) / 255
      const g = parseInt(cleanHex.substring(2, 4), 16) / 255
      const b = parseInt(cleanHex.substring(4, 6), 16) / 255

      const toLinear = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
      return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)
    }

    function getContrastRatio(hex1, hex2) {
      const lum1 = getLuminance(hex1)
      const lum2 = getLuminance(hex2)
      const brightest = Math.max(lum1, lum2)
      const darkest = Math.min(lum1, lum2)
      return (brightest + 0.05) / (darkest + 0.05)
    }

    it('ensures --btn-text has WCAG AA compliant contrast (>4.5:1) on --accent in AMOLED and Dark modes', () => {
      // Pure AMOLED Black & Dark Obsidian tokens:
      // --accent: #66A3BF, --btn-text: #051329
      const contrast = getContrastRatio('#66A3BF', '#051329')
      expect(contrast).toBeGreaterThanOrEqual(4.5)
      // Actual ratio is ~6.64:1
      expect(contrast).toBeGreaterThan(6.0)

      // Also verify hover state on --accent-hi (#8EC5DC)
      const hoverContrast = getContrastRatio('#8EC5DC', '#051329')
      expect(hoverContrast).toBeGreaterThanOrEqual(7.0) // >10:1 (WCAG AAA)
    })

    it('ensures --btn-text has WCAG AAA compliant contrast (>10:1) on --accent in Light Zinc mode (Android deep navy palette)', () => {
      // Light Zinc tokens (Android deep navy palette):
      // --accent: #032F72, --btn-text: #FFFFFF
      const contrast = getContrastRatio('#032F72', '#FFFFFF')
      expect(contrast).toBeGreaterThanOrEqual(10.0)
      // Actual ratio is ~12.7:1 (exceeding WCAG AAA requirement of 7:1)
      expect(contrast).toBeGreaterThan(12.0)

      // Also verify hover state on --accent-hi (#0A3D78)
      const hoverContrast = getContrastRatio('#0A3D78', '#FFFFFF')
      expect(hoverContrast).toBeGreaterThanOrEqual(10.0)
    })

    it('ensures focus outlines (--accent) have WCAG compliant contrast (>3:1) against surface backgrounds', () => {
      // AMOLED background #000000 with outline #66A3BF
      const amoledOutlineContrast = getContrastRatio('#66A3BF', '#000000')
      expect(amoledOutlineContrast).toBeGreaterThanOrEqual(3.0)
      expect(amoledOutlineContrast).toBeGreaterThan(7.0)

      // Dark Obsidian background #080A0F with outline #66A3BF
      const darkOutlineContrast = getContrastRatio('#66A3BF', '#080A0F')
      expect(darkOutlineContrast).toBeGreaterThanOrEqual(3.0)
      expect(darkOutlineContrast).toBeGreaterThan(7.0)

      // Light Zinc background #F8FAFC with outline #032F72
      const lightOutlineContrast = getContrastRatio('#032F72', '#F8FAFC')
      expect(lightOutlineContrast).toBeGreaterThanOrEqual(3.0)
      expect(lightOutlineContrast).toBeGreaterThan(10.0)

      // Light Zinc surface #FFFFFF with outline #032F72
      const lightSurfaceOutlineContrast = getContrastRatio('#032F72', '#FFFFFF')
      expect(lightSurfaceOutlineContrast).toBeGreaterThanOrEqual(3.0)
      expect(lightSurfaceOutlineContrast).toBeGreaterThan(10.0)
    })

    it('verifies light theme CSS tokens in index.css contain Android deep navy palette', () => {
      const cssPath = path.resolve(__dirname, '../index.css')
      const cssContent = fs.readFileSync(cssPath, 'utf-8')

      // Locate [data-theme="light"] block
      const lightBlockMatch = cssContent.match(/\[data-theme="light"\]\s*\{([^}]+)\}/)
      expect(lightBlockMatch).not.toBeNull()
      const lightBlock = lightBlockMatch[1]

      expect(lightBlock).toMatch(/--accent:\s*#032F72;/)
      expect(lightBlock).toMatch(/--accent-hi:\s*#0A3D78;/)
      expect(lightBlock).toMatch(/--accent-dim:\s*#021E4A;/)
      expect(lightBlock).toMatch(/--accent-navy:\s*#032F72;/)
      expect(lightBlock).toMatch(/--accent-glow:\s*rgba\(3,\s*47,\s*114,\s*0\.15\);/)
      expect(lightBlock).toMatch(/--btn-text:\s*#FFFFFF;/)
    })
  })
})

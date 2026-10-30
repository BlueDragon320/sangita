import React, { useState, useRef, useEffect, useCallback } from 'react'

export const THEME_OPTIONS = [
  {
    id: 'amoled',
    name: 'Pure AMOLED Black',
    shortName: 'AMOLED',
    desc: 'Pure #000000 surfaces',
    previewBg: '#000000',
    accentColor: '#66A3BF'
  },
  {
    id: 'dark',
    name: 'Dark Obsidian',
    shortName: 'Dark',
    desc: 'Deep #080A0F surfaces',
    previewBg: '#080A0F',
    accentColor: '#66A3BF'
  },
  {
    id: 'light',
    name: 'Light Zinc',
    shortName: 'Light',
    desc: 'Crisp #F8FAFC surfaces',
    previewBg: '#F8FAFC',
    accentColor: '#032F72'
  }
]

export function DefaultThemeIcon({ theme }) {
  if (theme === 'light') {
    // Sun icon
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true" data-testid="icon-theme-light">
        <path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0 .39-.39.39-1.03 0-1.41l-1.06-1.06zm1.06-10.96c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z"/>
      </svg>
    )
  }
  if (theme === 'dark') {
    // Crescent moon icon for obsidian
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true" data-testid="icon-theme-dark">
        <path d="M12.3 2a10 10 0 0 0-.19 20 10.04 10.04 0 0 0 9.89-8.49c.12-.66-.45-1.21-1.1-1.05a7.51 7.51 0 0 1-9.15-9.15c.16-.65-.39-1.22-1.05-1.1A9.87 9.87 0 0 0 12.3 2z"/>
      </svg>
    )
  }
  // AMOLED: Pure Black circle / OLED high contrast icon
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true" data-testid="icon-theme-amoled">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14a6 6 0 1 0 0 12 6 6 0 0 0 0-12z"/>
    </svg>
  )
}

export default function ThemeSelector({
  theme = 'amoled',
  onSelectTheme,
  onCycleTheme,
  ThemeIcon: CustomThemeIcon,
  compact = false,
  className = ''
}) {
  const [isOpen, setIsOpen] = useState(false)
  const isCycleOnly = !onSelectTheme && !!onCycleTheme
  const currentThemeIndex = Math.max(0, THEME_OPTIONS.findIndex(o => o.id === theme))
  const [focusedIndex, setFocusedIndex] = useState(currentThemeIndex)
  const containerRef = useRef(null)
  const triggerRef = useRef(null)
  const optionsRef = useRef([])

  // Close when clicking outside
  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  // Sync focusedIndex when dropdown opens
  useEffect(() => {
    if (isOpen) {
      setFocusedIndex(currentThemeIndex)
    }
  }, [isOpen, currentThemeIndex])

  // Focus element when focusedIndex changes while open
  useEffect(() => {
    if (isOpen && optionsRef.current[focusedIndex]) {
      optionsRef.current[focusedIndex].focus()
    }
  }, [isOpen, focusedIndex])

  const handleSelect = useCallback((selectedId) => {
    if (onSelectTheme) {
      onSelectTheme(selectedId)
    }
    setIsOpen(false)
    if (triggerRef.current) {
      triggerRef.current.focus()
    }
  }, [onSelectTheme])

  const handleTriggerKeyDown = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (isCycleOnly) {
        onCycleTheme?.()
      } else {
        setIsOpen(true)
      }
    } else if (e.key === 'Escape' && isOpen) {
      e.preventDefault()
      setIsOpen(false)
    }
  }

  const handleListKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      setIsOpen(false)
      if (triggerRef.current) triggerRef.current.focus()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setFocusedIndex((prev) => (prev + 1) % THEME_OPTIONS.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setFocusedIndex((prev) => (prev - 1 + THEME_OPTIONS.length) % THEME_OPTIONS.length)
    } else if (e.key === 'Home') {
      e.preventDefault()
      setFocusedIndex(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      setFocusedIndex(THEME_OPTIONS.length - 1)
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      const opt = THEME_OPTIONS[focusedIndex]
      if (opt) handleSelect(opt.id)
    } else if (e.key === 'Tab') {
      setIsOpen(false)
    }
  }

  const currentOption = THEME_OPTIONS.find(o => o.id === theme) || THEME_OPTIONS[0]

  // If component is used only in cycle mode without direct selection callback:
  if (isCycleOnly) {
    return (
      <button
        ref={triggerRef}
        type="button"
        tabIndex={0}
        className={`admin-nav-btn theme-selector-btn ${compact ? 'compact' : ''} ${className}`}
        onClick={onCycleTheme}
        aria-label="Cycle color theme"
        title="Cycle color theme"
        data-testid="admin-theme-btn"
      >
        {CustomThemeIcon ? (
          <CustomThemeIcon theme={theme} />
        ) : (
          <DefaultThemeIcon theme={theme} />
        )}
      </button>
    )
  }

  return (
    <div
      ref={containerRef}
      className={`theme-selector-container ${className}`}
      data-testid="theme-selector"
    >
      <button
        ref={triggerRef}
        type="button"
        tabIndex={0}
        className={`theme-selector-btn ${compact ? 'compact' : ''} ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleTriggerKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? 'theme-selector-listbox' : undefined}
        aria-label="Select color theme"
        title={`Select color theme: current is ${currentOption.name}`}
        data-testid="theme-selector-btn"
      >
        {CustomThemeIcon ? (
          <CustomThemeIcon theme={theme} />
        ) : (
          <DefaultThemeIcon theme={theme} />
        )}
      </button>

      {isOpen && (
        <div
          id="theme-selector-listbox"
          role="listbox"
          aria-label="Select color theme"
          aria-activedescendant={`theme-opt-${THEME_OPTIONS[focusedIndex]?.id}`}
          tabIndex={-1}
          className="theme-selector-menu"
          onKeyDown={handleListKeyDown}
          data-testid="theme-selector-menu"
        >
          <div className="theme-selector-header" aria-hidden="true">
            Color Theme
          </div>

          {THEME_OPTIONS.map((opt, idx) => {
            const isSelected = theme === opt.id
            const isFocused = focusedIndex === idx

            return (
              <button
                key={opt.id}
                ref={(el) => (optionsRef.current[idx] = el)}
                id={`theme-opt-${opt.id}`}
                role="option"
                aria-selected={isSelected}
                tabIndex={isFocused ? 0 : -1}
                className={`theme-option-btn ${isSelected ? 'selected' : ''} ${isFocused ? 'focused' : ''}`}
                onClick={() => handleSelect(opt.id)}
                onKeyDown={handleListKeyDown}
                onMouseEnter={() => setFocusedIndex(idx)}
                data-testid={`theme-option-${opt.id}`}
              >
                <div className="theme-option-left">
                  <span className={`theme-swatch ${opt.id}`}>
                    <span
                      className="theme-swatch-dot"
                      style={opt.accentColor ? { backgroundColor: opt.accentColor } : undefined}
                      data-testid={`theme-swatch-dot-${opt.id}`}
                    />
                  </span>
                  <div className="theme-option-text">
                    <span className="theme-option-title">{opt.name}</span>
                    <span className="theme-option-desc">{opt.desc}</span>
                  </div>
                </div>

                {isSelected && (
                  <span className="theme-option-check" aria-hidden="true" data-testid={`theme-check-${opt.id}`}>
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                    </svg>
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

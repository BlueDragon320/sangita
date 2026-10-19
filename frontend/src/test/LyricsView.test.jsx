import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import LyricsView from '../components/LyricsView.jsx'

describe('LyricsView Component', () => {
  const mockTrack = {
    name: 'Bohemian Rhapsody',
    artist: 'Queen',
    path: 'Rock/Queen - Bohemian Rhapsody.mp3'
  }

  it('renders without crashing and displays empty state when no lyrics available', () => {
    const handleClose = vi.fn()
    render(
      <LyricsView
        track={mockTrack}
        currentTime={10}
        duration={354}
        lyricsData={{ has_lyrics: false, raw: null }}
        loading={false}
        onClose={handleClose}
      />
    )

    expect(screen.getByText('Bohemian Rhapsody')).toBeInTheDocument()
    expect(screen.getByText('Queen')).toBeInTheDocument()
    expect(screen.getByText(/No lyrics avaliable/i)).toBeInTheDocument()
  })

  it('renders synced lines properly and highlights active line', () => {
    const lrcContent = `
[00:01.00] Is this the real life?
[00:04.00] Is this just fantasy?
[00:08.00] Caught in a landslide
    `.trim()

    const onSeek = vi.fn()

    render(
      <LyricsView
        track={mockTrack}
        currentTime={4.5}
        duration={300}
        lyricsData={{ has_lyrics: true, raw: lrcContent }}
        loading={false}
        onSeek={onSeek}
      />
    )

    expect(screen.getByText('Is this the real life?')).toBeInTheDocument()
    expect(screen.getByText('Is this just fantasy?')).toBeInTheDocument()
    expect(screen.getByText('Caught in a landslide')).toBeInTheDocument()

    // Line at 00:04 should be active for currentTime 4.5
    const line2 = screen.getByText('Is this just fantasy?').closest('.lyric-line')
    expect(line2).toHaveClass('active')

    // Click line to seek
    fireEvent.click(line2)
    expect(onSeek).toHaveBeenCalledWith(4)
  })

  it('supports adjusting sync offset nudges', () => {
    const lrcContent = `[00:02.00] Line 1`
    render(
      <LyricsView
        track={mockTrack}
        currentTime={2}
        duration={100}
        lyricsData={{ has_lyrics: true, raw: lrcContent }}
        loading={false}
      />
    )

    const nudgeEarlier = screen.getByTestId('lyrics-nudge-earlier')
    const offsetReset = screen.getByTestId('lyrics-offset-reset')
    const nudgeLater = screen.getByTestId('lyrics-nudge-later')

    expect(offsetReset).toHaveTextContent('Sync: 0.0s')

    fireEvent.click(nudgeLater)
    expect(offsetReset).toHaveTextContent('+0.5s')

    fireEvent.click(nudgeEarlier)
    expect(offsetReset).toHaveTextContent('Sync: 0.0s')
  })

  it('toggles maximize / fullscreen mode and handles escape key', () => {
    render(
      <LyricsView
        track={mockTrack}
        currentTime={2}
        duration={100}
        lyricsData={{ has_lyrics: true, raw: '[00:02.00] Line 1' }}
        loading={false}
      />
    )

    const container = screen.getByTestId('lyrics-view')
    const maxBtn = screen.getByTestId('lyrics-maximize-btn')

    expect(container).not.toHaveClass('fullscreen-mode')
    expect(maxBtn).toHaveAttribute('title', 'Maximize (Full screen)')

    // Click maximize
    fireEvent.click(maxBtn)
    expect(container).toHaveClass('fullscreen-mode')
    expect(maxBtn).toHaveAttribute('title', 'Minimize to normal view (Esc)')

    // Press Escape to minimize back
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(container).not.toHaveClass('fullscreen-mode')

    // Click maximize again and click again to minimize
    fireEvent.click(maxBtn)
    expect(container).toHaveClass('fullscreen-mode')
    fireEvent.click(maxBtn)
    expect(container).not.toHaveClass('fullscreen-mode')
  })

  it('toggles dynamic moving background and persists to localStorage', () => {
    localStorage.clear()

    const { unmount } = render(
      <LyricsView
        track={mockTrack}
        currentTime={2}
        duration={100}
        lyricsData={{ has_lyrics: true, raw: '[00:02.00] Line 1' }}
        loading={false}
      />
    )

    const container = screen.getByTestId('lyrics-view')
    const bgBtn = screen.getByTestId('lyrics-ambient-bg-btn')

    // Default is off
    expect(container).not.toHaveClass('dynamic-bg')
    expect(bgBtn).toHaveAttribute('title', 'Turn on moving background')
    expect(localStorage.getItem('sangita_lyrics_dynamic_bg')).toBeNull()

    // Toggle on
    fireEvent.click(bgBtn)
    expect(container).toHaveClass('dynamic-bg')
    expect(bgBtn).toHaveAttribute('title', 'Turn off moving background')
    expect(localStorage.getItem('sangita_lyrics_dynamic_bg')).toBe('true')

    // Toggle off
    fireEvent.click(bgBtn)
    expect(container).not.toHaveClass('dynamic-bg')
    expect(localStorage.getItem('sangita_lyrics_dynamic_bg')).toBe('false')

    unmount()

    // Test restoring from localStorage when initialized with 'true'
    localStorage.setItem('sangita_lyrics_dynamic_bg', 'true')
    render(
      <LyricsView
        track={mockTrack}
        currentTime={2}
        duration={100}
        lyricsData={{ has_lyrics: true, raw: '[00:02.00] Line 1' }}
        loading={false}
      />
    )
    const newContainer = screen.getByTestId('lyrics-view')
    expect(newContainer).toHaveClass('dynamic-bg')
  })
})


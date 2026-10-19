import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
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
    expect(screen.getByTestId('lyrics-fs-player')).toBeInTheDocument()

    // Press Escape to minimize back
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(container).not.toHaveClass('fullscreen-mode')
    expect(screen.queryByTestId('lyrics-fs-player')).not.toBeInTheDocument()

    // Click maximize again and click again to minimize
    fireEvent.click(maxBtn)
    expect(container).toHaveClass('fullscreen-mode')
    expect(screen.getByTestId('lyrics-fs-player')).toBeInTheDocument()
    fireEvent.click(maxBtn)
    expect(container).not.toHaveClass('fullscreen-mode')
    expect(screen.queryByTestId('lyrics-fs-player')).not.toBeInTheDocument()
  })

  it('renders all header actions and calls onClose when close button is clicked', () => {
    const handleClose = vi.fn()
    render(
      <LyricsView
        track={mockTrack}
        currentTime={10}
        duration={120}
        lyricsData={{ has_lyrics: true, raw: '[00:10.00] Line 1' }}
        loading={false}
        onClose={handleClose}
      />
    )

    const closeBtn = screen.getByTestId('lyrics-close-btn')
    const maxBtn = screen.getByTestId('lyrics-maximize-btn')
    const ambientBtn = screen.getByTestId('lyrics-ambient-bg-btn')
    const offsetGroup = screen.getByTestId('lyrics-offset-reset')

    expect(closeBtn).toBeInTheDocument()
    expect(maxBtn).toBeInTheDocument()
    expect(ambientBtn).toBeInTheDocument()
    expect(offsetGroup).toBeInTheDocument()

    fireEvent.click(closeBtn)
    expect(handleClose).toHaveBeenCalled()
  })

  it('allows play toggle and seeking from the fullscreen cinema playback bar', () => {
    const onTogglePlay = vi.fn()
    const onSeek = vi.fn()

    render(
      <LyricsView
        track={mockTrack}
        currentTime={45}
        duration={180}
        lyricsData={{ has_lyrics: true, raw: '[00:45.00] Line 1' }}
        loading={false}
        isPlaying={true}
        onTogglePlay={onTogglePlay}
        onSeek={onSeek}
      />
    )

    const maxBtn = screen.getByTestId('lyrics-maximize-btn')
    fireEvent.click(maxBtn)

    const fsPlayer = screen.getByTestId('lyrics-fs-player')
    expect(fsPlayer).toBeInTheDocument()

    const playBtn = screen.getByTestId('lyrics-fs-play-btn')
    fireEvent.click(playBtn)
    expect(onTogglePlay).toHaveBeenCalledTimes(1)

    const slider = screen.getByTestId('lyrics-fs-slider')
    fireEvent.change(slider, { target: { value: '90' } })
    expect(onSeek).toHaveBeenCalledWith(90)
  })

  it('cycles through colorful background themes with single click delay and persists to localStorage', () => {
    vi.useFakeTimers()
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
    expect(localStorage.getItem('sangita_lyrics_theme')).toBeNull()

    // 1st single click: pending click started, after 1.5s delay becomes combo1 (blue-green)
    fireEvent.click(bgBtn)
    act(() => {
      vi.advanceTimersByTime(1500)
    })
    expect(container).toHaveClass('dynamic-bg')
    expect(container).toHaveClass('theme-combo1')
    expect(bgBtn).toHaveAttribute('title', 'Turn off moving background')
    expect(localStorage.getItem('sangita_lyrics_theme')).toBe('combo1')

    // 2nd single click with delay: becomes combo2 (sunset)
    fireEvent.click(bgBtn)
    act(() => {
      vi.advanceTimersByTime(1500)
    })
    expect(container).toHaveClass('theme-combo2')
    expect(localStorage.getItem('sangita_lyrics_theme')).toBe('combo2')

    // 3rd single click with delay: becomes combo3 (aurora)
    fireEvent.click(bgBtn)
    act(() => {
      vi.advanceTimersByTime(1500)
    })
    expect(container).toHaveClass('theme-combo3')
    expect(localStorage.getItem('sangita_lyrics_theme')).toBe('combo3')

    // 4th single click with delay: becomes combo4 (cosmic)
    fireEvent.click(bgBtn)
    act(() => {
      vi.advanceTimersByTime(1500)
    })
    expect(container).toHaveClass('theme-combo4')
    expect(localStorage.getItem('sangita_lyrics_theme')).toBe('combo4')

    // 5th single click with delay: becomes red
    fireEvent.click(bgBtn)
    act(() => {
      vi.advanceTimersByTime(1500)
    })
    expect(container).toHaveClass('theme-red')
    expect(localStorage.getItem('sangita_lyrics_theme')).toBe('red')

    // 6th single click with delay: becomes green
    fireEvent.click(bgBtn)
    act(() => {
      vi.advanceTimersByTime(1500)
    })
    expect(container).toHaveClass('theme-green')
    expect(localStorage.getItem('sangita_lyrics_theme')).toBe('green')

    // 7th single click with delay: becomes blue
    fireEvent.click(bgBtn)
    act(() => {
      vi.advanceTimersByTime(1500)
    })
    expect(container).toHaveClass('theme-blue')
    expect(localStorage.getItem('sangita_lyrics_theme')).toBe('blue')

    // 8th single click with delay: cycles back to default off
    fireEvent.click(bgBtn)
    act(() => {
      vi.advanceTimersByTime(1500)
    })
    expect(container).not.toHaveClass('dynamic-bg')
    expect(container).not.toHaveClass('theme-blue')
    expect(bgBtn).toHaveAttribute('title', 'Turn on moving background')
    expect(localStorage.getItem('sangita_lyrics_theme')).toBe('default')

    unmount()
    vi.useRealTimers()
  })

  it('switches to black on double click (within 1.5s), and white with black font on second double click', () => {
    vi.useFakeTimers()
    localStorage.clear()

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
    const bgBtn = screen.getByTestId('lyrics-ambient-bg-btn')

    // Double click: 2 clicks within 1.5 seconds (e.g. 300ms apart)
    fireEvent.click(bgBtn)
    act(() => {
      vi.advanceTimersByTime(300)
    })
    fireEvent.click(bgBtn)

    // Should immediately become black mode
    expect(container).toHaveClass('theme-black')
    expect(localStorage.getItem('sangita_lyrics_theme')).toBe('black')

    // Second double click (within 1.5s of each other): switches to white mode
    act(() => {
      vi.advanceTimersByTime(2000) // Wait before next gesture
    })
    fireEvent.click(bgBtn)
    act(() => {
      vi.advanceTimersByTime(300)
    })
    fireEvent.click(bgBtn)

    // Should become white mode (font changes to black via .theme-white styles)
    expect(container).toHaveClass('theme-white')
    expect(localStorage.getItem('sangita_lyrics_theme')).toBe('white')

    // Third double click: switches back to black mode
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    fireEvent.click(bgBtn)
    act(() => {
      vi.advanceTimersByTime(300)
    })
    fireEvent.click(bgBtn)
    expect(container).toHaveClass('theme-black')

    // Single click with 1.5s delay while in monochrome mode returns to colorful themes (combo1)
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    fireEvent.click(bgBtn)
    act(() => {
      vi.advanceTimersByTime(1500)
    })
    expect(container).toHaveClass('theme-combo1')
    expect(localStorage.getItem('sangita_lyrics_theme')).toBe('combo1')

    vi.useRealTimers()
  })
})


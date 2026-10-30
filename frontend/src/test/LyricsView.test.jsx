import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import LyricsView, { findActiveLineIndex } from '../components/LyricsView.jsx'

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
    expect(screen.getByText(/No lyrics avail/i)).toBeInTheDocument()
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

    // 1st single click: pending click started, after 1.0s delay becomes combo1 (blue-green)
    fireEvent.click(bgBtn)
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(container).toHaveClass('dynamic-bg')
    expect(container).toHaveClass('theme-combo1')
    expect(bgBtn).toHaveAttribute('title', 'Turn off moving background')
    expect(localStorage.getItem('sangita_lyrics_theme')).toBe('combo1')

    // 2nd single click with delay: becomes combo2 (sunset)
    fireEvent.click(bgBtn)
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(container).toHaveClass('theme-combo2')
    expect(localStorage.getItem('sangita_lyrics_theme')).toBe('combo2')

    // 3rd single click with delay: becomes combo3 (aurora)
    fireEvent.click(bgBtn)
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(container).toHaveClass('theme-combo3')
    expect(localStorage.getItem('sangita_lyrics_theme')).toBe('combo3')

    // 4th single click with delay: becomes combo4 (cosmic)
    fireEvent.click(bgBtn)
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(container).toHaveClass('theme-combo4')
    expect(localStorage.getItem('sangita_lyrics_theme')).toBe('combo4')

    // 5th single click with delay: becomes red
    fireEvent.click(bgBtn)
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(container).toHaveClass('theme-red')
    expect(localStorage.getItem('sangita_lyrics_theme')).toBe('red')

    // 6th single click with delay: becomes green
    fireEvent.click(bgBtn)
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(container).toHaveClass('theme-green')
    expect(localStorage.getItem('sangita_lyrics_theme')).toBe('green')

    // 7th single click with delay: becomes blue
    fireEvent.click(bgBtn)
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(container).toHaveClass('theme-blue')
    expect(localStorage.getItem('sangita_lyrics_theme')).toBe('blue')

    // 8th single click with delay: cycles back to default off
    fireEvent.click(bgBtn)
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(container).not.toHaveClass('dynamic-bg')
    expect(container).not.toHaveClass('theme-blue')
    expect(bgBtn).toHaveAttribute('title', 'Turn on moving background')
    expect(localStorage.getItem('sangita_lyrics_theme')).toBe('default')

    unmount()
    vi.useRealTimers()
  })

  it('switches to black on double click (within 1.0s), and white with black font on second double click', () => {
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

  it('correctly calculates active line index with binary search algorithm', () => {
    const lines = [
      { time: 1.0, text: 'First line' },
      { time: 4.0, text: 'Second line' },
      { time: 8.5, text: 'Third line' },
      { time: 15.0, text: 'Fourth line' }
    ]

    // Before first line
    expect(findActiveLineIndex(lines, 0.5)).toBe(-1)
    // Exactly on first line
    expect(findActiveLineIndex(lines, 1.0)).toBe(0)
    // In between first and second
    expect(findActiveLineIndex(lines, 2.5)).toBe(0)
    // Exactly on second line
    expect(findActiveLineIndex(lines, 4.0)).toBe(1)
    // In between second and third
    expect(findActiveLineIndex(lines, 6.0)).toBe(1)
    // In between third and fourth
    expect(findActiveLineIndex(lines, 10.0)).toBe(2)
    // Far past fourth line
    expect(findActiveLineIndex(lines, 25.0)).toBe(3)
    // Empty array or null
    expect(findActiveLineIndex([], 5.0)).toBe(-1)
    expect(findActiveLineIndex(null, 5.0)).toBe(-1)
  })

  it('applies distance-based classes for fluid Apple Music/Spotify style styling', () => {
    const lrcContent = `
[00:01.00] Line 0
[00:03.00] Line 1
[00:05.00] Line 2
[00:07.00] Line 3
[00:09.00] Line 4
[00:11.00] Line 5
    `.trim()

    render(
      <LyricsView
        track={mockTrack}
        currentTime={5.0} // Target ~5.15s -> Line 2 (00:05) is active
        duration={100}
        lyricsData={{ has_lyrics: true, raw: lrcContent }}
        loading={false}
      />
    )

    const line0 = screen.getByText('Line 0').closest('.lyric-line')
    const line1 = screen.getByText('Line 1').closest('.lyric-line')
    const line2 = screen.getByText('Line 2').closest('.lyric-line')
    const line3 = screen.getByText('Line 3').closest('.lyric-line')
    const line4 = screen.getByText('Line 4').closest('.lyric-line')
    const line5 = screen.getByText('Line 5').closest('.lyric-line')

    // Line 2 is active (distance 0)
    expect(line2).toHaveClass('active')
    expect(line2).toHaveClass('distance-0')

    // Lines 1 and 3 are immediate neighbors (distance 1)
    expect(line1).toHaveClass('distance-1')
    expect(line3).toHaveClass('distance-1')

    // Lines 0 and 4 are secondary neighbors (distance 2)
    expect(line0).toHaveClass('distance-2')
    expect(line4).toHaveClass('distance-2')

    // Line 5 is far (distance >= 3)
    expect(line5).toHaveClass('distance-far')
  })

  it('supports aria-current on active line, role button, tabIndex, and hover preview', () => {
    const lrcContent = `
[00:02.00] First Verse
[00:05.00] Second Verse
    `.trim()

    render(
      <LyricsView
        track={mockTrack}
        currentTime={2.5}
        duration={100}
        lyricsData={{ has_lyrics: true, raw: lrcContent }}
        loading={false}
      />
    )

    const line0 = screen.getByTestId('lyric-line-0')
    const line1 = screen.getByTestId('lyric-line-1')

    expect(line0).toHaveAttribute('role', 'button')
    expect(line0).toHaveAttribute('tabIndex', '0')
    expect(line0).toHaveAttribute('aria-current', 'time')

    expect(line1).toHaveAttribute('role', 'button')
    expect(line1).toHaveAttribute('tabIndex', '0')
    expect(line1).not.toHaveAttribute('aria-current')

    // Line previews with timestamps
    expect(line0.querySelector('.lyric-line-preview')).toBeInTheDocument()
    expect(line0.querySelector('.lyric-line-preview')).toHaveTextContent('0:02')
    expect(line1.querySelector('.lyric-line-preview')).toHaveTextContent('0:05')
  })

  it('supports keyboard navigation: ArrowDown, ArrowUp, Home, End, and Enter/Space seeking', () => {
    const lrcContent = `
[00:01.00] Line A
[00:03.00] Line B
[00:06.00] Line C
[00:10.00] Line D
    `.trim()

    const onSeek = vi.fn()

    render(
      <LyricsView
        track={mockTrack}
        currentTime={1.0}
        duration={100}
        lyricsData={{ has_lyrics: true, raw: lrcContent }}
        loading={false}
        onSeek={onSeek}
      />
    )

    const lineA = screen.getByTestId('lyric-line-0')
    const lineB = screen.getByTestId('lyric-line-1')
    const lineC = screen.getByTestId('lyric-line-2')
    const lineD = screen.getByTestId('lyric-line-3')

    // Focus first line
    lineA.focus()
    expect(document.activeElement).toBe(lineA)

    // ArrowDown navigates to line B
    fireEvent.keyDown(lineA, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(lineB)

    // ArrowDown navigates to line C
    fireEvent.keyDown(lineB, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(lineC)

    // ArrowUp navigates back to line B
    fireEvent.keyDown(lineC, { key: 'ArrowUp' })
    expect(document.activeElement).toBe(lineB)

    // End navigates to last line (line D)
    fireEvent.keyDown(lineB, { key: 'End' })
    expect(document.activeElement).toBe(lineD)

    // Home navigates to first line (line A)
    fireEvent.keyDown(lineD, { key: 'Home' })
    expect(document.activeElement).toBe(lineA)

    // Pressing Space on line A seeks to 1.0s
    fireEvent.keyDown(lineA, { key: ' ' })
    expect(onSeek).toHaveBeenCalledWith(1)

    // Pressing Enter on line C seeks to 6.0s
    fireEvent.keyDown(lineC, { key: 'Enter' })
    expect(onSeek).toHaveBeenCalledWith(6)
  })

  it('displays floating return to current line pill on manual scroll and auto-resumes after 10s', () => {
    vi.useFakeTimers()

    const lrcContent = `
[00:01.00] Intro
[00:05.00] Chorus
    `.trim()

    render(
      <LyricsView
        track={mockTrack}
        currentTime={1.5}
        duration={100}
        lyricsData={{ has_lyrics: true, raw: lrcContent }}
        loading={false}
      />
    )

    // Let initial mount layout timers (60ms, 200ms, 450ms) settle
    act(() => {
      vi.advanceTimersByTime(1000)
    })

    // Initially floating pill is not present
    expect(screen.queryByTestId('lyrics-sync-scroll-btn')).not.toBeInTheDocument()

    // Trigger scroll
    const scrollBody = screen.getByTestId('lyric-line-0').closest('.lyrics-scroll-body')
    fireEvent.wheel(scrollBody, { deltaY: 200 })

    // Floating pill appears
    const returnBtn = screen.getByTestId('lyrics-sync-scroll-btn')
    expect(returnBtn).toBeInTheDocument()
    expect(returnBtn).toHaveTextContent(/Return to Current Line/i)

    // Clicking return button resumes auto-scroll
    fireEvent.click(returnBtn)
    expect(screen.queryByTestId('lyrics-sync-scroll-btn')).not.toBeInTheDocument()

    // Trigger wheel again
    fireEvent.wheel(scrollBody, { deltaY: 150 })
    expect(screen.getByTestId('lyrics-sync-scroll-btn')).toBeInTheDocument()

    // 9 seconds passed -> still visible
    act(() => {
      vi.advanceTimersByTime(9000)
    })
    expect(screen.getByTestId('lyrics-sync-scroll-btn')).toBeInTheDocument()

    // After 10s total (1000ms more) -> auto-resumes and hides
    act(() => {
      vi.advanceTimersByTime(1100)
    })
    expect(screen.queryByTestId('lyrics-sync-scroll-btn')).not.toBeInTheDocument()

    vi.useRealTimers()
  })

  it('renders persistent exit cue in fullscreen mode', () => {
    render(
      <LyricsView
        track={mockTrack}
        currentTime={2}
        duration={100}
        lyricsData={{ has_lyrics: true, raw: '[00:02.00] Line 1' }}
        loading={false}
      />
    )

    const maxBtn = screen.getByTestId('lyrics-maximize-btn')
    expect(screen.queryByTestId('lyrics-fs-exit-cue')).not.toBeInTheDocument()

    // Enter fullscreen
    fireEvent.click(maxBtn)
    const exitCue = screen.getByTestId('lyrics-fs-exit-cue')
    expect(exitCue).toBeInTheDocument()
    expect(exitCue).toHaveTextContent(/Exit/i)

    // Clicking exit cue exits fullscreen
    fireEvent.click(exitCue)
    expect(screen.queryByTestId('lyrics-fs-exit-cue')).not.toBeInTheDocument()
  })
})


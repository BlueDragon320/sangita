import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import RightPanel from '../components/RightPanel.jsx'

describe('RightPanel Component & Cover Art', () => {
  const mockTrack = {
    id: 'track-1',
    name: 'Faded',
    playlist: 'Alan Walker',
    path: 'Alan Walker/Faded.mp3'
  }

  it('renders track name, artist/playlist and formats', () => {
    render(
      <RightPanel
        track={mockTrack}
        playlist="Alan Walker"
        isPlaying={true}
        duration={212}
        formatTime={(s) => '3:32'}
        onClose={vi.fn()}
        onTogglePlay={vi.fn()}
        onDownload={vi.fn()}
        token="test-token"
      />
    )

    expect(screen.getByText('Faded')).toBeInTheDocument()
    expect(screen.getByText('NOW PLAYING')).toBeInTheDocument()
    expect(screen.getAllByText('MP3')[0]).toBeInTheDocument()
    expect(screen.getByText('3:32')).toBeInTheDocument()
  })

  it('renders embedded cover image with proper cover API source', () => {
    render(
      <RightPanel
        track={mockTrack}
        playlist="Alan Walker"
        isPlaying={false}
        duration={212}
        formatTime={(s) => '3:32'}
        onClose={vi.fn()}
        onTogglePlay={vi.fn()}
        onDownload={vi.fn()}
        token="test-token"
      />
    )

    const img = screen.getByRole('img', { name: 'Faded' })
    expect(img).toBeInTheDocument()
    expect(img.src).toContain('/api/cover/Alan%20Walker/Faded.mp3?token=test-token&v=2')
  })

  it('triggers onToggleFavorite when like button in RightPanel is clicked', () => {
    const handleToggleFavorite = vi.fn()
    render(
      <RightPanel
        track={mockTrack}
        playlist="Alan Walker"
        isPlaying={false}
        duration={212}
        formatTime={(s) => '3:32'}
        onClose={vi.fn()}
        onTogglePlay={vi.fn()}
        onDownload={vi.fn()}
        token="test-token"
        isFavorite={false}
        onToggleFavorite={handleToggleFavorite}
      />
    )

    const likeBtn = screen.getByTestId('right-panel-like')
    fireEvent.click(likeBtn)
    expect(handleToggleFavorite).toHaveBeenCalledWith(mockTrack.path)
  })

  it('calls onClose when close button is clicked', () => {
    const handleClose = vi.fn()
    render(
      <RightPanel
        track={mockTrack}
        playlist="Alan Walker"
        isPlaying={false}
        duration={212}
        formatTime={(s) => '3:32'}
        onClose={handleClose}
        onTogglePlay={vi.fn()}
        onDownload={vi.fn()}
        token="test-token"
      />
    )

    const closeBtn = screen.getByTestId('right-panel-close')
    fireEvent.click(closeBtn)
    expect(handleClose).toHaveBeenCalledTimes(1)
  })

  it('renders data usage monitor card replacing device sync', async () => {
    render(
      <RightPanel
        track={mockTrack}
        playlist="Alan Walker"
        isPlaying={true}
        duration={212}
        formatTime={(s) => '3:32'}
        onClose={vi.fn()}
        onTogglePlay={vi.fn()}
        onDownload={vi.fn()}
        token="test-token"
        username="alex"
      />
    )

    expect(screen.getByTestId('right-panel-data-usage')).toBeInTheDocument()
    expect(screen.getByText('DATA USAGE')).toBeInTheDocument()
    expect(screen.getByText('consumed today')).toBeInTheDocument()
  })

  it('toggles collapsible Audio & Stream Details disclosure and persists to localStorage', () => {
    localStorage.clear()

    const { unmount } = render(
      <RightPanel
        track={mockTrack}
        playlist="Alan Walker"
        isPlaying={false}
        duration={212}
        formatTime={(s) => '3:32'}
        onClose={vi.fn()}
        onTogglePlay={vi.fn()}
        onDownload={vi.fn()}
        token="test-token"
      />
    )

    const toggleBtn = screen.getByTestId('right-panel-details-toggle')
    const drawer = document.getElementById('right-panel-technical-details')

    // Initially collapsed
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'false')
    expect(drawer).toHaveClass('collapsed')
    expect(drawer).not.toHaveClass('expanded')

    // Click to expand
    fireEvent.click(toggleBtn)
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'true')
    expect(drawer).toHaveClass('expanded')
    expect(localStorage.getItem('sangita_right_panel_details_expanded')).toBe('true')

    // Click to collapse
    fireEvent.click(toggleBtn)
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'false')
    expect(drawer).toHaveClass('collapsed')
    expect(localStorage.getItem('sangita_right_panel_details_expanded')).toBe('false')

    unmount()
  })

  it('restores expanded state from localStorage and displays full technical metrics', () => {
    localStorage.setItem('sangita_right_panel_details_expanded', 'true')

    const trackWithMeta = {
      ...mockTrack,
      bitrate: 320,
      sample_rate: 48000
    }

    render(
      <RightPanel
        track={trackWithMeta}
        playlist="Alan Walker"
        isPlaying={true}
        duration={212}
        formatTime={(s) => '3:32'}
        onClose={vi.fn()}
        onTogglePlay={vi.fn()}
        onDownload={vi.fn()}
        token="test-token"
      />
    )

    const toggleBtn = screen.getByTestId('right-panel-details-toggle')
    const drawer = document.getElementById('right-panel-technical-details')

    expect(toggleBtn).toHaveAttribute('aria-expanded', 'true')
    expect(drawer).toHaveClass('expanded')

    // Technical metrics
    expect(screen.getByText('FORMAT')).toBeInTheDocument()
    expect(screen.getByText('LENGTH')).toBeInTheDocument()
    expect(screen.getByText('BITRATE')).toBeInTheDocument()
    expect(screen.getByText('320 kbps')).toBeInTheDocument()
    expect(screen.getByText('SAMPLE RATE')).toBeInTheDocument()
    expect(screen.getByText('48.0 kHz')).toBeInTheDocument()
    expect(screen.getByText('BUFFER')).toBeInTheDocument()
  })
})

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
    expect(screen.getByText('MP3')).toBeInTheDocument()
    expect(screen.getByText('3:32')).toBeInTheDocument()
    expect(screen.getByText('ACTIVE')).toBeInTheDocument()
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
})

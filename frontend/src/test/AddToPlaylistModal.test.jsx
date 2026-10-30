import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import AddToPlaylistModal from '../components/AddToPlaylistModal.jsx'

describe('AddToPlaylistModal Component', () => {
  const mockTrack = {
    id: 'track-1',
    name: 'Afsos',
    path: 'Anuv Jain/Afsos.mp3'
  }

  const mockPlaylists = {
    'Favorites': ['Anuv Jain/Afsos.mp3'],
    'Late Night Chill': ['song1.mp3'],
    'Library': ['song1.mp3', 'Anuv Jain/Afsos.mp3']
  }

  it('renders modal with track title, Favorites, and user playlists', () => {
    render(
      <AddToPlaylistModal
        track={mockTrack}
        playlists={mockPlaylists}
        favorites={['Anuv Jain/Afsos.mp3']}
        token="test-token"
        onClose={vi.fn()}
        onToggleFavorite={vi.fn()}
        onUpdatePlaylists={vi.fn()}
      />
    )

    expect(screen.getByText('Add to playlist')).toBeInTheDocument()
    expect(screen.getByText('Afsos')).toBeInTheDocument()
    expect(screen.getByText('Favorites')).toBeInTheDocument()
    expect(screen.getByText('Late Night Chill')).toBeInTheDocument()
  })

  it('calls onClose when close button is clicked', () => {
    const handleClose = vi.fn()
    render(
      <AddToPlaylistModal
        track={mockTrack}
        playlists={mockPlaylists}
        favorites={[]}
        token="test-token"
        onClose={handleClose}
      />
    )

    const closeBtn = screen.getByTestId('add-playlist-close')
    fireEvent.click(closeBtn)
    expect(handleClose).toHaveBeenCalledTimes(1)
  })

  it('calls onToggleFavorite when Favorites row is clicked', () => {
    const handleToggleFav = vi.fn()
    render(
      <AddToPlaylistModal
        track={mockTrack}
        playlists={mockPlaylists}
        favorites={[]}
        token="test-token"
        onClose={vi.fn()}
        onToggleFavorite={handleToggleFav}
      />
    )

    const favRow = screen.getByTestId('add-to-favorites-row')
    fireEvent.click(favRow)
    expect(handleToggleFav).toHaveBeenCalledWith('Anuv Jain/Afsos.mp3')
  })

  it('has accessible dialog attributes and aria-label on close button', () => {
    render(
      <AddToPlaylistModal
        track={mockTrack}
        playlists={mockPlaylists}
        favorites={['Anuv Jain/Afsos.mp3']}
        token="test-token"
        onClose={vi.fn()}
      />
    )

    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAttribute('aria-labelledby', 'add-playlist-title')
    expect(screen.getByRole('heading', { level: 3, name: 'Add to playlist' })).toHaveAttribute('id', 'add-playlist-title')

    const closeBtn = screen.getByTestId('add-playlist-close')
    expect(closeBtn).toHaveAttribute('aria-label', 'Close dialog')
  })

  it('renders playlist items as accessible checkboxes that can be toggled via keyboard', () => {
    const handleToggleFav = vi.fn()
    render(
      <AddToPlaylistModal
        track={mockTrack}
        playlists={mockPlaylists}
        favorites={['Anuv Jain/Afsos.mp3']}
        token="test-token"
        onClose={vi.fn()}
        onToggleFavorite={handleToggleFav}
      />
    )

    const favCheckbox = screen.getByTestId('add-to-favorites-row')
    expect(favCheckbox).toHaveAttribute('role', 'checkbox')
    expect(favCheckbox).toHaveAttribute('tabIndex', '0')
    expect(favCheckbox).toHaveAttribute('aria-checked', 'true')

    const chillCheckbox = screen.getByTestId('playlist-check-Late Night Chill')
    expect(chillCheckbox).toHaveAttribute('role', 'checkbox')
    expect(chillCheckbox).toHaveAttribute('tabIndex', '0')
    expect(chillCheckbox).toHaveAttribute('aria-checked', 'false')

    // Press Enter to toggle
    fireEvent.keyDown(favCheckbox, { key: 'Enter' })
    expect(handleToggleFav).toHaveBeenCalledWith('Anuv Jain/Afsos.mp3')

    // Press Space to toggle
    fireEvent.keyDown(favCheckbox, { key: ' ' })
    expect(handleToggleFav).toHaveBeenCalledTimes(2)
  })

  it('dismisses modal on Escape key press', () => {
    const handleClose = vi.fn()
    render(
      <AddToPlaylistModal
        track={mockTrack}
        playlists={mockPlaylists}
        favorites={[]}
        token="test-token"
        onClose={handleClose}
      />
    )

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(handleClose).toHaveBeenCalledTimes(1)
  })
})

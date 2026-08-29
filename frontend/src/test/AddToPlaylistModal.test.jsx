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
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import DiscoverView from '../components/DiscoverView.jsx'

describe('DiscoverView Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders dedicated discovery dashboard with data-testid="discover-view"', async () => {
    global.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: async () => []
      })
    )

    render(
      <DiscoverView
        token="test-token"
        playlists={{}}
        trackMetadata={{}}
      />
    )

    await waitFor(() => {
      expect(screen.getByTestId('discover-view')).toBeInTheDocument()
      expect(screen.getByText('Discover')).toBeInTheDocument()
      expect(screen.getByTestId('discover-search-input')).toBeInTheDocument()
    })
  })

  it('renders Artists fetched from /api/v2/artists with avatar, name, and track count', async () => {
    const mockArtists = [
      { id: 'arijit', name: 'Arijit Singh', track_count: 14, first_track_path: 'Arijit/song1.mp3' },
      { id: 'coldplay', name: 'Coldplay', track_count: 8, first_track_path: 'Coldplay/yellow.mp3' }
    ]

    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/api/v2/artists')) {
        return Promise.resolve({ ok: true, json: async () => mockArtists })
      }
      return Promise.resolve({ ok: true, json: async () => [] })
    })

    const handleSelectArtist = vi.fn()

    render(
      <DiscoverView
        token="test-token"
        playlists={{}}
        trackMetadata={{}}
        onSelectArtist={handleSelectArtist}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Arijit Singh')).toBeInTheDocument()
      expect(screen.getByText('Coldplay')).toBeInTheDocument()
    })

    expect(screen.getByText('14 songs')).toBeInTheDocument()
    expect(screen.getByText('8 songs')).toBeInTheDocument()

    // Clicking an artist triggers onSelectArtist
    const arijitCard = screen.getByTestId('artist-card-arijit')
    fireEvent.click(arijitCard)
    expect(handleSelectArtist).toHaveBeenCalledWith('arijit', 'Arijit Singh', expect.objectContaining({ name: 'Arijit Singh' }))
  })

  it('renders Public Playlists from /api/v2/playlists with curator badge, visibility badge, track count, and play button', async () => {
    const mockPlaylists = [
      {
        id: 'pub-1',
        name: 'Late Night Chill',
        curator: 'alex',
        visibility: 'public',
        is_public: true,
        track_count: 25,
        tracks: ['Chill/song1.mp3']
      }
    ]

    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/api/v2/playlists')) {
        return Promise.resolve({ ok: true, json: async () => mockPlaylists })
      }
      return Promise.resolve({ ok: true, json: async () => [] })
    })

    const handleSelectPlaylist = vi.fn()
    const handlePlayTracks = vi.fn()

    render(
      <DiscoverView
        token="test-token"
        playlists={{}}
        trackMetadata={{}}
        onSelectPlaylist={handleSelectPlaylist}
        onPlayTracks={handlePlayTracks}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Late Night Chill')).toBeInTheDocument()
    })

    expect(screen.getByTestId('curator-badge')).toHaveTextContent('@alex')
    expect(screen.getByTestId('visibility-badge')).toHaveTextContent('Public')
    expect(screen.getByText('25 tracks')).toBeInTheDocument()

    // Click play button
    const playBtn = screen.getByTestId('playlist-play-btn')
    fireEvent.click(playBtn)
    expect(handlePlayTracks).toHaveBeenCalledTimes(1)

    // Click card
    const card = screen.getByTestId('public-playlist-card-pub-1')
    fireEvent.click(card)
    expect(handleSelectPlaylist).toHaveBeenCalledWith('Late Night Chill', expect.objectContaining({ name: 'Late Night Chill' }))
  })

  it('renders Folder Playlists from classified source folders', async () => {
    global.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({ ok: true, json: async () => [] })
    )

    const mockPlaylists = {
      'Bollywood Hits Playlist': ['Bollywood/track1.mp3', 'Bollywood/track2.mp3'],
      'Road Trip Songs': ['RoadTrip/track1.mp3']
    }

    render(
      <DiscoverView
        token="test-token"
        playlists={mockPlaylists}
        trackMetadata={{}}
        onSelectPlaylist={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Bollywood Hits Playlist')).toBeInTheDocument()
      expect(screen.getByText('Road Trip Songs')).toBeInTheDocument()
    })

    expect(screen.getAllByTestId('folder-badge')[0]).toHaveTextContent('Source Folder')
  })

  it('filters artists and playlists with the quick search input and shows empty state on no match', async () => {
    const mockArtists = [
      { id: 'arijit', name: 'Arijit Singh', track_count: 5, tracks: [] },
      { id: 'dua', name: 'Dua Lipa', track_count: 3, tracks: [] }
    ]

    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/api/v2/artists')) {
        return Promise.resolve({ ok: true, json: async () => mockArtists })
      }
      return Promise.resolve({ ok: true, json: async () => [] })
    })

    render(
      <DiscoverView
        token="test-token"
        playlists={{}}
        trackMetadata={{}}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Arijit Singh')).toBeInTheDocument()
      expect(screen.getByText('Dua Lipa')).toBeInTheDocument()
    })

    const searchInput = screen.getByTestId('discover-search-input')
    fireEvent.change(searchInput, { target: { value: 'Arijit' } })

    expect(screen.getByText('Arijit Singh')).toBeInTheDocument()
    expect(screen.queryByText('Dua Lipa')).not.toBeInTheDocument()

    // Search for non-existing keyword
    fireEvent.change(searchInput, { target: { value: 'NonExistentXYZ' } })
    expect(screen.getByTestId('discover-artists-empty')).toBeInTheDocument()
    expect(screen.getByText(/No artists found matching "NonExistentXYZ"/)).toBeInTheDocument()

    // Clear search button
    const clearBtn = screen.getByTestId('discover-search-clear')
    fireEvent.click(clearBtn)
    expect(screen.getByText('Arijit Singh')).toBeInTheDocument()
    expect(screen.getByText('Dua Lipa')).toBeInTheDocument()
  })

  it('supports full keyboard accessibility with Enter and Space on cards', async () => {
    const mockArtists = [
      { id: 'arijit', name: 'Arijit Singh', track_count: 5, tracks: [] }
    ]

    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/api/v2/artists')) {
        return Promise.resolve({ ok: true, json: async () => mockArtists })
      }
      return Promise.resolve({ ok: true, json: async () => [] })
    })

    const handleSelectArtist = vi.fn()

    render(
      <DiscoverView
        token="test-token"
        playlists={{}}
        trackMetadata={{}}
        onSelectArtist={handleSelectArtist}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Arijit Singh')).toBeInTheDocument()
    })

    const card = screen.getByTestId('artist-card-arijit')
    expect(card).toHaveAttribute('role', 'button')
    expect(card).toHaveAttribute('tabIndex', '0')

    // Trigger with Enter key
    fireEvent.keyDown(card, { key: 'Enter' })
    expect(handleSelectArtist).toHaveBeenCalledTimes(1)

    // Trigger with Space key
    fireEvent.keyDown(card, { key: ' ' })
    expect(handleSelectArtist).toHaveBeenCalledTimes(2)
  })

  it('renders Add to My Playlists button on public playlist card and triggers onSavePlaylist with stopPropagation', async () => {
    const mockPlaylists = [
      {
        id: 'pub-test-1',
        name: 'Summer Vibes',
        curator: 'dj_dan',
        visibility: 'public',
        is_public: true,
        track_count: 12,
        tracks: ['Summer/beat.mp3']
      }
    ]

    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/api/v2/playlists')) {
        return Promise.resolve({ ok: true, json: async () => mockPlaylists })
      }
      return Promise.resolve({ ok: true, json: async () => [] })
    })

    const handleSelectPlaylist = vi.fn()
    const handleSavePlaylist = vi.fn()

    render(
      <DiscoverView
        token="test-token"
        playlists={{}}
        trackMetadata={{}}
        onSelectPlaylist={handleSelectPlaylist}
        onSavePlaylist={handleSavePlaylist}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Summer Vibes')).toBeInTheDocument()
    })

    const saveBtn = screen.getByTestId('discover-add-playlist-btn')
    expect(saveBtn).toBeInTheDocument()
    expect(saveBtn).toHaveAttribute('title', 'Add entire playlist to My Playlists')
    expect(saveBtn).toHaveAttribute('aria-label', 'Add entire playlist to My Playlists')

    // Also accessible via name-based testid
    expect(screen.getByTestId('add-to-my-playlists-Summer Vibes')).toBeInTheDocument()

    // Click save button: should NOT trigger onSelectPlaylist because stopPropagation is called
    fireEvent.click(saveBtn)

    expect(handleSavePlaylist).toHaveBeenCalledTimes(1)
    expect(handleSavePlaylist).toHaveBeenCalledWith(expect.objectContaining({ name: 'Summer Vibes', id: 'pub-test-1' }))
    expect(handleSelectPlaylist).not.toHaveBeenCalled()

    // Visual feedback: aria-label and title update to saved
    await waitFor(() => {
      expect(saveBtn).toHaveClass('saved')
      expect(saveBtn).toHaveAttribute('aria-label', 'Saved to My Playlists')
    })
  })

  it('renders Add to My Playlists button on folder playlist card and triggers onSavePlaylist', async () => {
    global.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({ ok: true, json: async () => [] })
    )

    const mockFolderPlaylists = {
      'Road Trip Songs': ['RoadTrip/song1.mp3', 'RoadTrip/song2.mp3']
    }

    const handleSavePlaylist = vi.fn()

    render(
      <DiscoverView
        token="test-token"
        playlists={mockFolderPlaylists}
        trackMetadata={{}}
        onSavePlaylist={handleSavePlaylist}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Road Trip Songs')).toBeInTheDocument()
    })

    const saveBtn = screen.getByTestId('add-to-my-playlists-Road Trip Songs')
    expect(saveBtn).toBeInTheDocument()

    const addBtn = screen.getByTestId('discover-add-playlist-btn')
    fireEvent.click(addBtn)

    expect(handleSavePlaylist).toHaveBeenCalledTimes(1)
    expect(handleSavePlaylist).toHaveBeenCalledWith(expect.objectContaining({ name: 'Road Trip Songs' }))
  })
})

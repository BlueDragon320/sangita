import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import DiscoverView from '../components/DiscoverView.jsx'

describe('DiscoverView Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders dedicated discovery dashboard with data-testid="discover-view" and fetches /api/v2/playlists?discover=true', async () => {
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

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/v2/playlists?discover=true',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer test-token' })
      })
    )
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

    expect(screen.getAllByTestId('folder-badge')[0]).toHaveTextContent('Folder')
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
    expect(screen.getByTestId('discover-empty-search')).toBeInTheDocument()
    expect(screen.getByText(/No matches found for "NonExistentXYZ"/)).toBeInTheDocument()

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
    expect(saveBtn).toHaveAttribute('title', 'Save to library')
    expect(saveBtn).toHaveAttribute('aria-label', 'Save to library')

    // Also accessible via name-based testid
    expect(screen.getByTestId('add-to-my-playlists-Summer Vibes')).toBeInTheDocument()

    // Click save button: should NOT trigger onSelectPlaylist because stopPropagation is called
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(handleSavePlaylist).toHaveBeenCalledTimes(1)
      expect(handleSavePlaylist).toHaveBeenCalledWith(expect.objectContaining({ name: 'Summer Vibes', id: 'pub-test-1' }), true)
    })
    expect(handleSelectPlaylist).not.toHaveBeenCalled()

    // Visual feedback: aria-label and title update to saved
    await waitFor(() => {
      expect(saveBtn).toHaveClass('saved')
      expect(saveBtn).toHaveAttribute('aria-label', 'Remove from library')
    })
  })

  it('calls POST /api/v2/playlists/<id>/save when clicking "Save to library" without calling clone endpoints', async () => {
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
      if (url.includes('/api/v2/playlists?discover=true')) {
        return Promise.resolve({ ok: true, json: async () => mockPlaylists })
      }
      if (url.includes('/api/v2/playlists/pub-test-1/save')) {
        return Promise.resolve({ ok: true, json: async () => ({ status: 'saved' }) })
      }
      return Promise.resolve({ ok: true, json: async () => [] })
    })

    const handleSavePlaylist = vi.fn()

    render(
      <DiscoverView
        token="test-token"
        playlists={{}}
        trackMetadata={{}}
        onSavePlaylist={handleSavePlaylist}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Summer Vibes')).toBeInTheDocument()
    })

    const saveBtn = screen.getByTestId('discover-add-playlist-btn')
    expect(saveBtn).toHaveAttribute('aria-label', 'Save to library')

    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v2/playlists/pub-test-1/save',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token'
          })
        })
      )
    })

    // Verify clone endpoints were NEVER called
    expect(global.fetch).not.toHaveBeenCalledWith(
      expect.stringContaining('/clone'),
      expect.anything()
    )

    await waitFor(() => {
      expect(handleSavePlaylist).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Summer Vibes', id: 'pub-test-1' }),
        true
      )
      expect(saveBtn).toHaveClass('saved')
      expect(saveBtn).toHaveAttribute('aria-label', 'Remove from library')
    })
  })

  it('calls DELETE /api/v2/playlists/<id>/save when clicking "Remove from library" without calling clone endpoints', async () => {
    const mockPlaylists = [
      {
        id: 'pub-test-saved',
        name: 'Late Night Chill',
        curator: 'alex',
        visibility: 'public',
        is_public: true,
        is_saved: true,
        track_count: 5,
        tracks: ['Chill/song1.mp3']
      }
    ]

    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/api/v2/playlists?discover=true')) {
        return Promise.resolve({ ok: true, json: async () => mockPlaylists })
      }
      if (url.includes('/api/v2/playlists/pub-test-saved/save')) {
        return Promise.resolve({ ok: true, json: async () => ({ status: 'unsaved' }) })
      }
      return Promise.resolve({ ok: true, json: async () => [] })
    })

    const handleSavePlaylist = vi.fn()

    render(
      <DiscoverView
        token="test-token"
        playlists={{}}
        trackMetadata={{}}
        onSavePlaylist={handleSavePlaylist}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Late Night Chill')).toBeInTheDocument()
    })

    const saveBtn = screen.getByTestId('discover-add-playlist-btn')
    expect(saveBtn).toHaveClass('saved')
    expect(saveBtn).toHaveAttribute('aria-label', 'Remove from library')

    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v2/playlists/pub-test-saved/save',
        expect.objectContaining({
          method: 'DELETE',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token'
          })
        })
      )
    })

    // Verify clone endpoints were NEVER called
    expect(global.fetch).not.toHaveBeenCalledWith(
      expect.stringContaining('/clone'),
      expect.anything()
    )

    await waitFor(() => {
      expect(handleSavePlaylist).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Late Night Chill', id: 'pub-test-saved' }),
        false
      )
      expect(saveBtn).not.toHaveClass('saved')
      expect(saveBtn).toHaveAttribute('aria-label', 'Save to library')
    })
  })

  it('does not update local state or notify onSavePlaylist if server save call fails', async () => {
    const mockPlaylists = [
      {
        id: 'pub-fail-1',
        name: 'Failing Playlist',
        curator: 'alex',
        visibility: 'public',
        is_public: true,
        track_count: 5,
        tracks: ['Fail/song.mp3']
      }
    ]

    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/api/v2/playlists?discover=true')) {
        return Promise.resolve({ ok: true, json: async () => mockPlaylists })
      }
      if (url.includes('/api/v2/playlists/pub-fail-1/save')) {
        return Promise.resolve({ ok: false, status: 500, statusText: 'Internal Server Error' })
      }
      return Promise.resolve({ ok: true, json: async () => [] })
    })

    const handleSavePlaylist = vi.fn()

    render(
      <DiscoverView
        token="test-token"
        playlists={{}}
        trackMetadata={{}}
        onSavePlaylist={handleSavePlaylist}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Failing Playlist')).toBeInTheDocument()
    })

    const saveBtn = screen.getByTestId('discover-add-playlist-btn')
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v2/playlists/pub-fail-1/save',
        expect.objectContaining({ method: 'POST' })
      )
    })

    // UI state should NOT change to saved, and onSavePlaylist should NOT be called
    expect(saveBtn).not.toHaveClass('saved')
    expect(saveBtn).toHaveAttribute('aria-label', 'Save to library')
    expect(handleSavePlaylist).not.toHaveBeenCalled()
  })

  it('renders Save to Library button on folder playlist card and triggers onSavePlaylist', async () => {
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

    await waitFor(() => {
      expect(handleSavePlaylist).toHaveBeenCalledTimes(1)
      expect(handleSavePlaylist).toHaveBeenCalledWith(expect.objectContaining({ name: 'Road Trip Songs' }), true)
    })
  })

  it('renders individually shared private playlists in a dedicated "Shared with You" section', async () => {
    const mockPlaylists = [
      {
        id: 'shared-priv-1',
        name: 'VIP Lounge Mix',
        curator: 'vip_curator',
        visibility: 'private',
        is_public: false,
        is_shared: true,
        is_granted: true,
        track_count: 15,
        tracks: ['VIP/lounge1.mp3']
      },
      {
        id: 'pub-1',
        name: 'Public Anthems',
        curator: 'alex',
        visibility: 'public',
        is_public: true,
        track_count: 10,
        tracks: ['Pop/hit1.mp3']
      }
    ]

    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/api/v2/playlists?discover=true')) {
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
      expect(screen.getByTestId('discover-shared-playlists-section')).toBeInTheDocument()
      expect(screen.getByTestId('discover-shared-playlists-heading')).toHaveTextContent('Shared with You')
      expect(screen.getByText('VIP Lounge Mix')).toBeInTheDocument()
    })

    const sharedCard = screen.getByTestId('shared-playlist-card-shared-priv-1')
    expect(sharedCard).toBeInTheDocument()

    // Curator & Shared badge
    expect(screen.getByText('@vip_curator')).toBeInTheDocument()
    expect(screen.getByText('Shared')).toBeInTheDocument()
    expect(screen.getByText('15 tracks')).toBeInTheDocument()

    // Public Anthems is in the public section
    expect(screen.getByTestId('public-playlist-card-pub-1')).toBeInTheDocument()
  })
})

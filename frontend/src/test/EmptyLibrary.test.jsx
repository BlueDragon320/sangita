import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
import React from 'react'
import App from '../App.jsx'
import Sidebar from '../components/Sidebar.jsx'
import DiscoverView from '../components/DiscoverView.jsx'

describe('Empty Personal Library UX & Functionality', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  describe('Test 1: Empty Personal Library Initial Render', () => {
    it('renders cleanly without fatal "No music found" error screen when user has empty library', async () => {
      localStorage.setItem('sangita_token', 'mock-token-empty')
      localStorage.setItem('sangita_user', 'newuser')
      localStorage.setItem('sangita_role', 'user')

      global.fetch = vi.fn().mockImplementation((url) => {
        if (url.includes('/api/me')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ username: 'newuser', role: 'user', rules: { allowed_playlists: ['*'] } })
          })
        }
        if (url === '/api/playlists') {
          // Completely empty personal library
          return Promise.resolve({ ok: true, json: async () => ({}) })
        }
        if (url === '/api/favorites') {
          return Promise.resolve({ ok: true, json: async () => [] })
        }
        if (url === '/api/user-playlists') {
          return Promise.resolve({ ok: true, json: async () => ({ playlists: [] }) })
        }
        if (url.startsWith('/api/v2/playlists')) {
          return Promise.resolve({ ok: true, json: async () => [] })
        }
        if (url.startsWith('/api/v2/catalog/sources')) {
          return Promise.resolve({ ok: true, json: async () => ({ sources: [] }) })
        }
        if (url.includes('/api/user/stats')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              username: 'newuser',
              total_seconds: 0,
              unique_tracks: 0,
              total_plays: 0,
              top_tracks: [],
              recently_played: [],
              top_artists: []
            })
          })
        }
        return Promise.resolve({ ok: true, json: async () => ({}) })
      })

      render(<App />)

      // 1. App renders shell cleanly
      await waitFor(() => {
        expect(screen.getByTestId('sidebar')).toBeInTheDocument()
      })

      // 2. No fatal "No music found" error screen is shown
      expect(screen.queryByText(/No music found/i)).not.toBeInTheDocument()

      // 3. Sidebar displays an empty state with "Your library is empty" and "Discover" or "Explore Discover"
      const sidebar = screen.getByTestId('sidebar')
      expect(within(sidebar).getByText(/Your library is empty/i)).toBeInTheDocument()
      expect(within(sidebar).getByTestId('sidebar-empty-discover-btn')).toBeInTheDocument()
      expect(within(sidebar).getByTestId('sidebar-discover-btn')).toBeInTheDocument()

      // 4. Main body displays friendly empty state with Explore Discover action
      await waitFor(() => {
        expect(screen.getByTestId('empty-library-state')).toBeInTheDocument()
      })
      expect(screen.getByTestId('empty-library-discover-btn')).toBeInTheDocument()

      // 5. App has Home and Discover views accessible
      const homeBtn = screen.getByTestId('header-home-btn')
      expect(homeBtn).toBeInTheDocument()
      fireEvent.click(homeBtn)

      await waitFor(() => {
        expect(screen.getByTestId('home-dashboard')).toBeInTheDocument()
      })

      // Navigate to Discover view
      const discoverBtn = screen.getByTestId('sidebar-discover-btn')
      fireEvent.click(discoverBtn)

      await waitFor(() => {
        expect(screen.getByTestId('discover-view')).toBeInTheDocument()
      })
      expect(screen.queryByText(/No music found/i)).not.toBeInTheDocument()
    })

    it('renders empty library state and handles discovery navigation in standalone Sidebar component', () => {
      const handleDiscover = vi.fn()
      const handleSelect = vi.fn()

      render(
        <Sidebar
          playlists={{}}
          currentPlaylist=""
          onSelect={handleSelect}
          isOpen={false}
          sidebarCollapsed={false}
          onToggleSidebar={vi.fn()}
          onDiscover={handleDiscover}
        />
      )

      expect(screen.getByText('Sangita')).toBeInTheDocument()
      expect(screen.getByText('Your library')).toBeInTheDocument()
      expect(screen.getByText('Your library is empty')).toBeInTheDocument()

      const exploreBtn = screen.getByTestId('sidebar-empty-discover-btn')
      expect(exploreBtn).toHaveTextContent('Explore Discover')
      fireEvent.click(exploreBtn)
      expect(handleDiscover).toHaveBeenCalledTimes(1)
    })
  })

  describe('Test 2: Global Search with Empty Personal Library', () => {
    it('searches trackMetadata and catalog tracks from the header when playlists prop has 0 items', async () => {
      localStorage.setItem('sangita_token', 'mock-token-search')
      localStorage.setItem('sangita_user', 'alex')
      localStorage.setItem('sangita_role', 'user')

      const mockTrackMetadata = {
        'Electronic/neon_pulse.mp3': {
          title: 'Neon Pulse',
          artist: 'Synthwave Duo',
          album: 'Future Horizon'
        },
        'Acoustic/morning_sun.mp3': {
          title: 'Morning Sun',
          artist: 'Acoustic Dreams',
          album: 'Sunrise Melodies'
        }
      }

      global.fetch = vi.fn().mockImplementation((url) => {
        if (url.includes('/api/me')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ username: 'alex', role: 'user', rules: { allowed_playlists: ['*'] } })
          })
        }
        if (url === '/api/playlists') {
          // Playlists has 0 items
          return Promise.resolve({ ok: true, json: async () => ({}) })
        }
        if (url.includes('/api/track-metadata')) {
          return Promise.resolve({ ok: true, json: async () => mockTrackMetadata })
        }
        if (url.includes('/api/durations') || url.includes('/api/favorites')) {
          return Promise.resolve({ ok: true, json: async () => ({}) })
        }
        return Promise.resolve({ ok: true, json: async () => ({}) })
      })

      render(<App />)

      await waitFor(() => {
        expect(screen.getByTestId('header-search-input')).toBeInTheDocument()
      })

      // User types a query matching catalog track in trackMetadata
      const searchInput = screen.getByTestId('header-search-input')
      fireEvent.change(searchInput, { target: { value: 'Neon' } })

      // Results returned and rendered in TrackList
      await waitFor(() => {
        expect(screen.getByText('Search Results')).toBeInTheDocument()
        expect(screen.getByText('Neon Pulse')).toBeInTheDocument()
        expect(screen.getByText('Synthwave Duo')).toBeInTheDocument()
      })

      // Query another catalog track
      fireEvent.change(searchInput, { target: { value: 'Acoustic Dreams' } })

      await waitFor(() => {
        expect(screen.getByText('Morning Sun')).toBeInTheDocument()
        expect(screen.getAllByText('Acoustic Dreams')[0]).toBeInTheDocument()
      })
    })
  })

  describe('Test 3: Discover View Functionality with Empty Library', () => {
    it('allows browsing Artists, Folder Playlists, and Public Playlists when personal library is empty', async () => {
      const mockArtists = [
        { id: 'art-1', name: 'Arijit Singh', track_count: 12, first_track_path: 'Arijit/song1.mp3' },
        { id: 'art-2', name: 'Coldplay', track_count: 8, first_track_path: 'Coldplay/yellow.mp3' }
      ]

      const mockPublicPlaylists = [
        {
          id: 'pub-101',
          name: 'Lo-Fi Study Session',
          title: 'Lo-Fi Study Session',
          curator: 'chill_master',
          visibility: 'public',
          is_public: true,
          track_count: 15,
          tracks: ['Lofi/beats1.mp3']
        },
        {
          id: 'folder-pl-1',
          name: 'Bollywood Hits',
          title: 'Bollywood Hits',
          curator: 'admin',
          visibility: 'public',
          is_folder_playlist: true,
          track_count: 20,
          tracks: ['Bollywood/song1.mp3']
        }
      ]

      global.fetch = vi.fn().mockImplementation((url) => {
        if (url.includes('/api/v2/artists')) {
          return Promise.resolve({ ok: true, json: async () => mockArtists })
        }
        if (url.includes('/api/v2/playlists')) {
          return Promise.resolve({ ok: true, json: async () => mockPublicPlaylists })
        }
        return Promise.resolve({ ok: true, json: async () => [] })
      })

      const handleSelectArtist = vi.fn()
      const handleSelectPlaylist = vi.fn()
      const handlePlayTracks = vi.fn()
      const handleSavePlaylist = vi.fn()
      const handleSaveArtist = vi.fn()

      render(
        <DiscoverView
          token="test-token"
          playlists={{}} // Empty personal library
          trackMetadata={{}}
          onSelectArtist={handleSelectArtist}
          onSelectPlaylist={handleSelectPlaylist}
          onPlayTracks={handlePlayTracks}
          onSavePlaylist={handleSavePlaylist}
          onSaveArtist={handleSaveArtist}
        />
      )

      // 1. Verify Artists Section is rendered and browsable
      await waitFor(() => {
        expect(screen.getByTestId('discover-artists-section')).toBeInTheDocument()
        expect(screen.getByText('Arijit Singh')).toBeInTheDocument()
        expect(screen.getByText('Coldplay')).toBeInTheDocument()
      })

      // 2. Verify Folder Playlists Section is rendered and browsable
      expect(screen.getByTestId('discover-folder-playlists-section')).toBeInTheDocument()
      expect(screen.getByText('Bollywood Hits')).toBeInTheDocument()

      // 3. Verify Public Playlists Section is rendered and browsable
      expect(screen.getByTestId('discover-public-playlists-section')).toBeInTheDocument()
      expect(screen.getByText('Lo-Fi Study Session')).toBeInTheDocument()

      // 4. Verify playing songs directly from Discover
      const playArtistBtn = screen.getAllByTestId('artist-play-btn')[0]
      fireEvent.click(playArtistBtn)
      expect(handlePlayTracks).toHaveBeenCalled()

      const playPlaylistBtn = screen.getAllByTestId('playlist-play-btn')[0]
      fireEvent.click(playPlaylistBtn)
      expect(handlePlayTracks).toHaveBeenCalled()

      // 5. Verify clicking "Save to library" on a playlist
      const addPlaylistBtn = screen.getAllByTestId('discover-add-playlist-btn')[0]
      expect(addPlaylistBtn).toHaveAttribute('aria-label', 'Save to library')
      fireEvent.click(addPlaylistBtn)
      await waitFor(() => {
        expect(handleSavePlaylist).toHaveBeenCalledWith(expect.objectContaining({ name: 'Lo-Fi Study Session' }), true)
      })

      // 6. Verify clicking "Save to library" on an artist
      const addArtistBtn = screen.getAllByTestId('discover-add-artist-btn')[0]
      expect(addArtistBtn).toHaveAttribute('aria-label', 'Save to library')
      fireEvent.click(addArtistBtn)
      await waitFor(() => {
        expect(handleSaveArtist).toHaveBeenCalledWith(expect.objectContaining({ name: 'Arijit Singh' }), true)
      })
    })
  })

  describe('Test 4: Saving items updates the Library', () => {
    it('bookmarks a playlist, updates personal library and sidebar, and unsaving cleanly removes it without deleting catalog item', async () => {
      localStorage.setItem('sangita_token', 'mock-token-save-flow')
      localStorage.setItem('sangita_user', 'alex')
      localStorage.setItem('sangita_role', 'user')

      let isPlaylistSaved = false
      let postSaveCalled = false
      let deleteSaveCalled = false

      const catalogPlaylists = [
        {
          id: 'pub-777',
          name: 'Indie Discoveries',
          title: 'Indie Discoveries',
          curator: 'curator_alice',
          visibility: 'public',
          is_public: true,
          track_count: 3,
          tracks: ['Indie/track1.mp3', 'Indie/track2.mp3', 'Indie/track3.mp3']
        }
      ]

      global.fetch = vi.fn().mockImplementation((url, opts = {}) => {
        if (url.includes('/api/me')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ username: 'alex', role: 'user', rules: { allowed_playlists: ['*'] } })
          })
        }
        if (url === '/api/playlists') {
          // If saved, user's library contains the saved playlist
          const pl = isPlaylistSaved
            ? { 'Indie Discoveries': ['Indie/track1.mp3', 'Indie/track2.mp3', 'Indie/track3.mp3'] }
            : {}
          return Promise.resolve({ ok: true, json: async () => pl })
        }
        if (url === '/api/user-playlists') {
          return Promise.resolve({ ok: true, json: async () => ({ playlists: [] }) })
        }
        if (url.startsWith('/api/v2/playlists') && !url.includes('/save')) {
          const res = catalogPlaylists.map(p => ({
            ...p,
            is_saved: isPlaylistSaved
          }))
          return Promise.resolve({ ok: true, json: async () => res })
        }
        if (url.includes('/api/v2/playlists/pub-777/save')) {
          if (opts.method === 'POST') {
            postSaveCalled = true
            isPlaylistSaved = true
            return Promise.resolve({ ok: true, json: async () => ({ status: 'saved', playlist_id: 'pub-777' }) })
          }
          if (opts.method === 'DELETE') {
            deleteSaveCalled = true
            isPlaylistSaved = false
            return Promise.resolve({ ok: true, json: async () => ({ status: 'unsaved', playlist_id: 'pub-777' }) })
          }
        }
        return Promise.resolve({ ok: true, json: async () => ({}) })
      })

      render(<App />)

      // 1. Initial State: Library is empty, sidebar shows "Your library is empty"
      await waitFor(() => {
        expect(screen.getByTestId('sidebar')).toBeInTheDocument()
      })
      expect(within(screen.getByTestId('sidebar')).getByText(/Your library is empty/i)).toBeInTheDocument()
      expect(screen.queryByTestId('sidebar-playlist-Indie Discoveries')).not.toBeInTheDocument()

      // 2. Navigate to Discover View
      fireEvent.click(screen.getByTestId('sidebar-discover-btn'))

      await waitFor(() => {
        expect(screen.getByTestId('discover-view')).toBeInTheDocument()
        expect(screen.getByText('Indie Discoveries')).toBeInTheDocument()
      })

      // 3. Save / Bookmark the playlist from Discover
      const saveBtn = screen.getByTestId('add-to-my-playlists-Indie Discoveries').parentElement
      expect(saveBtn).toHaveAttribute('aria-label', 'Save to library')
      fireEvent.click(saveBtn)

      // Verify POST save was called and toast is displayed
      await waitFor(() => {
        expect(postSaveCalled).toBe(true)
        expect(screen.getByTestId('toast-notification')).toHaveTextContent(/Saved playlist to your library/i)
      })

      // 4. Personal library and Sidebar update:
      // "Indie Discoveries" now appears in Sidebar and "Your library is empty" disappears
      await waitFor(() => {
        expect(screen.getByTestId('sidebar-playlist-Indie Discoveries')).toBeInTheDocument()
      })
      expect(within(screen.getByTestId('sidebar')).queryByText(/Your library is empty/i)).not.toBeInTheDocument()

      // 5. Unsaving removes it from the personal library
      expect(saveBtn).toHaveAttribute('aria-label', 'Remove from library')
      fireEvent.click(saveBtn)

      // Verify DELETE save was called and remove toast displayed
      await waitFor(() => {
        expect(deleteSaveCalled).toBe(true)
        expect(screen.getByTestId('toast-notification')).toHaveTextContent(/Removed playlist from your library/i)
      })

      // 6. Sidebar removes "Indie Discoveries" and reverts to empty state
      await waitFor(() => {
        expect(screen.queryByTestId('sidebar-playlist-Indie Discoveries')).not.toBeInTheDocument()
        expect(within(screen.getByTestId('sidebar')).getByText(/Your library is empty/i)).toBeInTheDocument()
      })

      // 7. Crucial check: The underlying catalog item in Discover was NOT deleted
      expect(screen.getByText('Indie Discoveries')).toBeInTheDocument()
    })
  })
})

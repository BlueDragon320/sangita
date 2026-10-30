import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
import React from 'react'
import App from '../App.jsx'

describe('App Component Full Integration', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('renders Login screen when no token is present', () => {
    render(<App />)
    expect(screen.getByText('Your personal music server')).toBeInTheDocument()
    expect(screen.getByText('Sign In')).toBeInTheDocument()
  })

  it('renders App shell with Sidebar, Header, and HomeDashboard when logged in', async () => {
    localStorage.setItem('sangita_token', 'mock-token')
    localStorage.setItem('sangita_user', 'admin')
    localStorage.setItem('sangita_role', 'admin')

    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/api/me')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ username: 'admin', role: 'admin', rules: { allowed_playlists: ['*'] } })
        })
      }
      if (url.includes('/api/playlists')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            'Chill Vibes': ['Chill Vibes/song1.mp3', 'Chill Vibes/song2.mp3'],
            'Favorites': []
          })
        })
      }
      if (url.includes('/api/durations') || url.includes('/api/favorites')) {
        return Promise.resolve({ ok: true, json: async () => ({}) })
      }
      if (url.includes('/api/user/stats')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            username: 'admin',
            total_seconds: 3600,
            unique_tracks: 5,
            total_plays: 10,
            top_tracks: [
              { path: 'Chill Vibes/song1.mp3', name: 'Song 1', artist: 'Artist 1', playlist: 'Chill Vibes', play_count: 5, total_seconds: 500 }
            ],
            recently_played: [],
            top_artists: []
          })
        })
      }
      return Promise.resolve({ ok: true, json: async () => ({}) })
    })

    render(<App />)

    // Verify main components render without blank screen
    await waitFor(() => {
      expect(screen.getByTestId('sidebar')).toBeInTheDocument()
      expect(screen.getByTestId('header-home-btn')).toBeInTheDocument()
    })

    // Click Home button to switch to Home view
    const homeBtn = screen.getByTestId('header-home-btn')
    fireEvent.click(homeBtn)

    await waitFor(() => {
      expect(screen.getByTestId('home-dashboard')).toBeInTheDocument()
      expect(screen.getByText('Your Top 10 Most Played Songs')).toBeInTheDocument()
    })
  })

  it('toggles LyricsView when clicking lyrics button in player', async () => {
    localStorage.setItem('sangita_token', 'mock-token')
    localStorage.setItem('sangita_user', 'admin')
    localStorage.setItem('sangita_role', 'admin')

    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/api/me')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ username: 'admin', role: 'admin', rules: { allowed_playlists: ['*'] } })
        })
      }
      if (url.includes('/api/playlists')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            'Chill Vibes': ['Chill Vibes/song1.mp3'],
            'Favorites': []
          })
        })
      }
      if (url.includes('/api/lyrics/')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ has_lyrics: true, raw: '[00:01.00] Testing song 1 lyrics' })
        })
      }
      return Promise.resolve({ ok: true, json: async () => ({}) })
    })

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('Chill Vibes')).toBeInTheDocument()
    })

    // Click on playlist to open tracklist
    fireEvent.click(screen.getByTestId('sidebar-playlist-Chill Vibes'))

    await waitFor(() => {
      expect(screen.getByText('song1')).toBeInTheDocument()
    })

    // Click on track to play it
    fireEvent.click(screen.getByText('song1'))

    await waitFor(() => {
      expect(screen.getByTestId('player-bar')).toBeInTheDocument()
    })

    // Find and click lyrics button
    const lyricsBtn = screen.getByTestId('lyrics-toggle-btn')
    fireEvent.click(lyricsBtn)

    await waitFor(() => {
      expect(screen.getByTestId('lyrics-view')).toBeInTheDocument()
      expect(screen.getByText('Testing song 1 lyrics')).toBeInTheDocument()
    })

    // Click a different playlist in the sidebar to ensure lyrics page is minimized
    fireEvent.click(screen.getByTestId('sidebar-playlist-Favorites'))

    await waitFor(() => {
      expect(screen.queryByTestId('lyrics-view')).not.toBeInTheDocument()
    })
  })

  it('sends explicit favorite states when adding and removing a song', async () => {
    localStorage.setItem('sangita_token', 'mock-token')
    let favorites = []
    global.fetch = vi.fn().mockImplementation((url, options = {}) => {
      if (url === '/api/me') return Promise.resolve({ ok: true, json: async () => ({ username: 'admin', role: 'admin' }) })
      if (url === '/api/playlists') return Promise.resolve({ ok: true, json: async () => ({ 'Chill Vibes': ['Chill Vibes/song1.mp3'], Favorites: [] }) })
      if (url === '/api/favorites/set') {
        const body = JSON.parse(options.body)
        favorites = body.is_favorite ? [body.track_path] : []
        return Promise.resolve({ ok: true, json: async () => ({ favorites }) })
      }
      if (url === '/api/favorites') return Promise.resolve({ ok: true, json: async () => favorites })
      return Promise.resolve({ ok: true, json: async () => ({}) })
    })
    render(<App />)
    await waitFor(() => expect(screen.getByTestId('sidebar-playlist-Chill Vibes')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('sidebar-playlist-Chill Vibes'))
    const moreBtn = await screen.findByTestId('track-more-btn')
    fireEvent.click(moreBtn)
    const favBtn = await screen.findByTestId('track-action-fav')
    fireEvent.click(favBtn)
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/favorites/set', expect.anything()))
    fireEvent.click(moreBtn)
    const favBtnRemove = await screen.findByTestId('track-action-fav')
    expect(favBtnRemove).toHaveAttribute('title', 'Remove from Favorites')
    fireEvent.click(favBtnRemove)
    await waitFor(() => {
      const requests = global.fetch.mock.calls.filter(([url]) => url === '/api/favorites/set')
      expect(requests.map(([, options]) => JSON.parse(options.body).is_favorite)).toEqual([true, false])
    })
  })

  it('auto-advances to the next track when current track ends', async () => {
    localStorage.setItem('sangita_token', 'mock-token')
    localStorage.setItem('sangita_user', 'admin')
    localStorage.setItem('sangita_role', 'admin')

    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/api/me')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ username: 'admin', role: 'admin', rules: { allowed_playlists: ['*'] } })
        })
      }
      if (url.includes('/api/playlists')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            'Chill Vibes': ['Chill Vibes/song1.mp3', 'Chill Vibes/song2.mp3'],
            'Favorites': []
          })
        })
      }
      return Promise.resolve({ ok: true, json: async () => ({}) })
    })

    const { container } = render(<App />)

    await waitFor(() => {
      expect(screen.getByText('Chill Vibes')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('sidebar-playlist-Chill Vibes'))

    await waitFor(() => {
      expect(screen.getByText('song1')).toBeInTheDocument()
      expect(screen.getByText('song2')).toBeInTheDocument()
    })

    // Play first track
    fireEvent.click(screen.getByText('song1'))

    await waitFor(() => {
      expect(screen.getByTestId('player-bar')).toBeInTheDocument()
    })

    const audio = container.querySelector('audio')
    expect(audio).toBeInTheDocument()

    // Trigger ended event on audio element
    fireEvent.ended(audio)

    await waitFor(() => {
      expect(audio.src).toContain('Chill%20Vibes%2Fsong2.mp3')
    })
  })

  it('loads discovered playlist by ID in App.jsx when clicked from Discover view', async () => {
    localStorage.setItem('sangita_token', 'mock-token')
    localStorage.setItem('sangita_user', 'alex')
    localStorage.setItem('sangita_role', 'user')

    const mockPublicPlaylists = [
      {
        id: 'pub-42',
        title: 'Community Anthems',
        name: 'Community Anthems',
        owner: 'curator_bob',
        visibility: 'public',
        description: 'Vibrant indie music curated by Bob',
        track_count: 2,
        tracks: ['Indie/track1.mp3']
      }
    ]

    const mockDetail = {
      id: 'pub-42',
      title: 'Community Anthems',
      description: 'Vibrant indie music curated by Bob',
      owner: 'curator_bob',
      visibility: 'public',
      is_folder_playlist: false,
      track_count: 2,
      unavailable_count: 1,
      tracks: [
        { id: 'trk-1', position: 1, track_path: 'Indie/track1.mp3', title: 'Indie Song 1', artist: 'Indie Band', duration: 180, is_available: true },
        { id: 'trk-2', position: 2, track_path: 'Indie/track2.mp3', title: 'Restricted Song', artist: 'Restricted Band', duration: 200, is_available: false }
      ]
    }

    global.fetch = vi.fn().mockImplementation((url, opts = {}) => {
      if (url.includes('/api/me')) {
        return Promise.resolve({ ok: true, json: async () => ({ username: 'alex', role: 'user', rules: { allowed_playlists: ['*'] } }) })
      }
      if (url === '/api/playlists') {
        return Promise.resolve({ ok: true, json: async () => ({ 'Chill Vibes': ['Chill Vibes/song1.mp3'] }) })
      }
      if (url === '/api/v2/playlists') {
        return Promise.resolve({ ok: true, json: async () => mockPublicPlaylists })
      }
      if (url.includes('/api/v2/playlists/pub-42')) {
        // Assert Authorization header is present
        expect(opts.headers?.Authorization).toBe('Bearer mock-token')
        return Promise.resolve({ ok: true, json: async () => mockDetail })
      }
      return Promise.resolve({ ok: true, json: async () => ({}) })
    })

    render(<App />)

    // Wait for sidebar
    await waitFor(() => {
      expect(screen.getByTestId('sidebar-discover-btn')).toBeInTheDocument()
    })

    // Click Discover button in sidebar
    fireEvent.click(screen.getByTestId('sidebar-discover-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('discover-view')).toBeInTheDocument()
      expect(screen.getByText('Community Anthems')).toBeInTheDocument()
    })

    // Click on public playlist card
    const card = screen.getByTestId('public-playlist-card-pub-42')
    fireEvent.click(card)

    // App should transition to music view with activePlaylistMeta
    await waitFor(() => {
      expect(screen.getByText('Community Anthems')).toBeInTheDocument()
      expect(screen.getByText('Vibrant indie music curated by Bob')).toBeInTheDocument()
      expect(screen.getByText('curator_bob')).toBeInTheDocument()
      expect(screen.getByText('Indie Song 1')).toBeInTheDocument()
      expect(screen.getByText('Restricted Song')).toBeInTheDocument()
    })

    // Alert banner for 1 unavailable song
    expect(screen.getByTestId('hero-unavailable-banner')).toHaveTextContent('1 song unavailable under your library permissions')

    // Unavailable track row has lock icon
    const restrictedRow = screen.getByTestId('track-row-1')
    expect(restrictedRow).toHaveClass('track-row-unavailable')
    expect(restrictedRow).toHaveAttribute('aria-disabled', 'true')
  })

  it('classifies source folders from /api/v2/catalog/sources and protects personal playlists', async () => {
    localStorage.setItem('sangita_token', 'mock-token')
    localStorage.setItem('sangita_user', 'alex')
    localStorage.setItem('sangita_role', 'user')

    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/api/me')) {
        return Promise.resolve({ ok: true, json: async () => ({ username: 'alex', role: 'user', rules: { allowed_playlists: ['*'] } }) })
      }
      if (url === '/api/playlists') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            'Favorites': ['fav.mp3'],
            'My Custom Jam': ['jam.mp3'],
            'Arijit Singh': ['arijit.mp3'],
            'Pop Hits': ['pop.mp3']
          })
        })
      }
      if (url === '/api/user-playlists') {
        return Promise.resolve({ ok: true, json: async () => ({ playlists: ['My Custom Jam'] }) })
      }
      if (url === '/api/v2/catalog/sources') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            sources: [
              { folder_name: 'Arijit Singh', classification: 'artist' },
              { folder_name: 'Pop Hits', classification: 'playlist' }
            ]
          })
        })
      }
      return Promise.resolve({ ok: true, json: async () => ({}) })
    })

    render(<App />)

    await waitFor(() => {
      expect(screen.getByTestId('sidebar-section-unified')).toBeInTheDocument()
    })

    // Assert that separate section heading texts are NOT present
    expect(screen.queryByText('My Playlists')).not.toBeInTheDocument()
    expect(screen.queryByText('Folder Playlists')).not.toBeInTheDocument()
    expect(document.querySelector('.sidebar-section-title')).not.toBeInTheDocument()

    expect(screen.getByTestId('sidebar-playlist-My Custom Jam')).toHaveTextContent('Playlist • 1 song')
    expect(screen.getByTestId('sidebar-playlist-Arijit Singh')).toHaveTextContent('Artist • 1 song')
    expect(screen.getByTestId('sidebar-playlist-Pop Hits')).toHaveTextContent('Playlist • 1 song')
  })

  it('saves an entire playlist from Discover to personal library and shows toast notification', async () => {
    localStorage.setItem('sangita_token', 'mock-token')
    localStorage.setItem('sangita_user', 'alex')

    let cloneCalled = false
    let playlistFetchCount = 0

    const mockPublicPlaylists = [
      {
        id: 'pub-42',
        name: 'Community Anthems',
        title: 'Community Anthems',
        curator: 'curator_bob',
        visibility: 'public',
        is_public: true,
        track_count: 5,
        tracks: ['Indie/song1.mp3']
      }
    ]

    global.fetch = vi.fn().mockImplementation((url, opts = {}) => {
      if (url.includes('/api/me')) {
        return Promise.resolve({ ok: true, json: async () => ({ username: 'alex', role: 'user', rules: { allowed_playlists: ['*'] } }) })
      }
      if (url === '/api/playlists') {
        playlistFetchCount++
        return Promise.resolve({ ok: true, json: async () => ({ 'Chill Vibes': ['Chill Vibes/song1.mp3'] }) })
      }
      if (url === '/api/v2/playlists') {
        return Promise.resolve({ ok: true, json: async () => mockPublicPlaylists })
      }
      if (url.includes('/api/v2/playlists/pub-42/clone')) {
        cloneCalled = true
        return Promise.resolve({
          ok: true,
          json: async () => ({ id: 'new-cloned-id', title: 'Community Anthems', track_count: 5 })
        })
      }
      return Promise.resolve({ ok: true, json: async () => ({}) })
    })

    render(<App />)

    await waitFor(() => {
      expect(screen.getByTestId('sidebar-discover-btn')).toBeInTheDocument()
    })

    // Navigate to Discover
    fireEvent.click(screen.getByTestId('sidebar-discover-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('discover-view')).toBeInTheDocument()
      expect(screen.getByText('Community Anthems')).toBeInTheDocument()
    })

    const initialFetchCount = playlistFetchCount
    const saveBtn = screen.getByTestId('add-to-my-playlists-Community Anthems')
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(cloneCalled).toBe(true)
      expect(playlistFetchCount).toBeGreaterThan(initialFetchCount)
      expect(screen.getByTestId('toast-notification')).toHaveTextContent(/Added "Community Anthems" to your playlists/)
    })
  })

  it('handles duplicate playlist name by appending suffix when saving from Discover', async () => {
    localStorage.setItem('sangita_token', 'mock-token')
    localStorage.setItem('sangita_user', 'alex')

    let savedBody = null

    const mockPublicPlaylists = [
      {
        id: 'pub-88',
        name: 'Chill Vibes',
        title: 'Chill Vibes',
        curator: 'curator_bob',
        visibility: 'public',
        is_public: true,
        track_count: 2,
        tracks: ['Chill Vibes/song1.mp3']
      }
    ]

    global.fetch = vi.fn().mockImplementation((url, opts = {}) => {
      if (url.includes('/api/me')) {
        return Promise.resolve({ ok: true, json: async () => ({ username: 'alex', role: 'user', rules: { allowed_playlists: ['*'] } }) })
      }
      if (url === '/api/playlists') {
        // User already has 'Chill Vibes' in their library!
        return Promise.resolve({ ok: true, json: async () => ({ 'Chill Vibes': ['Chill Vibes/song1.mp3'] }) })
      }
      if (url === '/api/v2/playlists') {
        return Promise.resolve({ ok: true, json: async () => mockPublicPlaylists })
      }
      if (url.includes('/api/v2/playlists/pub-88/clone')) {
        savedBody = JSON.parse(opts.body)
        return Promise.resolve({
          ok: true,
          json: async () => ({ id: 'new-cloned-88', title: savedBody.title, track_count: 2 })
        })
      }
      return Promise.resolve({ ok: true, json: async () => ({}) })
    })

    render(<App />)

    await waitFor(() => {
      expect(screen.getByTestId('sidebar-discover-btn')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('sidebar-discover-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('discover-view')).toBeInTheDocument()
      expect(screen.getByTestId('public-playlist-card-pub-88')).toBeInTheDocument()
    })

    const card = screen.getByTestId('public-playlist-card-pub-88')
    const saveBtn = within(card).getByTestId('discover-add-playlist-btn')
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(savedBody).not.toBeNull()
      expect(savedBody.title).toBe('Chill Vibes (1)')
      expect(screen.getByTestId('toast-notification')).toHaveTextContent(/Added "Chill Vibes \(1\)" to your playlists/)
    })
  })

  it('navigates from empty playlist view to Discover when clicking empty state action', async () => {
    localStorage.setItem('sangita_token', 'mock-token')
    localStorage.setItem('sangita_user', 'alex')

    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/api/me')) {
        return Promise.resolve({ ok: true, json: async () => ({ username: 'alex', role: 'user', rules: { allowed_playlists: ['*'] } }) })
      }
      if (url === '/api/playlists') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            'Empty Playlist': [],
            'Chill Vibes': ['song1.mp3']
          })
        })
      }
      return Promise.resolve({ ok: true, json: async () => ({}) })
    })

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('Empty Playlist')).toBeInTheDocument()
    })

    // Click on empty playlist in sidebar
    fireEvent.click(screen.getByTestId('sidebar-playlist-Empty Playlist'))

    // TrackList empty state appears with action button
    await waitFor(() => {
      expect(screen.getByTestId('tracklist-empty-state')).toBeInTheDocument()
      expect(screen.getByTestId('tracklist-empty-action')).toBeInTheDocument()
    })

    // Click Browse Library (empty state action)
    fireEvent.click(screen.getByTestId('tracklist-empty-action'))

    // Should switch to Discover view
    await waitFor(() => {
      expect(screen.getByTestId('discover-view')).toBeInTheDocument()
    })
  })
})

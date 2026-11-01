import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import App from '../App.jsx'
import DiscoverView from '../components/DiscoverView.jsx'
import TrackList from '../components/TrackList.jsx'
import Sidebar from '../components/Sidebar.jsx'

describe('Storefront Cleanliness, Offline/Reconnection Banner, and UI Polish', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    localStorage.clear()
  })

  describe('1. Offline and Reconnection Banner in App.jsx', () => {
    it('displays network offline banner when network disconnects and handles retry', async () => {
      localStorage.setItem('sangita_token', 'mock-token')
      localStorage.setItem('sangita_user', 'shopper')
      localStorage.setItem('sangita_role', 'user')

      global.fetch = vi.fn().mockImplementation((url) => {
        if (url.includes('/api/me')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ username: 'shopper', role: 'user', rules: { allowed_playlists: ['*'] } })
          })
        }
        if (url.includes('/api/playlists')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ 'Chill': ['Chill/track1.mp3'] })
          })
        }
        return Promise.resolve({ ok: true, json: async () => ({}) })
      })

      render(<App />)

      await waitFor(() => {
        expect(screen.getByTestId('sidebar')).toBeInTheDocument()
      })

      // Simulate network offline event
      fireEvent(window, new Event('offline'))

      await waitFor(() => {
        const banner = screen.getByTestId('connection-status-banner')
        expect(banner).toBeInTheDocument()
        expect(banner).toHaveClass('network')
        expect(banner).toHaveTextContent(/Network disconnected.*Offline mode active/i)
      })

      // Verify Retry button exists and is clickable
      const retryBtn = screen.getByTestId('connection-retry-btn')
      expect(retryBtn).toBeInTheDocument()
      fireEvent.click(retryBtn)

      // Simulate network online event
      fireEvent(window, new Event('online'))

      await waitFor(() => {
        expect(screen.queryByTestId('connection-status-banner')).not.toBeInTheDocument()
      })
    })

    it('allows dismissing the network offline banner via dismiss button', async () => {
      localStorage.setItem('sangita_token', 'mock-token')
      localStorage.setItem('sangita_user', 'shopper')
      localStorage.setItem('sangita_role', 'user')

      global.fetch = vi.fn().mockImplementation((url) => {
        if (url.includes('/api/me')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ username: 'shopper', role: 'user', rules: { allowed_playlists: ['*'] } })
          })
        }
        if (url.includes('/api/playlists')) {
          return Promise.resolve({ ok: true, json: async () => ({ 'Chill': ['Chill/track1.mp3'] }) })
        }
        return Promise.resolve({ ok: true, json: async () => ({}) })
      })

      render(<App />)

      await waitFor(() => {
        expect(screen.getByTestId('sidebar')).toBeInTheDocument()
      })

      fireEvent(window, new Event('offline'))

      await waitFor(() => {
        expect(screen.getByTestId('connection-status-banner')).toBeInTheDocument()
      })

      const dismissBtn = screen.getByTestId('connection-dismiss-btn')
      expect(dismissBtn).toBeInTheDocument()
      fireEvent.click(dismissBtn)

      await waitFor(() => {
        expect(screen.queryByTestId('connection-status-banner')).not.toBeInTheDocument()
      })
    })
  })

  describe('2. Customer-Facing Storefront Cleanliness & Shielding Internal Metrics', () => {
    it('does not render internal ranking engine scores, weights, or diagnostic telemetry in DiscoverView', async () => {
      global.fetch = vi.fn().mockImplementation(() => Promise.resolve({ ok: true, json: async () => [] }))

      const mockPlaylists = {
        'Top Hits': ['Hits/song1.mp3', 'Hits/song2.mp3']
      }
      const mockMetadata = {
        'Hits/song1.mp3': {
          title: 'Blinding Lights',
          artist: 'The Weeknd',
          album: 'After Hours',
          duration: 200,
          internal_b2b_score: 99.8,
          ranking_weight: 1.45,
          telemetry_debug: 'shard-04-ok'
        }
      }

      const { container } = render(
        <DiscoverView
          token="test-token"
          playlists={mockPlaylists}
          trackMetadata={mockMetadata}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Discover')).toBeInTheDocument()
      })

      // Ensure internal metrics are NOT rendered in the DOM
      expect(container.textContent).not.toContain('99.8')
      expect(container.textContent).not.toContain('ranking_weight')
      expect(container.textContent).not.toContain('internal_b2b_score')
      expect(container.textContent).not.toContain('shard-04-ok')
      expect(container.textContent).not.toMatch(/b2b/i)
      expect(container.textContent).not.toMatch(/telemetry/i)
    })

    it('does not render internal ranking weights or diagnostic telemetry in TrackList', () => {
      const tracks = [
        {
          id: 't-1',
          name: 'Song A',
          title: 'Song A',
          artist: 'Artist A',
          path: 'Artist A/songA.mp3',
          duration: 180,
          ranking_score: 94.2,
          b2b_weight: 0.88,
          telemetry_source: 'cluster-b'
        }
      ]

      const { container } = render(
        <TrackList
          tracks={tracks}
          currentIndex={0}
          isPlaying={false}
          onPlayTrack={vi.fn()}
        />
      )

      expect(screen.getByText('Song A')).toBeInTheDocument()
      expect(screen.getByText('Artist A')).toBeInTheDocument()

      // Assert internal scores are shielded
      expect(container.textContent).not.toContain('94.2')
      expect(container.textContent).not.toContain('0.88')
      expect(container.textContent).not.toContain('cluster-b')
      expect(container.textContent).not.toMatch(/b2b/i)
      expect(container.textContent).not.toMatch(/telemetry/i)
    })
  })

  describe('3. Empty States with Polite Actions Across Discover, Search, and Library', () => {
    it('Discover search empty state renders clear polite action to clear search', async () => {
      global.fetch = vi.fn().mockImplementation(() => Promise.resolve({ ok: true, json: async () => [] }))

      render(
        <DiscoverView
          token="test-token"
          playlists={{}}
          trackMetadata={{}}
        />
      )

      await waitFor(() => {
        expect(screen.getByTestId('discover-search-input')).toBeInTheDocument()
      })

      const searchInput = screen.getByTestId('discover-search-input')
      fireEvent.change(searchInput, { target: { value: 'NonExistentArtistOrSong' } })

      const emptySearchState = screen.getByTestId('discover-empty-search')
      expect(emptySearchState).toBeInTheDocument()
      expect(emptySearchState).toHaveTextContent(/No matches found for "NonExistentArtistOrSong"/i)

      const clearBtn = screen.getByTestId('discover-empty-clear-btn')
      expect(clearBtn).toBeInTheDocument()
      expect(clearBtn).toHaveTextContent('Clear search')

      fireEvent.click(clearBtn)
      expect(searchInput.value).toBe('')
    })

    it('Sidebar library search empty state provides polite Clear search action', () => {
      const mockPlaylists = {
        'Chill Vibes': ['song1.mp3'],
        'Workout': ['song2.mp3']
      }

      render(
        <Sidebar
          playlists={mockPlaylists}
          currentPlaylist="Chill Vibes"
          onSelect={vi.fn()}
          isOpen={false}
          sidebarCollapsed={false}
          onToggleSidebar={vi.fn()}
        />
      )

      const searchInput = screen.getByTestId('library-search-input')
      fireEvent.change(searchInput, { target: { value: 'XYZNotFound' } })

      const emptySearch = screen.getByTestId('sidebar-empty-search')
      expect(emptySearch).toBeInTheDocument()
      expect(emptySearch).toHaveTextContent(/No matches found/i)

      const clearBtn = screen.getByTestId('sidebar-empty-clear-btn')
      expect(clearBtn).toBeInTheDocument()
      expect(clearBtn).toHaveTextContent('Clear search')

      fireEvent.click(clearBtn)
      expect(searchInput.value).toBe('')
      expect(screen.getByText('Chill Vibes')).toBeInTheDocument()
    })

    it('TrackList empty state provides polite action (Explore Discover / Add Playlist)', () => {
      const handleEmptyAction = vi.fn()
      render(
        <TrackList
          tracks={[]}
          currentIndex={-1}
          isPlaying={false}
          onPlayTrack={vi.fn()}
          onEmptyAction={handleEmptyAction}
        />
      )

      const emptyCard = screen.getByTestId('tracklist-empty-state')
      expect(emptyCard).toBeInTheDocument()
      expect(emptyCard).toHaveTextContent('No tracks in this playlist yet')

      const actionBtn = screen.getByTestId('tracklist-empty-action')
      expect(actionBtn).toBeInTheDocument()
      expect(actionBtn).toHaveTextContent('Add Playlist from Discover')

      fireEvent.click(actionBtn)
      expect(handleEmptyAction).toHaveBeenCalledTimes(1)
    })
  })
})

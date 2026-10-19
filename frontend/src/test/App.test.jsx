import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
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
})

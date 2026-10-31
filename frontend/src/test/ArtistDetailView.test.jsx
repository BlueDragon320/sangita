import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import ArtistDetailView from '../components/ArtistDetailView.jsx'

describe('ArtistDetailView Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  const mockTracks = [
    { id: 't1', path: 'Arijit/Tum Hi Ho.mp3', name: 'Tum Hi Ho', artist: 'Arijit Singh' },
    { id: 't2', path: 'Arijit/Channa Mereya.mp3', name: 'Channa Mereya', artist: 'Arijit Singh' }
  ]

  const mockDurations = {
    'Arijit/Tum Hi Ho.mp3': 262,
    'Arijit/Channa Mereya.mp3': 289
  }

  it('renders detailed artist view with hero avatar, name, and track count', async () => {
    global.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({ ok: false, status: 404 })
    )

    render(
      <ArtistDetailView
        artistId="arijit"
        artistName="Arijit Singh"
        artist={{ name: 'Arijit Singh', tracks: mockTracks }}
        durations={mockDurations}
        token="token"
      />
    )

    expect(screen.getByTestId('artist-detail-view')).toBeInTheDocument()
    expect(screen.getByTestId('artist-name')).toHaveTextContent('Arijit Singh')
    expect(screen.getByTestId('artist-track-count')).toHaveTextContent(/2 songs, about 0 hr 9 min|2 songs, 9 min/)
    expect(screen.getByTestId('artist-avatar')).toBeInTheDocument()
  })

  it('triggers onPlayAll when Play All button is clicked', async () => {
    global.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({ ok: false })
    )

    const handlePlayAll = vi.fn()

    render(
      <ArtistDetailView
        artistId="arijit"
        artistName="Arijit Singh"
        artist={{ name: 'Arijit Singh', tracks: mockTracks }}
        durations={mockDurations}
        token="token"
        onPlayAll={handlePlayAll}
      />
    )

    const playAllBtn = screen.getByTestId('artist-play-all-btn')
    fireEvent.click(playAllBtn)
    expect(handlePlayAll).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ name: 'Tum Hi Ho' }),
      expect.objectContaining({ name: 'Channa Mereya' })
    ]))
  })

  it('triggers onShuffle when Shuffle button is clicked', async () => {
    global.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({ ok: false })
    )

    const handleShuffle = vi.fn()

    render(
      <ArtistDetailView
        artistId="arijit"
        artistName="Arijit Singh"
        artist={{ name: 'Arijit Singh', tracks: mockTracks }}
        durations={mockDurations}
        token="token"
        onShuffle={handleShuffle}
      />
    )

    const shuffleBtn = screen.getByTestId('artist-shuffle-btn')
    fireEvent.click(shuffleBtn)
    expect(handleShuffle).toHaveBeenCalledTimes(1)
  })

  it('renders integrated track list and allows clicking a track to play', async () => {
    global.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({ ok: false })
    )

    const handlePlayTrack = vi.fn()

    render(
      <ArtistDetailView
        artistId="arijit"
        artistName="Arijit Singh"
        artist={{ name: 'Arijit Singh', tracks: mockTracks }}
        durations={mockDurations}
        token="token"
        onPlayTrack={handlePlayTrack}
      />
    )

    expect(screen.getByText('Tum Hi Ho')).toBeInTheDocument()
    expect(screen.getByText('Channa Mereya')).toBeInTheDocument()

    // Click track
    fireEvent.click(screen.getByText('Tum Hi Ho'))
    expect(handlePlayTrack).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Tum Hi Ho' }),
      0,
      expect.any(Array)
    )
  })

  it('navigates back when clicking the Back button', async () => {
    global.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({ ok: false })
    )

    const handleBack = vi.fn()

    render(
      <ArtistDetailView
        artistId="arijit"
        artistName="Arijit Singh"
        artist={{ name: 'Arijit Singh', tracks: mockTracks }}
        onBack={handleBack}
      />
    )

    const backBtn = screen.getByTestId('artist-back-btn')
    fireEvent.click(backBtn)
    expect(handleBack).toHaveBeenCalledTimes(1)
  })

  it('renders clean empty state when artist has no tracks', async () => {
    global.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({ ok: false })
    )

    render(
      <ArtistDetailView
        artistId="empty-artist"
        artistName="Empty Artist"
        artist={{ name: 'Empty Artist', tracks: [] }}
        playlists={{}}
        trackMetadata={{}}
      />
    )

    expect(screen.getByTestId('artist-empty-tracks')).toBeInTheDocument()
    expect(screen.getByText('No tracks found for this artist.')).toBeInTheDocument()
    expect(screen.getByTestId('artist-play-all-btn')).toBeDisabled()
    expect(screen.getByTestId('artist-shuffle-btn')).toBeDisabled()
    expect(screen.getByTestId('artist-add-all-btn')).toBeDisabled()
  })

  it('renders Add All to Playlist button and opens dialog with writable playlist choices', async () => {
    global.fetch = vi.fn().mockImplementation((url, opts) => {
      if (url.includes('/api/v2/playlists')) {
        return Promise.resolve({
          ok: true,
          json: async () => [
            { id: 10, title: 'Chill Vibes', is_owner: true, track_count: 5 }
          ]
        })
      }
      if (url.includes('/api/v2/artists/arijit/add-to-playlist')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            tracks_added: 2,
            duplicates_skipped: 1
          })
        })
      }
      return Promise.resolve({ ok: false })
    })

    const onRefreshPlaylists = vi.fn()
    const onToast = vi.fn()

    render(
      <ArtistDetailView
        artistId="arijit"
        artistName="Arijit Singh"
        artist={{ name: 'Arijit Singh', tracks: mockTracks }}
        token="token"
        userPlaylists={['Chill Vibes']}
        playlistMetadata={{ 'Chill Vibes': { id: 10, is_owner: true } }}
        onRefreshPlaylists={onRefreshPlaylists}
        onToast={onToast}
      />
    )

    const addAllBtn = screen.getByTestId('artist-add-all-btn')
    expect(addAllBtn).toBeInTheDocument()
    expect(addAllBtn).not.toBeDisabled()

    // Click Add All to Playlist
    fireEvent.click(addAllBtn)

    // Dialog should open
    expect(screen.getByTestId('artist-add-all-dialog')).toBeInTheDocument()
    expect(screen.getByText('Add All Tracks to Playlist')).toBeInTheDocument()
    expect(screen.getByTestId('btn-toggle-create-new')).toBeInTheDocument()

    // Wait for playlists to be loaded and select active
    await waitFor(() => {
      expect(screen.getByTestId('select-target-playlist')).toBeInTheDocument()
      expect(screen.getByTestId('btn-confirm-add-all')).not.toBeDisabled()
    })

    // Submit existing playlist
    const form = screen.getByTestId('artist-add-all-dialog').querySelector('form')
    fireEvent.submit(form)

    await waitFor(() => {
      expect(screen.getByTestId('artist-toast')).toHaveTextContent('Added 2 tracks to Chill Vibes (1 duplicate skipped)')
    })
    expect(onToast).toHaveBeenCalledWith('Added 2 tracks to Chill Vibes (1 duplicate skipped)')
    expect(onRefreshPlaylists).toHaveBeenCalledTimes(1)
    expect(onToast).toHaveBeenCalledWith('Added 2 tracks to Chill Vibes (1 duplicate skipped)')
    expect(onRefreshPlaylists).toHaveBeenCalledTimes(1)
  })

  it('allows switching to Create New Playlist mode in dialog and creates new playlist', async () => {
    global.fetch = vi.fn().mockImplementation((url, opts) => {
      if (url.includes('/api/v2/playlists')) {
        return Promise.resolve({
          ok: true,
          json: async () => []
        })
      }
      if (opts?.method === 'POST' && url.includes('/api/v2/artists/arijit/add-to-playlist')) {
        const body = JSON.parse(opts.body)
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            tracks_added: 2,
            duplicates_skipped: 0,
            playlist_name: body.new_playlist_name
          })
        })
      }
      return Promise.resolve({ ok: false })
    })

    render(
      <ArtistDetailView
        artistId="arijit"
        artistName="Arijit Singh"
        artist={{ name: 'Arijit Singh', tracks: mockTracks }}
        token="token"
      />
    )

    fireEvent.click(screen.getByTestId('artist-add-all-btn'))
    expect(screen.getByTestId('artist-add-all-dialog')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByTestId('input-new-playlist-name')).toBeInTheDocument()
    })
    const input = screen.getByTestId('input-new-playlist-name')

    fireEvent.change(input, { target: { value: 'Best of Arijit' } })

    const form = screen.getByTestId('artist-add-all-dialog').querySelector('form')
    fireEvent.submit(form)

    await waitFor(() => {
      expect(screen.getByTestId('artist-toast')).toHaveTextContent('Added 2 tracks to Best of Arijit')
    })
  })
})

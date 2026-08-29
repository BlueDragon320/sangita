import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import HomeDashboard from '../components/HomeDashboard.jsx'

describe('HomeDashboard Component', () => {
  const mockStats = {
    username: 'blue',
    total_seconds: 7200,
    unique_tracks: 15,
    total_plays: 45,
    top_tracks: [
      {
        path: 'Rock/Queen - Bohemian Rhapsody.mp3',
        name: 'Bohemian Rhapsody',
        artist: 'Queen',
        playlist: 'Rock',
        play_count: 18,
        total_seconds: 900
      },
      {
        path: 'Pop/Michael Jackson - Billie Jean.mp3',
        name: 'Billie Jean',
        artist: 'Michael Jackson',
        playlist: 'Pop',
        play_count: 12,
        total_seconds: 600
      }
    ],
    recently_played: [
      {
        path: 'Rock/Queen - Bohemian Rhapsody.mp3',
        name: 'Bohemian Rhapsody',
        artist: 'Queen',
        playlist: 'Rock',
        played_at: '2026-08-29 12:00:00'
      }
    ],
    top_artists: [
      { artist: 'Queen', play_count: 24, tracks: 3 },
      { artist: 'Michael Jackson', play_count: 15, tracks: 2 }
    ]
  }

  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        range: '24h',
        total_seconds: 7200,
        data: []
      })
    })
  })

  it('renders user greeting, statistics cards, and top tracks', () => {
    render(
      <HomeDashboard
        username="blue"
        stats={mockStats}
        loading={false}
        onPlayTrack={vi.fn()}
        isPlaying={false}
        currentTrack={null}
        onOpenCreatePlaylist={vi.fn()}
        onSaveTop10Playlist={vi.fn()}
        onQuickShuffle={vi.fn()}
        token="test-token"
        favorites={[]}
        onToggleFavorite={vi.fn()}
        onAddToPlaylist={vi.fn()}
        durations={{}}
      />
    )

    expect(screen.getByText('blue')).toBeInTheDocument()
    expect(screen.getByText('2h 0m')).toBeInTheDocument()
    expect(screen.getByText('45')).toBeInTheDocument()
    expect(screen.getByText('15')).toBeInTheDocument()
    expect(screen.getAllByText('Bohemian Rhapsody').length).toBeGreaterThan(0)
    expect(screen.getByText('Billie Jean')).toBeInTheDocument()
    expect(screen.getByText('18 plays')).toBeInTheDocument()
    expect(screen.getAllByText('Queen').length).toBeGreaterThan(0)
  })

  it('triggers onOpenCreatePlaylist when Make Playlist button is clicked', () => {
    const handleOpenCreate = vi.fn()
    render(
      <HomeDashboard
        username="blue"
        stats={mockStats}
        loading={false}
        onPlayTrack={vi.fn()}
        isPlaying={false}
        currentTrack={null}
        onOpenCreatePlaylist={handleOpenCreate}
        onSaveTop10Playlist={vi.fn()}
        onQuickShuffle={vi.fn()}
        token="test-token"
        favorites={[]}
        onToggleFavorite={vi.fn()}
        onAddToPlaylist={vi.fn()}
        durations={{}}
      />
    )

    const createBtn = screen.getByTestId('home-create-playlist-btn')
    fireEvent.click(createBtn)
    expect(handleOpenCreate).toHaveBeenCalledTimes(1)
  })

  it('triggers onSaveTop10Playlist when Save Top 10 button is clicked', () => {
    const handleSaveTop10 = vi.fn()
    render(
      <HomeDashboard
        username="blue"
        stats={mockStats}
        loading={false}
        onPlayTrack={vi.fn()}
        isPlaying={false}
        currentTrack={null}
        onOpenCreatePlaylist={vi.fn()}
        onSaveTop10Playlist={handleSaveTop10}
        onQuickShuffle={vi.fn()}
        token="test-token"
        favorites={[]}
        onToggleFavorite={vi.fn()}
        onAddToPlaylist={vi.fn()}
        durations={{}}
      />
    )

    const saveTop10Btn = screen.getByTestId('home-save-top10-btn')
    fireEvent.click(saveTop10Btn)
    expect(handleSaveTop10).toHaveBeenCalledTimes(1)
  })

  it('triggers onPlayTrack when clicking a top track row', () => {
    const handlePlayTrack = vi.fn()
    render(
      <HomeDashboard
        username="blue"
        stats={mockStats}
        loading={false}
        onPlayTrack={handlePlayTrack}
        isPlaying={false}
        currentTrack={null}
        onOpenCreatePlaylist={vi.fn()}
        onSaveTop10Playlist={vi.fn()}
        onQuickShuffle={vi.fn()}
        token="test-token"
        favorites={[]}
        onToggleFavorite={vi.fn()}
        onAddToPlaylist={vi.fn()}
        durations={{}}
      />
    )

    const firstTrackRow = screen.getByTestId('home-top-track-0')
    fireEvent.click(firstTrackRow)
    expect(handlePlayTrack).toHaveBeenCalledWith(
      mockStats.top_tracks[0],
      'Rock',
      mockStats.top_tracks
    )
  })
})

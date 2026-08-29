import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import Hero from '../components/Hero.jsx'

describe('Hero Component & Spotify Layout', () => {
  const mockTracks = [
    { id: '1', name: 'Faded', path: 'Alan Walker/Faded.mp3' },
    { id: '2', name: 'Alone', path: 'Alan Walker/Alone.mp3' }
  ]

  const mockDurations = {
    'Alan Walker/Faded.mp3': 200,
    'Alan Walker/Alone.mp3': 160
  }

  it('renders playlist title, Public Playlist tag, creator avatar and duration stats', () => {
    render(
      <Hero
        playlistName="Classics"
        tracks={mockTracks}
        isPlaying={false}
        isShuffle={false}
        onPlay={vi.fn()}
        onShuffle={vi.fn()}
        onDownload={vi.fn()}
        username="VaibhavOp"
        durations={mockDurations}
        token="token"
      />
    )

    expect(screen.getByText('Public Playlist')).toBeInTheDocument()
    expect(screen.getByText('Classics')).toBeInTheDocument()
    expect(screen.getByText('VaibhavOp')).toBeInTheDocument()
    expect(screen.getByText(/2 songs, 6 min/)).toBeInTheDocument()
  })

  it('triggers onPlay when big play button is clicked', () => {
    const handlePlay = vi.fn()
    render(
      <Hero
        playlistName="Classics"
        tracks={mockTracks}
        isPlaying={false}
        isShuffle={false}
        onPlay={handlePlay}
        onShuffle={vi.fn()}
        onDownload={vi.fn()}
        username="VaibhavOp"
        durations={mockDurations}
        token="token"
      />
    )

    const playBtn = screen.getByTestId('hero-play-btn')
    fireEvent.click(playBtn)
    expect(handlePlay).toHaveBeenCalledTimes(1)
  })

  it('triggers onShuffle when shuffle button is clicked', () => {
    const handleShuffle = vi.fn()
    render(
      <Hero
        playlistName="Classics"
        tracks={mockTracks}
        isPlaying={false}
        isShuffle={false}
        onPlay={vi.fn()}
        onShuffle={handleShuffle}
        onDownload={vi.fn()}
        username="VaibhavOp"
        durations={mockDurations}
        token="token"
      />
    )

    const shuffleBtn = screen.getByTestId('hero-shuffle-btn')
    fireEvent.click(shuffleBtn)
    expect(handleShuffle).toHaveBeenCalledTimes(1)
  })
})

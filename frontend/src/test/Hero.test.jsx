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

  it('renders 4-track quad collage grid when playlist has 4 or more tracks', () => {
    const fourTracks = [
      { id: '1', name: 'Song 1', path: 'Pl/Song1.mp3' },
      { id: '2', name: 'Song 2', path: 'Pl/Song2.mp3' },
      { id: '3', name: 'Song 3', path: 'Pl/Song3.mp3' },
      { id: '4', name: 'Song 4', path: 'Pl/Song4.mp3' },
    ]
    const { container } = render(
      <Hero
        playlistName="Collage Playlist"
        tracks={fourTracks}
        isPlaying={false}
        isShuffle={false}
        onPlay={vi.fn()}
        onShuffle={vi.fn()}
        onDownload={vi.fn()}
        username="VaibhavOp"
        durations={{}}
        token="valid-token"
      />
    )

    const quadGrid = container.querySelector('.hero-art-quad-grid')
    expect(quadGrid).toBeInTheDocument()
    const images = container.querySelectorAll('.hero-quad-img')
    expect(images.length).toBe(4)
  })
})

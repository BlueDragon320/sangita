import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import TrackList from '../components/TrackList.jsx'

describe('TrackList Component & Duration Rendering', () => {
  const mockTracks = [
    { id: '1', name: 'Faded', playlist: 'Alan Walker', path: 'Alan Walker/Faded.mp3' },
    { id: '2', name: 'Alone', playlist: 'Alan Walker', path: 'Alan Walker/Alone.mp3' },
    { id: '3', name: 'Unknown Song', playlist: 'Alan Walker', path: 'Alan Walker/Unknown.mp3' },
  ]

  const mockDurations = {
    'Alan Walker/Faded.mp3': 212.4, // 3:32
    'Alan Walker/Alone.mp3': 161.0,  // 2:41
  }

  it('renders track list with track names and formatted durations without spinning loaders', () => {
    render(
      <TrackList
        tracks={mockTracks}
        currentIndex={0}
        isPlaying={true}
        onPlayTrack={vi.fn()}
        durations={mockDurations}
        token="token"
      />
    )

    expect(screen.getByText('Faded')).toBeInTheDocument()
    expect(screen.getByText('Alone')).toBeInTheDocument()
    expect(screen.getByText('Unknown Song')).toBeInTheDocument()

    // Formatted durations
    expect(screen.getByText('3:32')).toBeInTheDocument()
    expect(screen.getByText('2:41')).toBeInTheDocument()
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('calls onPlayTrack when a track row is clicked', () => {
    const handlePlay = vi.fn()
    render(
      <TrackList
        tracks={mockTracks}
        currentIndex={0}
        isPlaying={false}
        onPlayTrack={handlePlay}
        durations={mockDurations}
        token="token"
      />
    )

    const secondRow = screen.getByTestId('track-row-1')
    fireEvent.click(secondRow)

    expect(handlePlay).toHaveBeenCalledWith(mockTracks[1], 1)
  })

  it('calls onAddToPlaylist when + button is clicked', () => {
    const handleAddToPlaylist = vi.fn()
    render(
      <TrackList
        tracks={mockTracks}
        currentIndex={0}
        isPlaying={false}
        onPlayTrack={vi.fn()}
        durations={mockDurations}
        token="token"
        onAddToPlaylist={handleAddToPlaylist}
      />
    )

    const addBtn = screen.getByTestId('track-row-add-0')
    fireEvent.click(addBtn)

    expect(handleAddToPlaylist).toHaveBeenCalledWith(mockTracks[0])
  })
})

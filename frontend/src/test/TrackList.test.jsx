import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
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

  it('reveals favorite button when holding the timestamp for 2 seconds and hides after 4 seconds', () => {
    vi.useFakeTimers()
    const handleToggleFav = vi.fn()
    render(
      <TrackList
        tracks={mockTracks}
        currentIndex={0}
        isPlaying={false}
        onPlayTrack={vi.fn()}
        durations={mockDurations}
        token="token"
        onToggleFavorite={handleToggleFav}
        favorites={[]}
      />
    )

    const timestampWrapper = screen.getAllByTitle('On phone: hold 2s to favorite')[0]
    
    // Start hold
    fireEvent.touchStart(timestampWrapper)
    act(() => {
      vi.advanceTimersByTime(2000)
    })

    // Revealed like button should now appear
    const mobileLikeBtn = screen.getByTestId('track-mobile-like-0')
    expect(mobileLikeBtn).toBeInTheDocument()

    // Clicking it triggers toggle
    fireEvent.click(mobileLikeBtn)
    expect(handleToggleFav).toHaveBeenCalledWith(mockTracks[0].path)

    // Still visible after 2s
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(screen.getByTestId('track-mobile-like-0')).toBeInTheDocument()

    // After remaining 2s (total 4s), it disappears
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(screen.queryByTestId('track-mobile-like-0')).not.toBeInTheDocument()

    vi.useRealTimers()
  })
})

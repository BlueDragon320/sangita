import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import React from 'react'
import TrackList from '../components/TrackList.jsx'

describe('TrackList Component & Duration Rendering', () => {
  const mockTracks = [
    { id: '1', name: 'Faded', playlist: 'Alan Walker', artist: 'Alan Walker', path: 'Alan Walker/Faded.mp3' },
    { id: '2', name: 'Alone', playlist: 'Alan Walker', artist: 'Alan Walker', path: 'Alan Walker/Alone.mp3' },
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

  it('provides a named keyboard-accessible play button for each track', () => {
    const play = vi.fn()
    render(<TrackList tracks={mockTracks} onPlayTrack={play} durations={mockDurations} token="token" />)
    fireEvent.click(screen.getByRole('button', { name: 'Play Alone' }))
    expect(play).toHaveBeenCalledWith(mockTracks[1], 1)
  })

  it('calls onAddToPlaylist via the 3-dots context menu without hover clutter', () => {
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

    // No hover + button cluttering the row
    expect(screen.queryByTestId('track-row-add-0')).not.toBeInTheDocument()

    // 3-dots menu contains Add to playlist
    const moreBtn = screen.getAllByTestId('track-more-btn')[0]
    fireEvent.click(moreBtn)

    const addMenuItem = screen.getByTestId('track-action-playlist')
    fireEvent.click(addMenuItem)

    expect(handleAddToPlaylist).toHaveBeenCalledWith(mockTracks[0])
  })

  it('allows toggling favorite state via the 3-dots context menu', () => {
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

    const moreBtns = screen.getAllByTestId('track-more-btn')
    expect(moreBtns[0]).toBeInTheDocument()

    // Open context menu
    fireEvent.click(moreBtns[0])

    const favAction = screen.getByTestId('track-action-fav')
    expect(favAction).toBeInTheDocument()
    expect(favAction).toHaveTextContent(/add to favorites/i)

    // Click favorite toggle
    fireEvent.click(favAction)
    expect(handleToggleFav).toHaveBeenCalledWith(mockTracks[0].path)
  })

  // SECTION 3 AUDIT & MODERNIZATION TESTS

  it('provides accessible titles on truncated title and artist for tooltips and screen readers', () => {
    render(
      <TrackList
        tracks={mockTracks}
        currentIndex={0}
        isPlaying={false}
        onPlayTrack={vi.fn()}
        durations={mockDurations}
      />
    )

    const fadedTitle = screen.getByText('Faded')
    expect(fadedTitle).toHaveAttribute('title', 'Faded')

    const alanWalkerArtists = screen.getAllByText('Alan Walker')
    expect(alanWalkerArtists[0]).toHaveAttribute('title', 'Alan Walker')
  })

  it('renders distinct active and paused indicators in col-num complying with WCAG 1.4.1', () => {
    const { rerender } = render(
      <TrackList
        tracks={mockTracks}
        currentIndex={0}
        isPlaying={true}
        onPlayTrack={vi.fn()}
        durations={mockDurations}
      />
    )

    // Active + playing: PlayingBars and "Pause Faded" aria-label
    expect(document.querySelector('.playing-bars')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pause Faded' })).toBeInTheDocument()

    // Active + paused: Paused indicator icon and "Resume Faded" aria-label
    rerender(
      <TrackList
        tracks={mockTracks}
        currentIndex={0}
        isPlaying={false}
        onPlayTrack={vi.fn()}
        durations={mockDurations}
      />
    )

    expect(document.querySelector('.playing-bars')).not.toBeInTheDocument()
    const pausedIndicator = screen.getByLabelText('Paused')
    expect(pausedIndicator).toBeInTheDocument()
    expect(pausedIndicator.querySelector('svg')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Resume Faded' })).toBeInTheDocument()

    // Inactive track: track number and hover play icon
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(document.querySelectorAll('.row-hover-play').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Play Alone' })).toBeInTheDocument()
  })

  it('provides visible 3-dots context menu button with full accessible action sheet', () => {
    const handleToggleFav = vi.fn()
    const handleAddToPlaylist = vi.fn()
    const handleDownload = vi.fn()
    const handlePlay = vi.fn()

    render(
      <TrackList
        tracks={mockTracks}
        currentIndex={0}
        isPlaying={true}
        onPlayTrack={handlePlay}
        durations={mockDurations}
        favorites={['Alan Walker/Faded.mp3']}
        onToggleFavorite={handleToggleFav}
        onAddToPlaylist={handleAddToPlaylist}
        onDownloadTrack={handleDownload}
      />
    )

    const moreBtns = screen.getAllByTestId('track-more-btn')
    expect(moreBtns.length).toBe(3)
    expect(moreBtns[0]).toHaveAttribute('aria-label', 'More actions for Faded')

    // Open context menu for first track (which is currently in favorites)
    fireEvent.click(moreBtns[0])

    const menu = screen.getByRole('menu', { name: 'Actions for Faded' })
    expect(menu).toBeInTheDocument()

    // Verify all required actions are present
    expect(screen.getByText('Play track')).toBeInTheDocument()
    expect(screen.getByText('Remove from favorites')).toBeInTheDocument()
    expect(screen.getByText('Add to playlist')).toBeInTheDocument()
    expect(screen.getByText('Download track')).toBeInTheDocument()

    // Test "Add to playlist" click
    fireEvent.click(screen.getByTestId('track-action-playlist'))
    expect(handleAddToPlaylist).toHaveBeenCalledWith(mockTracks[0])
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()

    // Reopen menu and test "Download track"
    fireEvent.click(moreBtns[0])
    fireEvent.click(screen.getByTestId('track-action-download'))
    expect(handleDownload).toHaveBeenCalledWith(mockTracks[0])

    // Reopen menu and test "Remove from favorites"
    fireEvent.click(moreBtns[0])
    fireEvent.click(screen.getByTestId('track-action-fav'))
    expect(handleToggleFav).toHaveBeenCalledWith(mockTracks[0].path)

    // Open menu for second track (not in favorites) -> should say "Add to favorites"
    fireEvent.click(moreBtns[1])
    expect(screen.getByText('Add to favorites')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('track-action-play'))
    expect(handlePlay).toHaveBeenCalledWith(mockTracks[1], 1)
  })

  it('closes 3-dots action menu when Escape is pressed', () => {
    render(
      <TrackList
        tracks={mockTracks}
        currentIndex={0}
        isPlaying={false}
        onPlayTrack={vi.fn()}
      />
    )

    const moreBtn = screen.getAllByTestId('track-more-btn')[0]
    fireEvent.click(moreBtn)
    expect(screen.getByRole('menu')).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('renders accessible favorite button inside 3-dots menu with track-row-like hook', () => {
    const handleToggleFav = vi.fn()
    render(
      <TrackList
        tracks={mockTracks}
        currentIndex={0}
        isPlaying={false}
        onPlayTrack={vi.fn()}
        favorites={[]}
        onToggleFavorite={handleToggleFav}
      />
    )

    const moreBtn = screen.getAllByTestId('track-more-btn')[0]
    fireEvent.click(moreBtn)

    const favBtn = screen.getByTestId('track-row-like-0')
    expect(favBtn).toBeInTheDocument()
    expect(favBtn).toHaveAttribute('aria-label', 'Add Faded to favorites')

    fireEvent.click(favBtn)
    expect(handleToggleFav).toHaveBeenCalledWith(mockTracks[0].path)
  })

  it('renders polished empty state card when tracks array is empty', () => {
    const handleEmptyAction = vi.fn()
    render(
      <TrackList
        tracks={[]}
        onEmptyAction={handleEmptyAction}
      />
    )

    expect(screen.getByTestId('tracklist-empty-state')).toBeInTheDocument()
    expect(screen.getByText('No tracks in this playlist yet')).toBeInTheDocument()
    expect(screen.getByText('Add songs from your library, or add an entire playlist from Discover.')).toBeInTheDocument()

    const actionBtn = screen.getByTestId('tracklist-empty-action')
    expect(actionBtn).toHaveTextContent('Add Playlist from Discover')

    fireEvent.click(actionBtn)
    expect(handleEmptyAction).toHaveBeenCalledTimes(1)
  })

  it('renders distinct filtered empty state when filterQuery or isFiltered is provided', () => {
    const handleClear = vi.fn()
    render(
      <TrackList
        tracks={[]}
        isFiltered={true}
        filterQuery="NonexistentSong"
        onEmptyAction={handleClear}
      />
    )

    expect(screen.getByTestId('tracklist-empty-state')).toBeInTheDocument()
    expect(screen.getByText('No matching tracks')).toBeInTheDocument()
    expect(screen.getByText(/No tracks match "NonexistentSong"/)).toBeInTheDocument()

    const actionBtn = screen.getByTestId('tracklist-empty-action')
    expect(actionBtn).toHaveTextContent('Clear Filter')

    fireEvent.click(actionBtn)
    expect(handleClear).toHaveBeenCalledTimes(1)
  })

  it('renders unavailable track rows with dimmed styling, lock icon, and tooltip', () => {
    const tracksWithUnavailable = [
      { id: '1', name: 'Available Song', path: 'Pl/avail.mp3' },
      { id: '2', name: 'Restricted Song', path: 'Pl/restricted.mp3', is_unavailable: true }
    ]

    render(
      <TrackList
        tracks={tracksWithUnavailable}
        currentIndex={0}
        isPlaying={false}
        onPlayTrack={vi.fn()}
      />
    )

    const unavailRow = screen.getByTestId('track-row-1')
    expect(unavailRow).toHaveClass('track-row-unavailable')
    expect(unavailRow).toHaveAttribute('aria-disabled', 'true')
    expect(unavailRow).toHaveAttribute('title', 'Unavailable in your library')

    const lockIcon = screen.getByTestId('track-unavailable-lock-1')
    expect(lockIcon).toBeInTheDocument()
    expect(lockIcon).toHaveAttribute('title', 'Unavailable in your library')
    expect(lockIcon).toHaveAttribute('aria-label', 'Unavailable in your library')
  })

  it('prevents play and download actions on unavailable tracks', () => {
    const handlePlay = vi.fn()
    const handleDownload = vi.fn()

    const tracksWithUnavailable = [
      { id: '1', name: 'Restricted Song', path: 'Pl/restricted.mp3', is_unavailable: true }
    ]

    render(
      <TrackList
        tracks={tracksWithUnavailable}
        currentIndex={-1}
        isPlaying={false}
        onPlayTrack={handlePlay}
        onDownloadTrack={handleDownload}
      />
    )

    const row = screen.getByTestId('track-row-0')

    // Click on row does not play
    fireEvent.click(row)
    expect(handlePlay).not.toHaveBeenCalled()

    // Keyboard enter/space on row does not play
    fireEvent.keyDown(row, { key: 'Enter' })
    fireEvent.keyDown(row, { key: ' ' })
    expect(handlePlay).not.toHaveBeenCalled()

    // Open context menu
    const moreBtn = screen.getByTestId('track-more-btn')
    fireEvent.click(moreBtn)

    const playAction = screen.getByTestId('track-action-play')
    const downloadAction = screen.getByTestId('track-action-download')

    expect(playAction).toBeDisabled()
    expect(playAction).toHaveAttribute('aria-disabled', 'true')
    expect(playAction).toHaveAttribute('title', 'Unavailable in your library')

    expect(downloadAction).toBeDisabled()
    expect(downloadAction).toHaveAttribute('aria-disabled', 'true')
    expect(downloadAction).toHaveAttribute('title', 'Unavailable in your library')

    // Clicking them does not trigger callbacks
    fireEvent.click(playAction)
    expect(handlePlay).not.toHaveBeenCalled()

    fireEvent.click(downloadAction)
    expect(handleDownload).not.toHaveBeenCalled()
  })

  it('toggles play/pause when clicking play button on active track row instead of restarting (F5)', () => {
    const handlePlay = vi.fn()
    const handleTogglePlay = vi.fn()
    render(
      <TrackList
        tracks={mockTracks}
        currentIndex={0}
        isPlaying={true}
        onPlayTrack={handlePlay}
        onTogglePlay={handleTogglePlay}
        durations={mockDurations}
      />
    )

    // The play button for the active row (index 0) has title "Pause Faded"
    const activePlayBtn = screen.getByRole('button', { name: 'Pause Faded' })
    fireEvent.click(activePlayBtn)
    expect(handleTogglePlay).toHaveBeenCalledTimes(1)
    expect(handlePlay).not.toHaveBeenCalled()
  })

  it('calls onPlayTrack when clicking play button on inactive track row (F5)', () => {
    const handlePlay = vi.fn()
    const handleTogglePlay = vi.fn()
    render(
      <TrackList
        tracks={mockTracks}
        currentIndex={0}
        isPlaying={true}
        onPlayTrack={handlePlay}
        onTogglePlay={handleTogglePlay}
        durations={mockDurations}
      />
    )

    // The play button for the inactive row (index 1) has title "Play Alone"
    const inactivePlayBtn = screen.getByRole('button', { name: 'Play Alone' })
    fireEvent.click(inactivePlayBtn)
    expect(handlePlay).toHaveBeenCalledWith(mockTracks[1], 1)
    expect(handleTogglePlay).not.toHaveBeenCalled()
  })
})

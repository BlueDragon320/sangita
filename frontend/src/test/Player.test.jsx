import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import Player from '../components/Player.jsx'

describe('Player Component & Controls', () => {
  const mockTrack = {
    id: 'track-1',
    name: 'Bohemian Rhapsody',
    playlist: 'Rock Classics',
    path: '/music/Rock Classics/Bohemian Rhapsody.mp3'
  }

  it('renders track info, playback controls and duration', () => {
    render(
      <Player
        track={mockTrack}
        playlist="Rock Classics"
        isPlaying={false}
        isShuffle={false}
        isLoop={false}
        onTogglePlay={vi.fn()}
        onNext={vi.fn()}
        onPrev={vi.fn()}
        onToggleShuffle={vi.fn()}
        onToggleLoop={vi.fn()}
        currentTime={60}
        duration={354}
        onSeek={vi.fn()}
        volume={80}
        onVolumeChange={vi.fn()}
        formatTime={(s) => `${Math.floor(s/60)}:${Math.floor(s%60).toString().padStart(2,'0')}`}
        isActiveDevice={true}
        activeDeviceName="My Laptop"
        syncState={null}
        onClaimDevice={vi.fn()}
        onSendRemote={vi.fn()}
        devices={[]}
        myDeviceId="dev-1"
        onOpenDevices={vi.fn()}
        showRightPanel={true}
        onToggleRightPanel={vi.fn()}
      />
    )

    expect(screen.getByText('Bohemian Rhapsody')).toBeInTheDocument()
    expect(screen.getByText('Rock Classics')).toBeInTheDocument()
    expect(screen.getByText('1:00')).toBeInTheDocument()
    expect(screen.getByText('5:54')).toBeInTheDocument()
  })

  it('renders embedded cover image in player disc thumbnail', () => {
    render(
      <Player
        track={mockTrack}
        playlist="Rock Classics"
        isPlaying={true}
        isShuffle={false}
        isLoop={false}
        onTogglePlay={vi.fn()}
        onNext={vi.fn()}
        onPrev={vi.fn()}
        onToggleShuffle={vi.fn()}
        onToggleLoop={vi.fn()}
        currentTime={60}
        duration={354}
        onSeek={vi.fn()}
        volume={80}
        onVolumeChange={vi.fn()}
        formatTime={(s) => '1:00'}
        isActiveDevice={true}
        activeDeviceName="My Laptop"
        syncState={null}
        onClaimDevice={vi.fn()}
        onSendRemote={vi.fn()}
        devices={[]}
        myDeviceId="dev-1"
        onOpenDevices={vi.fn()}
        token="test-token"
      />
    )

    const img = screen.getByRole('img', { name: 'Bohemian Rhapsody' })
    expect(img).toBeInTheDocument()
    expect(img.src).toContain('/api/cover/music/Rock%20Classics/Bohemian%20Rhapsody.mp3?token=test-token&v=2')
  })

  it('triggers onTogglePlay when play/pause button is clicked', () => {
    const handleTogglePlay = vi.fn()
    render(
      <Player
        track={mockTrack}
        playlist="Rock Classics"
        isPlaying={false}
        isShuffle={false}
        isLoop={false}
        onTogglePlay={handleTogglePlay}
        onNext={vi.fn()}
        onPrev={vi.fn()}
        onToggleShuffle={vi.fn()}
        onToggleLoop={vi.fn()}
        currentTime={0}
        duration={300}
        onSeek={vi.fn()}
        volume={80}
        onVolumeChange={vi.fn()}
        formatTime={(s) => '0:00'}
        isActiveDevice={true}
        activeDeviceName=""
        syncState={null}
        onClaimDevice={vi.fn()}
        onSendRemote={vi.fn()}
        devices={[]}
        myDeviceId="dev-1"
        onOpenDevices={vi.fn()}
      />
    )

    const mainPlayBtn = screen.getByTestId('player-play-btn')
    fireEvent.click(mainPlayBtn)

    expect(handleTogglePlay).toHaveBeenCalledTimes(1)
  })

  it('triggers onToggleRightPanel when panel toggle button is clicked', () => {
    const handleTogglePanel = vi.fn()
    render(
      <Player
        track={mockTrack}
        playlist="Rock Classics"
        isPlaying={true}
        isShuffle={false}
        isLoop={false}
        onTogglePlay={vi.fn()}
        onNext={vi.fn()}
        onPrev={vi.fn()}
        onToggleShuffle={vi.fn()}
        onToggleLoop={vi.fn()}
        currentTime={0}
        duration={300}
        onSeek={vi.fn()}
        volume={80}
        onVolumeChange={vi.fn()}
        formatTime={(s) => '0:00'}
        isActiveDevice={true}
        activeDeviceName=""
        syncState={null}
        onClaimDevice={vi.fn()}
        onSendRemote={vi.fn()}
        devices={[]}
        myDeviceId="dev-1"
        onOpenDevices={vi.fn()}
        showRightPanel={true}
        onToggleRightPanel={handleTogglePanel}
      />
    )

    const panelBtn = screen.getByTitle('Now Playing View')
    fireEvent.click(panelBtn)

    expect(handleTogglePanel).toHaveBeenCalledTimes(1)
  })

  it('triggers onToggleFavorite when heart like button is clicked', () => {
    const handleToggleFavorite = vi.fn()
    render(
      <Player
        track={mockTrack}
        playlist="Rock Classics"
        isPlaying={true}
        isShuffle={false}
        isLoop={false}
        onTogglePlay={vi.fn()}
        onNext={vi.fn()}
        onPrev={vi.fn()}
        onToggleShuffle={vi.fn()}
        onToggleLoop={vi.fn()}
        currentTime={0}
        duration={300}
        onSeek={vi.fn()}
        volume={80}
        onVolumeChange={vi.fn()}
        formatTime={(s) => '0:00'}
        isActiveDevice={true}
        activeDeviceName=""
        syncState={null}
        onClaimDevice={vi.fn()}
        onSendRemote={vi.fn()}
        devices={[]}
        myDeviceId="dev-1"
        onOpenDevices={vi.fn()}
        isFavorite={false}
        onToggleFavorite={handleToggleFavorite}
      />
    )

    const likeBtn = screen.getByTestId('player-like-btn')
    fireEvent.click(likeBtn)

    expect(handleToggleFavorite).toHaveBeenCalledWith(mockTrack.path)
  })
})

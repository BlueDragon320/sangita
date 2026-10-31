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

  it('allows seeking with the keyboard', () => {
    const seek = vi.fn()
    render(<Player track={mockTrack} currentTime={50} duration={100} onSeek={seek}
      formatTime={s => String(s)} isActiveDevice={true} volume={80} />)
    const slider = screen.getByRole('slider', { name: 'Seek' })
    fireEvent.keyDown(slider, { key: 'ArrowRight' })
    expect(seek).toHaveBeenCalledWith(55)
    fireEvent.keyDown(slider, { key: 'Home' })
    expect(seek).toHaveBeenCalledWith(0)
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

    const panelBtn = screen.getByTestId('player-right-panel-toggle')
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

  it('renders synchronized timestamp and active device name when playing on a remote device', () => {
    const handleSendRemote = vi.fn()
    const handleClaimDevice = vi.fn()

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
        currentTime={125}
        duration={354}
        onSeek={vi.fn()}
        volume={80}
        onVolumeChange={vi.fn()}
        formatTime={(s) => `${Math.floor(s/60)}:${Math.floor(s%60).toString().padStart(2,'0')}`}
        isActiveDevice={false}
        activeDeviceName="Chrome on Living Room TV"
        syncState={{
          activeDeviceId: 'dev-2',
          trackId: mockTrack.path,
          positionMs: 125000,
          durationMs: 354000,
          isPlaying: true,
          updatedAt: Date.now(),
        }}
        onClaimDevice={handleClaimDevice}
        onSendRemote={handleSendRemote}
        devices={[{ deviceId: 'dev-2', deviceName: 'Chrome on Living Room TV' }]}
        myDeviceId="dev-1"
        onOpenDevices={vi.fn()}
      />
    )

    expect(screen.getByText('Playing on')).toBeInTheDocument()
    expect(screen.getByText('Chrome on Living Room TV')).toBeInTheDocument()
    expect(screen.getByText('2:05')).toBeInTheDocument()
    expect(screen.getByText('5:54')).toBeInTheDocument()

    // Clicking "Play on this device" triggers onClaimDevice
    const claimBtn = screen.getByText('Play on this device')
    fireEvent.click(claimBtn)
    expect(handleClaimDevice).toHaveBeenCalledTimes(1)
  })

  it('renders full-width top progress bar matching mobile miniplayer', () => {
    const handleSeek = vi.fn()
    render(
      <Player
        track={mockTrack}
        playlist="Rock Classics"
        isPlaying={true}
        currentTime={50}
        duration={100}
        onSeek={handleSeek}
        formatTime={(s) => `${Math.floor(s/60)}:${Math.floor(s%60).toString().padStart(2,'0')}`}
        isActiveDevice={true}
        syncState={null}
      />
    )

    const topProgress = screen.getByTestId('player-top-progress')
    expect(topProgress).toBeInTheDocument()

    // Clicking top progress bar triggers onSeek
    fireEvent.click(topProgress, { clientX: 50 })
    expect(handleSeek).toHaveBeenCalled()
  })

  it('supports PageUp, PageDown and touch scrubbing on top progress seek bar', () => {
    const handleSeek = vi.fn()
    render(
      <Player
        track={mockTrack}
        playlist="Rock Classics"
        isPlaying={true}
        currentTime={50}
        duration={100}
        onSeek={handleSeek}
        formatTime={(s) => `${s}s`}
        isActiveDevice={true}
      />
    )

    const slider = screen.getByRole('slider', { name: 'Seek' })
    expect(slider).toHaveAttribute('aria-orientation', 'horizontal')

    // PageUp (+10%)
    fireEvent.keyDown(slider, { key: 'PageUp' })
    expect(handleSeek).toHaveBeenCalledWith(60)

    // PageDown (-10%)
    fireEvent.keyDown(slider, { key: 'PageDown' })
    expect(handleSeek).toHaveBeenCalledWith(40)

    // Touch scrubbing
    fireEvent.touchStart(slider, {
      touches: [{ clientX: 25 }],
    })
    expect(handleSeek).toHaveBeenCalled()

    fireEvent.touchMove(slider, {
      touches: [{ clientX: 75 }],
    })
    expect(handleSeek).toHaveBeenCalled()

    fireEvent.touchEnd(slider, {
      changedTouches: [{ clientX: 80 }],
    })
    expect(handleSeek).toHaveBeenCalled()
  })

  it('provides accessible volume slider with step=5, PageUp/PageDown, and mute memory', () => {
    const handleVolumeChange = vi.fn()
    const { rerender } = render(
      <Player
        track={mockTrack}
        volume={70}
        onVolumeChange={handleVolumeChange}
        isActiveDevice={true}
      />
    )

    const volumeSlider = screen.getByTestId('player-volume-slider')
    expect(volumeSlider).toHaveAttribute('aria-label', 'Volume')
    expect(volumeSlider).toHaveAttribute('aria-valuetext', '70%')
    expect(volumeSlider).toHaveAttribute('step', '5')

    // PageUp (+10)
    fireEvent.keyDown(volumeSlider, { key: 'PageUp' })
    expect(handleVolumeChange).toHaveBeenCalledWith(80)

    // PageDown (-10)
    fireEvent.keyDown(volumeSlider, { key: 'PageDown' })
    expect(handleVolumeChange).toHaveBeenCalledWith(60)

    // Mute toggle remembers previous volume level
    const muteToggle = screen.getByTestId('player-volume-toggle')
    expect(muteToggle).toHaveAttribute('aria-label', 'Mute')
    fireEvent.click(muteToggle)
    expect(handleVolumeChange).toHaveBeenCalledWith(0)

    // When volume is 0, unmute restores previous volume (70)
    rerender(
      <Player
        track={mockTrack}
        volume={0}
        onVolumeChange={handleVolumeChange}
        isActiveDevice={true}
      />
    )
    const unmuteToggle = screen.getByTestId('player-volume-toggle')
    expect(unmuteToggle).toHaveAttribute('aria-label', 'Unmute')
    fireEvent.click(unmuteToggle)
    expect(handleVolumeChange).toHaveBeenCalledWith(70)
  })

  it('renders all accessible labels and states on transport controls', () => {
    render(
      <Player
        track={mockTrack}
        isPlaying={true}
        isShuffle={true}
        isLoop={true}
        isFavorite={true}
        showLyrics={true}
        showRightPanel={true}
        onToggleLyrics={vi.fn()}
        onToggleRightPanel={vi.fn()}
        onOpenDevices={vi.fn()}
        isActiveDevice={true}
      />
    )

    const playBtn = screen.getByTestId('player-play-btn')
    expect(playBtn).toHaveAttribute('aria-label', 'Pause')

    const shuffleBtn = screen.getByTestId('player-shuffle-btn')
    expect(shuffleBtn).toHaveAttribute('aria-label', 'Shuffle')
    expect(shuffleBtn).toHaveAttribute('aria-pressed', 'true')

    const loopBtn = screen.getByTestId('player-loop-btn')
    expect(loopBtn).toHaveAttribute('aria-label', 'Repeat')
    expect(loopBtn).toHaveAttribute('aria-pressed', 'true')

    const favoriteBtn = screen.getByTestId('player-like-btn')
    expect(favoriteBtn).toHaveAttribute('aria-label', 'Remove from Favorites')
    expect(favoriteBtn).toHaveAttribute('aria-pressed', 'true')

    const lyricsBtn = screen.getByTestId('lyrics-toggle-btn')
    expect(lyricsBtn).toHaveAttribute('aria-label', 'Toggle synced lyrics')
    expect(lyricsBtn).toHaveAttribute('aria-pressed', 'true')

    const rightPanelBtn = screen.getByTestId('player-right-panel-toggle')
    expect(rightPanelBtn).toHaveAttribute('aria-label', 'Toggle now playing panel')
    expect(rightPanelBtn).toHaveAttribute('aria-expanded', 'true')

    const devicesBtn = screen.getByTestId('player-devices-btn')
    expect(devicesBtn).toHaveAttribute('aria-label', 'Connected devices')
  })

  it('includes onAddToPlaylist button in remote playback mode for parity', () => {
    const handleAddToPlaylist = vi.fn()
    render(
      <Player
        track={mockTrack}
        isActiveDevice={false}
        activeDeviceName="Living Room Speaker"
        syncState={{
          activeDeviceId: 'dev-remote',
          trackId: mockTrack.path,
          positionMs: 10000,
          durationMs: 120000,
          isPlaying: true,
        }}
        myDeviceId="dev-local"
        onAddToPlaylist={handleAddToPlaylist}
        onSendRemote={vi.fn()}
      />
    )

    const addBtn = screen.getByTestId('player-add-btn')
    expect(addBtn).toBeInTheDocument()
    fireEvent.click(addBtn)
    expect(handleAddToPlaylist).toHaveBeenCalledWith(mockTrack)
  })

  it('renders autoplay gesture unlock UI when requiresUserGesture is true (F4)', () => {
    const handleUnlock = vi.fn()
    render(
      <Player
        track={mockTrack}
        playlist="Rock Classics"
        isPlaying={false}
        isActiveDevice={true}
        requiresUserGesture={true}
        onUnlockWebAudio={handleUnlock}
      />
    )

    const unlockBtn = screen.getByTestId('player-gesture-unlock-btn')
    expect(unlockBtn).toBeInTheDocument()
    expect(unlockBtn).toHaveTextContent(/Audio paused by browser/i)
    fireEvent.click(unlockBtn)
    expect(handleUnlock).toHaveBeenCalledTimes(1)
  })

  it('supports desktop mouse drag scrubbing on PlayerTopProgress (F6)', () => {
    const handleSeek = vi.fn()
    render(
      <Player
        track={mockTrack}
        playlist="Rock Classics"
        isPlaying={true}
        currentTime={50}
        duration={100}
        onSeek={handleSeek}
        formatTime={(s) => `${s}s`}
        isActiveDevice={true}
      />
    )

    const progress = screen.getByTestId('player-top-progress')
    // Mouse down to begin dragging
    fireEvent.mouseDown(progress, { clientX: 20, button: 0 })
    expect(handleSeek).toHaveBeenCalled()

    // Drag move to a new position
    fireEvent.mouseMove(progress, { clientX: 60 })
    expect(handleSeek).toHaveBeenCalled()

    // Mouse up on window finishes gesture
    fireEvent.mouseUp(window, { clientX: 85 })
    expect(handleSeek).toHaveBeenCalled()
  })
})

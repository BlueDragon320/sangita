import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App.jsx'

const sync = vi.hoisted(() => ({
  broadcastState: vi.fn(),
  getMyDeviceId: () => 'web',
  command: null,
  setSyncState: vi.fn(), setIsActiveDevice: vi.fn(),
  transferPlayback: vi.fn(), sendRemoteControl: vi.fn(), claimActiveDevice: vi.fn(),
  active: true, state: null,
}))
vi.mock('../hooks/useDeviceSync.js', () => ({
  useDeviceSync: ({ onRemoteCommand }) => {
    sync.command = onRemoteCommand
    return { ...sync, devices: [], isActiveDevice: sync.active, syncState: sync.state }
  },
}))
vi.mock('../components/Login.jsx', () => ({
  default: ({ onLogin }) => <button onClick={() => onLogin('test-token', 'listener', 'user')}>Test sign in</button>,
}))

async function signInAndStage(path) {
  const { container } = render(<App />)
  expect(container.querySelector('audio')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Test sign in' }))
  await waitFor(() => expect(container.querySelector('audio')).not.toBeNull())
  const audio = container.querySelector('audio')
  Object.defineProperties(audio, {
    duration: { configurable: true, value: 180 },
    paused: { configurable: true, value: false },
    readyState: { configurable: true, value: 4 },
  })
  await act(async () => sync.command({ action: 'play_track', payload: { path } }))
  return audio
}

describe('authoritative browser playback updates', () => {
  beforeEach(() => {
    localStorage.clear()
    window.history.replaceState({}, '', '/')
    sync.broadcastState.mockClear()
    sync.active = true
    sync.state = null
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {})
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
    global.fetch = vi.fn(async url => ({
      ok: true,
      json: async () => url.includes('/api/me')
        ? { username: 'listener', role: 'user', rules: { allowed_playlists: ['*'] } }
        : url.includes('/api/playlists') ? { First: ['First/old.mp3'], Second: ['Second/new.mp3'] }
        : url.includes('/api/favorites') ? [] : {},
    }))
  })

  it('publishes the remotely selected track when audio mounts after sign in', async () => {
    const audio = await signInAndStage('Second/new.mp3')
    audio.currentTime = 5
    fireEvent.playing(audio)
    expect(sync.broadcastState).toHaveBeenCalledWith(expect.objectContaining({
      trackId: 'Second/new.mp3', positionMs: 5000, durationMs: 180000,
      isPlaying: true, isBuffering: false,
    }))
  })

  it('publishes the new identity and pause or seek state after changing songs', async () => {
    const audio = await signInAndStage('First/old.mp3')
    fireEvent.playing(audio)
    await act(async () => sync.command({ action: 'play_track', payload: { path: 'Second/new.mp3' } }))
    audio.currentTime = 30
    fireEvent.seeked(audio)
    expect(sync.broadcastState).toHaveBeenLastCalledWith(expect.objectContaining({
      trackId: 'Second/new.mp3', positionMs: 30000, isBuffering: false,
    }))
    Object.defineProperty(audio, 'paused', { configurable: true, value: true })
    fireEvent.pause(audio)
    expect(sync.broadcastState).toHaveBeenLastCalledWith(expect.objectContaining({
      trackId: 'Second/new.mp3', isPlaying: false, isBuffering: false,
    }))
  })

  it('keeps the remote player visible for a phone song outside the saved library', async () => {
    localStorage.setItem('sangita_token', 'test-token')
    sync.active = false
    sync.state = { activeDeviceId: 'phone', originDeviceId: 'phone',
      trackId: 'Unadded/Phone song.mp3', positionMs: 12000, durationMs: 180000, isPlaying: true }
    render(<App />)
    const player = await screen.findByTestId('player-bar')
    expect(player).toHaveTextContent('Phone song')
    expect(player).toHaveTextContent('Playing on')
  })

  it('passes explicit trackId when claiming device while passive (F1)', async () => {
    localStorage.setItem('sangita_token', 'test-token')
    sync.active = false
    sync.state = {
      activeDeviceId: 'phone',
      originDeviceId: 'phone',
      trackId: 'Old/song.mp3',
      positionMs: 5000,
      durationMs: 120000,
      isPlaying: true
    }
    sync.claimActiveDevice.mockClear()
    sync.broadcastState.mockClear()

    render(<App />)
    const claimBtn = await screen.findByRole('button', { name: 'Play on this device' })
    fireEvent.click(claimBtn)

    expect(sync.claimActiveDevice).toHaveBeenCalledWith('Old/song.mp3')
  })
})

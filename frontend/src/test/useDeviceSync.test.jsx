import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDeviceSync } from '../hooks/useDeviceSync.js'

const wire = vi.hoisted(() => ({ handlers: {}, emit: vi.fn(), disconnect: vi.fn() }))
vi.mock('socket.io-client', () => ({ io: () => ({
  on: (name, handler) => { wire.handlers[name] = handler },
  emit: wire.emit, disconnect: wire.disconnect,
}) }))

describe('device sync session snapshots', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    wire.handlers = {}
    wire.emit.mockClear()
    sessionStorage.setItem('sangita_device_id', 'web')
  })
  afterEach(() => { cleanup(); vi.useRealTimers() })

  const audioRef = () => ({ current: {
    currentTime: 10, duration: 180, paused: false, ended: false, readyState: 4, pause: vi.fn(),
  } })

  it('reports the loaded identity together with the actual playback position and readiness', () => {
    renderHook(() => useDeviceSync({ token: 'test', audioRef: audioRef(), isPlaying: true,
      getTrackId: () => 'Second/new.mp3' }))
    act(() => vi.advanceTimersByTime(1000))
    expect(wire.emit).toHaveBeenCalledWith('POSITION_REPORT', expect.objectContaining({
      trackId: 'Second/new.mp3', positionMs: 10000, durationMs: 180000,
      isPlaying: true, isBuffering: false,
    }))
  })

  it('updates remote identity and position atomically from a full progress snapshot', () => {
    const { result } = renderHook(() => useDeviceSync({ token: 'test', audioRef: audioRef(), isPlaying: false }))
    act(() => wire.handlers.PLAYBACK_STATE_CHANGED({ activeDeviceId: 'phone', originDeviceId: 'phone',
      trackId: 'First/old.mp3', positionMs: 50000 }))
    act(() => wire.handlers.POSITION_SYNC({ activeDeviceId: 'phone', originDeviceId: 'phone',
      trackId: 'Second/new.mp3', positionMs: 5000, durationMs: 180000, isPlaying: true, isBuffering: false }))
    expect(result.current.syncState).toEqual(expect.objectContaining({
      trackId: 'Second/new.mp3', positionMs: 5000, isPlaying: true, isBuffering: false,
    }))
  })

  it('taking over from the phone does not send the inactive browser position', () => {
    const { result } = renderHook(() => useDeviceSync({ token: 'test', audioRef: audioRef(), isPlaying: false }))
    act(() => wire.handlers.PLAYBACK_STATE_CHANGED({ activeDeviceId: 'phone', originDeviceId: 'phone',
      trackId: 'Second/new.mp3', positionMs: 80000 }))
    act(() => result.current.transferPlayback('web'))
    expect(wire.emit).toHaveBeenCalledWith('TRANSFER_PLAYBACK', {
      targetDeviceId: 'web', positionMs: undefined, durationMs: undefined,
    })
  })

  it('transferring away sends the position of the previously active browser', () => {
    const { result } = renderHook(() => useDeviceSync({ token: 'test', audioRef: audioRef(), isPlaying: false }))
    act(() => result.current.transferPlayback('phone'))
    expect(wire.emit).toHaveBeenCalledWith('TRANSFER_PLAYBACK', {
      targetDeviceId: 'phone', positionMs: 10000, durationMs: 180000,
    })
  })
})

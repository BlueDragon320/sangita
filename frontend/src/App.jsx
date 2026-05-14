import { useState, useEffect, useRef, useCallback } from 'react'
import Login      from './components/Login.jsx'
import Sidebar    from './components/Sidebar.jsx'
import Hero       from './components/Hero.jsx'
import TrackList  from './components/TrackList.jsx'
import Player     from './components/Player.jsx'
import DevicePanel from './components/DevicePanel.jsx'
import { useDeviceSync } from './hooks/useDeviceSync.js'

function buildTracks(playlistName, paths) {
  return paths.map((p, i) => ({
    id: `${playlistName}-${i}`, path: p,
    name: p.split('/').pop().replace(/\.[^/.]+$/, ''), playlist: playlistName,
  }))
}
function formatTime(s) {
  if (!s || isNaN(s) || s === Infinity) return '0:00'
  return `${Math.floor(s/60)}:${Math.floor(s%60).toString().padStart(2,'0')}`
}
function ThemeIcon({ theme }) {
  if (theme === 'light') return <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0 .39-.39.39-1.03 0-1.41l-1.06-1.06zm1.06-10.96c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z"/></svg>
  if (theme === 'dark') return <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-2.98 0-5.4-2.42-5.4-5.4 0-1.81.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z"/></svg>
  return <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
}

export default function App() {
  const [token,           setToken]           = useState(() => localStorage.getItem('sangita_token') || '')
  const [username,        setUsername]        = useState(() => localStorage.getItem('sangita_user')  || '')
  const [playlists,       setPlaylists]       = useState({})
  const [currentPlaylist, setCurrentPlaylist] = useState('')
  const [dataLoading,     setDataLoading]     = useState(false)
  const [mobileMenuOpen,  setMobileMenuOpen]  = useState(false)
  const [queue,           setQueue]           = useState([])
  const [currentIndex,    setCurrentIndex]    = useState(-1)
  const [isPlaying,       setIsPlaying]       = useState(false)
  const [isShuffle,       setIsShuffle]       = useState(false)
  const [isLoop,          setIsLoop]          = useState(false)
  const [volume,          setVolume]          = useState(80)
  const [currentTime,     setCurrentTime]     = useState(0)
  const [duration,        setDuration]        = useState(0)
  const [durations,       setDurations]       = useState({})
  const [theme,           setTheme]           = useState(() => localStorage.getItem('sangita_theme') || 'bluedark')
  const [showDevices,     setShowDevices]     = useState(false)

  const audioRef     = useRef(null)
  const queueRef     = useRef([])
  const indexRef     = useRef(-1)
  const isShuffleRef = useRef(false)
  const isLoopRef    = useRef(false)
  const volumeRef    = useRef(80)
  const rafRef       = useRef(null)

  const playNextRef   = useRef(null)
  const playPrevRef   = useRef(null)
  const togglePlayRef = useRef(null)
  const seekToRef     = useRef(null)
  const changeVolRef  = useRef(null)
  const playTrackRef  = useRef(null)
  const lastSyncIdRef = useRef(null)
  const loadedTrackIdRef = useRef(null)
  const sendRemoteRef = useRef(null)

  useEffect(() => { queueRef.current     = queue        }, [queue])
  useEffect(() => { indexRef.current     = currentIndex }, [currentIndex])
  useEffect(() => { isShuffleRef.current = isShuffle    }, [isShuffle])
  useEffect(() => { isLoopRef.current    = isLoop       }, [isLoop])
  useEffect(() => { volumeRef.current    = volume       }, [volume])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('sangita_theme', theme)
  }, [theme])

  const cycleTheme = useCallback(() => {
    setTheme(t => t === 'bluedark' ? 'dark' : t === 'dark' ? 'light' : 'bluedark')
  }, [])

  const handleLogin = useCallback((tok, user) => {
    localStorage.setItem('sangita_token', tok)
    localStorage.setItem('sangita_user',  user)
    setToken(tok); setUsername(user)
  }, [])

  const handleLogout = useCallback(() => {
    localStorage.removeItem('sangita_token')
    localStorage.removeItem('sangita_user')
    setToken(''); setUsername(''); setPlaylists({})
    setQueue([]); setCurrentIndex(-1); setIsPlaying(false)
    setCurrentTime(0); setDuration(0)
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = '' }
    loadedTrackIdRef.current = null
  }, [])

  const handleRemoteCommand = useCallback((command) => {
    switch (command.action) {
      case 'play':   togglePlayRef.current?.(); break
      case 'pause':  togglePlayRef.current?.(); break
      case 'next':   playNextRef.current?.();   break
      case 'prev':   playPrevRef.current?.();   break
      case 'seek':   seekToRef.current?.(command.payload?.pct);      break
      case 'volume': changeVolRef.current?.(command.payload?.volume); break
      case 'play_track': playTrackRef.current?.(command.payload?.path); break
    }
  }, [])

  const {
    devices, isActiveDevice, syncState, setSyncState,
    broadcastState, transferPlayback, sendRemoteControl,
    claimActiveDevice, getMyDeviceId,
  } = useDeviceSync({ token, audioRef, isPlaying, onRemoteCommand: handleRemoteCommand })

  const isActiveRef   = useRef(isActiveDevice)
  const syncStateRef  = useRef(syncState)
  useEffect(() => { isActiveRef.current = isActiveDevice }, [isActiveDevice])
  useEffect(() => { syncStateRef.current = syncState }, [syncState])
  useEffect(() => { sendRemoteRef.current = sendRemoteControl }, [sendRemoteControl])

  const activeDeviceName = (() => {
    if (!syncState?.activeDeviceId || isActiveDevice) return null
    const d = devices.find(d => d.deviceId === syncState.activeDeviceId)
    return d?.deviceName || 'Another device'
  })()

  useEffect(() => {
    if (!syncState) return
    
    let q = queueRef.current
    let trackIdx = q.findIndex(t => t.path === syncState.trackId)
    
    if (trackIdx < 0) {
      let foundPlaylist = null;
      for (const [pName, paths] of Object.entries(playlists)) {
         if (paths.includes(syncState.trackId)) { foundPlaylist = pName; break; }
      }
      if (foundPlaylist) {
         setCurrentPlaylist(foundPlaylist);
         q = buildTracks(foundPlaylist, playlists[foundPlaylist]);
         setQueue(q);
         trackIdx = q.findIndex(t => t.path === syncState.trackId);
      }
    }

    const stateId = `${syncState.activeDeviceId}:${syncState.trackId}:${syncState.updatedAt}`
    if (lastSyncIdRef.current === stateId && indexRef.current === trackIdx) return
    lastSyncIdRef.current = stateId

    if (trackIdx >= 0) {
      setCurrentIndex(trackIdx)
    } else if (Object.keys(playlists).length > 0) {
      setCurrentIndex(-1)
    }

    if (isActiveDevice) {
      if (trackIdx < 0 || !audioRef.current) return
      const drift     = syncState.isPlaying ? Math.max(0, Date.now() - syncState.updatedAt) : 0
      const targetSec = (syncState.positionMs + drift) / 1000
      const applySeek = () => {
        if (!audioRef.current) return
        audioRef.current.volume = syncState.volume ?? volumeRef.current / 100
        audioRef.current.currentTime = Math.min(targetSec, audioRef.current.duration || 0)
        if (syncState.isPlaying) audioRef.current.play().catch(console.error)
        else audioRef.current.pause()
      }
      const targetPath = q[trackIdx].path;
      if (loadedTrackIdRef.current !== targetPath) {
        loadedTrackIdRef.current = targetPath;
        const t = localStorage.getItem('sangita_token') || ''
        audioRef.current.src = `/api/stream/${encodeURIComponent(targetPath)}?token=${t}`
        audioRef.current.addEventListener('loadedmetadata', applySeek, { once: true })
      } else { applySeek() }
    } else {
      if (audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause(); setIsPlaying(false)
      }
    }
  }, [syncState, isActiveDevice, playlists]) // eslint-disable-line

  useEffect(() => {
    if (!token) return
    setDataLoading(true)
    fetch('/api/playlists', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => { if (!r.ok) throw new Error(r.status); return r.json() })
      .then(data => { setPlaylists(data); const f = Object.keys(data)[0]; if (f) setCurrentPlaylist(f) })
      .catch(() => handleLogout())
      .finally(() => setDataLoading(false))
  }, [token])

  useEffect(() => {
    if (!currentPlaylist || !playlists[currentPlaylist]) return
    const tracks = buildTracks(currentPlaylist, playlists[currentPlaylist])
    setQueue(tracks)
    
    const curPath = loadedTrackIdRef.current;
    const newIdx = tracks.findIndex(t => t.path === curPath);
    if (newIdx >= 0) {
      setCurrentIndex(newIdx);
      return;
    }
    if (syncState && syncState.trackId && tracks.some(t => t.path === syncState.trackId)) return;

    setCurrentIndex(-1); setCurrentTime(0); setDuration(0)
    setIsPlaying(false); setDurations({})
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = '' }
    loadedTrackIdRef.current = null
  }, [currentPlaylist, playlists]) // eslint-disable-line

  useEffect(() => {
    const tick = () => {
      const audio = audioRef.current
      if (audio) {
        const t = audio.currentTime || 0
        const d = isFinite(audio.duration) ? audio.duration : 0
        setCurrentTime(t); setDuration(d); setIsPlaying(!audio.paused && !audio.ended && d > 0)
        if (d > 0) {
          const track = indexRef.current >= 0 ? queueRef.current[indexRef.current] : null
          if (track) setDurations(prev => prev[track.path] === d ? prev : { ...prev, [track.path]: d })
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [])

  useEffect(() => {
    const audio = audioRef.current; if (!audio) return
    const onEnded = () => {
      const q = queueRef.current; const idx = indexRef.current
      if (q.length === 0) return
      if (isLoopRef.current) { audio.currentTime = 0; audio.play().catch(console.error); return }
      let nextIdx
      if (isShuffleRef.current) {
        if (q.length === 1) { nextIdx = 0 }
        else { do { nextIdx = Math.floor(Math.random() * q.length) } while (nextIdx === idx) }
      } else { nextIdx = idx + 1 >= q.length ? 0 : idx + 1 }
      internalPlayTrack(q[nextIdx], nextIdx)
    }
    const onDurationChange = () => {
      const dur = audio.duration
      if (isFinite(dur) && dur > 0) {
        if (lastSyncIdRef.current) {
          broadcastState({
            activeDeviceId: getMyDeviceId(),
            trackId: loadedTrackIdRef.current,
            positionMs: Math.floor(audio.currentTime * 1000),
            durationMs: Math.floor(dur * 1000),
            isPlaying: !audio.paused, volume: volumeRef.current / 100, updatedAt: Date.now(),
          })
        }
      }
    }
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('durationchange', onDurationChange)
    return () => {
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('durationchange', onDurationChange)
    }
  }, []) // eslint-disable-line

  const internalPlayTrack = useCallback((track, index) => {
    if (!track) return
    const isAct = isActiveRef.current;
    const sState = syncStateRef.current;

    if (!isAct && sState?.activeDeviceId) {
      sendRemoteRef.current?.({ action: 'play_track', payload: { path: track.path } });
      setSyncState(prev => prev ? { ...prev, trackId: track.path, positionMs: 0, isPlaying: true, updatedAt: Date.now() } : prev);
      return;
    }

    if (!audioRef.current) return
    const t = localStorage.getItem('sangita_token') || ''
    audioRef.current.src    = `/api/stream/${encodeURIComponent(track.path)}?token=${t}`
    loadedTrackIdRef.current = track.path
    audioRef.current.volume = volumeRef.current / 100
    audioRef.current.play().catch(console.error)
    setCurrentIndex(index)
    broadcastState({
      activeDeviceId: getMyDeviceId(), trackId: track.path,
      positionMs: 0, durationMs: isFinite(audioRef.current.duration) ? Math.floor(audioRef.current.duration * 1000) : 0,
      isPlaying: true, volume: volumeRef.current / 100, updatedAt: Date.now(),
    })
  }, [broadcastState, getMyDeviceId])

  const playTrack  = useCallback((track, index) => internalPlayTrack(track, index), [internalPlayTrack])

  const playNext = useCallback(() => {
    const q = queueRef.current; const idx = indexRef.current; if (q.length === 0) return
    let nextIdx
    if (isShuffleRef.current) {
      if (q.length === 1) { nextIdx = 0 }
      else { do { nextIdx = Math.floor(Math.random() * q.length) } while (nextIdx === idx) }
    } else { nextIdx = idx + 1 >= q.length ? 0 : idx + 1 }
    internalPlayTrack(q[nextIdx], nextIdx)
  }, [internalPlayTrack])

  const playPrev = useCallback(() => {
    const q = queueRef.current; const idx = indexRef.current; if (q.length === 0) return
    if (audioRef.current && audioRef.current.currentTime > 3) { audioRef.current.currentTime = 0; return }
    internalPlayTrack(q[idx <= 0 ? q.length - 1 : idx - 1], idx <= 0 ? q.length - 1 : idx - 1)
  }, [internalPlayTrack])

  const togglePlay = useCallback(() => {
    const isAct = isActiveRef.current;
    const sState = syncStateRef.current;

    if (!isAct && sState?.activeDeviceId) {
       broadcastState({
         activeDeviceId: sState.activeDeviceId, trackId: sState.trackId,
         positionMs: sState.positionMs, durationMs: sState.durationMs,
         isPlaying: !sState.isPlaying, volume: sState.volume ?? (volumeRef.current / 100), updatedAt: Date.now(),
       });
       return;
    }

    const audio = audioRef.current; if (!audio) return
    if (!audio.src || audio.src === window.location.href) {
      const q = queueRef.current; if (q.length === 0) return
      const idx = isShuffleRef.current ? Math.floor(Math.random() * q.length) : 0
      internalPlayTrack(q[idx], idx); return
    }
    const newPlaying = audio.paused
    if (newPlaying) audio.play().catch(console.error); else audio.pause()
    broadcastState({
      activeDeviceId: getMyDeviceId(),
      trackId: loadedTrackIdRef.current,
      positionMs: Math.floor(audio.currentTime * 1000),
      durationMs: isFinite(audio.duration) ? Math.floor(audio.duration * 1000) : 0,
      isPlaying: newPlaying, volume: volumeRef.current / 100, updatedAt: Date.now(),
    })
  }, [broadcastState, getMyDeviceId, internalPlayTrack])

  const seekTo = useCallback((pct) => {
    const audio = audioRef.current; if (!audio) return
    const dur = isFinite(audio.duration) ? audio.duration : 0; if (dur <= 0) return
    audio.currentTime = (pct / 100) * dur
    broadcastState({
      activeDeviceId: getMyDeviceId(), trackId: loadedTrackIdRef.current,
      positionMs: Math.floor(audio.currentTime * 1000),
      durationMs: isFinite(audio.duration) ? Math.floor(audio.duration * 1000) : 0,
      isPlaying: !audio.paused, volume: volumeRef.current / 100, updatedAt: Date.now(),
    })
  }, [broadcastState, getMyDeviceId])

  const changeVolume = useCallback((v) => {
    setVolume(v); if (audioRef.current) audioRef.current.volume = v / 100
    broadcastState({
      activeDeviceId: getMyDeviceId(), trackId: loadedTrackIdRef.current,
      positionMs: Math.floor((audioRef.current?.currentTime || 0) * 1000),
      durationMs: isFinite(audioRef.current?.duration) ? Math.floor(audioRef.current.duration * 1000) : 0,
      isPlaying: !audioRef.current?.paused, volume: v / 100, updatedAt: Date.now(),
    })
  }, [broadcastState, getMyDeviceId])

  useEffect(() => { playNextRef.current   = playNext   }, [playNext])
  useEffect(() => { playPrevRef.current   = playPrev   }, [playPrev])
  useEffect(() => { togglePlayRef.current = togglePlay }, [togglePlay])
  useEffect(() => { seekToRef.current     = seekTo     }, [seekTo])
  useEffect(() => { changeVolRef.current  = changeVolume }, [changeVolume])
  useEffect(() => {
    playTrackRef.current = (path) => {
      let q = queueRef.current;
      let idx = q.findIndex(t => t.path === path);
      if (idx >= 0) { internalPlayTrack(q[idx], idx); return; }
      let found = null;
      for (const [pName, paths] of Object.entries(playlists)) {
         if (paths.includes(path)) { found = pName; break; }
      }
      if (found) {
         setCurrentPlaylist(found);
         q = buildTracks(found, playlists[found]);
         setQueue(q);
         idx = q.findIndex(t => t.path === path);
         if (idx >= 0) internalPlayTrack(q[idx], idx);
      }
    }
  }, [playlists, internalPlayTrack])

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT') return
      if (e.code === 'Space')      { e.preventDefault(); togglePlay() }
      if (e.code === 'ArrowRight') playNext()
      if (e.code === 'ArrowLeft')  playPrev()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [togglePlay, playNext, playPrev])

  const downloadTrack = useCallback(() => {
    const q = queueRef.current; const idx = indexRef.current
    const track = idx >= 0 ? q[idx] : (q.length > 0 ? q[0] : null); if (!track) return
    const t = localStorage.getItem('sangita_token') || ''
    const a = document.createElement('a')
    a.href = `/api/stream/${encodeURIComponent(track.path)}?token=${t}`
    a.download = track.name; document.body.appendChild(a); a.click(); document.body.removeChild(a)
  }, [])

  if (!token) return <Login onLogin={handleLogin} />
  const currentTrack = currentIndex >= 0 && queue[currentIndex] ? queue[currentIndex] : null

  return (
    <div className="app">
      <audio ref={audioRef} preload="auto" />
      {showDevices && (
        <DevicePanel
          devices={devices} myDeviceId={getMyDeviceId()}
          activeDeviceId={syncState?.activeDeviceId}
          onTransfer={transferPlayback} onClose={() => setShowDevices(false)}
        />
      )}
      <div className="app-body">
        {mobileMenuOpen && <div className="mobile-overlay" onClick={() => setMobileMenuOpen(false)} />}
        <Sidebar
          playlists={playlists} currentPlaylist={currentPlaylist}
          onSelect={(name) => { setCurrentPlaylist(name); setMobileMenuOpen(false) }}
          isOpen={mobileMenuOpen} username={username} onLogout={handleLogout}
          theme={theme} onCycleTheme={cycleTheme} ThemeIcon={ThemeIcon}
          deviceCount={devices.length} onOpenDevices={() => setShowDevices(true)}
        />
        <div className="main-area">
          <div className="mobile-topbar">
            <button className="btn-icon" onClick={() => setMobileMenuOpen(true)}>
              <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/></svg>
            </button>
            <span className="mobile-brand">Sangita</span>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <button className="theme-btn" onClick={cycleTheme}><ThemeIcon theme={theme} /></button>
              <button className="btn-icon" onClick={() => setShowDevices(true)}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M4 6h18V4H4c-1.1 0-2 .9-2 2v11H0v3h14v-3H4V6zm19 2h-6c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h6c.55 0 1-.45 1-1V9c0-.55-.45-1-1-1zm-1 9h-4v-7h4v7z"/></svg>
              </button>
              <button className="btn-icon" onClick={handleLogout}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/></svg>
              </button>
            </div>
          </div>
          {dataLoading ? (
            <div className="loading-state"><div className="spinner" /><p>Loading your library…</p></div>
          ) : Object.keys(playlists).length === 0 ? (
            <div className="empty-state" style={{ marginTop: 80 }}>
              <svg viewBox="0 0 24 24" width="64" height="64" fill="currentColor"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
              <h3>No music found</h3><p>Add audio files to your music/ folder and restart.</p>
            </div>
          ) : (
            <>
              <Hero
                playlistName={currentPlaylist} trackCount={playlists[currentPlaylist]?.length || 0}
                isPlaying={isPlaying && currentIndex >= 0} isShuffle={isShuffle}
                onPlay={() => {
                  if (currentIndex === -1 && queue.length > 0) {
                    const idx = isShuffle ? Math.floor(Math.random() * queue.length) : 0
                    playTrack(queue[idx], idx)
                  } else { togglePlay() }
                }}
                onShuffle={() => setIsShuffle(s => !s)} onDownload={downloadTrack}
              />
              <TrackList tracks={queue} currentIndex={currentIndex} isPlaying={isPlaying}
                onPlayTrack={playTrack} durations={durations} />
            </>
          )}
        </div>
      </div>
      <Player
        track={currentTrack} playlist={currentPlaylist} isPlaying={isPlaying}
        isShuffle={isShuffle} isLoop={isLoop}
        onTogglePlay={togglePlay} onNext={playNext} onPrev={playPrev}
        onToggleShuffle={() => setIsShuffle(s => !s)} onToggleLoop={() => setIsLoop(l => !l)}
        currentTime={currentTime} duration={duration} onSeek={seekTo}
        volume={volume} onVolumeChange={changeVolume} formatTime={formatTime}
        isActiveDevice={isActiveDevice} activeDeviceName={activeDeviceName} syncState={syncState}
        onClaimDevice={claimActiveDevice} onSendRemote={sendRemoteControl}
        devices={devices} myDeviceId={getMyDeviceId()} onOpenDevices={() => setShowDevices(true)}
      />
    </div>
  )
}
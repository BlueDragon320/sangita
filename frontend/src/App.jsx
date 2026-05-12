import { useState, useEffect, useRef, useCallback } from 'react'
import Login from './components/Login.jsx'
import Sidebar from './components/Sidebar.jsx'
import Hero from './components/Hero.jsx'
import TrackList from './components/TrackList.jsx'
import Player from './components/Player.jsx'
 
function buildTracks(playlistName, paths) {
  return paths.map((p, i) => ({
    id: `${playlistName}-${i}`,
    path: p,
    name: p.split('/').pop().replace(/\.[^/.]+$/, ''),
  }))
}
 
function formatTime(s) {
  if (!s || isNaN(s) || s === Infinity) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}
 
function ThemeIcon({ theme }) {
  if (theme === 'light') return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
      <path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0 .39-.39.39-1.03 0-1.41l-1.06-1.06zm1.06-10.96c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z"/>
    </svg>
  )
  if (theme === 'dark') return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
      <path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-2.98 0-5.4-2.42-5.4-5.4 0-1.81.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z"/>
    </svg>
  )
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
      <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
    </svg>
  )
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
  const [volume,          setVolume]          = useState(80)
  const [currentTime,     setCurrentTime]     = useState(0)
  const [duration,        setDuration]        = useState(0)
  const [durations,       setDurations]       = useState({})
  const [theme,           setTheme]           = useState(() => localStorage.getItem('sangita_theme') || 'bluedark')
 
  const audioRef     = useRef(null)
  const queueRef     = useRef([])
  const indexRef     = useRef(-1)
  const isShuffleRef = useRef(false)
  const volumeRef    = useRef(80)
  const rafRef       = useRef(null)
 
  useEffect(() => { queueRef.current     = queue        }, [queue])
  useEffect(() => { indexRef.current     = currentIndex }, [currentIndex])
  useEffect(() => { isShuffleRef.current = isShuffle    }, [isShuffle])
  useEffect(() => { volumeRef.current    = volume       }, [volume])
 
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('sangita_theme', theme)
  }, [theme])

  useEffect(() => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
      <rect width="32" height="32" rx="8" fill="%234F46E5"/>
      <path d="M22 8v10.26A4 4 0 1 1 20 15V10l-8 1.5v8.76A4 4 0 1 1 10 17V9.5z" fill="white"/>
    </svg>`
    const link = document.querySelector("link[rel~='icon']") || document.createElement('link')
    link.type = 'image/svg+xml'
    link.rel  = 'icon'
    link.href = `data:image/svg+xml,${svg}`
    document.head.appendChild(link)
  }, [])
 
  const cycleTheme = useCallback(() => {
    setTheme(t => t === 'bluedark' ? 'dark' : t === 'dark' ? 'light' : 'bluedark')
  }, [])
 
  const handleLogin = useCallback((tok, user) => {
    localStorage.setItem('sangita_token', tok)
    localStorage.setItem('sangita_user',  user)
    setToken(tok)
    setUsername(user)
  }, [])
 
  const handleLogout = useCallback(() => {
    localStorage.removeItem('sangita_token')
    localStorage.removeItem('sangita_user')
    setToken('')
    setUsername('')
    setPlaylists({})
    setQueue([])
    setCurrentIndex(-1)
    setIsPlaying(false)
    setCurrentTime(0)
    setDuration(0)
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
    }
  }, [])
 
  useEffect(() => {
    if (!token) return
    setDataLoading(true)
    fetch('/api/playlists', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => { if (!r.ok) throw new Error(r.status); return r.json() })
      .then(data => {
        setPlaylists(data)
        const first = Object.keys(data)[0]
        if (first) setCurrentPlaylist(first)
      })
      .catch(() => handleLogout())
      .finally(() => setDataLoading(false))
  }, [token])
 
  useEffect(() => {
    if (!currentPlaylist || !playlists[currentPlaylist]) return
    const tracks = buildTracks(currentPlaylist, playlists[currentPlaylist])
    setQueue(tracks)
    setCurrentIndex(-1)
    setCurrentTime(0)
    setDuration(0)
    setIsPlaying(false)
    setDurations({})
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
    }
  }, [currentPlaylist, playlists])
 
  useEffect(() => {
    const tick = () => {
      const audio = audioRef.current
      if (audio) {
        const t     = audio.currentTime || 0
        const d     = isFinite(audio.duration) ? audio.duration : 0
        const alive = !audio.paused && !audio.ended && d > 0

        setCurrentTime(t)
        setDuration(d)
        setIsPlaying(alive)

        if (d > 0) {
          const idx   = indexRef.current
          const q     = queueRef.current
          const track = idx >= 0 ? q[idx] : null
          if (track) {
            setDurations(prev => {
              if (prev[track.path] === d) return prev   
              return { ...prev, [track.path]: d }
            })
          }
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [])
 
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const onEnded = () => {
      const q = queueRef.current
      const idx = indexRef.current
      if (q.length === 0) return
      let nextIdx
      if (isShuffleRef.current) {
        if (q.length === 1) { nextIdx = 0 }
        else { do { nextIdx = Math.floor(Math.random() * q.length) } while (nextIdx === idx) }
      } else {
        nextIdx = idx + 1 >= q.length ? 0 : idx + 1
      }
      const t = localStorage.getItem('sangita_token') || ''
      audio.src = `/api/stream/${encodeURIComponent(q[nextIdx].path)}?token=${t}`
      audio.volume = volumeRef.current / 100
      audio.play().catch(console.error)
      setCurrentIndex(nextIdx)
    }
    audio.addEventListener('ended', onEnded)
    return () => audio.removeEventListener('ended', onEnded)
  }, [])
 
  const playTrack = useCallback((track, index) => {
    if (!audioRef.current || !track) return
    const t = localStorage.getItem('sangita_token') || ''
    audioRef.current.src = `/api/stream/${encodeURIComponent(track.path)}?token=${t}`
    audioRef.current.volume = volumeRef.current / 100
    audioRef.current.play().catch(console.error)
    setCurrentIndex(index)
  }, [])
 
  const playNext = useCallback(() => {
    const q = queueRef.current
    const idx = indexRef.current
    if (q.length === 0) return
    let nextIdx
    if (isShuffleRef.current) {
      if (q.length === 1) { nextIdx = 0 }
      else { do { nextIdx = Math.floor(Math.random() * q.length) } while (nextIdx === idx) }
    } else {
      nextIdx = idx + 1 >= q.length ? 0 : idx + 1
    }
    playTrack(q[nextIdx], nextIdx)
  }, [playTrack])
 
  const playPrev = useCallback(() => {
    const q = queueRef.current
    const idx = indexRef.current
    if (q.length === 0) return
    if (audioRef.current && audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0
      return
    }
    const prevIdx = idx <= 0 ? q.length - 1 : idx - 1
    playTrack(q[prevIdx], prevIdx)
  }, [playTrack])
 
  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (!audio.src || audio.src === window.location.href) {
      const q = queueRef.current
      if (q.length > 0) {
        const idx = isShuffleRef.current ? Math.floor(Math.random() * q.length) : 0
        playTrack(q[idx], idx)
      }
      return
    }
    if (audio.paused) audio.play().catch(console.error)
    else audio.pause()
  }, [playTrack])
 
  const seekTo = useCallback((pct) => {
    const audio = audioRef.current
    if (!audio) return
    const dur = isFinite(audio.duration) ? audio.duration : 0
    if (dur > 0) audio.currentTime = (pct / 100) * dur
  }, [])
 
  const changeVolume = useCallback((v) => {
    setVolume(v)
    if (audioRef.current) audioRef.current.volume = v / 100
  }, [])
 
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
    const q = queueRef.current
    const idx = indexRef.current
    const track = idx >= 0 ? q[idx] : (q.length > 0 ? q[0] : null)
    if (!track) return
    const t = localStorage.getItem('sangita_token') || ''
    const a = document.createElement('a')
    a.href = `/api/stream/${encodeURIComponent(track.path)}?token=${t}`
    a.download = track.name
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }, [])
 
  if (!token) return <Login onLogin={handleLogin} />
 
  const currentTrack = currentIndex >= 0 && queue[currentIndex] ? queue[currentIndex] : null
 
  return (
    <div className="app">
      <audio ref={audioRef} preload="auto" />
      <div className="app-body">
        {mobileMenuOpen && (
          <div className="mobile-overlay" onClick={() => setMobileMenuOpen(false)} />
        )}
        <Sidebar
          playlists={playlists}
          currentPlaylist={currentPlaylist}
          onSelect={(name) => { setCurrentPlaylist(name); setMobileMenuOpen(false) }}
          isOpen={mobileMenuOpen}
          username={username}
          onLogout={handleLogout}
          theme={theme}
          onCycleTheme={cycleTheme}
          ThemeIcon={ThemeIcon}
        />
        <div className="main-area">
          <div className="mobile-topbar">
            <button className="btn-icon" onClick={() => setMobileMenuOpen(true)}>
              <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>
              </svg>
            </button>
            <span className="mobile-brand">Sangita</span>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <button className="theme-btn" onClick={cycleTheme}>
                <ThemeIcon theme={theme} />
              </button>
              <button className="btn-icon" onClick={handleLogout}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                  <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/>
                </svg>
              </button>
            </div>
          </div>
 
          {dataLoading ? (
            <div className="loading-state">
              <div className="spinner" />
              <p>Loading your library…</p>
            </div>
          ) : Object.keys(playlists).length === 0 ? (
            <div className="empty-state" style={{ marginTop: 80 }}>
              <svg viewBox="0 0 24 24" width="64" height="64" fill="currentColor">
                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
              </svg>
              <h3>No music found</h3>
              <p>Add audio files to your music/ folder and restart.</p>
            </div>
          ) : (
            <>
              <Hero
                playlistName={currentPlaylist}
                trackCount={playlists[currentPlaylist]?.length || 0}
                isPlaying={isPlaying && currentIndex >= 0}
                isShuffle={isShuffle}
                onPlay={() => {
                  if (currentIndex === -1 && queue.length > 0) {
                    const idx = isShuffle ? Math.floor(Math.random() * queue.length) : 0
                    playTrack(queue[idx], idx)
                  } else {
                    togglePlay()
                  }
                }}
                onShuffle={() => setIsShuffle(s => !s)}
                onDownload={downloadTrack}
              />
              <TrackList
                tracks={queue}
                currentIndex={currentIndex}
                isPlaying={isPlaying}
                onPlayTrack={playTrack}
                durations={durations}
              />
            </>
          )}
        </div>
      </div>
 
      <Player
        track={currentTrack}
        playlist={currentPlaylist}
        isPlaying={isPlaying}
        isShuffle={isShuffle}
        onTogglePlay={togglePlay}
        onNext={playNext}
        onPrev={playPrev}
        onToggleShuffle={() => setIsShuffle(s => !s)}
        currentTime={currentTime}
        duration={duration}
        onSeek={seekTo}
        volume={volume}
        onVolumeChange={changeVolume}
        formatTime={formatTime}
      />
    </div>
  )
}
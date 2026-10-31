import React, { useState, useEffect, useRef, useCallback, useMemo, Suspense } from 'react'
import Login      from './components/Login.jsx'
import Sidebar    from './components/Sidebar.jsx'
import Header     from './components/Header.jsx'
import Hero       from './components/Hero.jsx'
import TrackList  from './components/TrackList.jsx'
import Player     from './components/Player.jsx'
import DevicePanel from './components/DevicePanel.jsx'
import { useDeviceSync } from './hooks/useDeviceSync.js'

const AdminDashboard = React.lazy(() => import('./components/AdminDashboard.jsx'))

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
export const THEME_STORAGE_KEY = 'sangita_theme';
export const THEME_MIGRATION_KEY = 'sangita_theme_migrated_v2';
export const VALID_THEMES = ['amoled', 'dark', 'light'];

export function resolveInitialTheme(storage = (typeof window !== 'undefined' ? window.localStorage : null)) {
  if (!storage) return 'amoled';
  try {
    const isMigrated = storage.getItem(THEME_MIGRATION_KEY) === 'true';
    const savedTheme = storage.getItem(THEME_STORAGE_KEY);

    // Migration rule (Part 1 implementationplan.md):
    // Prior to 3-theme alignment with Android, Sangita only had 'dark' (pure #000000 black) and 'light'.
    // In the Android-aligned 3-theme palette:
    //   - 'amoled' = Pure AMOLED Black (#000000)
    //   - 'dark'   = Dark Obsidian (#080A0F)
    //   - 'light'  = Light Zinc (#F8FAFC)
    // An existing saved 'dark' setting that has not yet been migrated maps to 'amoled'
    // so returning users retain their pure black appearance without unexpected disruption.
    if (!isMigrated) {
      storage.setItem(THEME_MIGRATION_KEY, 'true');
      if (savedTheme === 'dark' || !savedTheme) {
        storage.setItem(THEME_STORAGE_KEY, 'amoled');
        return 'amoled';
      }
      if (savedTheme === 'light') {
        storage.setItem(THEME_STORAGE_KEY, 'light');
        return 'light';
      }
    }

    if (savedTheme && VALID_THEMES.includes(savedTheme)) {
      return savedTheme;
    }
  } catch (e) {
    // fallback if localStorage fails
  }
  return 'amoled';
}

export function ThemeIcon({ theme }) {
  if (theme === 'light') {
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
        <path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0 .39-.39.39-1.03 0-1.41l-1.06-1.06zm1.06-10.96c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z"/>
      </svg>
    )
  }
  if (theme === 'dark') {
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
        <path d="M12.3 2a10 10 0 0 0-.19 20 10.04 10.04 0 0 0 9.89-8.49c.12-.66-.45-1.21-1.1-1.05a7.51 7.51 0 0 1-9.15-9.15c.16-.65-.39-1.22-1.05-1.1A9.87 9.87 0 0 0 12.3 2z"/>
      </svg>
    )
  }
  // AMOLED: Pure Black circle / OLED high contrast icon
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14a6 6 0 1 0 0 12 6 6 0 0 0 0-12z"/>
    </svg>
  )
}

const DEVICE_INFO = (() => {
  if (typeof navigator === 'undefined') {
    return { browser: 'Browser', deviceType: 'desktop', deviceName: 'Desktop', os: 'Unknown' };
  }
  const ua = navigator.userAgent;
  let browser = 'Browser';
  if (ua.includes('Edg/')) browser = 'Edge';
  else if (ua.includes('OPR/')) browser = 'Opera';
  else if (ua.includes('Chrome/') && !ua.includes('Chromium/')) browser = 'Chrome';
  else if (ua.includes('Firefox/')) browser = 'Firefox';
  else if (ua.includes('Safari/') && !ua.includes('Chrome/')) browser = 'Safari';

  const isMobile = /Mobi|Android/i.test(ua) && !/iPad|Tablet/i.test(ua);
  const isTablet = /iPad|Tablet/i.test(ua);
  const deviceType = isMobile ? 'mobile' : isTablet ? 'tablet' : 'desktop';
  const deviceName = isMobile ? 'Mobile' : isTablet ? 'Tablet' : 'Desktop';

  let os = 'Unknown';
  if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Mac OS X/i.test(ua)) os = 'Mac';
  else if (/Linux/i.test(ua)) os = 'Linux';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/iPhone|iPad/i.test(ua)) os = 'iOS';

  return { browser, deviceType, deviceName, os };
})();

function QuickCardThumb({ name, firstTrackPath, token }) {
  if (name === 'Favorites') {
    return (
      <div
        className="quick-card-thumb quick-card-thumb-fav"
        style={{
          background: 'linear-gradient(135deg, #10B981 0%, #047857 100%)',
          color: '#FFFFFF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 10px rgba(16, 185, 129, 0.3)'
        }}
      >
        <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
        </svg>
      </div>
    )
  }

  const [imgErr, setImgErr] = useState(false)
  const coverUrl = firstTrackPath
    ? `/api/cover/${firstTrackPath.split('/').map(encodeURIComponent).join('/')}?token=${encodeURIComponent(token || '')}&v=2`
    : name
    ? `/api/cover/${encodeURIComponent(name)}?token=${encodeURIComponent(token || '')}&v=2`
    : null

  if (!imgErr && coverUrl && token) {
    return (
      <div className="quick-card-thumb quick-card-thumb-img">
        <img
          src={coverUrl}
          key={firstTrackPath || name}
          alt={name}
          onError={() => setImgErr(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      </div>
    )
  }

  return (
    <div className="quick-card-thumb">
      <svg viewBox="0 0 24 24" width="22" height="22" fill="var(--accent)">
        <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
      </svg>
    </div>
  )
}

import RightPanel from './components/RightPanel.jsx'
import AddToPlaylistModal from './components/AddToPlaylistModal.jsx'
import HomeDashboard from './components/HomeDashboard.jsx'
import CreatePlaylistModal from './components/CreatePlaylistModal.jsx'
import LyricsView from './components/LyricsView.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import DiscoverView from './components/DiscoverView.jsx'
import ArtistDetailView from './components/ArtistDetailView.jsx'

export default function App() {
  const [token,           setToken]           = useState(() => localStorage.getItem('sangita_token') || '')
  const [username,        setUsername]        = useState(() => localStorage.getItem('sangita_user')  || '')
  const [role,            setRole]            = useState(() => localStorage.getItem('sangita_role')  || '')
  const [playlists,       setPlaylists]       = useState({})
  const [favorites,       setFavorites]       = useState([])
  const [currentPlaylist, setCurrentPlaylist] = useState('')
  const [addToPlaylistTrack, setAddToPlaylistTrack] = useState(null)
  const [selectedArtistId,   setSelectedArtistId]   = useState(null)
  const [selectedArtistName, setSelectedArtistName] = useState('')
  const [selectedArtistData, setSelectedArtistData] = useState(null)
  const [playlistViewMeta,   setPlaylistViewMeta]   = useState({})
  const [activePlaylistMeta, setActivePlaylistMeta] = useState(null)
  const [folderClassifications, setFolderClassifications] = useState({})
  const [userPlaylists, setUserPlaylists] = useState([])
  const [playlistMetadata, setPlaylistMetadata] = useState({})
  const [savedArtists, setSavedArtists] = useState([])
  const [savedTracks, setSavedTracks] = useState([])
  const [view,            setView]            = useState(() => {
    const isAdminPath = typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')
    const savedRole = typeof window !== 'undefined' ? localStorage.getItem('sangita_role') : ''
    if (isAdminPath) {
      if (savedRole === 'admin') return 'admin'
      if (typeof window !== 'undefined') window.history.replaceState({}, '', '/')
      return 'music'
    }
    return 'music'
  })
  const [searchQuery,     setSearchQuery]     = useState('')
  const [dataLoading,     setDataLoading]     = useState(false)
  const [libraryError, setLibraryError] = useState(false)
  const [libraryRetry, setLibraryRetry] = useState(0)
  const [mobileMenuOpen,  setMobileMenuOpen]  = useState(false)
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  const [queue,           setQueue]           = useState([])
  const [currentIndex,    setCurrentIndex]    = useState(-1)
  const [isLocalPlaying, setIsLocalPlaying] = useState(false)
  const [isShuffle,       setIsShuffle]       = useState(false)
  const [isLoop,          setIsLoop]          = useState(false)
  const [volume,          setVolume]          = useState(80)
  const [currentTime,     setCurrentTime]     = useState(0)
  const [duration,        setDuration]        = useState(0)
  const [durations,       setDurations]       = useState({})
  const [trackMetadata, setTrackMetadata] = useState({})
  const [theme,           setTheme]           = useState(() => resolveInitialTheme())
  const [showDevices,     setShowDevices]     = useState(false)
  const [showRightPanel,  setShowRightPanel]  = useState(true)
  const [isCompact,       setIsCompact]       = useState(() => localStorage.getItem('sangita_compact') === 'true')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('sangita_sidebar_collapsed') === 'true')
  const [userStats,       setUserStats]       = useState(null)
  const [statsLoading,    setStatsLoading]    = useState(false)
  const [showCreatePlaylist, setShowCreatePlaylist] = useState(false)
  const [showLyrics,         setShowLyrics]         = useState(false)
  const [lyricsData,         setLyricsData]         = useState(null)
  const [lyricsLoading,      setLyricsLoading]      = useState(false)
  const [toastNotification,  setToastNotification]  = useState(null)

  useEffect(() => {
    if (toastNotification) {
      const t = setTimeout(() => setToastNotification(null), 4000)
      return () => clearTimeout(t)
    }
  }, [toastNotification])

  const audioRef     = useRef(null)
  const shuffleRef = useRef({ signature: '', remaining: [], history: [], forward: [] })
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
  const wasActiveRef  = useRef(false)
  const loadedTrackIdRef = useRef(null)
  const sendRemoteRef = useRef(null)
  const lastTimeRef   = useRef(-1)
  const lastDurRef    = useRef(-1)
  const lastPlayingRef = useRef(null)

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.trim().toLowerCase();
    const results = [];
    const seenPaths = new Set();
    for (const [plName, paths] of Object.entries(playlists || {})) {
      (paths || []).forEach((p, i) => {
        seenPaths.add(p);
        const trackName = p.split('/').pop().replace(/\.[^/.]+$/, '');
        const metadata = trackMetadata[p] || {}
        if ([trackName, plName, metadata.title, metadata.artist, metadata.album].some(value => value?.toLowerCase().includes(q))) {
          results.push({
            id: `search-${plName}-${i}`,
            path: p,
            name: metadata.title || trackName,
            artist: metadata.artist,
            playlist: plName
          });
        }
      });
    }

    if (trackMetadata && typeof trackMetadata === 'object') {
      Object.entries(trackMetadata).forEach(([p, metadata], i) => {
        if (!seenPaths.has(p)) {
          seenPaths.add(p);
          const trackName = p.split('/').pop().replace(/\.[^/.]+$/, '');
          const meta = metadata || {};
          const folderName = p.includes('/') ? p.split('/')[0] : '';
          if ([trackName, folderName, meta.title, meta.artist, meta.album].some(value => value?.toLowerCase().includes(q))) {
            results.push({
              id: `search-meta-${i}`,
              path: p,
              name: meta.title || trackName,
              artist: meta.artist || folderName,
              playlist: folderName || 'Catalog'
            });
          }
        }
      });
    }

    if (Array.isArray(savedTracks)) {
      savedTracks.forEach((t, i) => {
        const p = typeof t === 'object' ? t?.path : t;
        if (p && !seenPaths.has(p)) {
          seenPaths.add(p);
          const trackName = p.split('/').pop().replace(/\.[^/.]+$/, '');
          const meta = (typeof t === 'object' ? t : null) || trackMetadata[p] || {};
          const folderName = p.includes('/') ? p.split('/')[0] : '';
          if ([trackName, folderName, meta.title, meta.artist, meta.album].some(value => value?.toLowerCase().includes(q))) {
            results.push({
              id: `search-saved-${i}`,
              path: p,
              name: meta.title || trackName,
              artist: meta.artist || folderName,
              playlist: folderName || 'Saved'
            });
          }
        }
      });
    }

    return results;
  }, [searchQuery, playlists, trackMetadata, savedTracks]);

  useEffect(() => { queueRef.current     = queue        }, [queue])
  useEffect(() => { indexRef.current     = currentIndex }, [currentIndex])
  useEffect(() => {
    isShuffleRef.current = isShuffle
    shuffleRef.current = { signature: '', remaining: [], history: [], forward: [] }
  }, [isShuffle])
  useEffect(() => { isLoopRef.current    = isLoop       }, [isLoop])
  useEffect(() => { volumeRef.current    = volume       }, [volume])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme)
      localStorage.setItem(THEME_MIGRATION_KEY, 'true')
    } catch (e) {}
  }, [theme])

  useEffect(() => {
    localStorage.setItem('sangita_compact', isCompact)
  }, [isCompact])

  useEffect(() => {
    localStorage.setItem('sangita_sidebar_collapsed', sidebarCollapsed)
  }, [sidebarCollapsed])

  const cycleTheme = useCallback(() => {
    setTheme(curr => {
      if (curr === 'amoled') return 'dark';
      if (curr === 'dark') return 'light';
      return 'amoled';
    });
  }, [])

  const handleViewChange = useCallback((newView) => {
    setShowLyrics(false);
    if (newView === 'admin') {
      if (role === 'admin') {
        setView('admin');
        if (typeof window !== 'undefined') window.history.pushState({ view: 'admin' }, '', '/admin');
      } else {
        setView('music');
        if (typeof window !== 'undefined') window.history.replaceState({ view: 'music' }, '', '/');
      }
    } else {
      setView(newView);
      if (typeof window !== 'undefined') window.history.pushState({ view: newView, playlist: currentPlaylist }, '', '/');
    }
  }, [role, currentPlaylist]);

  const handleLogin = useCallback((tok, user, userRole) => {
    localStorage.setItem('sangita_token', tok)
    localStorage.setItem('sangita_user',  user)
    localStorage.setItem('sangita_role',  userRole)
    setToken(tok); setUsername(user); setRole(userRole)
    
    if (window.location.pathname.startsWith('/admin')) {
      if (userRole === 'admin') {
        setView('admin');
      } else {
        setView('music');
        window.history.replaceState({}, '', '/');
      }
    }
  }, [])

  const handleLogout = useCallback(() => {
    localStorage.removeItem('sangita_token')
    localStorage.removeItem('sangita_user')
    localStorage.removeItem('sangita_role')
    setToken(''); setUsername(''); setRole(''); setPlaylists({})
    setActivePlaylistMeta(null); setFolderClassifications({}); setUserPlaylists([]); setPlaylistMetadata({})
    setSavedArtists([]); setSavedTracks([])
    setQueue([]); setCurrentIndex(-1); setIsLocalPlaying(false)
    setCurrentTime(0); setDuration(0); setView('music')
    window.history.replaceState({}, '', '/');
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = '' }
    loadedTrackIdRef.current = null
  }, [])

  const [requiresUserGesture, setRequiresUserGesture] = useState(false);
  const isApplyingRemoteStateRef = useRef(false);

  const ensureTrackStagedInWebPlayer = useCallback((trackPath, positionMs = 0) => {
    if (!trackPath || !audioRef.current) return null;

    const parts = trackPath.split('/');
    const filename = parts[parts.length - 1] || trackPath;
    const cleanTitle = filename.replace(/\.[^/.]+$/, '');
    const playlistName = parts.length > 1 ? parts[0] : 'Remote Stream';

    setQueue((prevQueue) => {
      const existingIdx = prevQueue.findIndex((t) => (t.path || t.id) === trackPath);
      if (existingIdx !== -1) {
        setCurrentIndex(existingIdx);
        return prevQueue;
      }
      const synthesizedTrack = {
        id: trackPath,
        path: trackPath,
        title: cleanTitle,
        name: cleanTitle,
        artist: playlistName,
        playlist: playlistName,
        isSynthesized: true,
      };
      const nextQueue = prevQueue.length > 0 ? [...prevQueue, synthesizedTrack] : [synthesizedTrack];
      setCurrentIndex(nextQueue.length - 1);
      return nextQueue;
    });

    const streamUrl = `/api/stream/${encodeURIComponent(trackPath)}?token=${encodeURIComponent(token)}`;
    const targetSec = (positionMs || 0) / 1000;
    if (loadedTrackIdRef.current !== trackPath) {
      loadedTrackIdRef.current = trackPath;
      audioRef.current.src = streamUrl;
      const onMetadata = () => {
        if (audioRef.current && targetSec > 0) {
          try {
            audioRef.current.currentTime = Math.min(targetSec, audioRef.current.duration || targetSec);
          } catch (e) {}
        }
      };
      audioRef.current.addEventListener('loadedmetadata', onMetadata, { once: true });
      audioRef.current.load();
    } else {
      if (Math.abs((audioRef.current.currentTime || 0) - targetSec) > 1.5) {
        try {
          audioRef.current.currentTime = targetSec;
        } catch (e) {}
      }
    }
  }, [token]);

  const attemptWebPlayWithGestureGuard = useCallback(async () => {
    if (!audioRef.current) return;
    try {
      await audioRef.current.play();
      setRequiresUserGesture(false);
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        console.warn('[Autoplay] Blocked by browser policy, user gesture required');
        setRequiresUserGesture(true);
      } else {
        console.warn('[Autoplay] Play error:', err.message);
      }
    }
  }, []);

  const handleRemoteCommand = useCallback((command) => {
    console.log('[RemoteCommand] Received action:', command.action, 'payload:', command.payload);
    switch (command.action) {
      case 'play':
        if (!audioRef.current?.src || audioRef.current.src === window.location.href) {
          if (syncStateRef.current?.trackId) {
            ensureTrackStagedInWebPlayer(syncStateRef.current.trackId, syncStateRef.current.positionMs);
          }
        }
        attemptWebPlayWithGestureGuard();
        break;
      case 'pause':
        audioRef.current?.pause();
        break;
      case 'next':   playNextRef.current?.(true); break;
      case 'prev':   playPrevRef.current?.(true); break;
      case 'seek': {
        const pct = command.payload?.pct;
        const posMs = command.payload?.positionMs;
        if (posMs !== undefined && audioRef.current) {
          audioRef.current.currentTime = posMs / 1000;
        } else if (pct !== undefined) {
          seekToRef.current?.(pct);
        }
        break;
      }
      case 'volume': changeVolRef.current?.(command.payload?.volume); break;
      case 'play_track': {
        const path = command.payload?.path;
        console.log('[RemoteCommand] Staging and playing track path:', path);
        if (path) {
          ensureTrackStagedInWebPlayer(path, 0);
          attemptWebPlayWithGestureGuard();
        }
        break;
      }
      case 'loop':    setIsLoop(command.payload?.loop); break;
      case 'shuffle': setIsShuffle(command.payload?.shuffle); break;
    }
  }, [attemptWebPlayWithGestureGuard, ensureTrackStagedInWebPlayer, setIsLoop, setIsShuffle]);

  const {
    devices, isActiveDevice, setIsActiveDevice, syncState, setSyncState,
    broadcastState, transferPlayback, sendRemoteControl,
    claimActiveDevice, getMyDeviceId,
    transferStatus, retryTransfer,
  } = useDeviceSync({ token, audioRef, isPlaying: isLocalPlaying, onRemoteCommand: handleRemoteCommand,
    getTrackId: () => loadedTrackIdRef.current });

  const handleUnlockWebAudio = useCallback(async () => {
    if (!audioRef.current) return;
    try {
      await audioRef.current.play();
      setRequiresUserGesture(false);
      broadcastState({
        trackId: loadedTrackIdRef.current,
        positionMs: Math.round(audioRef.current.currentTime * 1000),
        durationMs: Math.round((audioRef.current.duration || 0) * 1000),
        isPlaying: true,
        isBuffering: false,
        activeDeviceId: getMyDeviceId(),
        forceClaim: true,
      });
    } catch (e) {
      console.error('Audio unlock failed:', e);
    }
  }, [broadcastState, getMyDeviceId]);

  const isPlaying = isActiveDevice ? isLocalPlaying : !!syncState?.isPlaying;

  const isActiveRef   = useRef(isActiveDevice)
  const syncStateRef  = useRef(syncState)
  const devicesRef    = useRef(devices)
  useEffect(() => { isActiveRef.current = isActiveDevice }, [isActiveDevice])
  useEffect(() => { syncStateRef.current = syncState }, [syncState])
  useEffect(() => { devicesRef.current = devices }, [devices])
  useEffect(() => { sendRemoteRef.current = sendRemoteControl }, [sendRemoteControl])

  const currentTrack = useMemo(() => {
    const curPath = loadedTrackIdRef.current || syncState?.trackId;
    if (!curPath) return null;
    if (currentIndex >= 0 && queue[currentIndex]?.path === curPath) return queue[currentIndex];
    const inQueue = queue.find(t => t.path === curPath);
    if (inQueue) return inQueue;
    for (const [plName, paths] of Object.entries(playlists)) {
      const idx = paths.indexOf(curPath);
      if (idx !== -1) {
        return {
          id: `${plName}-${idx}`,
          path: curPath,
          title: curPath.split('/').pop().replace(/\.[^/.]+$/, ''),
          name: curPath.split('/').pop().replace(/\.[^/.]+$/, ''),
          playlist: plName,
          artist: plName
        };
      }
    }
    const filename = curPath.split('/').pop() || curPath;
    const cleanName = filename.replace(/\.[^/.]+$/, '');
    const plName = curPath.includes('/') ? curPath.substring(0, curPath.lastIndexOf('/')) : 'Library';
    const artistName = curPath.includes('/') ? curPath.substring(0, curPath.indexOf('/')) : 'Library';
    return {
      id: curPath,
      path: curPath,
      title: cleanName,
      name: cleanName,
      playlist: plName,
      artist: artistName,
    };
  }, [loadedTrackIdRef.current, syncState?.trackId, currentIndex, queue, playlists]);

  useEffect(() => {
    if (!currentTrack?.path || !token) {
      setLyricsData(null)
      return
    }
    let isMounted = true
    setLyricsLoading(true)
    fetch(`/api/lyrics/${encodeURIComponent(currentTrack.path)}?token=${encodeURIComponent(token)}`)
      .then(res => res.ok ? res.json() : { has_lyrics: false, raw: '' })
      .then(data => {
        if (isMounted) {
          setLyricsData(data)
          setLyricsLoading(false)
        }
      })
      .catch(err => {
        console.warn('Error fetching lyrics:', err)
        if (isMounted) {
          setLyricsData({ has_lyrics: false, raw: '' })
          setLyricsLoading(false)
        }
      })
    return () => { isMounted = false }
  }, [currentTrack?.path, token])

  const getActiveQueueAndIndex = useCallback(() => {
    const curPath = isActiveDevice ? loadedTrackIdRef.current : (syncState?.trackId || loadedTrackIdRef.current);
    if (!curPath) return { q: queueRef.current, idx: indexRef.current };
    const idx = queueRef.current.findIndex(t => t.path === curPath);
    if (idx >= 0) return { q: queueRef.current, idx };
    let foundPlaylist = null;
    for (const [pName, paths] of Object.entries(playlists)) {
      if (paths.includes(curPath)) { foundPlaylist = pName; break; }
    }
    if (foundPlaylist) {
      const q = buildTracks(foundPlaylist, playlists[foundPlaylist]);
      const newIdx = q.findIndex(t => t.path === curPath);
      return { q, idx: newIdx };
    }
    return { q: queueRef.current, idx: indexRef.current };
  }, [playlists, syncState?.trackId, isActiveDevice]);

  // Sync view history with browser back/forward buttons
  useEffect(() => {
    const handlePopState = (e) => {
      // Cleanly dismiss lyrics on browser back
      setShowLyrics(false);

      const isAdminPath = typeof window !== 'undefined' && window.location.pathname.startsWith('/admin');
      if (isAdminPath) {
        if (role === 'admin') {
          setView('admin');
        } else {
          setView('music');
          if (typeof window !== 'undefined') window.history.replaceState({ view: 'music' }, '', '/');
        }
        return;
      }

      const state = e?.state;
      if (state?.view === 'lyrics') {
        setShowLyrics(true);
      } else if (state?.view === 'search') {
        setView('search');
        setSearchQuery(state.query || '');
      } else if (state?.view === 'home') {
        setSearchQuery('');
        setView('home');
      } else if (state?.view === 'discover') {
        setSearchQuery('');
        setView('discover');
      } else if (state?.view === 'artist') {
        setSearchQuery('');
        setView('artist');
        if (state.artistId) setSelectedArtistId(state.artistId);
        if (state.artistName) setSelectedArtistName(state.artistName);
      } else {
        // Exits search and restores playlist navigation
        setSearchQuery('');
        setView('music');
        if (state?.playlist) {
          setCurrentPlaylist(state.playlist);
        }
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [role]);

  // Redirect users who try to view /admin without admin permissions
  useEffect(() => {
    if (view === 'admin' && token && role !== 'admin') {
      setView('music');
      window.history.replaceState({}, '', '/');
    }
  }, [view, token, role]);

  // Periodic stats pinger to SQLite backend
  useEffect(() => {
    if (!isPlaying || !isActiveDevice || !currentTrack) return;
    
    const devId = getMyDeviceId();
    const intervalSec = 10;
    
    const timer = setInterval(() => {
      fetch('/api/stats/ping', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          track_id: currentTrack.path,
          playlist: currentTrack.playlist || 'Library',
          device_id: devId,
          device_name: DEVICE_INFO.deviceName,
          device_type: DEVICE_INFO.deviceType,
          browser: DEVICE_INFO.browser,
          os: DEVICE_INFO.os,
          duration: intervalSec
        })
      }).catch(err => console.warn('[Stats] Failed report:', err));
    }, intervalSec * 1000);

    return () => clearInterval(timer);
  }, [isPlaying, isActiveDevice, currentTrack, token, getMyDeviceId]);

  const activeDeviceName = (() => {
    if (!syncState?.activeDeviceId || isActiveDevice) return null
    const d = devices.find(d => d.deviceId === syncState.activeDeviceId)
    return d?.deviceName || 'Another device'
  })()

  useEffect(() => {
    if (!syncState) return

    let q = queueRef.current
    let trackIdx = q.findIndex(t => t.path === syncState.trackId)

    if (trackIdx < 0 && syncState.trackId) {
      let foundPlaylist = null;
      for (const [pName, paths] of Object.entries(playlists)) {
         if (paths.includes(syncState.trackId)) { foundPlaylist = pName; break; }
      }
      if (foundPlaylist) {
         setCurrentPlaylist(foundPlaylist);
         q = buildTracks(foundPlaylist, playlists[foundPlaylist]);
         setQueue(q);
         trackIdx = q.findIndex(t => t.path === syncState.trackId);
      } else if (isActiveDevice) {
         ensureTrackStagedInWebPlayer(syncState.trackId, syncState.positionMs);
         q = queueRef.current;
         trackIdx = q.findIndex(t => (t.path || t.id) === syncState.trackId);
      }
    }

    // Include isActiveDevice and isTransferHandoff in the dedup key so that a transfer
    // always triggers the effect, even if syncState.trackId/updatedAt haven't changed yet
    const stateId = `${syncState.activeDeviceId}:${syncState.trackId}:${syncState.updatedAt}:${isActiveDevice}:${syncState.isTransferHandoff}`
    if (lastSyncIdRef.current === stateId && indexRef.current === trackIdx) return
    lastSyncIdRef.current = stateId

    const myId = getMyDeviceId();
    const isMeActive = syncState.activeDeviceId === myId || isActiveDevice;
    const isHandoff = Boolean(syncState.isTransferHandoff && isMeActive);

    if (isHandoff) {
      console.log('[SyncEffect] Authoritative transfer handoff targeting me, track:', syncState.trackId, 'pos:', syncState.positionMs);
      setSyncState(prev => (prev?.isTransferHandoff ? { ...prev, isTransferHandoff: false } : prev));
    }

    console.log('[SyncEffect]', { isActiveDevice, isMeActive, isHandoff, trackId: syncState.trackId, trackIdx,
      wasActive: wasActiveRef.current, loadedTrack: loadedTrackIdRef.current,
      activeDeviceId: syncState.activeDeviceId, isPlaying: syncState.isPlaying })

    if (trackIdx >= 0) {
      setCurrentIndex(trackIdx)
    } else if (Object.keys(playlists).length > 0 && !syncState.trackId) {
      setCurrentIndex(-1)
    }

    const targetPath = trackIdx >= 0 ? q[trackIdx].path : (syncState.trackId || loadedTrackIdRef.current);
    const trackChanged = targetPath !== null && loadedTrackIdRef.current !== targetPath;
    const justClaimed = !wasActiveRef.current && isActiveDevice;
    wasActiveRef.current = isActiveDevice;

    if (isActiveDevice) {
      if (!targetPath || !audioRef.current) {
        console.log('[SyncEffect] Active but no track or audioRef to play', { trackIdx, targetPath })
        return
      }

      const applyVolume = () => {
        if (syncState.volume !== undefined) {
          const targetVol = Math.round(syncState.volume * 100);
          if (targetVol !== volumeRef.current) {
            setVolume(targetVol);
            if (audioRef.current) audioRef.current.volume = targetVol / 100;
          }
        }
      }

      if (trackChanged || justClaimed || isHandoff) {
        console.log('[SyncEffect] Loading track on active device', { trackChanged, justClaimed, isHandoff, targetPath })
        const drift     = syncState.isPlaying ? Math.max(0, Date.now() - (syncState.updatedAt || Date.now())) : 0
        const targetSec = Math.max(0, ((syncState.positionMs || 0) + drift) / 1000)
        
        const applySeekAndPlay = () => {
          const audio = audioRef.current
          if (!audio) return
          applyVolume()

          const maxDur = isFinite(audio.duration) && audio.duration > 0 ? audio.duration : Infinity
          const seekTime = Math.min(targetSec, maxDur)
          try {
            audio.currentTime = seekTime
          } catch (e) {
            console.warn('[SyncEffect] Initial seek error:', e)
          }

          if (syncState.isPlaying) {
            attemptWebPlayWithGestureGuard();
          } else {
            audio.pause()
          }
        }

        loadedTrackIdRef.current = targetPath
        const t = localStorage.getItem('sangita_token') || ''
        const expectedSrc = `/api/stream/${encodeURIComponent(targetPath)}?token=${t}`

        if (audioRef.current.src && audioRef.current.src.endsWith(encodeURIComponent(targetPath) + `?token=${t}`)) {
          applySeekAndPlay()
        } else {
          audioRef.current.src = expectedSrc
          audioRef.current.addEventListener('loadedmetadata', applySeekAndPlay, { once: true })
          audioRef.current.addEventListener('canplay', () => {
            if (audioRef.current && Math.abs(audioRef.current.currentTime - targetSec) > 1.5 && targetSec > 0) {
              try {
                audioRef.current.currentTime = Math.min(targetSec, audioRef.current.duration || targetSec)
              } catch (e) {}
            }
          }, { once: true })
        }
      } else {
        applyVolume()
      }
    } else {
      wasActiveRef.current = false;
      if (audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause(); setIsLocalPlaying(false)
      }
      if (syncState && syncState.volume !== undefined) {
        setVolume(Math.round(syncState.volume * 100));
      }
    }
  }, [syncState, isActiveDevice, playlists, getMyDeviceId, attemptWebPlayWithGestureGuard, setSyncState, ensureTrackStagedInWebPlayer])

  useEffect(() => {
    if (!syncState) return
    if (syncState.isLoop !== undefined && syncState.isLoop !== isLoopRef.current) {
      setIsLoop(syncState.isLoop)
    }
    if (syncState.isShuffle !== undefined && syncState.isShuffle !== isShuffleRef.current) {
      setIsShuffle(syncState.isShuffle)
    }
  }, [syncState])

  const lastLoopRef = useRef(isLoop)
  const lastShuffleRef = useRef(isShuffle)

  useEffect(() => {
    if (!isActiveDevice || !audioRef.current || !loadedTrackIdRef.current) {
      lastLoopRef.current = isLoop
      lastShuffleRef.current = isShuffle
      return
    }

    if (isLoop === lastLoopRef.current && isShuffle === lastShuffleRef.current) {
      return
    }

    lastLoopRef.current = isLoop
    lastShuffleRef.current = isShuffle

    broadcastState({
      activeDeviceId: getMyDeviceId(),
      trackId: loadedTrackIdRef.current,
      positionMs: Math.floor((audioRef.current?.currentTime || 0) * 1000),
      durationMs: isFinite(audioRef.current?.duration) ? Math.floor(audioRef.current.duration * 1000) : 0,
      isPlaying: !audioRef.current?.paused,
      volume: volumeRef.current / 100,
      isLoop: isLoop,
      isShuffle: isShuffle,
      updatedAt: Date.now(),
    })
  }, [isLoop, isShuffle, isActiveDevice, broadcastState, getMyDeviceId])

  const toggleFavorite = useCallback(async (trackPath) => {
    if (!trackPath || !token) return
    try {
      const res = await fetch('/api/favorites/set', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ track_path: trackPath, is_favorite: !favorites.includes(trackPath) })
      })
      if (res.ok) {
        const data = await res.json()
        const updatedFavs = data.favorites || []
        setFavorites(updatedFavs)
        setPlaylists(prev => ({
          ...prev,
          Favorites: updatedFavs
        }))
        if (currentPlaylist === 'Favorites') {
          const tks = buildTracks('Favorites', updatedFavs)
          setQueue(tks)
        }
      }
    } catch (err) {
      console.error('[Favorites] Toggle error:', err)
    }
  }, [token, currentPlaylist, favorites])

  useEffect(() => {
    if (!token) return
    setDataLoading(true)
    setLibraryError(false)
    fetch('/api/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => { if (!r.ok) { const error = new Error(r.status); error.status = r.status; throw error }; return r.json() })
      .then(user => {
        setUsername(user.username);
        setRole(user.role);
        localStorage.setItem('sangita_user', user.username);
        localStorage.setItem('sangita_role', user.role);
        
        fetch('/api/track-metadata', { headers: { Authorization: `Bearer ${token}` } })
          .then(r => r.ok ? r.json() : {})
          .then(setTrackMetadata)
          .catch(() => {})

        // Fetch durations in parallel
        fetch('/api/durations', { headers: { Authorization: `Bearer ${token}` } })
          .then(r => r.ok ? r.json() : {})
          .then(durMap => {
            if (durMap && typeof durMap === 'object') {
              setDurations(prev => ({ ...durMap, ...prev }));
            }
          })
          .catch(err => console.warn('[Durations] Fetch error:', err));

        // Fetch favorites in parallel
        fetch('/api/favorites', { headers: { Authorization: `Bearer ${token}` } })
          .then(r => r.ok ? r.json() : [])
          .then(favs => {
            if (Array.isArray(favs)) {
              setFavorites(favs);
            }
          })
          .catch(err => console.warn('[Favorites] Fetch error:', err));

        return fetch('/api/playlists', { headers: { Authorization: `Bearer ${token}` } });
      })
      .then(r => { if (!r.ok) { const error = new Error(r.status); error.status = r.status; throw error }; return r.json() })
      .then(data => {
        setPlaylists(data);
        const keys = Object.keys(data);
        const hasSubstantivePlaylists = keys.some(k => k !== 'Favorites' || (data[k] && data[k].length > 0));
        if (hasSubstantivePlaylists && keys.length > 0 && !currentPlaylist) {
          const defaultPl = keys.includes('Library') ? 'Library' : keys[0];
          setCurrentPlaylist(defaultPl);
        }
        fetchSourceClassifications();
        fetchLibraryArtistsAndTracks();
      })
      .catch(err => { if (err.status === 401 || err.status === 403) handleLogout(); else setLibraryError(true) })
      .finally(() => setDataLoading(false))
  }, [token, handleLogout, libraryRetry])

  const fetchSourceClassifications = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetch('/api/v2/catalog/sources', {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        const sources = Array.isArray(data) ? data : (data?.sources || [])
        const classMap = {}
        sources.forEach(s => {
          const name = s.folder_name || s.display_name || s.name
          if (name && s.classification) {
            classMap[name] = s.classification
          }
        })
        setFolderClassifications(classMap)
      }
    } catch (err) {
      console.warn('Failed to fetch source classifications:', err)
    }
  }, [token])

  const fetchLibraryArtistsAndTracks = useCallback(async () => {
    if (!token) return
    try {
      const [artRes, trkRes] = await Promise.allSettled([
        fetch('/api/v2/library/artists', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/v2/library/tracks', { headers: { Authorization: `Bearer ${token}` } })
      ])
      if (artRes.status === 'fulfilled' && artRes.value.ok) {
        const data = await artRes.value.json()
        const list = Array.isArray(data) ? data : (data?.artists || [])
        setSavedArtists(list)
      }
      if (trkRes.status === 'fulfilled' && trkRes.value.ok) {
        const data = await trkRes.value.json()
        const list = Array.isArray(data) ? data : (data?.tracks || [])
        // The API returns track_path; the player and library controls use path.
        setSavedTracks(list.map(track => typeof track === 'string' ? track : {
          ...track,
          path: track.path || track.track_path
        }))
      }
    } catch (err) {
      console.warn('[Library] Failed to fetch saved artists or tracks:', err)
    }
  }, [token])

  const handleToggleSaveArtist = useCallback(async (artistOrId, nextSavedOpt, artistDataOpt) => {
    if (!artistOrId) return
    const artistId = typeof artistOrId === 'object' ? (artistOrId?.id || artistOrId?.name) : artistOrId
    const artistData = typeof artistOrId === 'object' ? artistOrId : (artistDataOpt || { id: artistId, name: artistId })
    if (!artistId) return

    const isCurrentlySaved = savedArtists.some(a => {
      const aId = typeof a === 'object' ? (a?.id || a?.name) : a
      return String(aId) === String(artistId)
    })
    const nextSaved = nextSavedOpt !== undefined ? nextSavedOpt : !isCurrentlySaved

    setSavedArtists(prev => {
      if (nextSaved) {
        if (prev.some(a => String(typeof a === 'object' ? (a?.id || a?.name) : a) === String(artistId))) {
          return prev
        }
        return [...prev, artistData]
      } else {
        return prev.filter(a => String(typeof a === 'object' ? (a?.id || a?.name) : a) !== String(artistId))
      }
    })

    const alreadyFetched = (typeof artistOrId === 'object') || Boolean(artistDataOpt)

    if (token && !alreadyFetched) {
      try {
        const method = nextSaved ? 'POST' : 'DELETE'
        const res = await fetch(`/api/v2/artists/${encodeURIComponent(artistId)}/save`, {
          method,
          headers: { Authorization: `Bearer ${token}` }
        })
        if (!res.ok) {
          console.warn('Failed to toggle artist save:', res.status)
          fetchLibraryArtistsAndTracks()
          return
        }
      } catch (err) {
        console.warn('Error toggling artist save:', err)
        fetchLibraryArtistsAndTracks()
      }
    }
    setToastNotification(nextSaved ? 'Saved artist to your library' : 'Removed artist from your library')
  }, [token, savedArtists, fetchLibraryArtistsAndTracks])

  const handleToggleSaveTrack = useCallback(async (trackPath, nextSavedOpt) => {
    if (!trackPath || !token) return
    const isCurrentlySaved = savedTracks.some(t => {
      const p = typeof t === 'object' ? t?.path : t
      return p === trackPath
    })
    const nextSaved = nextSavedOpt !== undefined ? nextSavedOpt : !isCurrentlySaved

    setSavedTracks(prev => {
      if (nextSaved) {
        if (prev.some(t => (typeof t === 'object' ? t?.path : t) === trackPath)) {
          return prev
        }
        return [...prev, trackPath]
      } else {
        return prev.filter(t => (typeof t === 'object' ? t?.path : t) !== trackPath)
      }
    })

    try {
      const method = nextSaved ? 'POST' : 'DELETE'
      const res = await fetch(`/api/v2/library/tracks?track_path=${encodeURIComponent(trackPath)}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ track_path: trackPath })
      })
      if (!res.ok) {
        console.warn('Failed to toggle track save:', res.status)
        fetchLibraryArtistsAndTracks()
        return
      }
      setToastNotification(nextSaved ? 'Saved track to your library' : 'Removed track from your library')
    } catch (err) {
      console.warn('Error toggling track save:', err)
      fetchLibraryArtistsAndTracks()
    }
  }, [token, savedTracks, fetchLibraryArtistsAndTracks])

  const fetchPlaylists = useCallback(() => {
    if (!token) return
    fetch('/api/playlists', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : {})
      .then(data => {
        setPlaylists(data);
      })
      .catch(console.error)

    fetch('/api/user-playlists', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : {})
      .then(data => {
        const list = Array.isArray(data) ? data : (data?.playlists || [])
        setUserPlaylists(list)
      })
      .catch(() => {})

    fetch('/api/v2/playlists', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : {})
      .then(data => {
        const list = Array.isArray(data) ? data : (data?.playlists || [])
        const metaMap = {}
        const savedMap = {}
        list.forEach(p => {
          const title = p.title || p.name
          if (title) {
            const isOwner = p.is_owner !== undefined ? p.is_owner : (p.owner ? p.owner === username : true)
            const isSaved = Boolean(p.is_saved)
            metaMap[title] = {
              id: p.id,
              title: title,
              owner: p.owner,
              visibility: p.visibility || (p.is_public ? 'public' : 'private'),
              description: p.description || '',
              unavailableCount: p.unavailable_count || 0,
              isFolderPlaylist: Boolean(p.is_folder_playlist),
              isOwner: isOwner,
              is_owner: isOwner,
              isSaved: isSaved,
              is_saved: isSaved
            }
            if (isSaved) {
              savedMap[title] = Array.isArray(p.tracks) ? p.tracks : []
            }
          }
        })
        setPlaylistMetadata(metaMap)
        setPlaylists(prev => {
          const next = { ...prev }
          let changed = false
          for (const [t, trks] of Object.entries(savedMap)) {
            if (!next[t]) {
              next[t] = trks
              changed = true
            }
          }
          list.forEach(p => {
            const title = p.title || p.name
            if (title && !p.is_saved && !p.is_owner && !userPlaylists.includes(title) && next[title]) {
              delete next[title]
              changed = true
            }
          })
          return changed ? next : prev
        })
      })
      .catch(() => {})
  }, [token, username])

  useEffect(() => {
    if (token) {
      fetchSourceClassifications();
      fetchPlaylists();
      fetchLibraryArtistsAndTracks();
    }
  }, [token, fetchSourceClassifications, fetchPlaylists, fetchLibraryArtistsAndTracks])

  const fetchUserStats = useCallback(async () => {
    if (!token) return
    setStatsLoading(true)
    try {
      const res = await fetch('/api/user/stats', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setUserStats(data)
      }
    } catch (err) {
      console.error('Failed to fetch user stats:', err)
    } finally {
      setStatsLoading(false)
    }
  }, [token])

  useEffect(() => {
    if (token) {
      fetchUserStats()
    }
  }, [token, fetchUserStats, view])

  const handleSaveTop10Playlist = useCallback(async () => {
    if (!userStats?.top_tracks?.length) return
    const now = new Date()
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    const playlistName = `My Top 10 (${monthNames[now.getMonth()]} ${now.getDate()})`
    const trackPaths = userStats.top_tracks.map(t => t.path)
    try {
      const res = await fetch('/api/user-playlists/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: playlistName, tracks: trackPaths })
      })
      if (res.ok) {
        fetchPlaylists()
        setCurrentPlaylist(playlistName)
        setView('music')
      }
    } catch (err) {
      console.error('Failed to save Top 10 playlist:', err)
    }
  }, [userStats, token, fetchPlaylists])

  const prevPlaylistRef = useRef(currentPlaylist)
  useEffect(() => {
    if (prevPlaylistRef.current && currentPlaylist && prevPlaylistRef.current !== currentPlaylist) {
      setShowLyrics(false)
    }
    prevPlaylistRef.current = currentPlaylist
  }, [currentPlaylist])

  useEffect(() => {
    if (!currentPlaylist) return
    let currentTracks = []
    if (activePlaylistMeta && activePlaylistMeta.title === currentPlaylist && Array.isArray(activePlaylistMeta.tracks)) {
      currentTracks = activePlaylistMeta.tracks
    } else if (playlists[currentPlaylist]) {
      currentTracks = buildTracks(currentPlaylist, playlists[currentPlaylist])
    } else if (currentPlaylist === 'Favorites') {
      currentTracks = buildTracks('Favorites', favorites || [])
    } else {
      currentTracks = []
    }
    setQueue(currentTracks)
    
    const curPath = isActiveDevice ? loadedTrackIdRef.current : (syncState?.trackId || loadedTrackIdRef.current);
    const newIdx = currentTracks.findIndex(t => t.path === curPath);
    setCurrentIndex(newIdx);
  }, [currentPlaylist, playlists, activePlaylistMeta, syncState?.trackId, isActiveDevice])

  useEffect(() => {
    const tick = () => {
      const audio = audioRef.current
      if (isActiveRef.current) {
        if (audio) {
          const t = audio.currentTime || 0
          const d = isFinite(audio.duration) ? audio.duration : 0
          const playing = !audio.paused && !audio.ended
          if (Math.abs(t - lastTimeRef.current) > 0.05) {
            setCurrentTime(t)
            lastTimeRef.current = t
          }
          if (Math.abs(d - lastDurRef.current) > 0.1) {
            setDuration(d)
            lastDurRef.current = d
          }
          if (playing !== lastPlayingRef.current) {
            setIsLocalPlaying(playing)
            lastPlayingRef.current = playing
          }
          if (d > 0) {
            const track = indexRef.current >= 0 ? queueRef.current[indexRef.current] : null
            if (track) setDurations(prev => prev[track.path] === d ? prev : { ...prev, [track.path]: d })
          }
        }
      } else {
        // Remote/inactive device: smoothly interpolate position in real time
        const s = syncStateRef.current
        if (s) {
          const drift = s.isPlaying ? Math.max(0, Date.now() - (s.updatedAt || Date.now())) : 0
          const curMs = (s.positionMs || 0) + drift
          const durMs = s.durationMs || 0
          const t = Math.max(0, durMs > 0 ? Math.min(curMs, durMs) : curMs) / 1000
          const d = durMs > 0 ? durMs / 1000 : (durations[s.trackId] || 0)
          if (Math.abs(t - lastTimeRef.current) > 0.05) {
            setCurrentTime(t)
            lastTimeRef.current = t
          }
          if (d > 0 && Math.abs(d - lastDurRef.current) > 0.1) {
            setDuration(d)
            lastDurRef.current = d
          }
          if (lastPlayingRef.current !== false) {
            setIsLocalPlaying(false)
            lastPlayingRef.current = false
          }
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [durations])


  const internalPlayTrack = useCallback((track, index, forceLocal) => {
    if (!track) return
    const isAct = isActiveRef.current;
    const sState = syncStateRef.current;
    const devs = devicesRef.current || [];
    const isRemoteOnline = Boolean(sState?.activeDeviceId && sState.activeDeviceId !== getMyDeviceId());
    console.log('[internalPlayTrack] isAct:', isAct, 'isRemoteOnline:', isRemoteOnline, 'track:', track.path, 'index:', index, 'forceLocal:', forceLocal);

    const isLocal = forceLocal === true;
    if (!isAct && isRemoteOnline && !isLocal) {
      console.log('[internalPlayTrack] Sending REMOTE_CONTROL play_track command');
      sendRemoteRef.current?.({ action: 'play_track', payload: { path: track.path } });
      setSyncState(prev => prev ? { ...prev, trackId: track.path, positionMs: 0, isPlaying: true, updatedAt: Date.now() } : prev);
      return;
    }

    if (!isAct) {
      isActiveRef.current = true;
      setIsActiveDevice(true);
      claimActiveDevice(track.path);
    }

    if (!audioRef.current) return
    const t = localStorage.getItem('sangita_token') || ''
    audioRef.current.src    = `/api/stream/${encodeURIComponent(track.path)}?token=${t}`
    loadedTrackIdRef.current = track.path
    audioRef.current.volume = volumeRef.current / 100
    const p = audioRef.current.play();
    if (p?.catch) p.catch(err => {
      console.warn('[internalPlayTrack] play() error:', err.message);
    });
    setCurrentIndex(index)
    broadcastState({
      activeDeviceId: getMyDeviceId(), trackId: track.path,
      positionMs: 0, durationMs: isFinite(audioRef.current.duration) ? Math.floor(audioRef.current.duration * 1000) : 0,
      isPlaying: false, isBuffering: true, volume: volumeRef.current / 100,
      isLoop: isLoopRef.current,
      isShuffle: isShuffleRef.current,
      forceClaim: true,
      updatedAt: Date.now(),
    })
  }, [broadcastState, getMyDeviceId, claimActiveDevice])

  const playTrack = useCallback((track, index) => {
    shuffleRef.current = { signature: '', remaining: [], history: [], forward: [] }
    internalPlayTrack(track, index)
  }, [internalPlayTrack])

  const handleQuickShuffle = useCallback(() => {
    const allTracks = []
    Object.entries(playlists).forEach(([plName, paths]) => {
      paths.forEach((p, idx) => {
        allTracks.push({
          id: `${plName}-${idx}`,
          path: p,
          name: p.split('/').pop().replace(/\.[^/.]+$/, ''),
          playlist: plName
        })
      })
    })
    if (allTracks.length === 0) return
    const shuffled = [...new Map(allTracks.map(track => [track.path, track])).values()]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1)); [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    setQueue(shuffled)
    setCurrentIndex(0)
    setIsShuffle(true)
    internalPlayTrack(shuffled[0], 0, true)
  }, [playlists, internalPlayTrack])

  const playNext = useCallback((forceLocal) => {
    const { q, idx } = getActiveQueueAndIndex()
    if (q.length === 0) return
    let nextIdx
    if (isShuffleRef.current) {
      const signature = JSON.stringify(q.map(t => t.path))
      let state = shuffleRef.current
      if (state.signature !== signature) state = shuffleRef.current = { signature, remaining: [], history: [], forward: [] }
      if (state.forward.length) {
        nextIdx = state.forward.pop()
      } else {
        if (!state.remaining.length) {
          state.remaining = q.map((_, i) => i).filter(i => i !== idx)
          for (let i = state.remaining.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1)); [state.remaining[i], state.remaining[j]] = [state.remaining[j], state.remaining[i]]
          }
        }
        nextIdx = state.remaining.pop() ?? idx
      }
      if (idx >= 0 && nextIdx !== idx) state.history.push(idx)
    } else { nextIdx = idx + 1 >= q.length ? 0 : idx + 1 }
    internalPlayTrack(q[nextIdx], nextIdx, forceLocal)
  }, [internalPlayTrack, getActiveQueueAndIndex])

  const playPrev = useCallback((forceLocal) => {
    const { q, idx } = getActiveQueueAndIndex()
    if (q.length === 0) return
    if (audioRef.current && audioRef.current.currentTime > 3) { audioRef.current.currentTime = 0; return }
    let prevIdx = idx <= 0 ? q.length - 1 : idx - 1
    if (isShuffleRef.current) {
      const state = shuffleRef.current
      if (state.signature !== JSON.stringify(q.map(t => t.path)) || !state.history.length) return
      prevIdx = state.history.pop()
      if (idx >= 0) state.forward.push(idx)
    }
    internalPlayTrack(q[prevIdx], prevIdx, forceLocal)
  }, [internalPlayTrack, getActiveQueueAndIndex])

  const isEndingRef = useRef(false)
  const handleEnded = useCallback(() => {
    if (isEndingRef.current) return
    isEndingRef.current = true
    setTimeout(() => { isEndingRef.current = false }, 500)

    console.log('[Audio] Track ended, auto-advancing to next song...');
    const audio = audioRef.current
    if (isLoopRef.current) {
      if (audio) {
        audio.currentTime = 0
        const p = audio.play()
        if (p?.catch) p.catch(console.error)
        broadcastState({
          activeDeviceId: getMyDeviceId(),
          trackId: loadedTrackIdRef.current,
          positionMs: 0,
          durationMs: isFinite(audio.duration) ? Math.floor(audio.duration * 1000) : 0,
          isPlaying: true,
          volume: volumeRef.current / 100,
          isLoop: true,
          isShuffle: isShuffleRef.current,
          updatedAt: Date.now(),
        })
      }
      return
    }
    // Auto-advance to the next track in queue with forceLocal = true
    playNext(true)
  }, [playNext, broadcastState, getMyDeviceId])

  // React attaches these handlers with the audio element, including after
  // login and when returning from the admin screen. An effect with only stable
  // callback dependencies can run before the audio element exists and never attach.
  const publishAudioState = useCallback((event) => {
    const audio = event.currentTarget
    if (!isActiveRef.current || !loadedTrackIdRef.current) return
    const isBuffering = event.type === 'waiting' ||
      (!audio.paused && audio.readyState < 3 && event.type !== 'playing' && event.type !== 'error')
    broadcastState({
      activeDeviceId: getMyDeviceId(),
      trackId: loadedTrackIdRef.current,
      positionMs: Math.floor(audio.currentTime * 1000),
      durationMs: isFinite(audio.duration) ? Math.floor(audio.duration * 1000) : 0,
      isPlaying: !audio.paused && !audio.ended && !isBuffering && event.type !== 'error',
      isBuffering,
      volume: volumeRef.current / 100,
      isLoop: isLoopRef.current,
      isShuffle: isShuffleRef.current,
      updatedAt: Date.now(),
    })
  }, [broadcastState, getMyDeviceId])

  const togglePlay = useCallback((forcePlay, forceLocal) => {
    const isAct = isActiveRef.current;
    const sState = syncStateRef.current;
    const devs = devicesRef.current || [];
    const isRemoteOnline = Boolean(sState?.activeDeviceId && sState.activeDeviceId !== getMyDeviceId());
    
    // Ensure we only force play/pause if forcePlay is explicitly a boolean (ignores React click event objects)
    const shouldForce = typeof forcePlay === 'boolean' ? forcePlay : undefined;

    const isLocal = forceLocal === true;
    if (!isAct && isRemoteOnline && !isLocal) {
       const action = shouldForce !== undefined
         ? (shouldForce ? 'play' : 'pause')
         : (sState.isPlaying ? 'pause' : 'play');
       sendRemoteRef.current?.({ action });
       return;
    }

    if (!isAct) {
      isActiveRef.current = true;
      setIsActiveDevice(true);
      claimActiveDevice(loadedTrackIdRef.current || syncStateRef.current?.trackId);
    }

    const audio = audioRef.current; if (!audio) return
    if (!audio.src || audio.src === window.location.href) {
      const { q, idx } = getActiveQueueAndIndex()
      if (q.length === 0) return
      const targetIdx = idx >= 0 ? idx : (isShuffleRef.current ? Math.floor(Math.random() * q.length) : 0)
      internalPlayTrack(q[targetIdx], targetIdx, true)
      return
    }
    const newPlaying = shouldForce !== undefined ? shouldForce : audio.paused
    if (newPlaying) {
      if (audio.ended) {
        audio.currentTime = 0;
      }
      const p = audio.play();
      if (p?.catch) p.catch(err => {
        console.warn('[togglePlay] play error:', err.message);
      });
    } else {
      audio.pause();
    }
    broadcastState({
      activeDeviceId: getMyDeviceId(),
      trackId: loadedTrackIdRef.current,
      positionMs: Math.floor(audio.currentTime * 1000),
      durationMs: isFinite(audio.duration) ? Math.floor(audio.duration * 1000) : 0,
      isPlaying: newPlaying, volume: volumeRef.current / 100,
      isLoop: isLoopRef.current,
      isShuffle: isShuffleRef.current,
      forceClaim: true,
      updatedAt: Date.now(),
    })
  }, [broadcastState, getMyDeviceId, internalPlayTrack, claimActiveDevice, getActiveQueueAndIndex])

  const lastRemoteSeekTimeRef = useRef(0);
  const seekTo = useCallback((pct, meta = {}) => {
    const isAct = isActiveRef.current;
    const sState = syncStateRef.current;
    const devs = devicesRef.current || [];
    const isRemoteOnline = Boolean(sState?.activeDeviceId && sState.activeDeviceId !== getMyDeviceId());

    if (!isAct && isRemoteOnline) {
      const now = Date.now();
      if (!meta.isEnd && (now - lastRemoteSeekTimeRef.current < 150)) {
        return;
      }
      lastRemoteSeekTimeRef.current = now;
      const dur = sState?.durationMs || (audioRef.current && isFinite(audioRef.current.duration) ? audioRef.current.duration * 1000 : 0);
      const positionMs = Math.round((pct / 100) * dur);
      sendRemoteRef.current?.({ action: 'seek', payload: { pct, positionMs } });
      return;
    }

    const audio = audioRef.current; if (!audio) return
    const dur = isFinite(audio.duration) ? audio.duration : 0; if (dur <= 0) return
    audio.currentTime = (pct / 100) * dur
    broadcastState({
      activeDeviceId: getMyDeviceId(), trackId: loadedTrackIdRef.current,
      positionMs: Math.floor(audio.currentTime * 1000),
      durationMs: isFinite(audio.duration) ? Math.floor(audio.duration * 1000) : 0,
      isPlaying: !audio.paused, volume: volumeRef.current / 100,
      isLoop: isLoopRef.current,
      isShuffle: isShuffleRef.current,
      updatedAt: Date.now(),
    })
  }, [broadcastState, getMyDeviceId])

  const handleSeekFromLyrics = useCallback((timeInSec) => {
    const isAct = isActiveRef.current
    const dur = duration > 0 ? duration : (audioRef.current?.duration || 0)
    if (dur <= 0) return
    const pct = Math.max(0, Math.min(100, (timeInSec / dur) * 100))
    if (isAct) {
      seekTo(pct)
    } else {
      sendRemoteRef.current?.({
        action: 'seek',
        payload: { pct, positionMs: Math.floor(timeInSec * 1000) }
      })
    }
  }, [duration, seekTo])

  const changeVolume = useCallback((v) => {
    const isAct = isActiveRef.current;
    const sState = syncStateRef.current;

    if (!isAct && sState?.activeDeviceId) {
      sendRemoteRef.current?.({ action: 'volume', payload: { volume: v } });
      setSyncState(prev => prev ? { ...prev, volume: v / 100, updatedAt: Date.now() } : prev);
      return;
    }

    setVolume(v);
    if (audioRef.current) audioRef.current.volume = v / 100
    broadcastState({
      activeDeviceId: getMyDeviceId(), trackId: loadedTrackIdRef.current,
      positionMs: Math.floor((audioRef.current?.currentTime || 0) * 1000),
      durationMs: isFinite(audioRef.current?.duration) ? Math.floor(audioRef.current.duration * 1000) : 0,
      isPlaying: !audioRef.current?.paused, volume: v / 100,
      isLoop: isLoopRef.current,
      isShuffle: isShuffleRef.current,
      updatedAt: Date.now(),
    })
  }, [broadcastState, getMyDeviceId])

  const handleToggleLoop = useCallback(() => {
    const nextLoop = !isLoopRef.current
    const isAct = isActiveRef.current
    if (isAct) {
      setIsLoop(nextLoop)
    } else {
      sendRemoteRef.current?.({ action: 'loop', payload: { loop: nextLoop } })
    }
  }, [])

  const handleToggleShuffle = useCallback(() => {
    const nextShuffle = !isShuffleRef.current
    const isAct = isActiveRef.current
    if (isAct) {
      shuffleRef.current = { signature: '', remaining: [], history: [], forward: [] }
      setIsShuffle(nextShuffle)
    } else {
      sendRemoteRef.current?.({ action: 'shuffle', payload: { shuffle: nextShuffle } })
    }
  }, [])

  useEffect(() => { playNextRef.current   = playNext   }, [playNext])
  useEffect(() => { playPrevRef.current   = playPrev   }, [playPrev])
  useEffect(() => { togglePlayRef.current = togglePlay }, [togglePlay])
  useEffect(() => { seekToRef.current     = seekTo     }, [seekTo])
  useEffect(() => { changeVolRef.current  = changeVolume }, [changeVolume])
  useEffect(() => {
    playTrackRef.current = (path) => {
      let q = queueRef.current;
      console.log('[PlayTrackRef] path:', path, 'queue size:', q.length);
      let idx = q.findIndex(t => t.path === path);
      if (idx >= 0) {
        console.log('[PlayTrackRef] Found in queue at index:', idx);
        internalPlayTrack(q[idx], idx, true);
        return;
      }
      let found = null;
      for (const [pName, paths] of Object.entries(playlists)) {
         if (paths.includes(path)) { found = pName; break; }
      }
      console.log('[PlayTrackRef] Playlist lookup result:', found);
      if (found) {
         setCurrentPlaylist(found);
         q = buildTracks(found, playlists[found]);
         setQueue(q);
         idx = q.findIndex(t => t.path === path);
         console.log('[PlayTrackRef] Rebuilt queue, new index:', idx);
         if (idx >= 0) {
           internalPlayTrack(q[idx], idx, true);
           return;
         }
      }
      // Fallback: If not found in queue or playlists, synthesize track and play with forceLocal=true!
      const filename = path.split('/').pop().replace(/\.[^/.]+$/, '');
      const pl = path.includes('/') ? path.split('/')[0] : 'Library';
      const fallbackTrack = {
        id: `remote-${Date.now()}`,
        path: path,
        name: filename,
        artist: 'Unknown Artist',
        playlist: pl
      };
      console.log('[PlayTrackRef] Playing fallback synthesized track:', fallbackTrack);
      setQueue([fallbackTrack]);
      internalPlayTrack(fallbackTrack, 0, true);
    }
  }, [playlists, internalPlayTrack])

  useEffect(() => {
    const onKey = (e) => {
      const inInput = e.target && ['INPUT', 'TEXTAREA'].includes(e.target.tagName);

      // Global '/' key listener (when not in input) to focus search bar
      if (!inInput && (e.key === '/' || e.code === 'Slash') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        const searchInput = document.querySelector('[data-testid="header-search-input"]') || document.querySelector('.search-input');
        if (searchInput) {
          searchInput.focus();
        }
        return;
      }

      // Media keys: only ignore when in input/textarea
      if (inInput) return;

      // Allow media keys to function on Home, Search, and Music views
      if (view === 'admin') return;

      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'ArrowRight' || e.key === 'ArrowRight') {
        playNext();
      } else if (e.code === 'ArrowLeft' || e.key === 'ArrowLeft') {
        playPrev();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [togglePlay, playNext, playPrev, view]);

  // Set up Media Session Action Handlers
  useEffect(() => {
    if (!('mediaSession' in navigator)) return

    const handlePlay = () => {
      if (togglePlayRef.current) togglePlayRef.current(true, true)
    }
    const handlePause = () => {
      if (togglePlayRef.current) togglePlayRef.current(false, true)
    }
    const handleNext = () => {
      if (playNextRef.current) playNextRef.current(true)
    }
    const handlePrev = () => {
      if (playPrevRef.current) playPrevRef.current(true)
    }
    const handleSeekTo = (details) => {
      if (seekToRef.current && details.seekTime !== undefined) {
        const audio = audioRef.current
        if (audio && isFinite(audio.duration) && audio.duration > 0) {
          const pct = (details.seekTime / audio.duration) * 100
          seekToRef.current(pct)
        }
      }
    }
    const handleSeekBackward = (details) => {
      const offset = details.seekOffset || 10
      const audio = audioRef.current
      if (audio) {
        const target = Math.max(0, audio.currentTime - offset)
        if (isFinite(audio.duration) && audio.duration > 0) {
          const pct = (target / audio.duration) * 100
          if (seekToRef.current) seekToRef.current(pct)
        }
      }
    }
    const handleSeekForward = (details) => {
      const offset = details.seekOffset || 10
      const audio = audioRef.current
      if (audio) {
        const target = Math.min(audio.duration || 0, audio.currentTime + offset)
        if (isFinite(audio.duration) && audio.duration > 0) {
          const pct = (target / audio.duration) * 100
          if (seekToRef.current) seekToRef.current(pct)
        }
      }
    }

    navigator.mediaSession.setActionHandler('play', handlePlay)
    navigator.mediaSession.setActionHandler('pause', handlePause)
    navigator.mediaSession.setActionHandler('previoustrack', handlePrev)
    navigator.mediaSession.setActionHandler('nexttrack', handleNext)
    
    try {
      navigator.mediaSession.setActionHandler('seekto', handleSeekTo)
    } catch (e) {
      console.warn('[MediaSession] seekto action not supported:', e)
    }
    try {
      navigator.mediaSession.setActionHandler('seekbackward', handleSeekBackward)
    } catch (e) {}
    try {
      navigator.mediaSession.setActionHandler('seekforward', handleSeekForward)
    } catch (e) {}

    return () => {
      navigator.mediaSession.setActionHandler('play', null)
      navigator.mediaSession.setActionHandler('pause', null)
      navigator.mediaSession.setActionHandler('previoustrack', null)
      navigator.mediaSession.setActionHandler('nexttrack', null)
      try { navigator.mediaSession.setActionHandler('seekto', null) } catch (e) {}
      try { navigator.mediaSession.setActionHandler('seekbackward', null) } catch (e) {}
      try { navigator.mediaSession.setActionHandler('seekforward', null) } catch (e) {}
    }
  }, [])

  // Sync Media Session Metadata when currentTrack changes on the active device
  useEffect(() => {
    if (!('mediaSession' in navigator)) return

    if (isActiveDevice && currentTrack) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.name,
        artist: currentTrack.playlist || 'Library',
        album: 'Sangita'
      })
    } else {
      navigator.mediaSession.metadata = null
    }
  }, [currentTrack, isActiveDevice])

  // Sync Media Session Playback and Position state with actual audio element events
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !('mediaSession' in navigator)) return

    const updatePosition = () => {
      if ('setPositionState' in navigator.mediaSession) {
        const dur = audio.duration
        const pos = audio.currentTime
        if (isFinite(dur) && dur > 0 && isFinite(pos)) {
          navigator.mediaSession.setPositionState({
            duration: dur,
            playbackRate: audio.playbackRate || 1,
            position: pos
          })
        }
      }
    }

    const handlePlay = () => {
      navigator.mediaSession.playbackState = 'playing'
      updatePosition()
    }

    const handlePause = () => {
      navigator.mediaSession.playbackState = 'paused'
    }

    const handleSeeked = () => {
      updatePosition()
    }

    const handleDurationChange = () => {
      updatePosition()
    }

    audio.addEventListener('play', handlePlay)
    audio.addEventListener('playing', handlePlay)
    audio.addEventListener('pause', handlePause)
    audio.addEventListener('seeked', handleSeeked)
    audio.addEventListener('durationchange', handleDurationChange)

    // Run initial update
    if (!audio.paused) {
      navigator.mediaSession.playbackState = 'playing'
    } else {
      navigator.mediaSession.playbackState = 'paused'
    }
    updatePosition()

    return () => {
      audio.removeEventListener('play', handlePlay)
      audio.removeEventListener('playing', handlePlay)
      audio.removeEventListener('pause', handlePause)
      audio.removeEventListener('seeked', handleSeeked)
      audio.removeEventListener('durationchange', handleDurationChange)
    }
  }, [currentTrack])

  const downloadTrack = useCallback((overrideTrack) => {
    const track = (overrideTrack && overrideTrack.path) ? overrideTrack : currentTrack; if (!track) return
    const t = localStorage.getItem('sangita_token') || ''
    const a = document.createElement('a')
    a.href = `/api/stream/${encodeURIComponent(track.path)}?token=${t}`
    a.download = track.name; document.body.appendChild(a); a.click(); document.body.removeChild(a)
  }, [currentTrack])

  const handleSidebarSelect = useCallback(async (name, plMeta) => {
    if (name === 'Discover') {
      setView('discover');
      setSearchQuery('');
      setShowLyrics(false);
      setMobileMenuOpen(false);
      if (typeof window !== 'undefined') window.history.pushState({ view: 'discover' }, '', '/');
      return;
    }

    const playlistId = plMeta?.id || playlistMetadata[name]?.id;

    if (playlistId) {
      try {
        const res = await fetch(`/api/v2/playlists/${playlistId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        if (res.ok) {
          const data = await res.json();
          const formattedTracks = Array.isArray(data.tracks) ? data.tracks.map((t, idx) => {
            if (typeof t === 'string') {
              return {
                id: `${data.title}-${idx}`,
                path: t,
                name: t.split('/').pop().replace(/\.[^/.]+$/, ''),
                playlist: data.title,
                artist: trackMetadata[t]?.artist || data.title
              };
            }
            const path = t.track_path || t.path || '';
            const tName = t.title || t.name || (path ? path.split('/').pop().replace(/\.[^/.]+$/, '') : (t.is_available === false ? 'Unavailable track' : 'Unknown track'));
            return {
              id: t.id || `${data.title}-${idx}`,
              path: path,
              name: tName,
              artist: t.artist || trackMetadata[path]?.artist || data.title,
              playlist: data.title,
              duration: t.duration,
              is_unavailable: Boolean(t.is_unavailable || t.unavailable || (t.is_available === false)),
              position: t.position
            };
          }) : [];

          const activeMeta = {
            ...data,
            unavailableCount: data.unavailable_count || 0,
            tracks: formattedTracks,
            isFolderPlaylist: Boolean(data.is_folder_playlist)
          };
          setActivePlaylistMeta(activeMeta);
          setCurrentPlaylist(data.title || name);
          setView('music');
          setSearchQuery('');
          setShowLyrics(false);
          setMobileMenuOpen(false);
          if (typeof window !== 'undefined') window.history.pushState({ view: 'music', playlist: data.title || name }, '', '/');
          return;
        }
      } catch (err) {
        console.warn('Failed to load playlist by id:', err);
      }
    }

    if (plMeta) {
      setActivePlaylistMeta({
        ...plMeta,
        title: plMeta.title || name,
        owner: plMeta.owner || plMeta.curator,
        visibility: plMeta.visibility,
        description: plMeta.description,
        unavailableCount: plMeta.unavailable_count || plMeta.unavailableCount || 0,
        isFolderPlaylist: Boolean(plMeta.is_folder_playlist || plMeta.isFolderPlaylist)
      });
    } else {
      setActivePlaylistMeta(null);
    }

    setView('music');
    setSearchQuery('');
    setCurrentPlaylist(name);
    setShowLyrics(false);
    setMobileMenuOpen(false);
    if (typeof window !== 'undefined') window.history.pushState({ view: 'music', playlist: name }, '', '/');
  }, [token, playlistMetadata, trackMetadata]);

  const handleEditPlaylist = useCallback(async ({ id, name, description, visibility }) => {
    const plId = id || activePlaylistMeta?.id;
    if (plId) {
      try {
        const res = await fetch(`/api/v2/playlists/${plId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          body: JSON.stringify({
            title: name,
            description,
            visibility
          })
        });
        if (res.ok) {
          const updated = await res.json();
          setActivePlaylistMeta(prev => ({
            ...prev,
            ...updated,
            title: updated.title || name,
            description: updated.description ?? description,
            visibility: updated.visibility || visibility
          }));
          setCurrentPlaylist(updated.title || name);
          fetchPlaylists();
        }
      } catch (err) {
        console.error('Failed to update playlist:', err);
      }
    }
  }, [activePlaylistMeta, token, fetchPlaylists]);

  const handleDeletePlaylist = useCallback(async (plName, plId, isOwnerParam) => {
    const meta = (plId && Object.values(playlistMetadata).find(p => p.id === plId)) || playlistMetadata[plName] || activePlaylistMeta;
    const targetId = plId || meta?.id;
    const isOwner = isOwnerParam !== undefined ? isOwnerParam : (
      meta?.is_owner !== undefined
        ? meta.is_owner
        : (meta?.isOwner !== undefined
          ? meta.isOwner
          : (meta?.owner && username ? meta.owner === username : true))
    );

    try {
      if (targetId && !isOwner) {
        await fetch(`/api/v2/playlists/${encodeURIComponent(targetId)}/save`, {
          method: 'DELETE',
          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });
        setToastNotification('Removed playlist from your library');
      } else if (targetId) {
        await fetch(`/api/v2/playlists/${targetId}`, {
          method: 'DELETE',
          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });
        setToastNotification('Deleted playlist');
      } else {
        await fetch(`/api/user-playlists/${encodeURIComponent(plName)}`, {
          method: 'DELETE',
          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });
      }
      setActivePlaylistMeta(null);
      fetchPlaylists();
      if (currentPlaylist === plName) {
        setCurrentPlaylist('Favorites');
      }
      setView('music');
    } catch (err) {
      console.error('Failed to delete/unsave playlist:', err);
    }
  }, [activePlaylistMeta, playlistMetadata, token, username, currentPlaylist, fetchPlaylists]);

  const handleSaveEntirePlaylist = useCallback(async (sourcePlaylist) => {
    if (!sourcePlaylist) return;
    const rawName = (sourcePlaylist.name || sourcePlaylist.title || 'Saved Playlist').trim();
    const description = sourcePlaylist.description || '';

    // If the user already has a playlist with that exact name, append a suffix or handle gracefully
    let targetName = rawName;
    if (playlists && playlists[targetName]) {
      let counter = 1;
      while (playlists[`${rawName} (${counter})`]) {
        counter++;
      }
      targetName = `${rawName} (${counter})`;
    }

    let newPlaylistId = null;
    let savedSuccessfully = false;

    // 1. Can use POST /api/v2/playlists/<playlist_id>/clone if sourcePlaylist.id exists
    if (sourcePlaylist.id) {
      try {
        const cloneRes = await fetch(`/api/v2/playlists/${encodeURIComponent(sourcePlaylist.id)}/clone`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify({
            title: targetName,
            description: description
          })
        });
        if (cloneRes.ok) {
          const cloneData = await cloneRes.json();
          newPlaylistId = cloneData?.id || null;
          savedSuccessfully = true;
        }
      } catch (err) {
        console.warn('Playlist clone error:', err);
      }
    }

    // 2. OR POST /api/v2/playlists with { title, description, tracks }
    if (!savedSuccessfully) {
      let rawTracks = sourcePlaylist.tracks;
      if ((!rawTracks || rawTracks.length === 0) && sourcePlaylist.id) {
        try {
          const detailRes = await fetch(`/api/v2/playlists/${encodeURIComponent(sourcePlaylist.id)}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {}
          });
          if (detailRes.ok) {
            const detailData = await detailRes.json();
            if (Array.isArray(detailData.tracks)) {
              rawTracks = detailData.tracks;
            }
          }
        } catch {}
      }

      const trackPaths = Array.isArray(rawTracks)
        ? rawTracks.map(t => (typeof t === 'string' ? t : (t?.track_path || t?.path || ''))).filter(Boolean)
        : [];

      try {
        const v2Res = await fetch('/api/v2/playlists', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify({
            title: targetName,
            description: description,
            visibility: 'private',
            tracks: trackPaths
          })
        });
        if (v2Res.ok) {
          const v2Data = await v2Res.json();
          newPlaylistId = v2Data?.id || null;
          savedSuccessfully = true;
        }
      } catch (err) {
        console.warn('POST /api/v2/playlists error:', err);
      }

      if (!savedSuccessfully) {
        // Fallback to legacy batch endpoint
        try {
          const batchRes = await fetch('/api/user-playlists/batch', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {})
            },
            body: JSON.stringify({
              name: targetName,
              tracks: trackPaths,
              description: description
            })
          });
          if (batchRes.ok) {
            const bData = await batchRes.json();
            newPlaylistId = bData?.id || null;
            savedSuccessfully = true;
          }
        } catch (err) {
          console.warn('Batch playlist creation error:', err);
        }
      }
    }

    if (savedSuccessfully) {
      fetchPlaylists();
      setToastNotification(`Added "${targetName}" to your playlists`);
      if (view !== 'discover' && newPlaylistId) {
        handleSidebarSelect(targetName, { id: newPlaylistId });
      }
    }
  }, [playlists, token, fetchPlaylists, view, handleSidebarSelect]);

  const handleToggleSavePlaylist = useCallback(async (targetPlaylistOrIsSaved, maybeNextSaved) => {
    let plName = currentPlaylist;
    let plId = activePlaylistMeta?.id || playlistMetadata[plName]?.id;
    let nextSaved;
    let needFetch = true;

    if (targetPlaylistOrIsSaved && typeof targetPlaylistOrIsSaved === 'object') {
      const pl = targetPlaylistOrIsSaved;
      plName = pl.name || pl.title;
      plId = pl.id || playlistMetadata[plName]?.id;
      nextSaved = maybeNextSaved !== undefined
        ? maybeNextSaved
        : !(pl.is_saved || playlistMetadata[plName]?.is_saved);
      // DiscoverView already performed the server save call
      needFetch = false;
    } else {
      const currentlySaved = activePlaylistMeta?.is_saved !== undefined
        ? Boolean(activePlaylistMeta.is_saved)
        : Boolean(playlistMetadata[plName]?.is_saved);
      nextSaved = targetPlaylistOrIsSaved !== undefined ? targetPlaylistOrIsSaved : !currentlySaved;
    }

    if (!plId && !plName) return;

    try {
      if (needFetch && plId) {
        const method = nextSaved ? 'POST' : 'DELETE';
        await fetch(`/api/v2/playlists/${encodeURIComponent(plId)}/save`, {
          method,
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
      }
      setPlaylistMetadata(prev => {
        const next = { ...prev };
        if (plName) {
          next[plName] = {
            ...(next[plName] || {}),
            id: plId || next[plName]?.id,
            is_saved: nextSaved,
            isSaved: nextSaved
          };
        }
        return next;
      });
      if (plName === currentPlaylist) {
        setActivePlaylistMeta(prev => prev ? { ...prev, is_saved: nextSaved, isSaved: nextSaved } : null);
      }
      fetchPlaylists();
      setToastNotification(nextSaved ? 'Saved playlist to your library' : 'Removed playlist from your library');
    } catch (err) {
      console.warn('Error toggling playlist save:', err);
    }
  }, [currentPlaylist, activePlaylistMeta, playlistMetadata, token, fetchPlaylists]);

  const handleDiscover = useCallback(() => {
    setView('discover');
    setSearchQuery('');
    setShowLyrics(false);
    setMobileMenuOpen(false);
    if (typeof window !== 'undefined') window.history.pushState({ view: 'discover' }, '', '/');
  }, []);

  const handleSelectArtist = useCallback((artistId, artistName, artistData) => {
    setView('artist');
    setSelectedArtistId(artistId);
    setSelectedArtistName(artistName || artistId);
    setSelectedArtistData(artistData || null);
    setShowLyrics(false);
    setMobileMenuOpen(false);
    if (typeof window !== 'undefined') {
      window.history.pushState({ view: 'artist', artistId, artistName }, '', '/');
    }
  }, []);

  const handleBackFromArtist = useCallback(() => {
    setView('discover');
    if (typeof window !== 'undefined') {
      window.history.pushState({ view: 'discover' }, '', '/');
    }
  }, []);

  const handlePlayDiscoveredTracks = useCallback((tracksToPlay, startIndex = 0, shuffle = false) => {
    if (!tracksToPlay || tracksToPlay.length === 0) return;
    let q = [...tracksToPlay];
    let startIdx = startIndex;
    if (shuffle) {
      const shuffled = [...tracksToPlay];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      q = shuffled;
      startIdx = 0;
      setIsShuffle(true);
    }
    setQueue(q);
    setCurrentIndex(startIdx);
    internalPlayTrack(q[startIdx], startIdx, true);
  }, [internalPlayTrack]);

  const handleToggleSidebar = useCallback(() => {
    setSidebarCollapsed(c => !c);
  }, []);

  const handleClaimDevice = useCallback(() => {
    const trackId = currentTrack?.path || loadedTrackIdRef.current || syncState?.trackId;
    claimActiveDevice(trackId);
  }, [claimActiveDevice, currentTrack, syncState]);

  const handleOpenDevices = useCallback(() => {
    setShowDevices(true);
  }, []);

  const handleCloseDevices = useCallback(() => {
    setShowDevices(false);
  }, []);

  const handleOpenMobileMenu = useCallback(() => {
    setMobileMenuOpen(true);
  }, []);

  const handleCloseMobileMenu = useCallback(() => {
    setMobileMenuOpen(false);
  }, []);

  const handleCloseLyrics = useCallback(() => {
    setShowLyrics(false);
  }, []);

  const handleToggleLyrics = useCallback(() => {
    setShowLyrics(v => {
      const next = !v;
      if (next && typeof window !== 'undefined') {
        window.history.pushState({ view: 'lyrics' }, '', window.location.href);
      }
      return next;
    });
  }, []);

  const handleCloseRightPanel = useCallback(() => {
    setShowRightPanel(false);
  }, []);

  const handleToggleRightPanel = useCallback(() => {
    setShowRightPanel(p => !p);
  }, []);

  const handleSearchChange = useCallback((val) => {
    setSearchQuery(val);
    if (val.trim()) {
      setView((prevView) => {
        if (prevView !== 'search' && typeof window !== 'undefined') {
          window.history.pushState({ view: 'search', query: val }, '', window.location.href);
        } else if (typeof window !== 'undefined' && window.history.state?.view === 'search') {
          window.history.replaceState({ view: 'search', query: val }, '', window.location.href);
        }
        return 'search';
      });
    } else {
      setView((prevView) => {
        if (prevView === 'search') {
          return 'music';
        }
        return prevView;
      });
    }
  }, []);

  const handleBackFromSearch = useCallback(() => {
    setSearchQuery('');
    setView('music');
    if (typeof window !== 'undefined') {
      window.history.pushState({ view: 'music', playlist: currentPlaylist }, '', '/');
    }
  }, [currentPlaylist]);

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    setView('music');
    if (typeof window !== 'undefined') {
      window.history.pushState({ view: 'music', playlist: currentPlaylist }, '', '/');
    }
  }, [currentPlaylist]);

  if (!token) return <Login onLogin={handleLogin} currentTheme={theme} onSelectTheme={setTheme} />

  if (view === 'admin') {
    return (
      <Suspense fallback={<div className="loading-state" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="spinner" /></div>}>
        <AdminDashboard
          token={token}
          playlists={playlists}
          onBackToPlayer={() => handleViewChange('music')}
          onLogout={handleLogout}
          theme={theme}
          setTheme={setTheme}
          onCycleTheme={cycleTheme}
          ThemeIcon={ThemeIcon}
        />
      </Suspense>
    )
  }

  return (
    <div className={`app ${sidebarCollapsed ? 'sidebar-collapsed' : ''} ${currentTrack ? 'has-player' : ''}`}>
      <audio
        ref={audioRef}
        preload="auto"
        onEnded={handleEnded}
        onPlay={() => setIsLocalPlaying(true)}
        onPause={(event) => { setIsLocalPlaying(false); publishAudioState(event) }}
        onPlaying={(event) => { setIsLocalPlaying(true); publishAudioState(event) }}
        onWaiting={publishAudioState}
        onDurationChange={publishAudioState}
        onLoadedMetadata={publishAudioState}
        onSeeked={publishAudioState}
        onError={publishAudioState}
      />
      {showDevices && (
        <DevicePanel
          devices={devices} myDeviceId={getMyDeviceId()}
          activeDeviceId={syncState?.activeDeviceId}
          onTransfer={transferPlayback} onClose={handleCloseDevices}
          transferStatus={transferStatus}
          retryTransfer={retryTransfer}
        />
      )}
      <div className="app-body">
        {mobileMenuOpen && <div className="mobile-overlay" onClick={handleCloseMobileMenu} />}
        <Sidebar
          playlists={playlists} currentPlaylist={currentPlaylist}
          onSelect={handleSidebarSelect}
          isOpen={mobileMenuOpen}
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={handleToggleSidebar}
          onCloseDrawer={() => setMobileMenuOpen(false)}
          onCreatePlaylist={() => setShowCreatePlaylist(true)}
          onDiscover={handleDiscover}
          view={view}
          token={token}
          userPlaylists={userPlaylists}
          playlistMetadata={playlistMetadata}
          folderClassifications={folderClassifications}
          username={username}
          savedArtists={savedArtists}
          savedTracks={savedTracks}
          onToggleSaveArtist={handleToggleSaveArtist}
          onToggleSaveTrack={handleToggleSaveTrack}
          onDeletePlaylist={handleDeletePlaylist}
          onSelectArtist={handleSelectArtist}
        />
        <div className="main-area">
          <Header
            view={view}
            onSelectView={handleViewChange}
            isAdmin={role === 'admin'}
            searchQuery={searchQuery}
            onSearchChange={handleSearchChange}
            theme={theme}
            setTheme={setTheme}
            onCycleTheme={cycleTheme}
            ThemeIcon={ThemeIcon}
            username={username}
            onLogout={handleLogout}
            onOpenDevices={handleOpenDevices}
            deviceCount={devices.length}
            onOpenMobileMenu={() => setMobileMenuOpen(true)}
          />

          <div className={`main-scroll-body ${showLyrics && currentTrack ? 'lyrics-mode' : ''}`}>
            {showLyrics && currentTrack ? (
              <ErrorBoundary onReset={() => setShowLyrics(false)} resetLabel="Return to Library">
                <LyricsView
                  track={currentTrack}
                  audioRef={audioRef}
                  currentTime={currentTime}
                  duration={duration}
                  lyricsData={lyricsData}
                  loading={lyricsLoading}
                  onSeek={handleSeekFromLyrics}
                  onClose={handleCloseLyrics}
                  isPlaying={isPlaying}
                  onTogglePlay={togglePlay}
                  token={token}
                />
              </ErrorBoundary>
            ) : dataLoading ? (
              <div className="loading-state"><div className="spinner" /><p>Loading your music library…</p></div>
            ) : libraryError ? (
              <div className="empty-state" role="alert"><p>Could not load your music library. Check your connection and try again.</p><button onClick={() => setLibraryRetry(n => n + 1)}>Try again</button></div>
            ) : view === 'discover' ? (
              <DiscoverView
                token={token}
                playlists={playlists}
                trackMetadata={trackMetadata}
                onSelectArtist={handleSelectArtist}
                onSelectPlaylist={(plName, plMeta) => {
                  handleSidebarSelect(plName, plMeta);
                }}
                onPlayTracks={handlePlayDiscoveredTracks}
                username={username}
                onSavePlaylist={handleToggleSavePlaylist}
                onSaveArtist={handleToggleSaveArtist}
                savedArtists={savedArtists}
                savedTracks={savedTracks}
                onToggleSaveArtist={handleToggleSaveArtist}
                onToggleSaveTrack={handleToggleSaveTrack}
              />
            ) : view === 'artist' ? (
              <ArtistDetailView
                artistId={selectedArtistId}
                artistName={selectedArtistName}
                artist={selectedArtistData}
                playlists={playlists}
                trackMetadata={trackMetadata}
                durations={durations}
                token={token}
                currentTrack={currentTrack}
                isPlaying={isPlaying}
                onPlayTrack={(track, idx, tracks) => {
                  handlePlayDiscoveredTracks(tracks, idx, false);
                }}
                onTogglePlay={togglePlay}
                onPlayAll={(tracks) => handlePlayDiscoveredTracks(tracks, 0, false)}
                onShuffle={(tracks) => handlePlayDiscoveredTracks(tracks, 0, true)}
                favorites={favorites}
                onToggleFavorite={toggleFavorite}
                onAddToPlaylist={(t) => setAddToPlaylistTrack(t)}
                onDownloadTrack={downloadTrack}
                onBack={handleBackFromArtist}
                onToast={(msg) => setToastNotification(msg)}
                onRefreshPlaylists={fetchPlaylists}
                userPlaylists={userPlaylists}
                playlistMetadata={playlistMetadata}
                savedArtists={savedArtists}
                savedTracks={savedTracks}
                onToggleSaveArtist={handleToggleSaveArtist}
                onToggleSaveTrack={handleToggleSaveTrack}
              />
            ) : view === 'home' ? (
              <HomeDashboard
                username={username}
                stats={userStats}
                loading={statsLoading}
                onPlayTrack={(track, pl, trackQueue) => {
                  const mappedQueue = (trackQueue || []).map((t, i) => ({
                    id: `${t.playlist || pl || 'Home'}-${i}`,
                    path: t.path,
                    name: t.name,
                    artist: t.artist,
                    playlist: t.playlist || pl || 'Home'
                  }))
                  const trackIdx = mappedQueue.findIndex(t => t.path === track.path)
                  setQueue(mappedQueue)
                  setCurrentIndex(trackIdx !== -1 ? trackIdx : 0)
                  internalPlayTrack(track, trackIdx !== -1 ? trackIdx : 0)
                }}
                isPlaying={isPlaying}
                currentTrack={currentTrack}
                onOpenCreatePlaylist={() => setShowCreatePlaylist(true)}
                onSaveTop10Playlist={handleSaveTop10Playlist}
                onQuickShuffle={handleQuickShuffle}
                token={token}
                favorites={favorites}
                onToggleFavorite={toggleFavorite}
                onAddToPlaylist={(t) => setAddToPlaylistTrack(t)}
                durations={durations}
              />
            ) : view === 'search' ? (
              <>
                <div className="hero" style={{ padding: '40px 48px 24px' }}>
                  <button
                    className="search-back-btn"
                    onClick={handleBackFromSearch}
                    data-testid="search-back-btn"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-dim, #94a3b8)',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      fontWeight: 500,
                      padding: 0,
                      marginBottom: 16
                    }}
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                      <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
                    </svg>
                    Back to {currentPlaylist || 'music'}
                  </button>
                  <h1 style={{ fontSize: 'clamp(2.5rem, 8vw, 4rem)', fontWeight: 800 }}>Search Results</h1>
                  <p className="hero-subtitle" style={{ marginTop: 4 }}>Showing matches for "{searchQuery}"</p>
                </div>
                {searchResults.length === 0 ? (
                  <div className="empty-state" style={{ marginTop: 40 }}>
                    <svg viewBox="0 0 24 24" width="48" height="48" fill="var(--text-dim)" style={{ opacity: 0.3 }}>
                      <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
                    </svg>
                    <h3>No matches found</h3>
                    <p>Try searching for a different song name or playlist.</p>
                    <button
                      className="clear-search-cta"
                      onClick={handleClearSearch}
                      data-testid="search-clear-cta"
                      style={{
                        marginTop: 16,
                        padding: '8px 20px',
                        borderRadius: 20,
                        border: '1px solid var(--border, rgba(255,255,255,0.12))',
                        background: 'var(--surface-hover, rgba(255,255,255,0.08))',
                        color: 'var(--text, #fff)',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                        fontWeight: 600
                      }}
                    >
                      Clear search
                    </button>
                  </div>
                ) : (
                  <TrackList
                    tracks={searchResults}
                    currentIndex={searchResults.findIndex(t => t.path === currentTrack?.path)}
                    isPlaying={isPlaying}
                    onPlayTrack={(track, idx) => {
                      setQueue(searchResults);
                      setCurrentIndex(idx);
                      internalPlayTrack(track, idx);
                    }}
                    onTogglePlay={togglePlay}
                    durations={durations}
                    token={token}
                    favorites={favorites}
                    onToggleFavorite={toggleFavorite}
                    onAddToPlaylist={(t) => setAddToPlaylistTrack(t)}
                    onDownloadTrack={downloadTrack}
                    savedArtists={savedArtists}
                    savedTracks={savedTracks}
                    onToggleSaveArtist={handleToggleSaveArtist}
                    onToggleSaveTrack={handleToggleSaveTrack}
                  />
                )}
              </>
            ) : ((Object.keys(playlists).length === 0 || !currentPlaylist) && !activePlaylistMeta) ? (
              <div className="empty-state" data-testid="empty-library-state" style={{ marginTop: 80 }}>
                <svg viewBox="0 0 24 24" width="64" height="64" fill="currentColor"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
                <h3>Your library is empty</h3>
                <p>Explore Discover to find songs, artists, and playlists to add to your library.</p>
                <button
                  type="button"
                  className="btn-primary"
                  style={{ marginTop: 16 }}
                  onClick={handleDiscover}
                  data-testid="empty-library-discover-btn"
                >
                  Explore Discover
                </button>
              </div>
            ) : (
              <>
                {/* Playlist Banner Header */}
                <Hero
                  playlistName={currentPlaylist}
                  tracks={queue}
                  isPlaying={isPlaying && currentTrack?.playlist === currentPlaylist}
                  isShuffle={isShuffle}
                  onPlay={() => {
                    if (currentIndex === -1 && queue.length > 0) {
                      const idx = isShuffle ? Math.floor(Math.random() * queue.length) : 0
                      playTrack(queue[idx], idx)
                    } else { togglePlay() }
                  }}
                  onShuffle={() => setIsShuffle(s => !s)}
                  onDownload={downloadTrack}
                  onAddToPlaylist={(t) => setAddToPlaylistTrack(t)}
                  username={username}
                  durations={durations}
                  token={token}
                  owner={activePlaylistMeta?.owner || playlistViewMeta?.curator || playlistViewMeta?.owner}
                  visibility={activePlaylistMeta?.visibility || playlistViewMeta?.visibility}
                  description={activePlaylistMeta?.description || playlistViewMeta?.description}
                  unavailableCount={activePlaylistMeta?.unavailableCount ?? activePlaylistMeta?.unavailable_count ?? (playlistViewMeta?.unavailable_count || 0)}
                  isOwner={activePlaylistMeta?.owner ? activePlaylistMeta.owner === username : true}
                  playlistId={activePlaylistMeta?.id}
                  isSaved={Boolean(activePlaylistMeta?.is_saved || playlistMetadata[currentPlaylist]?.is_saved || playlistMetadata[currentPlaylist]?.isSaved)}
                  is_saved={Boolean(activePlaylistMeta?.is_saved || playlistMetadata[currentPlaylist]?.is_saved || playlistMetadata[currentPlaylist]?.isSaved)}
                  onToggleSave={handleToggleSavePlaylist}
                  onEditPlaylist={handleEditPlaylist}
                  onDeletePlaylist={handleDeletePlaylist}
                  onSaveToMyPlaylists={handleSaveEntirePlaylist}
                  savedArtists={savedArtists}
                  savedTracks={savedTracks}
                  onToggleSaveArtist={handleToggleSaveArtist}
                  onToggleSaveTrack={handleToggleSaveTrack}
                />

                {/* Track List */}
                <TrackList
                  tracks={queue}
                  currentIndex={queue.findIndex(t => t.path === currentTrack?.path)}
                  isPlaying={isPlaying}
                  onPlayTrack={playTrack}
                  onTogglePlay={togglePlay}
                  durations={durations}
                  token={token}
                  favorites={favorites}
                  onToggleFavorite={toggleFavorite}
                  onAddToPlaylist={(t) => setAddToPlaylistTrack(t)}
                  onDownloadTrack={downloadTrack}
                  onEmptyAction={() => handleSidebarSelect('Discover')}
                  savedArtists={savedArtists}
                  savedTracks={savedTracks}
                  onToggleSaveArtist={handleToggleSaveArtist}
                  onToggleSaveTrack={handleToggleSaveTrack}
                />
              </>
            )}
          </div>
        </div>

        {/* RIGHT PANEL (Now Playing side view) */}
        {currentTrack && showRightPanel && (
          <RightPanel
            track={currentTrack}
            playlist={currentPlaylist}
            isPlaying={isPlaying}
            duration={duration}
            formatTime={formatTime}
            onClose={handleCloseRightPanel}
            onTogglePlay={togglePlay}
            onDownload={downloadTrack}
            token={token}
            username={username}
            isFavorite={currentTrack ? favorites.includes(currentTrack.path) : false}
            onToggleFavorite={toggleFavorite}
            onAddToPlaylist={(t) => setAddToPlaylistTrack(t)}
          />
        )}
      </div>

      {currentTrack && (
        <Player
          track={currentTrack} playlist={currentPlaylist} isPlaying={isPlaying}
          isShuffle={isShuffle} isLoop={isLoop}
          onTogglePlay={togglePlay} onNext={playNext} onPrev={playPrev}
          onToggleShuffle={handleToggleShuffle} onToggleLoop={handleToggleLoop}
          currentTime={currentTime} duration={duration} onSeek={seekTo}
          volume={volume} onVolumeChange={changeVolume} formatTime={formatTime}
          isActiveDevice={isActiveDevice} activeDeviceName={activeDeviceName} syncState={syncState}
          onClaimDevice={handleClaimDevice} onSendRemote={sendRemoteControl}
          devices={devices} myDeviceId={getMyDeviceId()} onOpenDevices={handleOpenDevices}
          showRightPanel={showRightPanel} onToggleRightPanel={handleToggleRightPanel}
          token={token}
          isFavorite={currentTrack ? favorites.includes(currentTrack.path) : false}
          onToggleFavorite={toggleFavorite}
          onAddToPlaylist={(t) => setAddToPlaylistTrack(t)}
          hasLyrics={!!lyricsData?.has_lyrics}
          showLyrics={showLyrics}
          onToggleLyrics={handleToggleLyrics}
          requiresUserGesture={requiresUserGesture}
          onUnlockWebAudio={handleUnlockWebAudio}
        />
      )}

      {addToPlaylistTrack && (
        <AddToPlaylistModal
          track={addToPlaylistTrack}
          playlists={playlists}
          favorites={favorites}
          token={token}
          onClose={() => setAddToPlaylistTrack(null)}
          onToggleFavorite={toggleFavorite}
          onUpdatePlaylists={setPlaylists}
        />
      )}

      {showCreatePlaylist && (
        <CreatePlaylistModal
          isOpen={showCreatePlaylist}
          onClose={() => setShowCreatePlaylist(false)}
          onCreated={(newPlName, plId, plData) => {
            fetchPlaylists()
            if (plId) {
              handleSidebarSelect(newPlName, { id: plId, ...plData })
            } else {
              setCurrentPlaylist(newPlName)
              setShowLyrics(false)
              setView('music')
            }
          }}
          token={token}
        />
      )}

      {toastNotification && (
        <div className="toast-notification" role="status" aria-live="polite" data-testid="toast-notification">
          <span>{toastNotification}</span>
          <button
            type="button"
            className="toast-close-btn"
            onClick={() => setToastNotification(null)}
            aria-label="Close notification"
          >
            &times;
          </button>
        </div>
      )}
    </div>
  )
}

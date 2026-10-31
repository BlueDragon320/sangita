import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import './DiscoverView.css'

function strHue(str) {
  let h = 0
  for (const c of (str || '')) h = (h * 31 + c.charCodeAt(0)) | 0
  return Math.abs(h) % 360
}

function formatDuration(sec) {
  if (!sec || isNaN(sec) || sec <= 0) return ''
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function matchIndividualLetters(query, ...fields) {
  if (!query || typeof query !== 'string') return true
  const q = query.trim().toLowerCase()
  if (!q) return true

  const targets = fields
    .filter(f => f != null && f !== false)
    .map(f => String(f).toLowerCase())
  if (targets.length === 0) return false

  const combined = targets.join(' ')

  const checkSingle = (term, targetStr) => {
    if (!term) return true
    // a) Exact substring match: target.includes(q)
    if (targetStr.includes(term)) return true

    // b) Sequential subsequence match: characters in query appear in target in sequential order
    let sIdx = 0
    for (let i = 0; i < targetStr.length && sIdx < term.length; i++) {
      if (targetStr[i] === term[sIdx]) {
        sIdx++
      }
    }
    if (sIdx === term.length) return true

    // c) Individual letter multiset match: every non-whitespace character in the query exists in the target string(s)
    const termCounts = {}
    let nonWsCount = 0
    for (let i = 0; i < term.length; i++) {
      const ch = term[i]
      if (ch === ' ' || ch === '\t' || ch === '\n') continue
      termCounts[ch] = (termCounts[ch] || 0) + 1
      nonWsCount++
    }
    if (nonWsCount === 0) return true

    const targetCounts = {}
    for (let i = 0; i < targetStr.length; i++) {
      const ch = targetStr[i]
      if (ch === ' ' || ch === '\t' || ch === '\n') continue
      targetCounts[ch] = (targetCounts[ch] || 0) + 1
    }

    for (const ch in termCounts) {
      if ((targetCounts[ch] || 0) < termCounts[ch]) {
        return false
      }
    }
    return true
  }

  // 1. Direct match against combined target fields
  if (checkSingle(q, combined)) return true

  // d) Token matching: if query has multiple space-separated words, each word matches either as substring, subsequence, or letter set
  const tokens = q.split(/\s+/).filter(Boolean)
  if (tokens.length > 1) {
    const allTokensMatch = tokens.every(token => checkSingle(token, combined))
    if (allTokensMatch) return true
  }

  return false
}

function isPlaylistName(name) {
  if (name === 'Favorites' || name === 'Library') return true
  const lower = (name || '').toLowerCase()
  return (
    lower.includes('playlist') ||
    lower.includes('movie') ||
    lower.includes('songs') ||
    lower.includes('chill') ||
    lower.includes('top 50') ||
    lower.includes('driver') ||
    lower.includes('soundtrack') ||
    lower.includes('party') ||
    lower.includes('collection') ||
    lower.includes('music from')
  )
}

function isArtistName(name) {
  return !isPlaylistName(name)
}

function ArtistAvatar({ artist, token }) {
  const [imgErr, setImgErr] = useState(false)
  const coverUrl = artist?.image_url || (artist?.first_track_path
    ? `/api/cover/${artist.first_track_path.split('/').map(encodeURIComponent).join('/')}?token=${encodeURIComponent(token || '')}&v=2`
    : artist?.name
    ? `/api/cover/${encodeURIComponent(artist.name)}?token=${encodeURIComponent(token || '')}&v=2`
    : null)

  const hue = strHue(artist?.name || 'Artist')

  if (!imgErr && coverUrl && token) {
    return (
      <div className="discover-artist-avatar-wrap">
        <img
          src={coverUrl}
          alt={artist?.name || 'Artist'}
          onError={() => setImgErr(true)}
          className="discover-artist-avatar-img"
          data-testid="artist-avatar"
        />
      </div>
    )
  }

  return (
    <div
      className="discover-artist-avatar-wrap"
      style={{
        background: `linear-gradient(135deg, hsl(${hue}, 60%, 35%), hsl(${(hue + 45) % 360}, 55%, 20%))`
      }}
      data-testid="artist-avatar"
    >
      <div className="discover-artist-avatar-fallback">
        {(artist?.name || 'A').slice(0, 1).toUpperCase()}
      </div>
    </div>
  )
}

function PlaylistThumb({ playlist, token }) {
  const [imgErr, setImgErr] = useState(false)
  const firstTrack = playlist?.first_track_path || (Array.isArray(playlist?.tracks) ? (typeof playlist.tracks[0] === 'string' ? playlist.tracks[0] : playlist.tracks[0]?.path) : null)
  const coverUrl = playlist?.image_url || (firstTrack
    ? `/api/cover/${firstTrack.split('/').map(encodeURIComponent).join('/')}?token=${encodeURIComponent(token || '')}&v=2`
    : playlist?.name
    ? `/api/cover/${encodeURIComponent(playlist.name)}?token=${encodeURIComponent(token || '')}&v=2`
    : null)

  const hue = strHue(playlist?.name || 'Playlist')

  if (!imgErr && coverUrl && token) {
    return (
      <div className="discover-playlist-thumb-wrap">
        <img
          src={coverUrl}
          alt={playlist?.name || 'Playlist'}
          onError={() => setImgErr(true)}
          className="discover-playlist-thumb-img"
        />
      </div>
    )
  }

  return (
    <div
      className="discover-playlist-thumb-wrap"
      style={{
        background: `linear-gradient(135deg, hsl(${hue}, 55%, 28%), hsl(${(hue + 50) % 360}, 50%, 15%))`
      }}
    >
      <div className="discover-playlist-thumb-fallback">
        <svg viewBox="0 0 24 24" width="32" height="32" fill="var(--accent)">
          <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
        </svg>
      </div>
    </div>
  )
}

function SongThumb({ track, token }) {
  const [imgErr, setImgErr] = useState(false)
  const trackPath = track?.path || ''
  const coverUrl = !imgErr && trackPath && token
    ? `/api/cover/${trackPath.split('/').map(encodeURIComponent).join('/')}?token=${encodeURIComponent(token)}&v=2`
    : null
  const hue = strHue(track?.title || track?.name || 'Song')

  if (coverUrl) {
    return (
      <div className="discover-song-thumb">
        <img
          src={coverUrl}
          alt=""
          onError={() => setImgErr(true)}
          className="discover-song-thumb-img"
          data-testid="song-thumbnail"
        />
      </div>
    )
  }

  return (
    <div
      className="discover-song-thumb discover-song-thumb-fallback"
      style={{
        background: `linear-gradient(135deg, hsl(${hue}, 55%, 30%), hsl(${(hue + 40) % 360}, 50%, 15%))`
      }}
      aria-hidden="true"
      data-testid="song-thumbnail"
    >
      <svg viewBox="0 0 24 24" width="18" height="18" fill="var(--accent, currentColor)">
        <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
      </svg>
    </div>
  )
}

function DiscoverSongRow({
  song,
  idx,
  token,
  onPlayTracks,
  onToggleSaveTrack,
  onAddToPlaylist,
  onToggleFavorite,
  favorites = [],
  savedTracks = [],
  onDownloadTrack
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const menuRef = useRef(null)
  const moreBtnRef = useRef(null)

  const isFav = Array.isArray(favorites) && favorites.some(f => (typeof f === 'string' ? f : f?.path) === song.path)
  const isSaved = Array.isArray(savedTracks) && savedTracks.some(t => (typeof t === 'string' ? t : t?.path) === song.path)

  const handlePlay = (e) => {
    if (e) e.stopPropagation()
    if (onPlayTracks) {
      onPlayTracks([song], 0, false)
    }
  }

  useEffect(() => {
    if (!isMenuOpen) return
    const handleClickOutside = (e) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target) &&
        moreBtnRef.current &&
        !moreBtnRef.current.contains(e.target)
      ) {
        setIsMenuOpen(false)
      }
    }
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsMenuOpen(false)
        moreBtnRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isMenuOpen])

  const handleDownload = (e) => {
    e.stopPropagation()
    setIsMenuOpen(false)
    if (onDownloadTrack) {
      onDownloadTrack(song)
    } else {
      try {
        const a = document.createElement('a')
        a.href = `/api/stream/${encodeURIComponent(song.path)}?token=${encodeURIComponent(token || '')}`
        a.download = song.title || song.name || 'track'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
      } catch {}
    }
  }

  return (
    <div
      className="discover-song-row"
      role="button"
      tabIndex={0}
      onClick={handlePlay}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handlePlay(e)
        }
      }}
      data-testid={`discover-song-row-${song.id || song.path}`}
      aria-label={`Play ${song.title || song.name} by ${song.artist}`}
    >
      <div className="discover-song-main">
        <div className="discover-song-cover-container">
          <SongThumb track={song} token={token} />
          <button
            type="button"
            className="discover-song-play-btn"
            onClick={handlePlay}
            aria-label={`Play ${song.title || song.name}`}
            title={`Play ${song.title || song.name}`}
            data-testid="song-play-btn"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </button>
        </div>

        <div className="discover-song-meta">
          <span className="discover-song-title" title={song.title || song.name} data-testid="song-title">
            {song.title || song.name}
          </span>
          <span className="discover-song-artist" title={song.artist} data-testid="song-artist">
            {song.artist}
          </span>
        </div>
      </div>

      {song.album && (
        <div className="discover-song-album" title={song.album} data-testid="song-album">
          {song.album}
        </div>
      )}

      {song.duration > 0 && (
        <div className="discover-song-duration" data-testid="song-duration">
          {formatDuration(song.duration)}
        </div>
      )}

      <div className="discover-song-actions" onClick={(e) => e.stopPropagation()}>
        {onToggleFavorite && (
          <button
            type="button"
            className={`discover-song-action-btn ${isFav ? 'active' : ''}`}
            onClick={(e) => {
              e.stopPropagation()
              onToggleFavorite(song)
            }}
            aria-label={isFav ? "Remove from favorites" : "Add to favorites"}
            title={isFav ? "Remove from favorites" : "Add to favorites"}
            data-testid="song-fav-btn"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill={isFav ? "var(--red, #EF4444)" : "none"} stroke={isFav ? "var(--red, #EF4444)" : "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </button>
        )}

        <button
          type="button"
          ref={moreBtnRef}
          className="discover-song-more-btn"
          onClick={(e) => {
            e.stopPropagation()
            setIsMenuOpen(prev => !prev)
          }}
          aria-label={`More actions for ${song.title || song.name}`}
          aria-haspopup="menu"
          aria-expanded={isMenuOpen}
          data-testid="song-more-btn"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <circle cx="12" cy="5" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="12" cy="19" r="2" />
          </svg>
        </button>

        {isMenuOpen && (
          <div
            ref={menuRef}
            className="discover-song-menu"
            role="menu"
            aria-label={`Actions for ${song.title || song.name}`}
            data-testid="song-action-menu"
          >
            <button
              type="button"
              role="menuitem"
              className="discover-song-menu-item"
              onClick={handlePlay}
            >
              <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
              <span>Play</span>
            </button>

            {onAddToPlaylist && (
              <button
                type="button"
                role="menuitem"
                className="discover-song-menu-item"
                onClick={(e) => {
                  e.stopPropagation()
                  setIsMenuOpen(false)
                  onAddToPlaylist(song)
                }}
              >
                <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
                  <path d="M14 10H2v2h12v-2zm0-4H2v2h12V6zm4 8v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zM2 16h8v-2H2v2z" />
                </svg>
                <span>Add to Playlist</span>
              </button>
            )}

            {onToggleSaveTrack && (
              <button
                type="button"
                role="menuitem"
                className="discover-song-menu-item"
                onClick={(e) => {
                  e.stopPropagation()
                  setIsMenuOpen(false)
                  onToggleSaveTrack(song, !isSaved)
                }}
              >
                <svg viewBox="0 0 24 24" width="15" height="15" fill={isSaved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                </svg>
                <span>{isSaved ? "Remove from Library" : "Save to Library"}</span>
              </button>
            )}

            <button
              type="button"
              role="menuitem"
              className="discover-song-menu-item"
              onClick={handleDownload}
            >
              <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
                <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
              </svg>
              <span>Download</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function DiscoverView({
  token,
  playlists = {},
  trackMetadata = {},
  onSelectArtist,
  onSelectPlaylist,
  onPlayTracks,
  username,
  onSavePlaylist,
  onSaveArtist,
  onToggleSave,
  onAddToMyPlaylists,
  savedArtists: propSavedArtists = [],
  savedTracks: propSavedTracks = [],
  onToggleSaveArtist,
  onToggleSaveTrack,
  favorites = [],
  onToggleFavorite,
  onAddToPlaylist,
  onDownloadTrack,
  onToast
}) {
  const [searchFilter, setSearchFilter] = useState('')
  const [v2Artists, setV2Artists] = useState([])
  const [v2Playlists, setV2Playlists] = useState([])
  const [savedPlaylists, setSavedPlaylists] = useState(new Set())
  const [savedArtists, setSavedArtists] = useState(new Set())
  const [loading, setLoading] = useState(true)

  // Fetch from /api/v2/artists and /api/v2/playlists?discover=true
  useEffect(() => {
    let isMounted = true
    async function loadData() {
      setLoading(true)
      try {
        const headers = token ? { Authorization: `Bearer ${token}` } : {}

        const [artRes, plRes] = await Promise.allSettled([
          fetch('/api/v2/artists', { headers }),
          fetch('/api/v2/playlists?discover=true', { headers })
        ])

        if (isMounted && artRes.status === 'fulfilled' && artRes.value.ok) {
          try {
            const data = await artRes.value.json()
            if (Array.isArray(data)) {
              setV2Artists(data)
            } else if (Array.isArray(data?.artists)) {
              setV2Artists(data.artists)
            }
          } catch {}
        }

        if (isMounted && plRes.status === 'fulfilled' && plRes.value.ok) {
          try {
            const data = await plRes.value.json()
            if (Array.isArray(data)) {
              setV2Playlists(data)
            } else if (Array.isArray(data?.playlists)) {
              setV2Playlists(data.playlists)
            }
          } catch {}
        }
      } catch (err) {
        console.warn('[DiscoverView] Fetch error:', err)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    loadData()
    return () => { isMounted = false }
  }, [token])

  useEffect(() => {
    if (Array.isArray(propSavedArtists) && propSavedArtists.length > 0) {
      setSavedArtists(prev => {
        const next = new Set(prev)
        propSavedArtists.forEach(a => {
          const key = typeof a === 'object' ? (a?.id || a?.name) : a
          if (key) {
            next.add(key)
            if (typeof a === 'object') {
              if (a.id) next.add(a.id)
              if (a.name) next.add(a.name)
            }
          }
        })
        return next
      })
    }
  }, [propSavedArtists])

  // Derive discoverable artists: Use v2Artists if present, otherwise extract from playlists & metadata
  const discoverableArtists = useMemo(() => {
    if (v2Artists.length > 0) {
      return v2Artists.map((a, idx) => ({
        id: a.id || `artist-${idx}`,
        name: a.name || 'Unknown Artist',
        track_count: a.track_count ?? (Array.isArray(a.tracks) ? a.tracks.length : 0),
        first_track_path: a.first_track_path || (Array.isArray(a.tracks) ? (typeof a.tracks[0] === 'string' ? a.tracks[0] : a.tracks[0]?.path) : null),
        image_url: a.image_url || a.artwork,
        tracks: a.tracks || []
      }))
    }

    // Fallback: derive from library playlists and metadata
    const artistsMap = new Map()

    // 1. Folders that classify as artists
    Object.entries(playlists).forEach(([folderName, paths]) => {
      if (folderName === 'Favorites' || folderName === 'Library') return
      if (isArtistName(folderName)) {
        if (!artistsMap.has(folderName)) {
          artistsMap.set(folderName, {
            id: encodeURIComponent(folderName),
            name: folderName,
            track_count: paths.length,
            first_track_path: paths[0],
            tracks: paths
          })
        }
      }
    })

    // 2. Artists from track metadata
    Object.entries(trackMetadata).forEach(([path, meta]) => {
      if (meta?.artist && meta.artist.trim()) {
        const artName = meta.artist.trim()
        if (!artistsMap.has(artName)) {
          artistsMap.set(artName, {
            id: encodeURIComponent(artName),
            name: artName,
            track_count: 1,
            first_track_path: path,
            tracks: [path]
          })
        } else {
          const entry = artistsMap.get(artName)
          if (!entry.tracks.includes(path)) {
            entry.tracks.push(path)
            entry.track_count = entry.tracks.length
          }
        }
      }
    })

    return Array.from(artistsMap.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [v2Artists, playlists, trackMetadata])

  // Derive discoverable Shared Playlists (individually granted private playlists)
  const sharedPlaylists = useMemo(() => {
    const sharedFromV2 = v2Playlists.filter(p => !p.is_folder_playlist && (p.is_shared === true || p.is_granted === true))
    if (sharedFromV2.length > 0) {
      return sharedFromV2.map((p, idx) => ({
        ...p,
        id: p.id || `shared-pl-${idx}`,
        title: p.title || p.name || 'Untitled Playlist',
        name: p.title || p.name || 'Untitled Playlist',
        owner: p.owner || p.curator || p.username || 'admin',
        curator: p.curator || p.owner || p.username || 'admin',
        visibility: p.visibility || 'private',
        description: (p.description && !p.description.startsWith('Folder playlist for ')) ? p.description : '',
        is_saved: Boolean(p.is_saved),
        track_count: p.track_count ?? (Array.isArray(p.tracks) ? p.tracks.length : 0),
        first_track_path: p.first_track_path || (Array.isArray(p.tracks) ? (typeof p.tracks[0] === 'string' ? p.tracks[0] : (p.tracks[0]?.track_path || p.tracks[0]?.path)) : null),
        tracks: p.tracks || []
      }))
    }
    return []
  }, [v2Playlists])

  // Derive discoverable Public Playlists
  const publicPlaylists = useMemo(() => {
    // Check if v2Playlists contains public playlists (excluding shared private playlists)
    const publicFromV2 = v2Playlists.filter(p => !p.is_folder_playlist && (p.is_public === true || p.visibility === 'public') && !p.is_shared && !p.is_granted)
    if (publicFromV2.length > 0) {
      return publicFromV2.map((p, idx) => ({
        ...p,
        id: p.id || `public-pl-${idx}`,
        title: p.title || p.name || 'Untitled Playlist',
        name: p.title || p.name || 'Untitled Playlist',
        owner: p.owner || p.curator || p.username || 'admin',
        curator: p.curator || p.owner || p.username || 'admin',
        visibility: p.visibility || (p.is_public ? 'public' : 'private'),
        description: (p.description && !p.description.startsWith('Folder playlist for ')) ? p.description : '',
        is_saved: Boolean(p.is_saved),
        track_count: p.track_count ?? (Array.isArray(p.tracks) ? p.tracks.length : 0),
        first_track_path: p.first_track_path || (Array.isArray(p.tracks) ? (typeof p.tracks[0] === 'string' ? p.tracks[0] : (p.tracks[0]?.track_path || p.tracks[0]?.path)) : null),
        tracks: p.tracks || []
      }))
    }

    // Default clean state if none defined or return empty array
    return []
  }, [v2Playlists])

  // Derive Folder Playlists: Source folder collections classified as playlists
  const folderPlaylists = useMemo(() => {
    // If v2Playlists explicitly lists folder collections
    const foldersFromV2 = v2Playlists.filter(p => p.is_folder_playlist || p.type === 'folder' || p.is_folder)
    if (foldersFromV2.length > 0) {
      return foldersFromV2.map((p, idx) => ({
        id: p.id || `folder-pl-${idx}`,
        name: p.title || p.name,
        track_count: p.track_count ?? (Array.isArray(p.tracks) ? p.tracks.length : 0),
        first_track_path: p.first_track_path || (Array.isArray(p.tracks) ? (typeof p.tracks[0] === 'string' ? p.tracks[0] : (p.tracks[0]?.track_path || p.tracks[0]?.path)) : null),
        tracks: p.tracks || []
      }))
    }

    // Fallback: top-level source folders in playlists classified as playlists
    const list = []
    Object.entries(playlists).forEach(([name, paths]) => {
      if (name === 'Favorites') return
      if (isPlaylistName(name)) {
        list.push({
          id: encodeURIComponent(name),
          name: name,
          track_count: paths.length,
          first_track_path: paths[0],
          tracks: paths
        })
      }
    })

    return list.sort((a, b) => a.name.localeCompare(b.name))
  }, [v2Playlists, playlists])

  // Derive all discoverable songs from available sources
  const discoverableSongs = useMemo(() => {
    const songsMap = new Map()

    const addOrMerge = (track, defaultPlaylist = '', defaultArtist = '') => {
      if (!track) return
      let path = ''
      let id = ''
      let title = ''
      let artist = ''
      let album = ''
      let duration = undefined
      let playlist = defaultPlaylist

      if (typeof track === 'string') {
        path = track
        id = track
      } else if (typeof track === 'object') {
        path = track.path || track.track_path || track.id || ''
        id = track.id || track.path || track.track_path || ''
        title = track.title || track.name || ''
        artist = track.artist || ''
        album = track.album || ''
        duration = track.duration ?? track.total_seconds
        if (track.playlist) playlist = track.playlist
      }

      if (!path && !id) return
      const key = path || id

      const filename = path
        ? path.split('/').pop().replace(/\.[^/.]+$/, '')
        : (id || 'Unknown Track')

      const meta = trackMetadata[key] || trackMetadata[path] || {}
      const finalTitle = title || meta.title || meta.name || filename
      const finalArtist = artist || meta.artist || defaultArtist || (isArtistName(defaultPlaylist) ? defaultPlaylist : '') || 'Unknown Artist'
      const finalAlbum = album || meta.album || ''
      const finalDuration = duration ?? meta.duration ?? meta.total_seconds

      if (!songsMap.has(key)) {
        songsMap.set(key, {
          id: id || path,
          path: path || id,
          title: finalTitle,
          name: finalTitle,
          artist: finalArtist,
          album: finalAlbum,
          duration: finalDuration,
          playlist: playlist || meta.playlist || ''
        })
      } else {
        const existing = songsMap.get(key)
        if ((!existing.artist || existing.artist === 'Unknown Artist') && finalArtist && finalArtist !== 'Unknown Artist') {
          existing.artist = finalArtist
        }
        if (!existing.album && finalAlbum) {
          existing.album = finalAlbum
        }
        if (existing.duration == null && finalDuration != null) {
          existing.duration = finalDuration
        }
        if (!existing.playlist && playlist) {
          existing.playlist = playlist
        }
      }
    }

    // 1. Source: trackMetadata entries
    if (trackMetadata && typeof trackMetadata === 'object') {
      Object.entries(trackMetadata).forEach(([path, meta]) => {
        addOrMerge({ path, ...meta })
      })
    }

    // 2. Source: playlists (library folders and playlists)
    if (playlists && typeof playlists === 'object') {
      Object.entries(playlists).forEach(([plName, tracks]) => {
        if (Array.isArray(tracks)) {
          tracks.forEach(track => {
            addOrMerge(track, plName)
          })
        }
      })
    }

    // 3. Source: v2Artists (if they have tracks)
    if (Array.isArray(v2Artists)) {
      v2Artists.forEach(artistItem => {
        if (artistItem && Array.isArray(artistItem.tracks)) {
          artistItem.tracks.forEach(track => {
            addOrMerge(track, '', artistItem.name)
          })
        }
      })
    }

    // 4. Source: v2Playlists (if they have tracks)
    if (Array.isArray(v2Playlists)) {
      v2Playlists.forEach(playlistItem => {
        if (playlistItem && Array.isArray(playlistItem.tracks)) {
          playlistItem.tracks.forEach(track => {
            addOrMerge(track, playlistItem.title || playlistItem.name || '')
          })
        }
      })
    }

    return Array.from(songsMap.values())
  }, [trackMetadata, playlists, v2Artists, v2Playlists])

  // Search filtering
  const q = searchFilter.trim().toLowerCase()

  const filteredSongs = useMemo(() => {
    if (!q) return []
    return discoverableSongs.filter(song =>
      matchIndividualLetters(searchFilter, song.title, song.name, song.artist, song.album, song.path)
    )
  }, [discoverableSongs, searchFilter, q])

  const filteredArtists = useMemo(() => {
    if (!q) return discoverableArtists
    return discoverableArtists.filter(a => matchIndividualLetters(searchFilter, a.name))
  }, [discoverableArtists, searchFilter, q])

  const filteredSharedPlaylists = useMemo(() => {
    if (!q) return sharedPlaylists
    return sharedPlaylists.filter(p =>
      matchIndividualLetters(searchFilter, p.name, p.curator, p.title, p.description)
    )
  }, [sharedPlaylists, searchFilter, q])

  const filteredPublicPlaylists = useMemo(() => {
    if (!q) return publicPlaylists
    return publicPlaylists.filter(p =>
      matchIndividualLetters(searchFilter, p.name, p.curator, p.title, p.description)
    )
  }, [publicPlaylists, searchFilter, q])

  const filteredFolderPlaylists = useMemo(() => {
    if (!q) return folderPlaylists
    return folderPlaylists.filter(p => matchIndividualLetters(searchFilter, p.name))
  }, [folderPlaylists, searchFilter, q])

  // Helper to map paths to playable track objects
  const mapTracks = useCallback((playlistName, rawTracks = []) => {
    return rawTracks.map((item, idx) => {
      if (typeof item === 'object' && item.path) {
        return item
      }
      const p = String(item)
      const name = p.split('/').pop().replace(/\.[^/.]+$/, '')
      return {
        id: `${playlistName}-${idx}`,
        path: p,
        name: name,
        playlist: playlistName,
        artist: trackMetadata[p]?.artist || playlistName
      }
    })
  }, [trackMetadata])

  const handlePlayArtist = useCallback((e, artist) => {
    e.stopPropagation()
    const tracksToPlay = mapTracks(artist.name, artist.tracks)
    if (onPlayTracks) {
      onPlayTracks(tracksToPlay, 0, false)
    }
  }, [mapTracks, onPlayTracks])

  const handlePlayPlaylist = useCallback((e, pl) => {
    e.stopPropagation()
    const tracksToPlay = mapTracks(pl.name, pl.tracks)
    if (onPlayTracks) {
      onPlayTracks(tracksToPlay, 0, false)
    }
  }, [mapTracks, onPlayTracks])

  const handleSavePlaylist = useCallback(async (e, pl) => {
    e.stopPropagation()
    const plKey = pl.id || pl.name
    const isCurrentlySaved = Boolean(pl.is_saved || savedPlaylists.has(plKey))
    const nextSaved = !isCurrentlySaved

    if (pl.id) {
      try {
        const method = nextSaved ? 'POST' : 'DELETE'
        const res = await fetch(`/api/v2/playlists/${encodeURIComponent(pl.id)}/save`, {
          method,
          headers: token ? {
            Authorization: `Bearer ${token}`
          } : {}
        })
        if (!res.ok) {
          console.warn('Failed to toggle playlist save:', res.status, res.statusText)
          return
        }
      } catch (err) {
        console.warn('Failed to toggle playlist save:', err)
        return
      }
    }

    setSavedPlaylists(prev => {
      const next = new Set(prev)
      if (nextSaved) next.add(plKey)
      else next.delete(plKey)
      return next
    })

    setV2Playlists(prev => prev.map(p => {
      if ((p.id && p.id === pl.id) || p.name === pl.name) {
        return { ...p, is_saved: nextSaved }
      }
      return p
    }))

    const handler = onSavePlaylist || onToggleSave
    if (handler) {
      handler(pl, nextSaved)
    }
  }, [token, savedPlaylists, onSavePlaylist, onToggleSave])

  const handleSaveArtist = useCallback(async (e, artist) => {
    e.stopPropagation()
    const artistKey = artist.id || artist.name
    const isCurrentlySaved = Boolean(artist.is_saved || savedArtists.has(artistKey))
    const nextSaved = !isCurrentlySaved

    if (artist.id) {
      try {
        const method = nextSaved ? 'POST' : 'DELETE'
        const response = await fetch(`/api/v2/artists/${encodeURIComponent(artist.id)}/save`, {
          method,
          headers: token ? {
            Authorization: `Bearer ${token}`
          } : {}
        })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
      } catch (err) {
        console.warn('Failed to toggle artist save:', err)
        return
      }
    } else {
      return
    }

    setSavedArtists(prev => {
      const next = new Set(prev)
      if (nextSaved) {
        next.add(artistKey)
      } else {
        next.delete(artistKey)
      }
      return next
    })

    setV2Artists(prev => prev.map(a => {
      if ((a.id && a.id === artist.id) || a.name === artist.name) {
        return { ...a, is_saved: nextSaved }
      }
      return a
    }))

    const handler = onToggleSaveArtist || onSaveArtist || onSavePlaylist || onToggleSave
    if (handler) {
      handler(artist, nextSaved)
    }
  }, [token, savedArtists, onToggleSaveArtist, onSaveArtist, onSavePlaylist, onToggleSave])

  return (
    <div className="discover-view" data-testid="discover-view">
      {/* Header & Quick Search */}
      <div className="discover-header">
        <div className="discover-header-top">
          <h1 className="discover-title">Discover</h1>
          <p className="discover-subtitle">
            Explore accessible artists, folder collections, and public playlists
          </p>
        </div>

        <div className="discover-search-bar">
          <span className="discover-search-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
            </svg>
          </span>
          <input
            type="text"
            placeholder="Search Discover"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="discover-search-input"
            aria-label="Filter discoverable artists and playlists"
            data-testid="discover-search-input"
          />
          {searchFilter && (
            <button
              type="button"
              className="discover-search-clear"
              onClick={() => setSearchFilter('')}
              aria-label="Clear discover filter"
              data-testid="discover-search-clear"
            >
              &times;
            </button>
          )}
        </div>
      </div>

      {/* Empty Search Result Consolidator or Catalog Sections */}
      {q && (filteredSongs.length + filteredArtists.length + filteredSharedPlaylists.length + filteredPublicPlaylists.length + filteredFolderPlaylists.length === 0) ? (
        <div className="discover-empty-state discover-empty-search" data-testid="discover-empty-search" data-testid-alt="discover-artists-empty">
          <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <p className="discover-empty-title">
            No matches found for "{searchFilter}"
          </p>
          <p className="discover-empty-desc">
            Check your search query or clear the filter to browse the catalog.
          </p>
          <button
            type="button"
            className="discover-clear-search-cta"
            onClick={() => setSearchFilter('')}
            data-testid="discover-empty-clear-btn"
          >
            Clear search
          </button>
        </div>
      ) : (
        <>
          {/* SECTION 0: SONGS (when search query is active and songs match) */}
          {q && filteredSongs.length > 0 && (
            <section className="discover-section discover-songs-section" data-testid="discover-songs-section">
              <div className="discover-section-header">
                <h2 className="discover-section-title" data-testid="discover-songs-heading">Songs</h2>
                <span className="discover-section-count" data-testid="discover-songs-count">
                  {filteredSongs.length} {filteredSongs.length === 1 ? 'song' : 'songs'}
                </span>
              </div>

              <div className="discover-songs-list" data-testid="discover-songs-list" role="list">
                {filteredSongs.map((song, idx) => (
                  <DiscoverSongRow
                    key={song.id || song.path || idx}
                    song={song}
                    idx={idx}
                    token={token}
                    onPlayTracks={onPlayTracks}
                    onToggleSaveTrack={onToggleSaveTrack}
                    onAddToPlaylist={onAddToPlaylist}
                    onToggleFavorite={onToggleFavorite}
                    favorites={favorites}
                    savedTracks={propSavedTracks}
                    onDownloadTrack={onDownloadTrack}
                  />
                ))}
              </div>
            </section>
          )}

          {/* SECTION 1: ARTISTS */}
          {(!q || filteredArtists.length > 0) && (
            <section className="discover-section" data-testid="discover-artists-section">
              <div className="discover-section-header">
                <h2 className="discover-section-title" data-testid="discover-artists-heading">Artists</h2>
                <span className="discover-section-count">
                  {filteredArtists.length} {filteredArtists.length === 1 ? 'artist' : 'artists'}
                </span>
              </div>

              {filteredArtists.length === 0 ? (
                <div className="discover-empty-state" data-testid="discover-artists-empty">
                  <svg viewBox="0 0 24 24" width="40" height="40" fill="currentColor">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                  </svg>
                  <p className="discover-empty-title">
                    No artists available in your catalog
                  </p>
                  <p className="discover-empty-desc">
                    Organize your music folders into artist directories to browse them here.
                  </p>
                </div>
              ) : (
                <div className="discover-artists-grid" data-testid="artists-grid">
                  {filteredArtists.map((artist) => (
                    <div
                      key={artist.id || artist.name}
                      className="discover-artist-card"
                      role="button"
                      tabIndex={0}
                      onClick={() => onSelectArtist?.(artist.id, artist.name, artist)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          onSelectArtist?.(artist.id, artist.name, artist)
                        }
                      }}
                      aria-label={`View artist ${artist.name}`}
                      data-testid={`artist-card-${artist.id || artist.name}`}
                    >
                      <ArtistAvatar artist={artist} token={token} />
                      <h3 className="discover-artist-name" title={artist.name} data-testid="artist-name">
                        {artist.name}
                      </h3>
                      <p className="discover-artist-count" data-testid="artist-track-count">
                        {artist.track_count} {artist.track_count === 1 ? 'song' : 'songs'}
                      </p>

                      {artist.track_count > 0 && onPlayTracks && (
                        <button
                          type="button"
                          className="discover-card-play-btn"
                          onClick={(e) => handlePlayArtist(e, artist)}
                          aria-label={`Play songs by ${artist.name}`}
                          title={`Play ${artist.name}`}
                          data-testid="artist-play-btn"
                        >
                          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        </button>
                      )}

                      <button
                        type="button"
                        className={`discover-card-save-btn discover-artist-save-btn ${(artist.is_saved || savedArtists.has(artist.id || artist.name)) ? 'saved' : ''} ${(!onPlayTracks || artist.track_count === 0) ? 'no-play' : ''}`}
                        onClick={(e) => handleSaveArtist(e, artist)}
                        aria-label={(artist.is_saved || savedArtists.has(artist.id || artist.name)) ? "Remove from library" : "Save to library"}
                        title={(artist.is_saved || savedArtists.has(artist.id || artist.name)) ? "Remove from library" : "Save to library"}
                        data-testid="discover-add-artist-btn"
                      >
                        <span data-testid={`add-to-my-playlists-${artist.name}`} style={{ display: 'none' }} aria-hidden="true" />
                        {(artist.is_saved || savedArtists.has(artist.id || artist.name)) ? (
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                          </svg>
                        ) : (
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                          </svg>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

      {/* SECTION: SHARED WITH YOU */}
      {sharedPlaylists.length > 0 && (!q || filteredSharedPlaylists.length > 0) && (
        <section className="discover-section" data-testid="discover-shared-playlists-section">
          <div className="discover-section-header">
            <h2 className="discover-section-title" data-testid="discover-shared-playlists-heading">Shared with You</h2>
            <span className="discover-section-count">
              {filteredSharedPlaylists.length} {filteredSharedPlaylists.length === 1 ? 'playlist' : 'playlists'}
            </span>
          </div>

          {filteredSharedPlaylists.length === 0 ? (
            <div className="discover-empty-state" data-testid="discover-shared-playlists-empty">
              <svg viewBox="0 0 24 24" width="40" height="40" fill="currentColor">
                <path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z" />
              </svg>
              <p className="discover-empty-title">
                {q ? `No shared playlists matching "${searchFilter}"` : 'No shared playlists yet'}
              </p>
            </div>
          ) : (
            <div className="discover-playlists-grid" data-testid="shared-playlists-grid">
              {filteredSharedPlaylists.map((pl) => (
                <div
                  key={pl.id || pl.name}
                  className="discover-playlist-card"
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectPlaylist?.(pl.title || pl.name, pl)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onSelectPlaylist?.(pl.title || pl.name, pl)
                    }
                  }}
                  aria-label={`Open shared playlist ${pl.name}`}
                  data-testid={`shared-playlist-card-${pl.id || pl.name}`}
                >
                  <PlaylistThumb playlist={pl} token={token} />
                  <div className="discover-playlist-info">
                    <h3 className="discover-playlist-name" title={pl.name} data-testid="shared-playlist-title">
                      {pl.name}
                    </h3>
                    <div className="discover-playlist-meta-row">
                      <span className="curator-badge" data-testid="curator-badge" title={`Shared by @${pl.curator}`}>
                        @{pl.curator}
                      </span>
                      <span className="visibility-badge" data-testid="visibility-badge">
                        Shared
                      </span>
                      <span className="discover-playlist-count" data-testid="shared-playlist-count">
                        {pl.track_count} {pl.track_count === 1 ? 'track' : 'tracks'}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    className={`discover-card-save-btn ${(pl.is_saved || savedPlaylists.has(pl.id || pl.name)) ? 'saved' : ''} ${(!onPlayTracks || pl.track_count === 0) ? 'no-play' : ''}`}
                    onClick={(e) => handleSavePlaylist(e, pl)}
                    aria-label={(pl.is_saved || savedPlaylists.has(pl.id || pl.name)) ? "Remove from library" : "Save to library"}
                    title={(pl.is_saved || savedPlaylists.has(pl.id || pl.name)) ? "Remove from library" : "Save to library"}
                    data-testid="discover-add-playlist-btn"
                  >
                    <span data-testid={`add-to-my-playlists-${pl.name}`} style={{ display: 'none' }} aria-hidden="true" />
                    {(pl.is_saved || savedPlaylists.has(pl.id || pl.name)) ? (
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                      </svg>
                    )}
                  </button>

                  {pl.track_count > 0 && onPlayTracks && (
                    <button
                      type="button"
                      className="discover-card-play-btn"
                      onClick={(e) => handlePlayPlaylist(e, pl)}
                      aria-label={`Play ${pl.name}`}
                      title={`Play ${pl.name}`}
                      data-testid="playlist-play-btn"
                    >
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* SECTION 2: PUBLIC PLAYLISTS */}
      {(!q || filteredPublicPlaylists.length > 0) && (
        <section className="discover-section" data-testid="discover-public-playlists-section">
          <div className="discover-section-header">
            <h2 className="discover-section-title" data-testid="discover-public-playlists-heading">Public Playlists</h2>
            <span className="discover-section-count">
              {filteredPublicPlaylists.length} {filteredPublicPlaylists.length === 1 ? 'playlist' : 'playlists'}
            </span>
          </div>

          {filteredPublicPlaylists.length === 0 ? (
            <div className="discover-empty-state" data-testid="discover-public-playlists-empty">
              <svg viewBox="0 0 24 24" width="40" height="40" fill="currentColor">
                <path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z" />
              </svg>
              <p className="discover-empty-title">
                {q ? `No public playlists matching "${searchFilter}"` : 'No public playlists yet'}
              </p>
              <p className="discover-empty-desc">
                {q ? 'Try a different search keyword.' : 'Playlists marked as public by other users will appear here.'}
              </p>
            </div>
          ) : (
            <div className="discover-playlists-grid" data-testid="public-playlists-grid">
              {filteredPublicPlaylists.map((pl) => (
                <div
                  key={pl.id || pl.name}
                  className="discover-playlist-card"
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectPlaylist?.(pl.title || pl.name, pl)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onSelectPlaylist?.(pl.title || pl.name, pl)
                    }
                  }}
                  aria-label={`Open public playlist ${pl.name}`}
                  data-testid={`public-playlist-card-${pl.id || pl.name}`}
                >
                  <PlaylistThumb playlist={pl} token={token} />
                  <div className="discover-playlist-info">
                    <h3 className="discover-playlist-name" title={pl.name} data-testid="public-playlist-title">
                      {pl.name}
                    </h3>
                    <div className="discover-playlist-meta-row">
                      <span className="curator-badge" data-testid="curator-badge" title={`Curated by @${pl.curator}`}>
                        @{pl.curator}
                      </span>
                      <span className="visibility-badge" data-testid="visibility-badge">
                        Public
                      </span>
                      <span className="discover-playlist-count" data-testid="public-playlist-count">
                        {pl.track_count} {pl.track_count === 1 ? 'track' : 'tracks'}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    className={`discover-card-save-btn ${(pl.is_saved || savedPlaylists.has(pl.id || pl.name)) ? 'saved' : ''} ${(!onPlayTracks || pl.track_count === 0) ? 'no-play' : ''}`}
                    onClick={(e) => handleSavePlaylist(e, pl)}
                    aria-label={(pl.is_saved || savedPlaylists.has(pl.id || pl.name)) ? "Remove from library" : "Save to library"}
                    title={(pl.is_saved || savedPlaylists.has(pl.id || pl.name)) ? "Remove from library" : "Save to library"}
                    data-testid="discover-add-playlist-btn"
                  >
                    <span data-testid={`add-to-my-playlists-${pl.name}`} style={{ display: 'none' }} aria-hidden="true" />
                    {(pl.is_saved || savedPlaylists.has(pl.id || pl.name)) ? (
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                      </svg>
                    )}
                  </button>

                  {pl.track_count > 0 && onPlayTracks && (
                    <button
                      type="button"
                      className="discover-card-play-btn"
                      onClick={(e) => handlePlayPlaylist(e, pl)}
                      aria-label={`Play ${pl.name}`}
                      title={`Play ${pl.name}`}
                      data-testid="playlist-play-btn"
                    >
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* SECTION 3: FOLDER PLAYLISTS */}
      {(!q || filteredFolderPlaylists.length > 0) && (
        <section className="discover-section" data-testid="discover-folder-playlists-section">
          <div className="discover-section-header">
            <h2 className="discover-section-title" data-testid="discover-folder-playlists-heading">Folder Playlists</h2>
            <span className="discover-section-count">
              {filteredFolderPlaylists.length} {filteredFolderPlaylists.length === 1 ? 'collection' : 'collections'}
            </span>
          </div>

          {filteredFolderPlaylists.length === 0 ? (
            <div className="discover-empty-state" data-testid="discover-folder-playlists-empty">
              <svg viewBox="0 0 24 24" width="40" height="40" fill="currentColor">
                <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
              </svg>
              <p className="discover-empty-title">
                {q ? `No folder playlists matching "${searchFilter}"` : 'No folder collections found'}
              </p>
              <p className="discover-empty-desc">
                {q ? 'Try clearing your search query.' : 'Admin-managed music folders classified as playlists will appear here.'}
              </p>
            </div>
          ) : (
            <div className="discover-playlists-grid" data-testid="folder-playlists-grid">
              {filteredFolderPlaylists.map((pl) => (
                <div
                  key={pl.id || pl.name}
                  className="discover-playlist-card"
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectPlaylist?.(pl.title || pl.name, pl)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onSelectPlaylist?.(pl.title || pl.name, pl)
                    }
                  }}
                  aria-label={`Open folder playlist ${pl.name}`}
                  data-testid={`folder-playlist-card-${pl.name}`}
                >
                  <PlaylistThumb playlist={pl} token={token} />
                  <div className="discover-playlist-info">
                    <h3 className="discover-playlist-name" title={pl.name} data-testid="folder-playlist-title">
                      {pl.name}
                    </h3>
                    <div className="discover-playlist-meta-row">
                      <span className="folder-badge" data-testid="folder-badge">
                        Folder
                      </span>
                      <span className="discover-playlist-count" data-testid="folder-playlist-count">
                        {pl.track_count} {pl.track_count === 1 ? 'track' : 'tracks'}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    className={`discover-card-save-btn ${(pl.is_saved || savedPlaylists.has(pl.id || pl.name)) ? 'saved' : ''} ${(!onPlayTracks || pl.track_count === 0) ? 'no-play' : ''}`}
                    onClick={(e) => handleSavePlaylist(e, pl)}
                    aria-label={(pl.is_saved || savedPlaylists.has(pl.id || pl.name)) ? "Remove from library" : "Save to library"}
                    title={(pl.is_saved || savedPlaylists.has(pl.id || pl.name)) ? "Remove from library" : "Save to library"}
                    data-testid="discover-add-playlist-btn"
                  >
                    <span data-testid={`add-to-my-playlists-${pl.name}`} style={{ display: 'none' }} aria-hidden="true" />
                    {(pl.is_saved || savedPlaylists.has(pl.id || pl.name)) ? (
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                      </svg>
                    )}
                  </button>

                  {pl.track_count > 0 && onPlayTracks && (
                    <button
                      type="button"
                      className="discover-card-play-btn"
                      onClick={(e) => handlePlayPlaylist(e, pl)}
                      aria-label={`Play ${pl.name}`}
                      title={`Play ${pl.name}`}
                      data-testid="folder-playlist-play-btn"
                    >
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}
        </>
      )}
    </div>
  )
}

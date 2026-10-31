import React, { useState, useEffect, useMemo, useCallback } from 'react'
import './DiscoverView.css'

function strHue(str) {
  let h = 0
  for (const c of (str || '')) h = (h * 31 + c.charCodeAt(0)) | 0
  return Math.abs(h) % 360
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

export default function DiscoverView({
  token,
  playlists = {},
  trackMetadata = {},
  onSelectArtist,
  onSelectPlaylist,
  onPlayTracks,
  username,
  onSavePlaylist,
  onToggleSave,
  onAddToMyPlaylists
}) {
  const [searchFilter, setSearchFilter] = useState('')
  const [v2Artists, setV2Artists] = useState([])
  const [v2Playlists, setV2Playlists] = useState([])
  const [savedPlaylists, setSavedPlaylists] = useState(new Set())
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

  // Search filtering
  const q = searchFilter.trim().toLowerCase()

  const filteredArtists = useMemo(() => {
    if (!q) return discoverableArtists
    return discoverableArtists.filter(a => a.name.toLowerCase().includes(q))
  }, [discoverableArtists, q])

  const filteredSharedPlaylists = useMemo(() => {
    if (!q) return sharedPlaylists
    return sharedPlaylists.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.curator && p.curator.toLowerCase().includes(q))
    )
  }, [sharedPlaylists, q])

  const filteredPublicPlaylists = useMemo(() => {
    if (!q) return publicPlaylists
    return publicPlaylists.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.curator && p.curator.toLowerCase().includes(q))
    )
  }, [publicPlaylists, q])

  const filteredFolderPlaylists = useMemo(() => {
    if (!q) return folderPlaylists
    return folderPlaylists.filter(p => p.name.toLowerCase().includes(q))
  }, [folderPlaylists, q])

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
            placeholder="Filter artists, public playlists, and folder collections..."
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

      {/* SECTION 1: ARTISTS */}
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
              {q ? `No artists found matching "${searchFilter}"` : 'No artists available in your catalog'}
            </p>
            <p className="discover-empty-desc">
              {q ? 'Check your search query or clear the filter.' : 'Organize your music folders into artist directories to browse them here.'}
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
              </div>
            ))}
          </div>
        )}
      </section>

      {/* SECTION: SHARED WITH YOU */}
      {sharedPlaylists.length > 0 && (
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
                    aria-label={(pl.is_saved || savedPlaylists.has(pl.id || pl.name)) ? "Remove from Library" : "Add to Library"}
                    title={(pl.is_saved || savedPlaylists.has(pl.id || pl.name)) ? "Remove from Library" : "Add to Library"}
                    data-testid="discover-add-playlist-btn"
                  >
                    <span data-testid={`add-to-my-playlists-${pl.name}`} style={{ position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', border: 0 }} aria-hidden="true" />
                    {(pl.is_saved || savedPlaylists.has(pl.id || pl.name)) ? (
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M12 5v14M5 12h14"/>
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
                  aria-label={(pl.is_saved || savedPlaylists.has(pl.id || pl.name)) ? "Remove from Library" : "Add to Library"}
                  title={(pl.is_saved || savedPlaylists.has(pl.id || pl.name)) ? "Remove from Library" : "Add to Library"}
                  data-testid="discover-add-playlist-btn"
                >
                  <span data-testid={`add-to-my-playlists-${pl.name}`} style={{ position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', border: 0 }} aria-hidden="true" />
                  {(pl.is_saved || savedPlaylists.has(pl.id || pl.name)) ? (
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M12 5v14M5 12h14"/>
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

      {/* SECTION 3: FOLDER PLAYLISTS */}
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
                      Source Folder
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
                  aria-label={(pl.is_saved || savedPlaylists.has(pl.id || pl.name)) ? "Remove from Library" : "Add to Library"}
                  title={(pl.is_saved || savedPlaylists.has(pl.id || pl.name)) ? "Remove from Library" : "Add to Library"}
                  data-testid="discover-add-playlist-btn"
                >
                  <span data-testid={`add-to-my-playlists-${pl.name}`} style={{ position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', border: 0 }} aria-hidden="true" />
                  {(pl.is_saved || savedPlaylists.has(pl.id || pl.name)) ? (
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M12 5v14M5 12h14"/>
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
    </div>
  )
}

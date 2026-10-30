import React, { useState, useEffect, useMemo } from 'react'
import SangitaLogo from './SangitaLogo.jsx'

function strHue(str) {
  let h = 0;
  for (const c of (str || '')) h = (h * 31 + c.charCodeAt(0)) | 0;
  return Math.abs(h) % 360;
}

// Spotify Library Icon (Used when expanded to collapse)
function SpotifyLibraryIcon({ width = 18, height = 18 }) {
  return (
    <svg viewBox="0 0 24 24" width={width} height={height} fill="currentColor">
      <path d="M4 3a1 1 0 0 1 1 1v16a1 1 0 1 1-2 0V4a1 1 0 0 1 1-1zm5 0a1 1 0 0 1 1 1v16a1 1 0 1 1-2 0V4a1 1 0 0 1 1-1zm5 1a1 1 0 0 1 1-1h1.5a1 1 0 0 1 .6.2l3.5 3a1 1 0 0 1 .4.8V20a1 1 0 0 1-1 1H15a1 1 0 0 1-1-1V4zm2 1.8V19h2V7.4l-2-1.6z"/>
    </svg>
  )
}

function isPlaylistName(name) {
  if (name === 'Favorites' || name === 'Library') return true
  const lower = name.toLowerCase()
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

function PlaylistThumb({ name, firstTrackPath, token }) {
  if (name === 'Favorites') {
    return (
      <div
        className="playlist-thumb playlist-thumb-fav"
        style={{
          background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
          color: '#FFFFFF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 10px rgba(16, 185, 129, 0.3)'
        }}
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
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
      <div className={`playlist-thumb ${isArtistName(name) ? 'playlist-thumb-artist' : 'playlist-thumb-img'}`}>
        <img
          src={coverUrl}
          key={firstTrackPath || name}
          alt={name}
          onError={() => setImgErr(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', borderRadius: isArtistName(name) ? '50%' : 'inherit', display: 'block' }}
        />
      </div>
    )
  }

  const hue = strHue(name)
  return (
    <div
      className={`playlist-thumb ${isArtistName(name) ? 'playlist-thumb-artist' : ''}`}
      style={{
        background: `linear-gradient(135deg, hsl(${hue}, 55%, 28%), hsl(${(hue + 50) % 360}, 50%, 15%))`,
        borderRadius: isArtistName(name) ? '50%' : undefined
      }}
    >
      <svg viewBox="0 0 24 24" width="20" height="20" fill="var(--emerald)">
        <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
      </svg>
    </div>
  )
}

function PlaylistItemRow({
  name,
  count,
  firstTrack,
  token,
  isActive,
  isArtist,
  isMyPlaylist,
  visibility = 'private',
  sidebarCollapsed,
  meta,
  onSelect
}) {
  const isPublic = visibility === 'public'

  return (
    <div
      role="button"
      tabIndex={0}
      className={`playlist-item ${isActive ? 'active' : ''}`}
      onClick={() => meta ? onSelect(name, meta) : onSelect(name)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          if (meta) {
            onSelect(name, meta)
          } else {
            onSelect(name)
          }
        }
      }}
      title={sidebarCollapsed ? `${name} (${count} songs)` : undefined}
      data-testid={`sidebar-playlist-${name}`}
    >
      <PlaylistThumb name={name} firstTrackPath={firstTrack} token={token} />
      {!sidebarCollapsed && (
        <>
          <div className="playlist-item-info">
            <div className="playlist-item-title-row">
              <span className="playlist-item-name">{name}</span>
              {isMyPlaylist && isPublic && (
                <span
                  className="playlist-visibility-badge badge-public"
                  title="Public playlist"
                  aria-label="Public playlist"
                  data-testid={`playlist-visibility-${name}`}
                >
                  <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor" aria-hidden="true">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                  </svg>
                  <span className="badge-text">Public</span>
                </span>
              )}
            </div>
            <div className="playlist-item-count">
              {isArtist ? 'Artist' : 'Playlist'} • {count} song{count !== 1 ? 's' : ''}
            </div>
          </div>
          {isActive && (
            <span className="playlist-active-pin" title="Currently Selected">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="var(--emerald)">
                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
              </svg>
            </span>
          )}
        </>
      )}
    </div>
  )
}

function Sidebar({
  playlists = {},
  currentPlaylist,
  onSelect,
  isOpen,
  sidebarCollapsed,
  onToggleSidebar,
  token,
  onCloseDrawer,
  onCreatePlaylist,
  onDiscover,
  view,
  userPlaylists = [],
  playlistMetadata = {},
  folderClassifications = {}
}) {
  const [filterType, setFilterType] = useState('all') // 'all', 'playlists', 'artists'
  const [libSearch, setLibSearch] = useState('')
  const [internalClassifications, setInternalClassifications] = useState({})

  useEffect(() => {
    if (!token) return
    const hasPropsClass = folderClassifications && (
      Array.isArray(folderClassifications) ? folderClassifications.length > 0 : Object.keys(folderClassifications).length > 0
    )
    if (hasPropsClass) return

    let isMounted = true
    fetch('/api/v2/catalog/sources', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.ok ? r.json() : {})
      .then(data => {
        if (!isMounted) return
        const sources = Array.isArray(data) ? data : (data?.sources || [])
        const map = {}
        sources.forEach(s => {
          const name = s.folder_name || s.display_name || s.name
          if (name && s.classification) {
            map[name] = s.classification
          }
        })
        setInternalClassifications(map)
      })
      .catch(() => {})

    return () => { isMounted = false }
  }, [token, folderClassifications])

  const classMap = React.useMemo(() => {
    const raw = (folderClassifications && (
      Array.isArray(folderClassifications) ? folderClassifications.length > 0 : Object.keys(folderClassifications).length > 0
    ))
      ? folderClassifications
      : internalClassifications

    if (Array.isArray(raw)) {
      const map = {}
      raw.forEach(s => {
        const name = s.folder_name || s.display_name || s.name
        if (name && s.classification) {
          map[name] = s.classification
        }
      })
      return map
    }
    return raw || {}
  }, [folderClassifications, internalClassifications])

  const allNames = Object.keys(playlists)
  const hasFavorites = 'Favorites' in playlists && (
    !libSearch || 'favorites'.includes(libSearch.toLowerCase())
  )

  const isUserCreated = (name) => {
    if (name === 'Favorites') return true
    if (Array.isArray(userPlaylists) && userPlaylists.includes(name)) return true
    if (playlistMetadata[name]?.isUserPlaylist || playlistMetadata[name]?.isOwner || playlistMetadata[name]?.owner) return true
    return false
  }

  const getClassification = (name) => classMap[name] || null

  const isArtist = (name) => {
    if (name === 'Favorites') return false
    if (isUserCreated(name)) return false
    const classification = getClassification(name)
    if (classification === 'artist') return true
    if (classification === 'playlist') return false
    return isArtistName(name)
  }

  // Filter based on search query for non-Favorites items
  const nonFavNames = allNames.filter(name =>
    name !== 'Favorites' && name.toLowerCase().includes(libSearch.toLowerCase())
  )

  // Filter based on filterType ('all', 'playlists', 'artists')
  const filteredNonFavNames = nonFavNames.filter(name => {
    const artist = isArtist(name)
    if (filterType === 'playlists') return !artist
    if (filterType === 'artists') return artist
    return true // 'all'
  })

  // Sort alphabetically
  filteredNonFavNames.sort((a, b) => a.localeCompare(b))

  // Unified list: Favorites ALWAYS pinned at the top, followed directly by all remaining items sorted alphabetically
  const visibleItems = hasFavorites ? ['Favorites', ...filteredNonFavNames] : filteredNonFavNames
  const totalVisibleCount = visibleItems.length

  return (
    <aside
      className={`sidebar ${isOpen ? 'open' : ''} ${sidebarCollapsed ? 'collapsed' : ''}`}
      data-testid="sidebar"
    >
      {/* Brand Header & Toggle */}
      <div
        className="sidebar-header"
        onClick={onToggleSidebar}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !e.target.closest('.sidebar-close-btn')) {
            e.preventDefault()
            onToggleSidebar?.()
          }
        }}
        role="button"
        tabIndex={0}
        aria-expanded={!sidebarCollapsed}
        aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        title={sidebarCollapsed ? "Click to expand sidebar" : "Click to collapse sidebar"}
        data-testid="sidebar-toggle-btn"
        style={{ cursor: 'pointer' }}
      >
        <div className="brand">
          <div className="brand-icon" title="Sangita">
            <SangitaLogo size={28} />
          </div>
          {!sidebarCollapsed && <span className="brand-name">Sangita</span>}
        </div>
        {isOpen && (
          <button
            type="button"
            className="sidebar-close-btn"
            onClick={(e) => {
              e.stopPropagation()
              if (onCloseDrawer) {
                onCloseDrawer()
              } else if (onToggleSidebar) {
                onToggleSidebar()
              }
            }}
            aria-label="Close library menu"
            title="Close library menu"
            data-testid="sidebar-close-btn"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        )}
      </div>

      {/* Discover Navigation Button */}
      <div className="sidebar-discover-container">
        <button
          type="button"
          className={`sidebar-discover-btn ${view === 'discover' || currentPlaylist === 'Discover' ? 'active' : ''}`}
          onClick={() => {
            if (onDiscover) {
              onDiscover()
            } else if (onSelect) {
              onSelect('Discover')
            }
          }}
          aria-label="Discover public catalog and artists"
          title={sidebarCollapsed ? "Discover" : undefined}
          data-testid="sidebar-discover-btn"
        >
          <div className="sidebar-discover-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <path d="M12 10.9c-.61 0-1.1.49-1.1 1.1s.49 1.1 1.1 1.1c.61 0 1.1-.49 1.1-1.1s-.49-1.1-1.1-1.1zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm2.19 12.19L6 18l3.81-8.19L18 6l-3.81 8.19z"/>
            </svg>
          </div>
          {!sidebarCollapsed && <span className="sidebar-discover-label">Discover</span>}
        </button>
      </div>

      {/* Library Toolbar (Hidden when collapsed) */}
      {!sidebarCollapsed && (
        <div className="library-toolbar" data-testid="library-toolbar">
          <div className="library-title-row">
            <div className="library-heading">
              <SpotifyLibraryIcon width={16} height={16} />
              <span>Your Library</span>
            </div>
            <button
              type="button"
              className="sidebar-create-playlist-btn"
              onClick={onCreatePlaylist}
              aria-label="Create playlist"
              title="Create playlist"
              data-testid="sidebar-create-playlist-btn"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
              </svg>
            </button>
          </div>

          {/* Quick Filter Chips: Exactly 2 Buttons (Playlists and Artists) */}
          <div className="library-chips">
            <button
              className={`lib-chip ${filterType === 'playlists' ? 'active' : ''}`}
              onClick={() => setFilterType(prev => prev === 'playlists' ? 'all' : 'playlists')}
              data-testid="lib-chip-playlists"
            >
              Playlists
            </button>
            <button
              className={`lib-chip ${filterType === 'artists' ? 'active' : ''}`}
              onClick={() => setFilterType(prev => prev === 'artists' ? 'all' : 'artists')}
              data-testid="lib-chip-artists"
            >
              Artists
            </button>
          </div>

          {/* Library Mini Search */}
          <div className="library-search-wrapper">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="var(--text-dim)">
              <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
            </svg>
            <input
              type="text"
              placeholder="Search in library..."
              value={libSearch}
              onChange={e => setLibSearch(e.target.value)}
              className="library-search-input"
              data-testid="library-search-input"
            />
            {libSearch && (
              <button onClick={() => setLibSearch('')} className="lib-clear-btn" data-testid="lib-clear-btn">&times;</button>
            )}
          </div>
        </div>
      )}

      {/* Unified Library List */}
      <nav className="sidebar-nav">
        {visibleItems.length === 0 ? (
          <div className="sidebar-empty">
            {allNames.length === 0 ? (sidebarCollapsed ? "" : "No items") : (sidebarCollapsed ? "" : "No matches")}
          </div>
        ) : (
          <div className="sidebar-section" data-testid="sidebar-section-unified">
            {visibleItems.map(name => {
              const count = playlists[name]?.length || 0
              const firstTrack = playlists[name]?.[0]
              const isActive = name === currentPlaylist
              const isArtistItem = isArtist(name)
              const isMyPlaylistItem = isUserCreated(name)
              const visibility = playlistMetadata[name]?.visibility || 'private'

              return (
                <PlaylistItemRow
                  key={name}
                  name={name}
                  count={count}
                  firstTrack={firstTrack}
                  token={token}
                  isActive={isActive}
                  isArtist={isArtistItem}
                  isMyPlaylist={isMyPlaylistItem}
                  visibility={visibility}
                  sidebarCollapsed={sidebarCollapsed}
                  meta={playlistMetadata[name]}
                  onSelect={onSelect}
                />
              )
            })}
          </div>
        )}
      </nav>
    </aside>
  )
}

export default React.memo(Sidebar)

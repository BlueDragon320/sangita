import React, { useState } from 'react'

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

// Distinct Expand Button Icon (Used when contracted/collapsed to expand)
function ExpandSidebarIcon({ width = 20, height = 20 }) {
  return (
    <svg viewBox="0 0 24 24" width={width} height={height} fill="currentColor">
      <path d="M4 19V5h2v14H4zm14.59-7.41L13.17 6 11.75 7.41 14.34 10H8v2h6.34l-2.59 2.59L13.17 16l5.42-5.41z"/>
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

export default function Sidebar({
  playlists,
  currentPlaylist,
  onSelect,
  isOpen,
  sidebarCollapsed,
  onToggleSidebar,
  token
}) {
  const [filterType, setFilterType] = useState('all') // 'all', 'playlists', 'artists'
  const [libSearch, setLibSearch] = useState('')
  const names = Object.keys(playlists).sort((a, b) => {
    if (a === 'Favorites') return -1
    if (b === 'Favorites') return 1
    if (a === 'Library') return -1
    if (b === 'Library') return 1
    return a.localeCompare(b)
  })

  const filteredNames = names.filter(name => {
    const matchesSearch = name.toLowerCase().includes(libSearch.toLowerCase())
    if (!matchesSearch) return false
    if (filterType === 'playlists') return isPlaylistName(name)
    if (filterType === 'artists') return isArtistName(name)
    return true
  })

  return (
    <aside
      className={`sidebar ${isOpen ? 'open' : ''} ${sidebarCollapsed ? 'collapsed' : ''}`}
      data-testid="sidebar"
    >
      {/* Brand Header & Toggle */}
      <div
        className="sidebar-header"
        onClick={onToggleSidebar}
        title={sidebarCollapsed ? "Click to expand sidebar" : "Click to collapse sidebar"}
        data-testid="sidebar-toggle-btn"
        style={{ cursor: 'pointer' }}
      >
        <div className="brand">
          <div className="brand-icon" title="Sangita">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
            </svg>
          </div>
          {!sidebarCollapsed && <span className="brand-name">Sangita</span>}
        </div>
      </div>

      {/* Library Toolbar (Hidden when collapsed) */}
      {!sidebarCollapsed && (
        <div className="library-toolbar" data-testid="library-toolbar">
          <div className="library-title-row">
            <div className="library-heading">
              <SpotifyLibraryIcon width={16} height={16} />
              <span>Your Library</span>
            </div>
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

      {/* Playlist Items List */}
      <nav className="sidebar-nav">
        {filteredNames.length === 0 ? (
          <div className="sidebar-empty">
            {names.length === 0 ? (sidebarCollapsed ? "" : "No items") : (sidebarCollapsed ? "" : "No matches")}
          </div>
        ) : (
          filteredNames.map(name => {
            const count = playlists[name]?.length || 0
            const firstTrack = playlists[name]?.[0]
            const isActive = name === currentPlaylist
            const isArt = isArtistName(name)

            return (
              <div
                key={name}
                className={`playlist-item ${isActive ? 'active' : ''}`}
                onClick={() => onSelect(name)}
                title={sidebarCollapsed ? `${name} (${count} songs)` : undefined}
                data-testid={`sidebar-playlist-${name}`}
              >
                <PlaylistThumb name={name} firstTrackPath={firstTrack} token={token} />
                {!sidebarCollapsed && (
                  <>
                    <div className="playlist-item-info">
                      <div className="playlist-item-name">{name}</div>
                      <div className="playlist-item-count">
                        {isArt ? 'Artist' : 'Playlist'} • {count} song{count !== 1 ? 's' : ''}
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
          })
        )}
      </nav>
    </aside>
  )
}
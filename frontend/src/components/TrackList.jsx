import React, { useState, useRef, useEffect, useCallback } from 'react'

function PlayingBars() {
  return (
    <div className="playing-bars" aria-hidden="true">
      <div className="playing-bar" style={{ height: 12 }} />
      <div className="playing-bar" style={{ height: 8  }} />
      <div className="playing-bar" style={{ height: 16 }} />
      <div className="playing-bar" style={{ height: 6  }} />
    </div>
  )
}

function fmtDur(s) {
  if (!s || isNaN(s) || s <= 0) return '—'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

function PlusIcon({ width = 16, height = 16 }) {
  return (
    <svg viewBox="0 0 24 24" width={width} height={height} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14"/>
    </svg>
  )
}

function PlayIcon({ width = 14, height = 14 }) {
  return (
    <svg viewBox="0 0 24 24" width={width} height={height} fill="currentColor" aria-hidden="true">
      <path d="M8 5v14l11-7z" />
    </svg>
  )
}

function DownloadIcon({ width = 16, height = 16 }) {
  return (
    <svg viewBox="0 0 24 24" width={width} height={height} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  )
}

function MoreDotsIcon({ width = 16, height = 16 }) {
  return (
    <svg viewBox="0 0 24 24" width={width} height={height} fill="currentColor" aria-hidden="true">
      <circle cx="12" cy="5" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="12" cy="19" r="2" />
    </svg>
  )
}

function HeartIcon({ filled }) {
  return filled ? (
    <svg viewBox="0 0 24 24" width={16} height={16} fill="var(--emerald)" aria-hidden="true">
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} fill="currentColor" aria-hidden="true">
      <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
    </svg>
  )
}

function TrackRowThumb({ track, token }) {
  const [imgErr, setImgErr] = useState(false)
  const coverUrl = track?.path ? `/api/cover/${track.path.split('/').map(encodeURIComponent).join('/')}?token=${encodeURIComponent(token || '')}&v=2` : null

  if (!imgErr && coverUrl && token) {
    return (
      <div className="track-table-thumb">
        <img
          src={coverUrl}
          key={track.path}
          alt=""
          onError={() => setImgErr(true)}
          className="track-thumb-img"
        />
      </div>
    )
  }
  return (
    <div className="track-table-thumb track-thumb-fallback" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
        <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
      </svg>
    </div>
  )
}

function TrackRowItem({
  track,
  idx,
  isActive,
  isPlaying,
  dur,
  isFav,
  token,
  onPlayTrack,
  onToggleFavorite,
  onAddToPlaylist,
  onDownloadTrack
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const moreBtnRef = useRef(null)
  const menuRef = useRef(null)

  const isUnavailable = Boolean(track.is_unavailable || track.unavailable || track.is_available === false)
  const isCurrentlyPlaying = isActive && isPlaying
  const trackTitle = track.name || track.title || (isUnavailable ? 'Unavailable track' : 'Unknown track')
  const artistName = track.artist || (isUnavailable ? 'Restricted' : (track.playlist || 'Sangita Artist'))

  const playActionLabel = isCurrentlyPlaying
    ? `Pause ${trackTitle}`
    : isActive
    ? `Resume ${trackTitle}`
    : `Play ${trackTitle}`

  const handleDirectDownload = useCallback((t) => {
    if (t?.is_unavailable) return
    try {
      const authToken = token || (typeof localStorage !== 'undefined' ? localStorage.getItem('sangita_token') : '') || ''
      const a = document.createElement('a')
      a.href = `/api/stream/${encodeURIComponent(t.path)}?token=${encodeURIComponent(authToken)}`
      a.download = t.name || 'track'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } catch {}
  }, [token])

  useEffect(() => {
    if (!isMenuOpen) return

    // Auto-focus first item when menu opens
    const timer = setTimeout(() => {
      if (menuRef.current) {
        const firstItem = menuRef.current.querySelector('button[role="menuitem"]:not([disabled])')
        if (firstItem) firstItem.focus()
      }
    }, 10)

    const handlePointerDown = (e) => {
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
        e.stopPropagation()
        setIsMenuOpen(false)
        if (moreBtnRef.current) {
          moreBtnRef.current.focus()
        }
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        if (!menuRef.current) return
        const items = Array.from(menuRef.current.querySelectorAll('button[role="menuitem"]:not([disabled])'))
        if (items.length === 0) return
        const currentIdx = items.indexOf(document.activeElement)
        if (currentIdx === -1) {
          items[0]?.focus()
        } else if (e.key === 'ArrowDown') {
          const nextIdx = (currentIdx + 1) % items.length
          items[nextIdx]?.focus()
        } else {
          const prevIdx = (currentIdx - 1 + items.length) % items.length
          items[prevIdx]?.focus()
        }
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isMenuOpen])

  return (
    <div
      className={`spotify-track-row ${isActive ? 'active' : ''} ${isUnavailable ? 'track-row-unavailable' : ''}`}
      onClick={() => {
        if (!isUnavailable && onPlayTrack) {
          onPlayTrack(track, idx)
        }
      }}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          if (!isUnavailable && onPlayTrack) {
            onPlayTrack(track, idx)
          }
        }
      }}
      tabIndex={isUnavailable ? -1 : 0}
      role="row"
      aria-selected={isActive}
      aria-disabled={isUnavailable ? 'true' : undefined}
      title={isUnavailable ? "Unavailable in your library" : undefined}
      style={{ animationDelay: `${Math.min(idx * 25, 500)}ms` }}
      data-testid={`track-row-${idx}`}
    >
      {/* Number / Play Indicator Column */}
      <div className="col-num" role="gridcell">
        {isUnavailable ? (
          <div
            className="row-unavailable-lock"
            title="Unavailable in your library"
            aria-label="Unavailable in your library"
            data-testid={`track-unavailable-lock-${idx}`}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
              <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
            </svg>
          </div>
        ) : (
          <button
            type="button"
            className="row-play-btn"
            title={playActionLabel}
            aria-label={playActionLabel}
            onClick={(e) => {
              e.stopPropagation()
              if (onPlayTrack) onPlayTrack(track, idx)
            }}
          >
            {isActive ? (
              isPlaying ? (
                <PlayingBars />
              ) : (
                <span className="track-paused-indicator" aria-label="Paused" title="Paused">
                  ⏸
                </span>
              )
            ) : (
              <>
                <span className="row-hover-play" aria-hidden="true">
                  <PlayIcon width={14} height={14} />
                </span>
                <span className="row-num-label">{idx + 1}</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Title + Thumbnail + Artist Column */}
      <div className="col-title" role="gridcell">
        <TrackRowThumb track={track} token={token} />
        <div className="track-text-group">
          <div className="track-title-row">
            <div
              className={`track-title-text ${isActive ? 'active-title' : ''}`}
              title={isUnavailable ? "Unavailable in your library" : trackTitle}
            >
              {trackTitle}
            </div>
            {isUnavailable && (
              <span
                className="track-unavailable-badge"
                title="Unavailable in your library"
                aria-label="Unavailable in your library"
                data-testid={`track-unavailable-badge-${idx}`}
              >
                <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true">
                  <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
                </svg>
              </span>
            )}
          </div>
          <div
            className="track-artist-text"
            title={artistName}
          >
            {artistName}
          </div>
        </div>
      </div>

      {/* Actions & Duration Column */}
      <div className="col-duration" role="gridcell">
        {/* Add to Playlist shortcut button (desktop) */}
        {onAddToPlaylist && (
          <div className="track-row-actions">
            <button
              type="button"
              className="btn-icon track-row-add-btn"
              onClick={(e) => {
                e.stopPropagation()
                onAddToPlaylist(track)
              }}
              title="Add to playlist"
              aria-label={`Add ${trackTitle} to playlist`}
              data-testid={`track-row-add-${idx}`}
            >
              <PlusIcon width={16} height={16} />
            </button>
          </div>
        )}

        {/* Duration timestamp */}
        <div className="track-duration-timestamp">
          {fmtDur(dur)}
        </div>

        {/* 3-Dots Context Menu Button & Action Menu / Sheet */}
        <div className="track-more-wrapper">
          <button
            type="button"
            ref={moreBtnRef}
            className="btn-icon track-more-btn"
            data-testid="track-more-btn"
            data-track-index={idx}
            aria-label={`More actions for ${trackTitle}`}
            title={`More actions for ${trackTitle}`}
            aria-haspopup="menu"
            aria-expanded={isMenuOpen}
            onClick={(e) => {
              e.stopPropagation()
              setIsMenuOpen((prev) => !prev)
            }}
          >
            <MoreDotsIcon width={16} height={16} />
          </button>

          {isMenuOpen && (
            <>
              <div
                className="track-action-backdrop"
                aria-hidden="true"
                onClick={(e) => {
                  e.stopPropagation()
                  setIsMenuOpen(false)
                }}
              />
              <div
                ref={menuRef}
                className="track-action-menu"
                role="menu"
                aria-label={`Actions for ${trackTitle}`}
                data-testid="track-action-menu"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="track-action-sheet-handle" aria-hidden="true" />
                <div className="track-action-header" aria-hidden="true">
                  <span className="track-action-header-title">{trackTitle}</span>
                  <span className="track-action-header-artist">{artistName}</span>
                </div>

                <button
                  type="button"
                  role="menuitem"
                  className={`track-action-item ${isUnavailable ? 'disabled' : ''}`}
                  disabled={isUnavailable}
                  aria-disabled={isUnavailable ? 'true' : undefined}
                  title={isUnavailable ? "Unavailable in your library" : "Play Track"}
                  data-testid="track-action-play"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (isUnavailable) return
                    setIsMenuOpen(false)
                    if (onPlayTrack) onPlayTrack(track, idx)
                  }}
                >
                  <PlayIcon width={14} height={14} />
                  <span>Play Track</span>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  className={`track-action-item ${isFav ? 'active' : ''}`}
                  data-testid="track-action-fav"
                  title={isFav ? "Remove from Favorites" : "Add to Favorites"}
                  aria-label={isFav ? `Remove ${trackTitle} from Favorites` : `Add ${trackTitle} to Favorites`}
                  onClick={(e) => {
                    e.stopPropagation()
                    setIsMenuOpen(false)
                    if (onToggleFavorite) onToggleFavorite(track.path)
                  }}
                >
                  <span
                    data-testid={`track-row-like-${idx}`}
                    title={isFav ? "Remove from Favorites" : "Add to Favorites"}
                    aria-label={isFav ? `Remove ${trackTitle} from Favorites` : `Add ${trackTitle} to Favorites`}
                    className="track-action-fav-inner"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', width: '100%' }}
                  >
                    <HeartIcon filled={isFav} />
                    <span>{isFav ? 'Remove from Favorites' : 'Add to Favorites'}</span>
                  </span>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  className="track-action-item"
                  data-testid="track-action-playlist"
                  onClick={(e) => {
                    e.stopPropagation()
                    setIsMenuOpen(false)
                    if (onAddToPlaylist) onAddToPlaylist(track)
                  }}
                >
                  <PlusIcon width={14} height={14} />
                  <span>Add to Playlist...</span>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  className={`track-action-item ${isUnavailable ? 'disabled' : ''}`}
                  disabled={isUnavailable}
                  aria-disabled={isUnavailable ? 'true' : undefined}
                  title={isUnavailable ? "Unavailable in your library" : "Download Track"}
                  data-testid="track-action-download"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (isUnavailable) return
                    setIsMenuOpen(false)
                    if (onDownloadTrack) {
                      onDownloadTrack(track)
                    } else {
                      handleDirectDownload(track)
                    }
                  }}
                >
                  <DownloadIcon width={14} height={14} />
                  <span>Download Track</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function TrackList({
  tracks = [],
  currentIndex,
  isPlaying,
  onPlayTrack,
  durations = {},
  token,
  favorites = [],
  onToggleFavorite,
  onAddToPlaylist,
  onDownloadTrack,
  emptyTitle,
  emptyMessage,
  emptyActionText,
  onEmptyAction,
  isFiltered,
  filterQuery
}) {
  if (tracks.length === 0) {
    const isFilteredState = Boolean(filterQuery || isFiltered)
    const title = emptyTitle || (isFilteredState ? 'No matching tracks' : 'No tracks in this playlist yet')
    const message = emptyMessage || (isFilteredState
      ? `No tracks match "${filterQuery || ''}". Check spelling or try a different search.`
      : 'Add songs from your library, or add an entire playlist from Discover.')
    const actionLabel = emptyActionText || (isFilteredState ? 'Clear Filter' : 'Add Playlist from Discover')

    return (
      <div className="empty-state tracklist-empty-card" data-testid="tracklist-empty-state">
        <div className="empty-state-icon-wrapper" aria-hidden="true">
          {isFilteredState ? (
            <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18V5l12-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="16" r="3" />
            </svg>
          )}
        </div>
        <h3 className="empty-state-title">{title}</h3>
        <p className="empty-state-message">{message}</p>
        <button
          type="button"
          className="empty-state-action-btn"
          data-testid="tracklist-empty-action"
          onClick={onEmptyAction}
        >
          {actionLabel}
        </button>
      </div>
    )
  }

  return (
    <div className="spotify-tracklist-container" data-testid="track-list" role="table" aria-label="Tracks">
      {/* Table Column Headers: Number, Title, Duration */}
      <div className="spotify-table-header" role="row">
        <div className="col-num" role="columnheader">#</div>
        <div className="col-title" role="columnheader">Title</div>
        <div className="col-duration" role="columnheader">
          <ClockIcon />
        </div>
      </div>

      {/* Table Song Rows */}
      {tracks.map((track, idx) => {
        const isActive = idx === currentIndex
        const normPath = track.path ? track.path.replace(/\\/g, '/') : ''
        const dur = durations[track.path] ?? durations[normPath] ?? durations[normPath.replace(/\//g, '\\')] ?? track.duration
        const isFav = favorites.includes(track.path) || favorites.includes(normPath)

        return (
          <TrackRowItem
            key={track.id || track.path || idx}
            track={track}
            idx={idx}
            isActive={isActive}
            isPlaying={isPlaying}
            dur={dur}
            isFav={isFav}
            token={token}
            onPlayTrack={onPlayTrack}
            onToggleFavorite={onToggleFavorite}
            onAddToPlaylist={onAddToPlaylist}
            onDownloadTrack={onDownloadTrack}
          />
        )
      })}
    </div>
  )
}

export default React.memo(TrackList)

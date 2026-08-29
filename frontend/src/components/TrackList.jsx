import React, { useState } from 'react'

function PlayingBars() {
  return (
    <div className="playing-bars">
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
    <svg viewBox="0 0 24 24" width={width} height={height} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14"/>
    </svg>
  )
}

function HeartIcon({ filled }) {
  return filled ? (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="var(--emerald)">
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
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
    <div className="track-table-thumb track-thumb-fallback">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
        <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
      </svg>
    </div>
  )
}
 
export default function TrackList({
  tracks = [],
  currentIndex,
  isPlaying,
  onPlayTrack,
  durations = {},
  token,
  favorites = [],
  onToggleFavorite,
  onAddToPlaylist
}) {
  if (tracks.length === 0) {
    return (
      <div className="empty-state">
        <svg viewBox="0 0 24 24" width="56" height="56" fill="currentColor">
          <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
        </svg>
        <h3>No tracks here</h3>
        <p>This playlist currently has no songs.</p>
      </div>
    )
  }

  return (
    <div className="spotify-tracklist-container" data-testid="track-list">
      {/* Table Column Headers: Number, Title, Duration */}
      <div className="spotify-table-header">
        <div className="col-num">#</div>
        <div className="col-title">Title</div>
        <div className="col-duration">
          <ClockIcon />
        </div>
      </div>
 
      {/* Table Song Rows */}
      {tracks.map((track, idx) => {
        const isActive          = idx === currentIndex
        const isCurrentlyPlaying = isActive && isPlaying
        const dur = durations[track.path]
        const isFav = favorites.includes(track.path)
        const artistName = track.artist || track.playlist || 'Sangita Artist'
 
        return (
          <div
            key={track.id || idx}
            className={`spotify-track-row ${isActive ? 'active' : ''}`}
            onClick={() => onPlayTrack(track, idx)}
            style={{ animationDelay: `${Math.min(idx * 25, 500)}ms` }}
            data-testid={`track-row-${idx}`}
          >
            {/* Number / Play Indicator Column */}
            <div className="col-num">
              {isCurrentlyPlaying ? (
                <PlayingBars />
              ) : (
                <>
                  <span className="row-num-label">{idx + 1}</span>
                  <button className="row-play-btn" title="Play">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                  </button>
                </>
              )}
            </div>
 
            {/* Title + Thumbnail + Artist Column */}
            <div className="col-title">
              <TrackRowThumb track={track} token={token} />
              <div className="track-text-group">
                <div className={`track-title-text ${isActive ? 'active-title' : ''}`}>
                  {track.name}
                </div>
                <div className="track-artist-text">
                  {artistName}
                </div>
              </div>
            </div>
 
            {/* Actions & Duration Column */}
            <div className="col-duration">
              <div className="track-row-actions">
                {onAddToPlaylist && (
                  <button
                    className="btn-icon track-row-add-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      onAddToPlaylist(track)
                    }}
                    title="Add to playlist"
                    data-testid={`track-row-add-${idx}`}
                  >
                    <PlusIcon width={16} height={16} />
                  </button>
                )}
                {onToggleFavorite && (
                  <button
                    className={`btn-icon track-row-like-btn ${isFav ? 'active' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      onToggleFavorite(track.path)
                    }}
                    title={isFav ? "Remove from Favorites" : "Add to Favorites"}
                    data-testid={`track-row-like-${idx}`}
                  >
                    <HeartIcon filled={isFav} />
                  </button>
                )}
              </div>
              <div className="track-duration-timestamp">
                {fmtDur(dur)}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

import React, { useState } from 'react'

function strHue(str) {
  let h = 0
  for (const c of (str || '')) h = (h * 31 + c.charCodeAt(0)) | 0
  return Math.abs(h) % 360
}

function formatTotalDuration(tracks = [], durations = {}) {
  let totalSec = 0
  for (const t of tracks) {
    if (durations[t.path]) {
      totalSec += durations[t.path]
    }
  }
  const count = tracks.length
  if (totalSec <= 0) {
    return `${count} song${count !== 1 ? 's' : ''}`
  }
  const hrs = Math.floor(totalSec / 3600)
  const mins = Math.floor((totalSec % 3600) / 60)
  if (hrs > 0) {
    return `${count} song${count !== 1 ? 's' : ''}, about ${hrs} hr ${mins} min`
  }
  return `${count} song${count !== 1 ? 's' : ''}, ${mins} min`
}

function HeroArt({ playlistName, tracks = [], token }) {
  const [imgErr, setImgErr] = useState(false)
  const firstTrackPath = tracks[0]?.path
  const coverUrl = firstTrackPath
    ? `/api/cover/${firstTrackPath.split('/').map(encodeURIComponent).join('/')}?token=${encodeURIComponent(token || '')}&v=2`
    : playlistName
    ? `/api/cover/${encodeURIComponent(playlistName)}?token=${encodeURIComponent(token || '')}&v=2`
    : null

  if (playlistName === 'Favorites') {
    return (
      <div
        className="hero-art hero-art-fav"
        style={{
          width: 192,
          height: 192,
          minWidth: 192,
          maxWidth: 192,
          minHeight: 192,
          maxHeight: 192,
          flexShrink: 0,
          borderRadius: 6,
          background: 'linear-gradient(135deg, #10B981 0%, #047857 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 12px 36px rgba(0, 0, 0, 0.55)'
        }}
      >
        <svg viewBox="0 0 24 24" width="72" height="72" fill="#FFFFFF">
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
        </svg>
      </div>
    )
  }

  // If playlist has 4+ tracks, show 4-quad collage like Spotify
  if (tracks.length >= 4 && !imgErr && token) {
    const quadTracks = tracks.slice(0, 4)
    return (
      <div
        className="hero-art hero-art-quad-grid"
        style={{
          width: 192,
          height: 192,
          minWidth: 192,
          maxWidth: 192,
          minHeight: 192,
          maxHeight: 192,
          flexShrink: 0,
          borderRadius: 6,
          overflow: 'hidden',
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gridTemplateRows: 'repeat(2, minmax(0, 1fr))',
          boxShadow: '0 12px 36px rgba(0, 0, 0, 0.55)'
        }}
      >
        {quadTracks.map((t, i) => (
          <div key={t.path || i} className="hero-quad-cell" style={{ width: '100%', height: '100%', overflow: 'hidden', minWidth: 0, minHeight: 0, position: 'relative' }}>
            <img
              src={`/api/cover/${t.path.split('/').map(encodeURIComponent).join('/')}?token=${encodeURIComponent(token || '')}&v=2`}
              alt=""
              onError={() => setImgErr(true)}
              className="hero-quad-img"
              style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', transform: 'scale(1.2)', display: 'block' }}
            />
          </div>
        ))}
      </div>
    )
  }

  if (!imgErr && coverUrl && token) {
    return (
      <div
        className="hero-art hero-art-cover"
        style={{
          width: 192,
          height: 192,
          minWidth: 192,
          maxWidth: 192,
          minHeight: 192,
          maxHeight: 192,
          flexShrink: 0,
          borderRadius: 6,
          overflow: 'hidden',
          boxShadow: '0 12px 36px rgba(0, 0, 0, 0.55)'
        }}
      >
        <img
          src={coverUrl}
          key={firstTrackPath || playlistName}
          alt={playlistName || 'Cover'}
          onError={() => setImgErr(true)}
          className="hero-cover-single"
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', display: 'block' }}
        />
      </div>
    )
  }

  const hue = strHue(playlistName || 'Library')
  return (
    <div
      className="hero-art hero-art-placeholder"
      style={{
        width: 192,
        height: 192,
        minWidth: 192,
        maxWidth: 192,
        minHeight: 192,
        maxHeight: 192,
        flexShrink: 0,
        borderRadius: 6,
        background: `linear-gradient(135deg, hsl(${hue}, 55%, 28%), hsl(${(hue + 60) % 360}, 50%, 14%))`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 12px 36px rgba(0, 0, 0, 0.55)'
      }}
    >
      <svg viewBox="0 0 24 24" width="56" height="56" fill="var(--emerald)">
        <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
      </svg>
    </div>
  )
}

export default function Hero({
  playlistName,
  tracks = [],
  isPlaying,
  isShuffle,
  onPlay,
  onShuffle,
  onDownload,
  onAddToPlaylist,
  username = 'admin',
  durations = {},
  token
}) {
  const count = tracks.length
  const hue = strHue(playlistName || 'Library')

  return (
    <div
      className="hero-container"
      style={{
        '--hero-accent-hue': `${hue}deg`,
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        padding: '28px 32px 16px',
        background: `linear-gradient(180deg, hsl(${hue}, 45%, 22%) 0%, hsl(${hue}, 40%, 12%) 65%, transparent 100%)`
      }}
      data-testid="hero-banner"
    >
      {/* Top Banner Header: Left Art + Right Metadata */}
      <div className="hero-header-content" style={{ display: 'flex', alignItems: 'flex-end', gap: '24px', width: '100%', minWidth: 0 }}>
        <HeroArt playlistName={playlistName || 'Library'} tracks={tracks} token={token} />

        <div className="hero-meta" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', flex: 1, minWidth: 0, textAlign: 'left', marginBottom: '2px' }}>
          <span className="hero-tag" style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#FFFFFF', opacity: 0.9, marginBottom: '2px' }}>
            Public Playlist
          </span>
          <h1 className="hero-title" title={playlistName || 'Library'} style={{ fontSize: 'clamp(2rem, 5vw, 3.8rem)', fontWeight: 800, lineHeight: 1.05, letterSpacing: '-0.04em', color: '#FFFFFF', margin: '4px 0 10px', wordBreak: 'break-word' }}>
            {playlistName || 'Library'}
          </h1>
          <div className="hero-creator-row" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.88rem', color: '#FFFFFF', fontWeight: 500 }}>
            <div className="hero-avatar" style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--emerald)', color: '#000000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, flexShrink: 0 }}>
              {(username || 'A')[0].toUpperCase()}
            </div>
            <span className="hero-creator-name" style={{ fontWeight: 700, color: '#FFFFFF' }}>{username || 'Admin'}</span>
            <span className="hero-dot" style={{ opacity: 0.6, fontWeight: 400 }}>•</span>
            <span className="hero-stats" style={{ opacity: 0.85, fontWeight: 400, color: 'var(--text-dim)' }}>
              {formatTotalDuration(tracks, durations)}
            </span>
          </div>
        </div>
      </div>

      {/* Action Bar (Below Header, Above Table) */}
      <div className="hero-action-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0 4px', position: 'relative', zIndex: 1 }}>
        <div className="hero-action-left" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            className="btn-hero-play"
            onClick={onPlay}
            title={isPlaying ? "Pause" : "Play"}
            data-testid="hero-play-btn"
            style={{ width: 56, height: 56, borderRadius: '50%', background: '#1ed760', border: 'none', color: '#000000', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 8px 24px rgba(30, 215, 96, 0.4)', flexShrink: 0 }}
          >
            {isPlaying ? (
              <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor" style={{ marginLeft: 3 }}>
                <path d="M8 5v14l11-7z"/>
              </svg>
            )}
          </button>

          <button
            className={`btn-action-icon ${isShuffle ? 'active glow' : ''}`}
            onClick={onShuffle}
            title={isShuffle ? 'Shuffle ON' : 'Shuffle OFF'}
            data-testid="hero-shuffle-btn"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4zM14.83 13.41l-1.41 1.41 2.13 2.13L13.5 19H19v-5.5l-2.04 2.04z"/>
            </svg>
          </button>

          <button
            className="btn-action-icon"
            onClick={onDownload}
            title="Download current track"
            data-testid="hero-download-btn"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
            </svg>
          </button>

          {onAddToPlaylist && tracks.length > 0 && (
            <button
              className="btn-action-pill"
              onClick={() => onAddToPlaylist(tracks[0])}
              title="Add songs to playlist"
              data-testid="hero-add-pill-btn"
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M12 5v14M5 12h14"/>
              </svg>
              <span>Add</span>
            </button>
          )}

          <button
            className={`btn-action-pill ${isShuffle ? 'active' : ''}`}
            onClick={onShuffle}
            title="Shuffle Mix"
            data-testid="hero-mix-pill-btn"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="16 3 21 3 21 8"/>
              <line x1="4" y1="20" x2="21" y2="3"/>
              <polyline points="21 16 21 21 16 21"/>
              <line x1="15" y1="15" x2="21" y2="21"/>
              <line x1="4" y1="4" x2="9" y2="9"/>
            </svg>
            <span>Mix</span>
          </button>
        </div>

        <div className="hero-action-right">
          <div className="view-format-indicator">
            <span>List</span>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z"/>
            </svg>
          </div>
        </div>
      </div>
    </div>
  )
}
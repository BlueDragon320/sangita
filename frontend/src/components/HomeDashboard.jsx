import React, { useState } from 'react'
import ListeningGraph from './ListeningGraph.jsx'

function formatTime(sec) {
  if (!sec || isNaN(sec)) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s < 10 ? '0' : ''}${s}`
}

function formatListeningTime(sec) {
  if (!sec || sec <= 0) return '0 min'
  const hours = Math.floor(sec / 3600)
  const mins = Math.floor((sec % 3600) / 60)
  if (hours > 0) {
    return `${hours}h ${mins}m`
  }
  return `${mins} min`
}

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

function HeartIcon({ filled }) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
      <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
    </svg>
  )
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
      <path d="M8 5v14l11-7z"/>
    </svg>
  )
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
    </svg>
  )
}

function DashboardTrackThumb({ path, token, size = 40 }) {
  const [imgErr, setImgErr] = useState(false)
  const coverUrl = path
    ? `/api/cover/${path.split('/').map(encodeURIComponent).join('/')}?token=${encodeURIComponent(token || '')}&v=2`
    : null

  if (!imgErr && coverUrl && token) {
    return (
      <div className="home-track-thumb" style={{ width: size, height: size }}>
        <img
          src={coverUrl}
          key={path}
          alt=""
          className="home-track-img"
          onError={() => setImgErr(true)}
        />
      </div>
    )
  }
  return (
    <div className="home-track-thumb home-track-fallback" style={{ width: size, height: size }}>
      <svg viewBox="0 0 24 24" width={Math.round(size * 0.45)} height={Math.round(size * 0.45)} fill="var(--text-dim)">
        <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
      </svg>
    </div>
  )
}

export default function HomeDashboard({
  username,
  stats,
  loading = false,
  onPlayTrack,
  isPlaying,
  currentTrack,
  onOpenCreatePlaylist,
  onSaveTop10Playlist,
  onQuickShuffle,
  token,
  favorites = [],
  onToggleFavorite,
  onAddToPlaylist,
  durations = {}
}) {
  const [insightsExpanded, setInsightsExpanded] = useState(true)

  if (loading) {
    return (
      <div className="home-dashboard home-loading-state" data-testid="home-dashboard" aria-busy="true">
        {/* Skeleton Compact Header */}
        <div className="home-hero skeleton-box">
          <div className="skeleton-line" style={{ width: 140, height: 12, marginBottom: 12, borderRadius: 4 }} />
          <div className="skeleton-line" style={{ width: 320, height: 32, marginBottom: 10, borderRadius: 6 }} />
          <div className="skeleton-line" style={{ width: 220, height: 14, marginBottom: 20, borderRadius: 4 }} />
          <div className="home-quick-actions">
            <div className="skeleton-pill" style={{ width: 130, height: 36, borderRadius: 9999 }} />
            <div className="skeleton-pill" style={{ width: 130, height: 36, borderRadius: 9999 }} />
          </div>
        </div>

        {/* Skeleton Jump Back In */}
        <section className="home-section">
          <div className="skeleton-line" style={{ width: 160, height: 22, marginBottom: 16, borderRadius: 4 }} />
          <div className="home-jump-back-grid">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="home-jump-card skeleton-card">
                <div className="skeleton-thumb" style={{ width: 54, height: 54, borderRadius: 6 }} />
                <div className="home-jump-info">
                  <div className="skeleton-line" style={{ width: '75%', height: 14, marginBottom: 8, borderRadius: 3 }} />
                  <div className="skeleton-line" style={{ width: '45%', height: 12, borderRadius: 3 }} />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Skeleton Most Played */}
        <section className="home-section">
          <div className="skeleton-line" style={{ width: 140, height: 22, marginBottom: 16, borderRadius: 4 }} />
          <div className="home-top-tracks-table skeleton-table">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="skeleton-row" style={{ height: 48, margin: '6px 0', borderRadius: 6 }} />
            ))}
          </div>
        </section>
      </div>
    )
  }

  const greeting = getGreeting()
  const topTracks = stats?.top_tracks || []
  const recentlyPlayed = stats?.recently_played || []
  const topArtists = stats?.top_artists || []
  const totalSeconds = stats?.total_seconds || 0
  const uniqueTracks = stats?.unique_tracks || 0
  const totalPlays = stats?.total_plays || 0
  const topSong = topTracks[0]

  return (
    <div className="home-dashboard" data-testid="home-dashboard">
      {/* 1. COMPACT GREETING HEADER & QUICK ACTIONS */}
      <div className="home-hero">
        <div className="home-hero-content">
          <div className="home-greeting-tag">Your Personal Hub</div>
          <h1 className="home-greeting-title" data-testid="home-greeting">
            {greeting}, <span className="home-username">{username || 'Blue'}</span>
          </h1>
          <p className="home-greeting-sub">
            Pick up where you left off, rediscover your most played songs, or shuffle your library.
          </p>

          <div className="home-quick-actions">
            <button
              className="btn-home-action primary"
              onClick={onQuickShuffle}
              data-testid="home-quick-shuffle-btn"
              title="Quickly shuffle all songs"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/>
              </svg>
              <span>Quick Shuffle</span>
            </button>

            <button
              className="btn-home-action secondary"
              onClick={onOpenCreatePlaylist}
              data-testid="home-create-playlist-btn"
              title="Create a new playlist"
            >
              <PlusIcon />
              <span>New Playlist</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. JUMP BACK IN (RECENTLY PLAYED - PROMINENT 1-CLICK PLAY CARDS) */}
      <section className="home-section" data-testid="home-recently-played-section">
        <div className="home-section-header">
          <div className="home-section-title-group">
            <h2 className="home-section-title">Jump Back In</h2>
            <span className="home-section-subtitle">Pick up right where you left off</span>
          </div>
        </div>

        {recentlyPlayed.length === 0 ? (
          <div className="home-empty-box">
            <svg viewBox="0 0 24 24" width="36" height="36" fill="var(--text-dim)" style={{ opacity: 0.4 }}>
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
            </svg>
            <h4>No recently played tracks yet</h4>
            <p>Start listening to songs to quickly resume playback here!</p>
          </div>
        ) : (
          <div className="home-jump-back-grid">
            {recentlyPlayed.slice(0, 6).map((r, i) => {
              const isThisPlaying = isPlaying && currentTrack?.path === r.path
              return (
                <div
                  key={r.path || i}
                  className={`home-jump-card ${isThisPlaying ? 'active' : ''}`}
                  onClick={() => onPlayTrack(r, r.playlist, recentlyPlayed)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onPlayTrack(r, r.playlist, recentlyPlayed)
                    }
                  }}
                  title={`Play ${r.name}`}
                  data-testid={`home-recent-card-${i}`}
                >
                  <DashboardTrackThumb path={r.path} token={token} size={54} />
                  <div className="home-jump-info">
                    <span className="home-jump-name">{r.name}</span>
                    <span className="home-jump-artist">{r.artist}</span>
                  </div>
                  <button
                    className={`btn-icon home-jump-play-btn ${isThisPlaying ? 'playing' : ''}`}
                    title={isThisPlaying ? "Pause" : "Play"}
                    aria-label={`Play ${r.name}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      onPlayTrack(r, r.playlist, recentlyPlayed)
                    }}
                  >
                    {isThisPlaying ? <PauseIcon /> : <PlayIcon />}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* 3. MOST PLAYED (TOP TRACKS) TABLE WITH SAVE AS PLAYLIST ACTION */}
      <section className="home-section" data-testid="home-top-tracks-section">
        <div className="home-section-header">
          <div className="home-section-title-group">
            <h2 className="home-section-title">Your Top 10 Most Played Songs</h2>
            <span className="home-section-subtitle">Ranked by your personal playback frequency</span>
          </div>

          {topTracks.length > 0 && (
            <button
              className="btn-home-action secondary compact"
              onClick={onSaveTop10Playlist}
              data-testid="home-save-top10-btn"
              title="Create a new playlist with your Top 10 songs"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
              </svg>
              <span>Save as Playlist</span>
            </button>
          )}
        </div>

        {topTracks.length === 0 ? (
          <div className="home-empty-box">
            <svg viewBox="0 0 24 24" width="36" height="36" fill="var(--text-dim)" style={{ opacity: 0.4 }}>
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
            </svg>
            <h4>No listening stats yet</h4>
            <p>Start listening to songs to generate your personalized Top 10!</p>
          </div>
        ) : (
          <div className="home-top-tracks-table" data-testid="home-top-tracks">
            <div className="home-table-header">
              <span className="col-rank">#</span>
              <span className="col-track">Title</span>
              <span className="col-plays">Plays</span>
              <span className="col-dur">Time</span>
            </div>

            {topTracks.map((t, idx) => {
              const isThisPlaying = isPlaying && currentTrack?.path === t.path
              const isFav = favorites.includes(t.path)

              return (
                <div
                  key={t.path || idx}
                  className={`home-track-row ${isThisPlaying ? 'active' : ''}`}
                  onClick={() => onPlayTrack(t, t.playlist, topTracks)}
                  data-testid={`home-top-track-${idx}`}
                >
                  {/* Rank Badge */}
                  <div className="col-rank">
                    <span className={`rank-badge ${idx < 3 ? `rank-top rank-${idx + 1}` : ''}`}>
                      {idx + 1}
                    </span>
                    <button
                      className="row-play-btn"
                      onClick={(e) => {
                        e.stopPropagation()
                        onPlayTrack(t, t.playlist, topTracks)
                      }}
                      aria-label={isThisPlaying ? "Pause" : "Play"}
                    >
                      {isThisPlaying ? <PauseIcon /> : <PlayIcon />}
                    </button>
                  </div>

                  {/* Title & Artist */}
                  <div className="col-track">
                    <DashboardTrackThumb path={t.path} token={token} size={40} />
                    <div className="home-track-names">
                      <span className={`home-track-title ${isThisPlaying ? 'active' : ''}`}>
                        {t.name}
                      </span>
                      <span className="home-track-artist">{t.artist}</span>
                    </div>
                  </div>

                  {/* Play Count Badge */}
                  <div className="col-plays">
                    <span className="play-count-badge">
                      {t.play_count} {t.play_count === 1 ? 'play' : 'plays'}
                    </span>
                  </div>

                  {/* Duration & Actions */}
                  <div className="col-dur">
                    <div className="home-row-actions">
                      <button
                        className={`btn-icon home-action-btn ${isFav ? 'active' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          onToggleFavorite && onToggleFavorite(t.path)
                        }}
                        title={isFav ? "Remove Favorite" : "Add Favorite"}
                        aria-label={isFav ? "Remove Favorite" : "Add Favorite"}
                      >
                        <HeartIcon filled={isFav} />
                      </button>
                      <button
                        className="btn-icon home-action-btn"
                        onClick={(e) => {
                          e.stopPropagation()
                          onAddToPlaylist && onAddToPlaylist(t)
                        }}
                        title="Add to Playlist"
                        aria-label="Add to Playlist"
                      >
                        <PlusIcon />
                      </button>
                    </div>
                    <span className="home-track-duration">
                      {formatTime(durations[t.path] || t.total_seconds)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* 4. TOP ARTISTS ROW */}
      <section className="home-section" data-testid="home-top-artists-section">
        <div className="home-section-header">
          <div className="home-section-title-group">
            <h2 className="home-section-title">Top Artists</h2>
            <span className="home-section-subtitle">Your most played artists across all sessions</span>
          </div>
        </div>

        {topArtists.length === 0 ? (
          <p className="home-empty-text">Play more songs to see your top artists.</p>
        ) : (
          <div className="home-artists-grid">
            {topArtists.map((a, i) => (
              <div key={i} className="home-artist-card">
                <div className="artist-badge-avatar">
                  {a.artist.charAt(0).toUpperCase()}
                </div>
                <div className="artist-card-info">
                  <span className="artist-name">{a.artist}</span>
                  <span className="artist-plays">{a.play_count} plays • {a.tracks} tracks</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 5. LISTENING INSIGHTS & ACTIVITY (QUIETER SUPPORTING SECTION AT THE BOTTOM) */}
      <section className="home-section home-insights-section">
        <button
          type="button"
          className="home-insights-header"
          onClick={() => setInsightsExpanded(prev => !prev)}
          aria-expanded={insightsExpanded}
        >
          <div className="home-insights-title-group">
            <div className="home-insights-icon">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/>
              </svg>
            </div>
            <div className="home-insights-text">
              <h3 className="home-insights-heading">Listening Insights & Activity</h3>
              <span className="home-insights-sub">Personal playback metrics and listening trends over time</span>
            </div>
          </div>
          <div className={`home-insights-chevron ${insightsExpanded ? 'open' : ''}`}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/>
            </svg>
          </div>
        </button>

        {insightsExpanded && (
          <div className="home-insights-body">
            {/* PERSONAL METRICS / STATS CARDS */}
            <div className="home-stats-grid">
              <div className="home-stat-card" data-testid="home-stat-time">
                <div className="stat-card-icon time">
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                    <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
                  </svg>
                </div>
                <div className="stat-card-info">
                  <span className="stat-card-label">Listening Time</span>
                  <span className="stat-card-value">{formatListeningTime(totalSeconds)}</span>
                </div>
              </div>

              <div className="home-stat-card" data-testid="home-stat-plays">
                <div className="stat-card-icon plays">
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                    <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                  </svg>
                </div>
                <div className="stat-card-info">
                  <span className="stat-card-label">Songs Played</span>
                  <span className="stat-card-value">{totalPlays}</span>
                </div>
              </div>

              <div className="home-stat-card" data-testid="home-stat-tracks">
                <div className="stat-card-icon unique">
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 14.5c-2.49 0-4.5-2.01-4.5-4.5S9.51 7.5 12 7.5s4.5 2.01 4.5 4.5-2.01 4.5-4.5 4.5zm0-5.5c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1z"/>
                  </svg>
                </div>
                <div className="stat-card-info">
                  <span className="stat-card-label">Tracks Explored</span>
                  <span className="stat-card-value">{uniqueTracks}</span>
                </div>
              </div>

              <div className="home-stat-card">
                <div className="stat-card-icon top">
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                    <path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94A5.01 5.01 0 0 0 11 15.9V19H7v2h10v-2h-4v-3.1a5.01 5.01 0 0 0 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z"/>
                  </svg>
                </div>
                <div className="stat-card-info">
                  <span className="stat-card-label">#1 Top Song</span>
                  <span className="stat-card-value highlight" title={topSong?.name || 'Play some music'}>
                    {topSong ? topSong.name : 'No plays yet'}
                  </span>
                </div>
              </div>
            </div>

            {/* LISTENING ACTIVITY LINEAR GRAPH */}
            <ListeningGraph token={token} />
          </div>
        )}
      </section>
    </div>
  )
}

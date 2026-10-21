import React, { useState, useEffect, useCallback } from 'react'

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let b = Number(bytes)
  for (let i = 0; i < units.length; i++) {
    if (b < 1024 || i === units.length - 1) {
      return `${i === 0 ? b : b.toFixed(1)} ${units[i]}`
    }
    b /= 1024
  }
  return `${b.toFixed(1)} PB`
}

function RightPanel({
  track,
  playlist,
  isPlaying,
  duration,
  formatTime,
  onClose,
  onTogglePlay,
  onDownload,
  token,
  username,
  isFavorite = false,
  onToggleFavorite,
  onAddToPlaylist
}) {
  const [imgErr, setImgErr] = useState(false)
  const [dataUsage, setDataUsage] = useState({
    todayBytes: 0,
    formattedToday: '0 B',
    totalBytes: 0,
    formattedTotal: '0 B',
    requests: 0
  })

  const fetchDataUsage = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetch('/api/user/data-usage', {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setDataUsage({
          todayBytes: data.today?.bytes || 0,
          formattedToday: data.today?.formatted || formatBytes(data.today?.bytes || 0),
          totalBytes: data.total?.bytes || 0,
          formattedTotal: data.total?.formatted || formatBytes(data.total?.bytes || 0),
          requests: data.today?.requests || 0
        })
      }
    } catch {
      // silently ignore network errors
    }
  }, [token])

  useEffect(() => {
    fetchDataUsage()
    const pollInterval = setInterval(fetchDataUsage, isPlaying ? 6000 : 25000)
    return () => clearInterval(pollInterval)
  }, [fetchDataUsage, isPlaying, track?.path])

  if (!track) return null

  const fileExt = (track.path || '').split('.').pop().toUpperCase() || 'AUDIO'
  const coverUrl = track.path ? `/api/cover/${track.path.split('/').map(encodeURIComponent).join('/')}?token=${encodeURIComponent(token || '')}&v=2` : null

  return (
    <aside className="right-panel" data-testid="right-panel">
      <div className="right-panel-header">
        <span className="right-panel-context" title={playlist || 'Library'}>
          {playlist || 'Library'}
        </span>
        <button className="btn-icon right-panel-close" onClick={onClose} title="Close Panel" data-testid="right-panel-close">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>
      </div>

      <div className="right-panel-content">
        {/* Large Cinematic Cover Visual with Embedded Cover Art (80% Visual, 20% Meta) */}
        <div className="now-playing-art-card">
          <div className="now-playing-art-visual">
            {!imgErr && coverUrl ? (
              <img
                src={coverUrl}
                alt={track.name}
                key={track.path}
                className="now-playing-cover-img"
                onError={() => setImgErr(true)}
              />
            ) : (
              <div className="now-playing-art-circle">
                <svg viewBox="0 0 24 24" width="44" height="44" fill="var(--emerald)">
                  <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                </svg>
              </div>
            )}
            {isPlaying && (
              <div className="now-playing-equalizer-pill">
                <span className="eq-bar" />
                <span className="eq-bar" />
                <span className="eq-bar" />
              </div>
            )}
          </div>

          <div className="now-playing-track-meta">
            <div className="now-playing-info">
              <span className="now-playing-tag">NOW PLAYING</span>
              <h3 className="now-playing-title" title={track.name}>
                {track.name}
              </h3>
              <p className="now-playing-artist">
                {track.playlist || playlist || 'Sangita Audio'}
              </p>
            </div>
            <div className="now-playing-actions">
              {onAddToPlaylist && (
                <button
                  className="btn-icon"
                  onClick={() => onAddToPlaylist(track)}
                  title="Add to Playlist"
                  data-testid="right-panel-add"
                >
                  <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 5v14M5 12h14"/>
                  </svg>
                </button>
              )}
              {onToggleFavorite && (
                <button
                  className={`btn-icon ${isFavorite ? 'active' : ''}`}
                  onClick={() => onToggleFavorite(track.path)}
                  title={isFavorite ? "Remove from Favorites" : "Add to Favorites"}
                  data-testid="right-panel-like"
                >
                  <svg viewBox="0 0 24 24" width="17" height="17" fill={isFavorite ? "var(--emerald)" : "none"} stroke="currentColor" strokeWidth={isFavorite ? "0" : "2"}>
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                  </svg>
                </button>
              )}
              <button className="btn-icon" onClick={onDownload} title="Download song" data-testid="right-panel-download">
                <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor">
                  <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Audio Information Card (Kept exactly as requested) */}
        <div className="now-playing-artist-card">
          <h4 className="artist-card-title">TRACK METRICS</h4>
          <div className="artist-card-body">
            <div className="artist-avatar-wrapper">
              <div className="artist-avatar">
                {track.name.slice(0, 2).toUpperCase()}
              </div>
            </div>
            <div className="artist-info">
              <div className="artist-name-row">
                <span className="artist-name">{track.playlist || 'Local Library'}</span>
                <span className="verified-badge" title="Source verified">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="var(--emerald)">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                  </svg>
                </span>
              </div>
              <p className="artist-sub">{fileExt} Stream</p>
            </div>
          </div>
          
          <div className="track-stats-pills">
            <div className="stat-pill">
              <span className="stat-pill-label">FORMAT</span>
              <span className="stat-pill-value">{fileExt}</span>
            </div>
            <div className="stat-pill">
              <span className="stat-pill-label">LENGTH</span>
              <span className="stat-pill-value">{formatTime(duration)}</span>
            </div>
          </div>
        </div>

        {/* Data Consumed Card (Replaces Device Sync) */}
        <div className="now-playing-data-card" data-testid="right-panel-data-usage">
          <div className="data-card-header">
            <div className="data-card-title-row">
              <h4 className="artist-card-title">DATA USAGE</h4>
            </div>
          </div>
          
          <div className="data-usage-metric">
            <div className="data-usage-hero">
              <span className="data-usage-num">{dataUsage.formattedToday}</span>
              <span className="data-usage-unit">consumed today</span>
            </div>
          </div>

          <div className="track-stats-pills">
            <div className="stat-pill">
              <span className="stat-pill-label">TODAY</span>
              <span className="stat-pill-value">{dataUsage.formattedToday}</span>
            </div>
            <div className="stat-pill">
              <span className="stat-pill-label">ALL TIME</span>
              <span className="stat-pill-value">{dataUsage.formattedTotal}</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}

export default React.memo(RightPanel)

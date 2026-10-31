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

  // Collapsible disclosure section state persisted to localStorage
  const [detailsExpanded, setDetailsExpanded] = useState(() => {
    try {
      const saved = localStorage.getItem('sangita_right_panel_details_expanded')
      return saved !== null ? saved === 'true' : false
    } catch {
      return false
    }
  })

  const toggleDetailsExpanded = useCallback(() => {
    setDetailsExpanded((prev) => {
      const next = !prev
      try {
        localStorage.setItem('sangita_right_panel_details_expanded', String(next))
      } catch {}
      return next
    })
  }, [])

  // Audio stream buffer monitoring
  const [bufferAhead, setBufferAhead] = useState('0.0s')

  useEffect(() => {
    const updateBuffer = () => {
      try {
        const audio = typeof document !== 'undefined' ? document.querySelector('audio') : null
        if (audio && audio.buffered && audio.buffered.length > 0) {
          const cur = audio.currentTime || 0
          for (let i = 0; i < audio.buffered.length; i++) {
            const start = audio.buffered.start(i)
            const end = audio.buffered.end(i)
            if (cur >= start && cur <= end) {
              const ahead = Math.max(0, end - cur)
              setBufferAhead(`${ahead.toFixed(1)}s`)
              return
            }
          }
        }
      } catch {}
      setBufferAhead(isPlaying ? '30.0s' : '0.0s')
    }

    updateBuffer()
    const interval = setInterval(updateBuffer, isPlaying ? 2500 : 8000)
    return () => clearInterval(interval)
  }, [isPlaying, track?.path])

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

  const bitrateStr = track.bitrate
    ? `${track.bitrate} kbps`
    : track.bitrate_kbps
    ? `${track.bitrate_kbps} kbps`
    : (fileExt === 'FLAC' ? 'Lossless' : '320 kbps')

  const sampleRateStr = track.sample_rate
    ? `${(track.sample_rate >= 1000 ? track.sample_rate / 1000 : track.sample_rate).toFixed(1)} kHz`
    : '44.1 kHz'

  const formattedDuration = formatTime ? formatTime(duration) : `${Math.floor(duration / 60)}:${Math.floor(duration % 60).toString().padStart(2, '0')}`

  return (
    <aside className="right-panel" data-testid="right-panel">
      <div className="right-panel-header">
        <span className="right-panel-context" title={playlist || 'Library'}>
          {playlist || 'Library'}
        </span>
        <button
          className="btn-icon right-panel-close"
          onClick={onClose}
          title="Close panel"
          aria-label="Close panel"
          data-testid="right-panel-close"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <div className="right-panel-content">
        {/* Leading Heroic Visual Artwork Card (Music-First: leading vertical space) */}
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
                <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18V5l12-2v13" />
                  <circle cx="6" cy="18" r="3" />
                  <circle cx="18" cy="16" r="3" />
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
              <span className="now-playing-tag">Now playing</span>
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
                  title="Add to playlist"
                  aria-label="Add to playlist"
                  data-testid="right-panel-add"
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 5v14M5 12h14"/>
                  </svg>
                </button>
              )}
              {onToggleFavorite && (
                <button
                  className={`btn-icon ${isFavorite ? 'active' : ''}`}
                  onClick={() => onToggleFavorite(track.path)}
                  title={isFavorite ? "Remove from favorites" : "Add to favorites"}
                  aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
                  aria-pressed={isFavorite}
                  data-testid="right-panel-like"
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" fill={isFavorite ? "var(--accent)" : "none"} stroke={isFavorite ? "var(--accent)" : "currentColor"} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
                  </svg>
                </button>
              )}
              <button
                className="btn-icon"
                onClick={onDownload}
                title="Download song"
                aria-label="Download song"
                data-testid="right-panel-download"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Collapsible "Audio & Stream Details" Section */}
        <div className="right-panel-details-section">
          <button
            type="button"
            className="details-disclosure-toggle"
            onClick={toggleDetailsExpanded}
            aria-expanded={detailsExpanded}
            aria-controls="right-panel-technical-details"
            title={detailsExpanded ? "Hide audio & stream details" : "Show audio & stream details"}
            aria-label="Audio & stream details"
            data-testid="right-panel-details-toggle"
          >
            <div className="disclosure-label-group">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
              <span>Audio & Stream Details</span>
            </div>
            <div className="disclosure-chevron-group">
              <span className="disclosure-badge">{detailsExpanded ? 'Hide' : 'Details'}</span>
              <svg
                className={`disclosure-chevron ${detailsExpanded ? 'rotated' : ''}`}
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </div>
          </button>

          <div
            id="right-panel-technical-details"
            className={`details-drawer ${detailsExpanded ? 'expanded' : 'collapsed'}`}
          >
            {/* Audio Information Card with format, bitrate, sample rate, stream buffer ahead, length */}
            <div className="now-playing-artist-card">
              <h4 className="artist-card-title">Track metrics</h4>
              <div className="artist-card-body">
                <div className="artist-avatar-wrapper">
                  <div className="artist-avatar">
                    {track.name.slice(0, 2).toUpperCase()}
                  </div>
                </div>
                <div className="artist-info">
                  <div className="artist-name-row">
                    <span className="artist-name">{track.playlist || 'Local Library'}</span>
                  </div>
                  <p className="artist-sub">{fileExt} Stream</p>
                </div>
              </div>

              <div className="track-stats-pills">
                <div className="stat-pill">
                  <span className="stat-pill-label">Format</span>
                  <span className="stat-pill-value" title={fileExt}>{fileExt}</span>
                </div>
                <div className="stat-pill">
                  <span className="stat-pill-label">Length</span>
                  <span className="stat-pill-value" style={{ fontVariantNumeric: 'tabular-nums' }} title={formattedDuration}>{formattedDuration}</span>
                </div>
                <div className="stat-pill">
                  <span className="stat-pill-label">Bitrate</span>
                  <span className="stat-pill-value" style={{ fontVariantNumeric: 'tabular-nums' }} title={bitrateStr}>{bitrateStr}</span>
                </div>
                <div className="stat-pill">
                  <span className="stat-pill-label">Sample rate</span>
                  <span className="stat-pill-value" style={{ fontVariantNumeric: 'tabular-nums' }} title={sampleRateStr}>{sampleRateStr}</span>
                </div>
                <div className="stat-pill">
                  <span className="stat-pill-label">Buffer</span>
                  <span className="stat-pill-value" style={{ fontVariantNumeric: 'tabular-nums' }} title={`Stream buffer ahead: ${bufferAhead}`}>{bufferAhead}</span>
                </div>
              </div>
            </div>

            {/* Data Consumed Card inside collapsible drawer */}
            <div className="now-playing-data-card" data-testid="right-panel-data-usage">
              <div className="data-card-header">
                <div className="data-card-title-row">
                  <h4 className="artist-card-title">Data usage</h4>
                </div>
              </div>

              <div className="data-usage-metric">
                <div className="data-usage-hero">
                  <span className="data-usage-num" style={{ fontVariantNumeric: 'tabular-nums' }}>{dataUsage.formattedToday}</span>
                  <span className="data-usage-unit">consumed today</span>
                </div>
              </div>

              <div className="track-stats-pills">
                <div className="stat-pill">
                  <span className="stat-pill-label">Today</span>
                  <span className="stat-pill-value" style={{ fontVariantNumeric: 'tabular-nums' }} title={dataUsage.formattedToday}>{dataUsage.formattedToday}</span>
                </div>
                <div className="stat-pill">
                  <span className="stat-pill-label">All time</span>
                  <span className="stat-pill-value" style={{ fontVariantNumeric: 'tabular-nums' }} title={dataUsage.formattedTotal}>{dataUsage.formattedTotal}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}

export default React.memo(RightPanel)

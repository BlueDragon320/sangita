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
 
export default function TrackList({ tracks, currentIndex, isPlaying, onPlayTrack, durations = {} }) {
  if (tracks.length === 0) {
    return (
      <div className="empty-state">
        <svg viewBox="0 0 24 24" width="56" height="56" fill="currentColor">
          <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
        </svg>
        <h3>No tracks here</h3>
        <p>This folder has no audio files.</p>
      </div>
    )
  }

  return (
    <div className="track-list-container">
      <div className="track-list-header">
        <div>#</div>
        <div>Title</div>
        <div style={{ textAlign: 'right' }}>Duration</div>
      </div>
 
      {tracks.map((track, idx) => {
        const isActive          = idx === currentIndex
        const isCurrentlyPlaying = isActive && isPlaying
        const dur = durations[track.path]
 
        return (
          <div
            key={track.id || idx}
            className={`track-row ${isActive ? 'active' : ''}`}
            onClick={() => onPlayTrack(track, idx)}
            style={{ animationDelay: `${Math.min(idx * 30, 600)}ms` }}
          >
            <div className="track-num">
              {isCurrentlyPlaying ? (
                <PlayingBars />
              ) : (
                <>
                  <span className="track-num-label">{idx + 1}</span>
                  <span className="track-num-icon">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                  </span>
                </>
              )}
            </div>
 
            <div className="track-info">
              <div className="track-name">{track.name}</div>
            </div>
 
            <div className="track-duration">
              {dur == null ? (
                <span style={{
                  display: 'inline-block',
                  width: 10, height: 10,
                  border: '2px solid var(--border-hi)',
                  borderTopColor: 'var(--accent)',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                  verticalAlign: 'middle',
                  opacity: 0.5,
                }} />
              ) : fmtDur(dur)}
            </div>
          </div>
        )
      })}
    </div>
  )
}

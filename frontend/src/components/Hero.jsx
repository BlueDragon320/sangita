const SHARE_URL = "https://your-domain.com"
 
function strHue(str) {
  let h = 0
  for (const c of str) h = (h * 31 + c.charCodeAt(0)) | 0
  return Math.abs(h) % 360
}
 
function ArtCollage({ name }) {
  const hue = strHue(name)
  const quads = [
    { bg: `hsl(${hue},50%,18%)`,           icon: true  },
    { bg: `hsl(${(hue+45)%360},45%,14%)`,  icon: false },
    { bg: `hsl(${(hue+90)%360},55%,16%)`,  icon: false },
    { bg: `hsl(${(hue+135)%360},40%,12%)`, icon: true  },
  ]
  return (
    <div className="hero-art">
      {quads.map((q, i) => (
        <div key={i} className="hero-art-quad" style={{ background: q.bg }}>
          {q.icon && (
            <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor">
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
            </svg>
          )}
        </div>
      ))}
    </div>
  )
}
 
export default function Hero({ playlistName, trackCount, isPlaying, isShuffle, onPlay, onShuffle, onDownload }) {
  const handleShare = () => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(SHARE_URL).then(() => alert(`Link copied!\n${SHARE_URL}`))
    } else {
      alert(`Your Sangita link:\n${SHARE_URL}`)
    }
  }
 
  return (
    <div className="hero">
      <ArtCollage name={playlistName || 'Library'} />
 
      <div className="hero-meta">
        <h1>{playlistName || 'Library'}</h1>
        <p className="hero-subtitle">
          Playlist · {trackCount} track{trackCount !== 1 ? 's' : ''}
        </p>
      </div>
 
      <div className="hero-share-url">
        <a href={SHARE_URL} target="_blank" rel="noopener noreferrer">
          {SHARE_URL}
        </a>
      </div>
 
      <div className="hero-actions">
        <button className="btn-circle" onClick={onDownload} title="Download current track">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
          </svg>
        </button>
 
        <button
          className={`btn-circle ${isShuffle ? 'active' : ''}`}
          onClick={onShuffle}
          title={isShuffle ? 'Shuffle ON' : 'Shuffle OFF'}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4zM14.83 13.41l-1.41 1.41 2.13 2.13L13.5 19H19v-5.5l-2.04 2.04z"/>
          </svg>
        </button>
 
        <button className="btn-hero-play" onClick={onPlay}>
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
 
        <button className="btn-circle" onClick={handleShare} title="Copy share link">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92S19.61 16.08 18 16.08z"/>
          </svg>
        </button>
      </div>
    </div>
  )
}

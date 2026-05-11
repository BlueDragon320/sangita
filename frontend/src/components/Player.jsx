const PrevIcon    = () => <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6 8.5 6V6z"/></svg>
const NextIcon    = () => <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
const PlayIcon    = () => <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
const PauseIcon   = () => <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
const VolumeIcon  = () => <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>
const MuteIcon    = () => <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3 3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4 9.91 6.09 12 8.18V4z"/></svg>
const ShuffleIcon = () => <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M10.59 9.17 5.41 4 4 5.41l5.17 5.17zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4zM14.83 13.41l-1.41 1.41 2.13 2.13L13.5 19H19v-5.5l-2.04 2.04z"/></svg>
const NoteIcon    = () => <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
 
function strHue(str) {
  let h = 0
  for (const c of (str || '')) h = (h * 31 + c.charCodeAt(0)) | 0
  return Math.abs(h) % 360
}
 
function sliderStyle(pct, width) {
  return {
    background: `linear-gradient(to right, var(--accent) ${pct}%, var(--border-hi) ${pct}%)`,
    height: 4,
    borderRadius: 2,
    flex: width ? undefined : 1,
    width: width || undefined,
    cursor: 'pointer',
  }
}
 
export default function Player({
  track, playlist, isPlaying, isShuffle,
  onTogglePlay, onNext, onPrev, onToggleShuffle,
  currentTime, duration, onSeek,
  volume, onVolumeChange, formatTime,
}) {
  const pct    = duration > 0 ? (currentTime / duration) * 100 : 0
  const hue    = strHue(playlist || '')
  const discBg = track
    ? `linear-gradient(135deg, hsl(${hue},55%,22%), hsl(${(hue + 50) % 360},55%,18%))`
    : 'var(--card)'
 
  return (
    <footer className="player">
      <div className={`player-left ${track ? '' : 'player-empty'}`}>
        <div className="player-disc" style={{ background: discBg }}>
          <NoteIcon />
        </div>
        <div className="player-info">
          <div className="player-title">{track ? track.name : 'Nothing playing'}</div>
          <div className="player-playlist">{track ? (track.playlist || playlist) : 'Select a track'}</div>
        </div>
      </div>
 
      <div className="player-center">
        <div className="player-controls">
          <button
            className="btn-icon"
            onClick={onToggleShuffle}
            title={isShuffle ? 'Shuffle ON' : 'Shuffle OFF'}
            style={{
              color:        isShuffle ? 'var(--accent)' : undefined,
              background:   isShuffle ? 'var(--accent-glow)' : undefined,
              border:       isShuffle ? '1px solid var(--accent)' : '1px solid transparent',
              borderRadius: '50%',
            }}
          >
            <ShuffleIcon />
          </button>
 
          <button className="btn-icon" onClick={onPrev}><PrevIcon /></button>
 
          <button className="btn-play-main" onClick={onTogglePlay}>
            {isPlaying ? <PauseIcon /> : <PlayIcon />}
          </button>
 
          <button className="btn-icon" onClick={onNext}><NextIcon /></button>
 
          <div style={{ width: 36 }} />
        </div>
 
        <div className="playback-bar">
          <span className="playback-time">{formatTime(currentTime)}</span>
          <input
            type="range"
            min="0" max="100" step="0.1"
            value={pct}
            onChange={e => onSeek(parseFloat(e.target.value))}
            className="range-slider"
            style={sliderStyle(pct)}
          />
          <span className="playback-time">{formatTime(duration)}</span>
        </div>
      </div>
 
      <div className="player-right">
        <button className="btn-icon" onClick={() => onVolumeChange(volume === 0 ? 60 : 0)}>
          {volume === 0 ? <MuteIcon /> : <VolumeIcon />}
        </button>
        <input
          type="range"
          min="0" max="100"
          value={volume}
          onChange={e => onVolumeChange(Number(e.target.value))}
          className="range-slider"
          style={sliderStyle(volume, 90)}
        />
      </div>
    </footer>
  )
}

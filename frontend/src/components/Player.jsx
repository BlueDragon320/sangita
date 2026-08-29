import React, { useState, useEffect } from 'react'

function strHue(str) {
  let h = 0;
  for (const c of (str || '')) h = (h * 31 + c.charCodeAt(0)) | 0;
  return Math.abs(h) % 360;
}

function getCoverUrl(path, token) {
  if (!path) return '';
  const cleanPath = path.replace(/^\/+/, '');
  const encodedPath = cleanPath.split('/').map(encodeURIComponent).join('/');
  return `/api/cover/${encodedPath}${token ? `?token=${encodeURIComponent(token)}&v=2` : '?v=2'}`;
}

function PlayerDisc({ track, token, discBg }) {
  const [imgErr, setImgErr] = useState(false)

  // Reset image error state whenever track or token changes
  useEffect(() => {
    setImgErr(false)
  }, [track?.path, token])

  const coverUrl = track?.path ? getCoverUrl(track.path, token) : null

  return (
    <div className="player-disc" style={{ background: imgErr || !coverUrl ? discBg : undefined }}>
      {!imgErr && coverUrl ? (
        <img
          src={coverUrl}
          key={track?.path}
          alt={track?.name || 'Cover'}
          onError={() => setImgErr(true)}
          className="player-disc-cover"
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', borderRadius: 'inherit' }}
        />
      ) : (
        <NoteIcon />
      )}
    </div>
  )
}

export default function Player({
  track,
  playlist,
  isPlaying,
  isShuffle,
  isLoop,
  onTogglePlay,
  onNext,
  onPrev,
  onToggleShuffle,
  onToggleLoop,
  currentTime,
  duration,
  onSeek,
  volume,
  onVolumeChange,
  formatTime,
  isActiveDevice,
  activeDeviceName,
  syncState,
  onClaimDevice,
  onSendRemote,
  devices,
  myDeviceId,
  onOpenDevices,
  showRightPanel,
  onToggleRightPanel,
  token,
  isFavorite = false,
  onToggleFavorite,
  onAddToPlaylist
}) {
  const pct = duration > 0 ? (currentTime / duration) * 100 : 0
  const hue = strHue(track?.name || '')
  const discBg = track
    ? `linear-gradient(135deg, hsl(${hue}, 55%, 24%), hsl(${(hue + 60) % 360}, 50%, 16%))`
    : 'var(--card)'

  const isRemote = !isActiveDevice && syncState && syncState.activeDeviceId && syncState.activeDeviceId !== myDeviceId

  const sliderStyle = (val, max = 100) => ({
    background: `linear-gradient(to right, var(--emerald) ${val}%, var(--border-hi) ${val}%)`,
    height: 4,
    borderRadius: 2,
    flex: max === 100 ? 1 : undefined,
    width: max !== 100 ? `${max}px` : undefined,
    cursor: 'pointer'
  })

  if (isRemote) {
    const remoteIsPlaying = !!syncState.isPlaying
    const drift = remoteIsPlaying ? Math.max(0, Date.now() - (syncState.updatedAt || Date.now())) : 0
    const remotePositionSec = ((syncState.positionMs || 0) + drift) / 1000
    const remoteDurationSec = (syncState.durationMs || 0) / 1000
    const remotePct = remoteDurationSec > 0 ? Math.min(100, (remotePositionSec / remoteDurationSec) * 100) : 0

    return (
      <footer className="player player-remote" data-testid="player-bar">
        <div className="player-left">
          <PlayerDisc track={track} token={token} discBg={discBg} />
          <div className="player-info">
            <div className="player-title" title={track ? track.name : (syncState.trackId?.split('/').pop().replace(/\.[^/.]+$/, '') || 'Playing remotely')}>
              {track ? track.name : (syncState.trackId?.split('/').pop().replace(/\.[^/.]+$/, '') || 'Playing remotely')}
            </div>
            <div className="player-playlist">
              Playing on <span className="player-device-tag">{activeDeviceName || 'another device'}</span>
            </div>
          </div>
          {track && (
            <button
              className={`btn-icon player-like-btn ${isFavorite ? 'active' : ''}`}
              onClick={() => onToggleFavorite && onToggleFavorite(track.path)}
              title={isFavorite ? "Remove from Favorites" : "Add to Favorites"}
            >
              <HeartIcon filled={isFavorite} />
            </button>
          )}
          <button className="player-claim-btn" onClick={onClaimDevice}>Play here</button>
        </div>
        <div className="player-center">
          <div className="player-controls">
            <button
              className={`btn-icon ${isShuffle ? 'active glow' : ''}`}
              onClick={() => onSendRemote({ action: 'shuffle', payload: { shuffle: !isShuffle }})}
              title={isShuffle ? "Shuffle ON" : "Shuffle OFF"}
            >
              <ShuffleIcon />
            </button>
            <button className="btn-icon" onClick={() => onSendRemote({ action: 'prev' })} title="Previous">
              <PrevIcon />
            </button>
            <button
              className="btn-play-main"
              onClick={() => onSendRemote({ action: remoteIsPlaying ? 'pause' : 'play' })}
              title={remoteIsPlaying ? "Pause" : "Play"}
            >
              {remoteIsPlaying ? <PauseIcon/> : <PlayIcon/>}
            </button>
            <button className="btn-icon" onClick={() => onSendRemote({ action: 'next' })} title="Next">
              <NextIcon />
            </button>
            <button
              className={`btn-icon ${isLoop ? 'active glow' : ''}`}
              onClick={() => onSendRemote({ action: 'loop', payload: { loop: !isLoop }})}
              title={isLoop ? "Repeat ON" : "Repeat OFF"}
            >
              <LoopIcon />
            </button>
          </div>
          <div className="playback-bar">
            <span className="playback-time">{formatTime(remotePositionSec)}</span>
            <input
              type="range"
              min="0"
              max="100"
              step="0.1"
              value={remotePct}
              onChange={(e) => onSendRemote({ action: 'seek', payload: { pct: parseFloat(e.target.value) } })}
              className="range-slider"
              style={sliderStyle(remotePct)}
            />
            <span className="playback-time">{remoteDurationSec > 0 ? formatTime(remoteDurationSec) : '—:——'}</span>
          </div>
        </div>
        <div className="player-right">
          {onToggleRightPanel && (
            <button
              className={`btn-icon ${showRightPanel ? 'active' : ''}`}
              onClick={onToggleRightPanel}
              title="Now Playing View"
            >
              <PanelIcon />
            </button>
          )}
          <button className="btn-icon player-devices-btn" onClick={onOpenDevices} title="Connected Devices">
            <DevicesIcon />
          </button>
          {syncState?.volume !== undefined && (
            <>
              <button
                className="btn-icon"
                onClick={() => onSendRemote({ action: 'volume', payload: { volume: syncState.volume === 0 ? 60 : 0 }})}
                title="Mute/Unmute"
              >
                {syncState.volume === 0 ? <MuteIcon /> : <VolumeIcon />}
              </button>
              <input
                type="range"
                min="0"
                max="100"
                value={syncState.volume * 100}
                onChange={e => onSendRemote({ action: 'volume', payload: { volume: Number(e.target.value) }})}
                className="range-slider"
                style={sliderStyle(syncState.volume * 100, 90)}
              />
            </>
          )}
        </div>
      </footer>
    )
  }

  return (
    <footer className="player" data-testid="player-bar">
      <div className={`player-left ${track ? '' : 'player-empty'}`}>
        <PlayerDisc track={track} token={token} discBg={discBg} />
        <div className="player-info">
          <div className="player-title" title={track ? track.name : 'Nothing playing'}>
            {track ? track.name : 'Nothing playing'}
          </div>
          <div className="player-playlist">
            {track ? (track.playlist || playlist) : 'Select a track'}
          </div>
        </div>
        {track && (
          <div className="player-action-btns" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {onAddToPlaylist && (
              <button
                className="btn-icon player-add-btn"
                onClick={() => onAddToPlaylist(track)}
                title="Add to Playlist"
                data-testid="player-add-btn"
              >
                <PlusIcon width={16} height={16} />
              </button>
            )}
            <button
              className={`btn-icon player-like-btn ${isFavorite ? 'active' : ''}`}
              onClick={() => onToggleFavorite && onToggleFavorite(track.path)}
              title={isFavorite ? "Remove from Favorites" : "Add to Favorites"}
              data-testid="player-like-btn"
            >
              <HeartIcon filled={isFavorite} />
            </button>
          </div>
        )}
      </div>

      <div className="player-center">
        <div className="player-controls">
          <button
            className={`btn-icon ${isShuffle ? 'active glow' : ''}`}
            onClick={onToggleShuffle}
            data-testid="player-shuffle-btn"
            title={isShuffle ? "Shuffle ON" : "Shuffle OFF"}
          >
            <ShuffleIcon />
          </button>
          <button
            className="btn-icon"
            onClick={onPrev}
            data-testid="player-prev-btn"
            title="Previous"
          >
            <PrevIcon />
          </button>
          <button
            className="btn-play-main"
            onClick={onTogglePlay}
            data-testid="player-play-btn"
            title={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? <PauseIcon/> : <PlayIcon/>}
          </button>
          <button
            className="btn-icon"
            onClick={onNext}
            data-testid="player-next-btn"
            title="Next"
          >
            <NextIcon />
          </button>
          <button
            className={`btn-icon ${isLoop ? 'active glow' : ''}`}
            onClick={onToggleLoop}
            data-testid="player-loop-btn"
            title={isLoop ? "Repeat ON" : "Repeat OFF"}
          >
            <LoopIcon />
          </button>
        </div>

        <div className="playback-bar">
          <span className="playback-time">{formatTime(currentTime)}</span>
          <input
            type="range"
            min="0"
            max="100"
            step="0.1"
            value={pct}
            onChange={e => onSeek(parseFloat(e.target.value))}
            className="range-slider"
            style={sliderStyle(pct)}
          />
          <span className="playback-time">{formatTime(duration)}</span>
        </div>
      </div>

      <div className="player-right">
        {onToggleRightPanel && (
          <button
            className={`btn-icon ${showRightPanel ? 'active' : ''}`}
            onClick={onToggleRightPanel}
            title="Now Playing View"
            data-testid="player-right-panel-toggle"
          >
            <PanelIcon />
          </button>
        )}
        <button
          className="btn-icon player-devices-btn"
          onClick={onOpenDevices}
          title="Connected Devices"
          data-testid="player-devices-btn"
        >
          <DevicesIcon />
        </button>
        <button
          className="btn-icon"
          onClick={() => onVolumeChange(volume === 0 ? 80 : 0)}
          title={volume === 0 ? "Unmute" : "Mute"}
          data-testid="player-volume-toggle"
        >
          {volume === 0 ? <MuteIcon /> : <VolumeIcon />}
        </button>
        <input
          type="range"
          min="0"
          max="100"
          value={volume}
          onChange={e => onVolumeChange(Number(e.target.value))}
          className="range-slider"
          style={sliderStyle(volume, 90)}
        />
      </div>
    </footer>
  )
}

/* ════════════════════════════════════════════════════════════════════════════
   MODERN SLEEK SVGS
   ════════════════════════════════════════════════════════════════════════════ */
function NoteIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="var(--emerald)">
      <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
    </svg>
  )
}

function HeartIcon({ filled }) {
  return filled ? (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="var(--emerald)">
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
  )
}

function ShuffleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 3 21 3 21 8"/>
      <line x1="4" y1="20" x2="21" y2="3"/>
      <polyline points="21 16 21 21 16 21"/>
      <line x1="15" y1="15" x2="21" y2="21"/>
      <line x1="4" y1="4" x2="9" y2="9"/>
    </svg>
  )
}

function PrevIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
      <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
    </svg>
  )
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" style={{ marginLeft: 2 }}>
      <path d="M8 5v14l11-7z"/>
    </svg>
  )
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
    </svg>
  )
}

function NextIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
      <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
    </svg>
  )
}

function LoopIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="17 1 21 5 17 9"/>
      <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
      <polyline points="7 23 3 19 7 15"/>
      <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
    </svg>
  )
}

function VolumeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
    </svg>
  )
}

function MuteIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
      <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
    </svg>
  )
}

function DevicesIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
      <path d="M4 6h18V4H4c-1.1 0-2 .9-2 2v11H0v3h14v-3H4V6zm19 2h-6c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h6c.55 0 1-.45 1-1V9c0-.55-.45-1-1-1zm-1 9h-4v-7h4v7z"/>
    </svg>
  )
}

function PanelIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
      <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zM7 10h2v7H7zm4-3h2v10h-2zm4 6h2v4h-2z"/>
    </svg>
  )
}

function PlusIcon({ width = 16, height = 16 }) {
  return (
    <svg viewBox="0 0 24 24" width={width} height={height} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14"/>
    </svg>
  )
}
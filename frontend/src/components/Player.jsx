import React, { useState, useEffect, useRef } from 'react'

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
    <div
      className="player-disc"
      style={{
        background: imgErr || !coverUrl ? discBg : undefined,
        border: '1px solid var(--border)'
      }}
    >
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


function PlayerTopProgress({ pct, currentTime = 0, duration = 0, onSeek, formatTime }) {
  const [hoverPct, setHoverPct] = useState(null)
  const [hoverX, setHoverX] = useState(0)
  const [dragPct, setDragPct] = useState(null)
  const isDraggingRef = useRef(false)
  const didDragRef = useRef(false)
  const lastEmitTimeRef = useRef(0)
  const lastEmitPctRef = useRef(null)
  const progressRef = useRef(null)

  const calcPctFromClientX = (clientX, target) => {
    const el = progressRef.current || target
    if (!el) return 0
    const rect = el.getBoundingClientRect()
    const width = rect.width > 0 ? rect.width : (el.offsetWidth || 100)
    const x = Math.max(0, Math.min(width, clientX - rect.left))
    return Math.max(0, Math.min(100, (x / width) * 100))
  }

  const handleMouseMove = (e) => {
    const p = calcPctFromClientX(e.clientX, e.currentTarget)
    setHoverPct(p)
    setHoverX(e.clientX)
    if (isDraggingRef.current) {
      didDragRef.current = true
      setDragPct(p)
      const now = Date.now()
      if (now - lastEmitTimeRef.current >= 150 && (lastEmitPctRef.current === null || Math.abs(p - lastEmitPctRef.current) >= 2)) {
        lastEmitTimeRef.current = now
        lastEmitPctRef.current = p
        onSeek?.(p)
      }
    }
  }

  const handleMouseLeave = () => {
    if (!isDraggingRef.current) {
      setHoverPct(null)
    }
  }

  const handleMouseDown = (e) => {
    if (e.button !== 0) return
    isDraggingRef.current = true
    didDragRef.current = false
    const p = calcPctFromClientX(e.clientX, e.currentTarget)
    setDragPct(p)
    setHoverPct(p)
    setHoverX(e.clientX)
    lastEmitPctRef.current = p
    lastEmitTimeRef.current = Date.now()
    onSeek?.(p)

    const onWindowMouseMove = (moveEvent) => {
      if (!isDraggingRef.current) return
      didDragRef.current = true
      const currentP = calcPctFromClientX(moveEvent.clientX, progressRef.current)
      setDragPct(currentP)
      setHoverPct(currentP)
      setHoverX(moveEvent.clientX)

      const now = Date.now()
      if (now - lastEmitTimeRef.current >= 150 && Math.abs(currentP - (lastEmitPctRef.current ?? 0)) >= 2) {
        lastEmitTimeRef.current = now
        lastEmitPctRef.current = currentP
        onSeek?.(currentP)
      }
    }

    const onWindowMouseUp = (upEvent) => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false
        const finalP = calcPctFromClientX(upEvent.clientX, progressRef.current)
        setDragPct(null)
        setHoverPct(null)
        lastEmitPctRef.current = null
        onSeek?.(finalP)
      }
      window.removeEventListener('mousemove', onWindowMouseMove)
      window.removeEventListener('mouseup', onWindowMouseUp)
    }

    window.addEventListener('mousemove', onWindowMouseMove)
    window.addEventListener('mouseup', onWindowMouseUp)
  }

  const handleMouseUp = (e) => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false
      const p = calcPctFromClientX(e.clientX, e.currentTarget)
      setDragPct(null)
      setHoverPct(null)
      lastEmitPctRef.current = null
      onSeek?.(p)
    }
  }

  const handleClick = (e) => {
    if (didDragRef.current) {
      didDragRef.current = false
      return
    }
    const p = calcPctFromClientX(e.clientX, e.currentTarget)
    onSeek?.(p)
  }

  const getTouchPct = (e) => {
    const touch = e.touches?.[0] || e.changedTouches?.[0]
    if (!touch) return null
    return calcPctFromClientX(touch.clientX, e.currentTarget)
  }

  const handleTouchStart = (e) => {
    const p = getTouchPct(e)
    if (p !== null) {
      isDraggingRef.current = true
      setDragPct(p)
      lastEmitPctRef.current = p
      lastEmitTimeRef.current = Date.now()
      onSeek?.(p)
    }
  }

  const handleTouchMove = (e) => {
    const p = getTouchPct(e)
    if (p !== null) {
      setDragPct(p)
      const now = Date.now()
      if (now - lastEmitTimeRef.current >= 150 || (lastEmitPctRef.current !== null && Math.abs(p - lastEmitPctRef.current) >= 5)) {
        lastEmitTimeRef.current = now
        lastEmitPctRef.current = p
        onSeek?.(p)
      }
    }
  }

  const handleTouchEnd = (e) => {
    const p = getTouchPct(e)
    isDraggingRef.current = false
    setDragPct(null)
    lastEmitPctRef.current = null
    if (p !== null) {
      onSeek?.(p)
    }
  }

  const hoverTimeSec = hoverPct !== null && duration > 0 ? (hoverPct / 100) * duration : 0
  const activePct = dragPct !== null ? dragPct : (Number(pct) || 0)
  const safePct = Math.min(100, Math.max(0, activePct))
  const displayCurrentTime = dragPct !== null && duration > 0 ? (dragPct / 100) * duration : currentTime

  return (
    <div
      ref={progressRef}
      className="player-top-progress"
      role="slider"
      tabIndex={0}
      aria-label="Seek"
      aria-orientation="horizontal"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(safePct)}
      aria-valuetext={`${formatTime ? formatTime(displayCurrentTime) : '0:00'} of ${formatTime ? formatTime(duration) : '0:00'}`}
      onKeyDown={(e) => {
        const changes = {
          ArrowLeft: -5,
          ArrowDown: -5,
          ArrowRight: 5,
          ArrowUp: 5,
          PageUp: 10,
          PageDown: -10,
        }
        if (e.key in changes || e.key === 'Home' || e.key === 'End') {
          e.preventDefault()
          e.stopPropagation()
          onSeek?.(e.key === 'Home' ? 0 : e.key === 'End' ? 100 : Math.max(0, Math.min(100, safePct + changes[e.key])))
        }
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      title="Click or drag to seek"
      data-testid="player-top-progress"
    >
      <span className="player-top-time player-top-time-start">
        {formatTime ? formatTime(displayCurrentTime) : '0:00'}
      </span>

      <div className="player-top-progress-track">
        <div
          className="player-top-progress-fill"
          style={{ width: `${safePct}%` }}
        />
        {/* Vertical playhead thumb indicator matching reference image */}
        <div
          className="player-top-progress-thumb"
          style={{ left: `${safePct}%` }}
        />
        {/* Subtle end dot at 100% matching reference image */}
        <div className="player-top-progress-end-dot" />

        {hoverPct !== null && (
          <div
            className="player-top-progress-hover"
            style={{ width: `${hoverPct}%` }}
          />
        )}
      </div>

      <span className="player-top-time player-top-time-end">
        {duration > 0 ? (formatTime ? formatTime(duration) : '0:00') : '—:——'}
      </span>

      {hoverPct !== null && (
        <div
          className="player-top-progress-tooltip"
          style={{ left: hoverX }}
        >
          {formatTime ? formatTime(hoverTimeSec) : `${Math.floor(hoverTimeSec / 60)}:${Math.floor(hoverTimeSec % 60).toString().padStart(2, '0')}`}
        </div>
      )}
    </div>
  )
}

function Player({
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
  onAddToPlaylist,
  hasLyrics = false,
  showLyrics = false,
  onToggleLyrics,
  requiresUserGesture = false,
  onUnlockWebAudio
}) {
  const pct = duration > 0 ? (currentTime / duration) * 100 : 0
  const discBg = 'var(--surface)'

  const isRemote = !isActiveDevice && syncState && syncState.activeDeviceId && syncState.activeDeviceId !== myDeviceId

  // Remember previous volume when unmuting instead of hardcoding 80
  const prevVolumeRef = useRef(volume > 0 ? volume : 80)
  const lastRemoteSeekRef = useRef(0)

  useEffect(() => {
    if (volume > 0) {
      prevVolumeRef.current = volume
    }
  }, [volume])

  const handleRemoteSeek = (newPct, meta = {}) => {
    const now = Date.now()
    if (meta.isEnd || now - lastRemoteSeekRef.current >= 150) {
      lastRemoteSeekRef.current = now
      onSendRemote?.({ action: 'seek', payload: { pct: newPct } })
    }
  }

  const handleMuteToggle = () => {
    if (volume === 0) {
      onVolumeChange?.(prevVolumeRef.current || 80)
    } else {
      prevVolumeRef.current = volume
      onVolumeChange?.(0)
    }
  }

  const handleVolumeKeyDown = (e) => {
    if (e.key === 'PageUp') {
      e.preventDefault()
      e.stopPropagation()
      onVolumeChange?.(Math.min(100, volume + 10))
    } else if (e.key === 'PageDown') {
      e.preventDefault()
      e.stopPropagation()
      onVolumeChange?.(Math.max(0, volume - 10))
    }
  }

  const sliderStyle = (val, max = 100) => ({
    background: `linear-gradient(to right, var(--accent) ${val}%, var(--border-hi) ${val}%)`,
    height: 4,
    borderRadius: 2,
    flex: max === 100 ? 1 : undefined,
    width: max !== 100 ? `${max}px` : undefined,
    cursor: 'pointer'
  })

  if (isRemote) {
    const remoteIsPlaying = !!syncState.isPlaying
    const remotePositionSec = currentTime
    const remoteDurationSec = duration > 0 ? duration : ((syncState.durationMs || 0) / 1000)
    const remotePct = remoteDurationSec > 0 ? Math.min(100, (remotePositionSec / remoteDurationSec) * 100) : 0
    const remoteVolPct = syncState?.volume !== undefined
      ? Math.round(syncState.volume > 1 ? syncState.volume : syncState.volume * 100)
      : 80

    const remoteTrackId = syncState?.trackId;
    const activeTrack = (remoteTrackId && track?.path === remoteTrackId)
      ? track
      : (remoteTrackId ? {
          id: remoteTrackId,
          path: remoteTrackId,
          name: remoteTrackId.split('/').pop().replace(/\.[^/.]+$/, ''),
          title: remoteTrackId.split('/').pop().replace(/\.[^/.]+$/, ''),
          playlist: 'Remote Track',
        } : track);

    const remoteTitle = activeTrack ? (activeTrack.title || activeTrack.name || '') : ''
    const remoteArtist = activeTrack ? (activeTrack.artist || activeTrack.playlist || playlist || 'Unknown Artist') : ''
    const remoteAnnouncement = activeTrack && remoteTitle
      ? `Now playing: ${remoteTitle} by ${remoteArtist}`
      : ''

    return (
      <footer className="player player-remote" data-testid="player-bar">
        <div
          className="sr-only"
          role="status"
          aria-live="polite"
          aria-atomic="true"
          data-testid="player-live-region"
        >
          {remoteAnnouncement}
        </div>
        <PlayerTopProgress pct={remotePct} currentTime={remotePositionSec} duration={remoteDurationSec} onSeek={handleRemoteSeek} formatTime={formatTime} />
        <div className="player-left">
          <PlayerDisc track={activeTrack} token={token} discBg={discBg} />
          <div className="player-info">
            <div className="player-title" title={activeTrack ? activeTrack.name : 'Playing remotely'}>
              {activeTrack ? activeTrack.name : 'Playing remotely'}
            </div>
            <div className="player-playlist">
              <span className="player-playlist-name">Playing on <span className="player-device-tag">{activeDeviceName || 'another device'}</span></span>
              <span className="player-mobile-time"> • {formatTime ? formatTime(remotePositionSec) : '0:00'} / {remoteDurationSec > 0 ? (formatTime ? formatTime(remoteDurationSec) : '0:00') : '—:——'}</span>
            </div>
          </div>
          {activeTrack && (
            <div className="player-action-btns" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {onAddToPlaylist && (
                <button
                  className="btn-icon player-add-btn"
                  onClick={() => onAddToPlaylist(activeTrack)}
                  title="Add to playlist"
                  aria-label="Add to playlist"
                  data-testid="player-add-btn"
                >
                  <PlusIcon width={18} height={18} />
                </button>
              )}
              <button
                className={`btn-icon player-like-btn ${isFavorite ? 'active' : ''}`}
                onClick={() => onToggleFavorite && onToggleFavorite(activeTrack.path)}
                title={isFavorite ? "Remove from favorites" : "Add to favorites"}
                aria-label={isFavorite ? "Remove from Favorites" : "Add to Favorites"}
                aria-pressed={isFavorite}
                data-testid="player-like-btn"
              >
                <HeartIcon filled={isFavorite} />
              </button>
            </div>
          )}
        </div>
        <div className="player-center">
          {requiresUserGesture ? (
            <button
              type="button"
              className="player-gesture-unlock-btn"
              onClick={onUnlockWebAudio}
              data-testid="player-gesture-unlock-btn"
              title="Audio paused by browser • Click to play"
              aria-label="Audio paused by browser. Click to play"
            >
              <PlayIcon width={14} height={14} />
              <span>Audio paused by browser • Click to play</span>
            </button>
          ) : (
            <div className="player-controls">
              <button
                className={`btn-icon btn-shuffle ${isShuffle ? 'active' : ''}`}
                onClick={() => onSendRemote({ action: 'shuffle', payload: { shuffle: !isShuffle }})}
                title={isShuffle ? "Shuffle on" : "Shuffle off"}
                aria-label="Shuffle"
                aria-pressed={isShuffle}
              >
                <ShuffleIcon />
              </button>
              <button
                className="btn-icon btn-prev"
                onClick={() => onSendRemote({ action: 'prev' })}
                title="Previous"
                aria-label="Previous"
              >
                <PrevIcon />
              </button>
              <button
                className="btn-play-main"
                onClick={() => onSendRemote({ action: remoteIsPlaying ? 'pause' : 'play' })}
                title={remoteIsPlaying ? "Pause" : "Play"}
                aria-label={remoteIsPlaying ? "Pause" : "Play"}
              >
                {remoteIsPlaying ? <PauseIcon/> : <PlayIcon/>}
              </button>
              <button
                className="btn-icon btn-next"
                onClick={() => onSendRemote({ action: 'next' })}
                title="Next"
                aria-label="Next"
              >
                <NextIcon />
              </button>
              <button
                className={`btn-icon btn-repeat ${isLoop ? 'active' : ''}`}
                onClick={() => onSendRemote({ action: 'loop', payload: { loop: !isLoop }})}
                title={isLoop ? "Repeat on" : "Repeat off"}
                aria-label="Repeat"
                aria-pressed={isLoop}
              >
                <LoopIcon />
              </button>
            </div>
          )}
        </div>
        <div className="player-right">
          {onToggleLyrics && (
            <button
              className={`btn-icon player-lyrics-btn ${showLyrics ? 'active' : ''}`}
              onClick={onToggleLyrics}
              title={showLyrics ? "Hide lyrics" : "Show synced lyrics"}
              aria-label="Toggle synced lyrics"
              aria-pressed={showLyrics}
              data-testid="lyrics-toggle-btn"
            >
              <LyricsIcon />
            </button>
          )}
          {onToggleRightPanel && (
            <button
              className={`btn-icon ${showRightPanel ? 'active' : ''}`}
              onClick={onToggleRightPanel}
              title="Now playing view"
              aria-label="Toggle now playing panel"
              aria-expanded={showRightPanel}
              data-testid="player-right-panel-toggle"
            >
              <PanelIcon />
            </button>
          )}
          <div className="player-device-indicator">
            <button
              className="btn-icon player-devices-btn"
              onClick={onOpenDevices}
              title="Connected devices"
              aria-label="Connected devices"
              data-testid="player-devices-btn"
            >
              <DevicesIcon />
            </button>
          </div>
          {syncState?.volume !== undefined && (
            <>
              <button
                className="btn-icon"
                onClick={() => onSendRemote({ action: 'volume', payload: { volume: remoteVolPct === 0 ? (prevVolumeRef.current || 60) : 0 }})}
                title={remoteVolPct === 0 ? "Unmute" : "Mute"}
                aria-label={remoteVolPct === 0 ? "Unmute" : "Mute"}
              >
                {remoteVolPct === 0 ? <MuteIcon /> : <VolumeIcon />}
              </button>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={remoteVolPct}
                aria-label="Volume"
                aria-valuetext={`${remoteVolPct}%`}
                onChange={e => onSendRemote({ action: 'volume', payload: { volume: Number(e.target.value) }})}
                onKeyDown={(e) => {
                  if (e.key === 'PageUp') {
                    e.preventDefault(); e.stopPropagation()
                    onSendRemote({ action: 'volume', payload: { volume: Math.min(100, remoteVolPct + 10) }})
                  } else if (e.key === 'PageDown') {
                    e.preventDefault(); e.stopPropagation()
                    onSendRemote({ action: 'volume', payload: { volume: Math.max(0, remoteVolPct - 10) }})
                  }
                }}
                className="range-slider"
                style={sliderStyle(remoteVolPct, 90)}
              />
            </>
          )}
        </div>
      </footer>
    )
  }

  const localTitle = track ? (track.title || track.name || '') : ''
  const localArtist = track ? (track.artist || track.playlist || playlist || 'Unknown Artist') : ''
  const localAnnouncement = track && localTitle
    ? `Now playing: ${localTitle} by ${localArtist}`
    : ''

  return (
    <footer className="player" data-testid="player-bar">
      <div
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        data-testid="player-live-region"
      >
        {localAnnouncement}
      </div>
      <PlayerTopProgress pct={pct} currentTime={currentTime} duration={duration} onSeek={onSeek} formatTime={formatTime} />
      <div className={`player-left ${track ? '' : 'player-empty'}`}>
        <PlayerDisc track={track} token={token} discBg={discBg} />
        <div className="player-info">
          <div className="player-title" title={track ? track.name : 'Nothing playing'}>
            {track ? track.name : 'Nothing playing'}
          </div>
          <div className="player-playlist">
            <span className="player-playlist-name">{track ? (track.playlist || playlist) : 'Select a track'}</span>
            <span className="player-mobile-time"> • {formatTime ? formatTime(currentTime) : '0:00'} / {formatTime ? formatTime(duration) : '0:00'}</span>
          </div>
        </div>
        {track && (
          <div className="player-action-btns" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {onAddToPlaylist && (
              <button
                className="btn-icon player-add-btn"
                onClick={() => onAddToPlaylist(track)}
                title="Add to playlist"
                aria-label="Add to playlist"
                data-testid="player-add-btn"
              >
                <PlusIcon width={18} height={18} />
              </button>
            )}
            <button
              className={`btn-icon player-like-btn ${isFavorite ? 'active' : ''}`}
              onClick={() => onToggleFavorite && onToggleFavorite(track.path)}
              title={isFavorite ? "Remove from favorites" : "Add to favorites"}
              aria-label={isFavorite ? "Remove from Favorites" : "Add to Favorites"}
              aria-pressed={isFavorite}
              data-testid="player-like-btn"
            >
              <HeartIcon filled={isFavorite} />
            </button>
          </div>
        )}
      </div>

      <div className="player-center">
        {requiresUserGesture ? (
          <button
            type="button"
            className="player-gesture-unlock-btn"
            onClick={onUnlockWebAudio}
            data-testid="player-gesture-unlock-btn"
            title="Audio paused by browser • Click to play"
            aria-label="Audio paused by browser. Click to play"
          >
            <PlayIcon width={14} height={14} />
            <span>Audio paused by browser • Click to play</span>
          </button>
        ) : (
          <div className="player-controls">
            <button
              className={`btn-icon btn-shuffle ${isShuffle ? 'active' : ''}`}
              onClick={onToggleShuffle}
              data-testid="player-shuffle-btn"
              title={isShuffle ? "Shuffle on" : "Shuffle off"}
              aria-label="Shuffle"
              aria-pressed={isShuffle}
            >
              <ShuffleIcon />
            </button>
            <button
              className="btn-icon btn-prev"
              onClick={onPrev}
              data-testid="player-prev-btn"
              title="Previous"
              aria-label="Previous"
            >
              <PrevIcon />
            </button>
            <button
              className="btn-play-main"
              onClick={onTogglePlay}
              data-testid="player-play-btn"
              title={isPlaying ? "Pause" : "Play"}
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? <PauseIcon/> : <PlayIcon/>}
            </button>
            <button
              className="btn-icon btn-next"
              onClick={onNext}
              data-testid="player-next-btn"
              title="Next"
              aria-label="Next"
            >
              <NextIcon />
            </button>
            <button
              className={`btn-icon btn-repeat ${isLoop ? 'active' : ''}`}
              onClick={onToggleLoop}
              data-testid="player-loop-btn"
              title={isLoop ? "Repeat on" : "Repeat off"}
              aria-label="Repeat"
              aria-pressed={isLoop}
            >
              <LoopIcon />
            </button>
          </div>
        )}
      </div>

      <div className="player-right">
        {onToggleLyrics && (
          <button
            className={`btn-icon player-lyrics-btn ${showLyrics ? 'active' : ''}`}
            onClick={onToggleLyrics}
            title={showLyrics ? "Hide lyrics" : "Show synced lyrics"}
            aria-label="Toggle synced lyrics"
            aria-pressed={showLyrics}
            data-testid="lyrics-toggle-btn"
          >
            <LyricsIcon />
          </button>
        )}
        {onToggleRightPanel && (
          <button
            className={`btn-icon ${showRightPanel ? 'active' : ''}`}
            onClick={onToggleRightPanel}
            title="Now playing view"
            aria-label="Toggle now playing panel"
            aria-expanded={showRightPanel}
            data-testid="player-right-panel-toggle"
          >
            <PanelIcon />
          </button>
        )}
        <div className="player-device-indicator">
          <button
            className="btn-icon player-devices-btn"
            onClick={onOpenDevices}
            title="Connected devices"
            aria-label="Connected devices"
            data-testid="player-devices-btn"
          >
            <DevicesIcon />
          </button>
        </div>
        <button
          className="btn-icon"
          onClick={handleMuteToggle}
          title={volume === 0 ? "Unmute" : "Mute"}
          aria-label={volume === 0 ? "Unmute" : "Mute"}
          data-testid="player-volume-toggle"
        >
          {volume === 0 ? <MuteIcon /> : <VolumeIcon />}
        </button>
        <input
          type="range"
          min="0"
          max="100"
          step="5"
          value={volume}
          aria-label="Volume"
          aria-valuetext={`${volume}%`}
          onChange={e => onVolumeChange(Number(e.target.value))}
          onKeyDown={handleVolumeKeyDown}
          className="range-slider"
          style={sliderStyle(volume, 90)}
          data-testid="player-volume-slider"
        />
      </div>
    </footer>
  )
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   MODERN SLEEK SVGS
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function NoteIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  )
}

function HeartIcon({ filled }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill={filled ? "var(--accent)" : "none"}
      stroke={filled ? "var(--accent)" : "currentColor"}
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </svg>
  )
}

function ShuffleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 3 21 3 21 8" />
      <line x1="4" y1="20" x2="21" y2="3" />
      <polyline points="21 16 21 21 16 21" />
      <line x1="15" y1="15" x2="21" y2="21" />
      <line x1="4" y1="4" x2="9" y2="9" />
    </svg>
  )
}

function PrevIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="19 20 9 12 19 4 19 20" />
      <line x1="5" y1="19" x2="5" y2="5" />
    </svg>
  )
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 2 }}>
      <polygon points="6 4 20 12 6 20 6 4" />
    </svg>
  )
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="7" y1="5" x2="7" y2="19" />
      <line x1="17" y1="5" x2="17" y2="19" />
    </svg>
  )
}

function NextIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="5 4 15 12 5 20 5 4" />
      <line x1="19" y1="5" x2="19" y2="19" />
    </svg>
  )
}

function LoopIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="17 1 21 5 17 9" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <polyline points="7 23 3 19 7 15" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  )
}

function VolumeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  )
}

function MuteIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <line x1="22" y1="9" x2="16" y2="15" />
      <line x1="16" y1="9" x2="22" y2="15" />
    </svg>
  )
}

function DevicesIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="14" height="10" rx="1.5" />
      <path d="M6 18h6" />
      <path d="M18 10h3a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1z" />
    </svg>
  )
}

function PanelIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="15" y1="3" x2="15" y2="21" />
    </svg>
  )
}

function PlusIcon({ width = 18, height = 18 }) {
  return (
    <svg viewBox="0 0 24 24" width={width} height={height} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14"/>
    </svg>
  )
}

function LyricsIcon({ width = 18, height = 18, className = '' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={width}
      height={height}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}
    >
      <path d="M3 6h10" />
      <path d="M3 11h7" />
      <path d="M3 16h5" />
      <path d="M3 21h10" />
      <path d="M17 17a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Z" />
      <path d="M17 17V5l4-1v5" />
    </svg>
  )
}

export default React.memo(Player)
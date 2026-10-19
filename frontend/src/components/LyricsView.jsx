import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'


function formatLyricsTime(sec = 0) {
  const s = Math.floor(sec || 0)
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${r < 10 ? '0' : ''}${r}`
}

function parseLRC(lrcText) {
  if (!lrcText || typeof lrcText !== 'string') return { lines: [], isSynced: false, offsetSec: 0 }

  // Check for standard LRC metadata offset tag: [offset:+/-ms]
  const offsetMatch = lrcText.match(/\[offset:\s*([+-]?\d+)\]/i)
  const fileOffsetSec = offsetMatch ? (parseInt(offsetMatch[1], 10) / 1000.0) : 0

  const lines = []
  const rawLines = lrcText.split(/\r?\n/)
  // Regex to match [mm:ss.xx] or [mm:ss.xxx]
  const timeRegex = /\[(\d{2}):(\d{2})(?:\.(\d{1,3}))?\]/g

  let hasTimestamp = false

  for (const raw of rawLines) {
    const trimmed = raw.trim()
    if (!trimmed) continue

    // Skip metadata tags like [ti:], [ar:], [al:], [offset:]
    if (/^\[(ti|ar|al|by|offset|length|re|ve):/i.test(trimmed)) continue

    // Find all timestamps in this line
    const matches = [...trimmed.matchAll(timeRegex)]
    if (matches.length > 0) {
      hasTimestamp = true
      const text = trimmed.replace(timeRegex, '').trim()
      for (const m of matches) {
        const min = parseInt(m[1], 10)
        const sec = parseInt(m[2], 10)
        const msStr = m[3] || '0'
        const ms = parseFloat(`0.${msStr}`)
        // Add file-level offset if present
        const timeInSec = Math.max(0, (min * 60 + sec + ms) + fileOffsetSec)
        lines.push({ time: timeInSec, text })
      }
    } else if (!hasTimestamp && !trimmed.startsWith('[')) {
      // Plain unsynced text line
      lines.push({ time: null, text: trimmed })
    }
  }

  if (hasTimestamp) {
    lines.sort((a, b) => (a.time || 0) - (b.time || 0))

    // Prepend intro instrumental note line if first lyric line starts after 4s
    if (lines.length > 0 && lines[0].time > 4) {
      lines.unshift({ time: 0, text: '♪', isInstrumental: true })
    }

    // Insert instrumental note lines ONLY for long gaps (>= 12 seconds) between lyrics
    const withInstrumentals = []
    for (let i = 0; i < lines.length; i++) {
      withInstrumentals.push(lines[i])
      if (i < lines.length - 1) {
        const gap = lines[i + 1].time - lines[i].time
        if (gap >= 12) {
          withInstrumentals.push({
            time: lines[i].time + 6,
            text: '♪',
            isInstrumental: true
          })
        }
      }
    }

    return { lines: withInstrumentals, isSynced: true, offsetSec: fileOffsetSec }
  }

  return { lines, isSynced: false, offsetSec: 0 }
}

export default function LyricsView({
  track,
  currentTime = 0,
  duration = 0,
  lyricsData,
  loading = false,
  onSeek,
  onClose,
  isPlaying,
  onTogglePlay,
  token
}) {
  const fullContainerRef = useRef(null)
  const containerRef = useRef(null)
  const activeLineRef = useRef(null)
  const userScrollTimeoutRef = useRef(null)
  const hideControlsTimeoutRef = useRef(null)
  const [userIsScrolling, setUserIsScrolling] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [controlsVisible, setControlsVisible] = useState(true)
  const COLORFUL_THEMES = useMemo(() => [
    'combo1',
    'combo2',
    'combo3',
    'combo4',
    'red',
    'green',
    'blue'
  ], [])

  const [theme, setTheme] = useState(() => {
    try {
      const savedTheme = localStorage.getItem('sangita_lyrics_theme')
      if (savedTheme) return savedTheme
      const oldBg = localStorage.getItem('sangita_lyrics_dynamic_bg')
      if (oldBg === 'true') return 'combo1'
      return 'default'
    } catch {
      return 'default'
    }
  })

  const [isPendingClick, setIsPendingClick] = useState(false)
  const lastClickTimeRef = useRef(0)
  const clickTimerRef = useRef(null)

  const handleAmbientClick = useCallback(() => {
    const now = Date.now()
    const elapsed = now - lastClickTimeRef.current

    // Double-click detected: 2 clicks within 1.5 seconds (1500ms)
    if (elapsed < 1500 && lastClickTimeRef.current > 0) {
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current)
        clickTimerRef.current = null
      }
      setIsPendingClick(false)
      lastClickTimeRef.current = 0

      setTheme((prev) => {
        // Toggle Black / White
        const next = prev === 'black' ? 'white' : 'black'
        try {
          localStorage.setItem('sangita_lyrics_theme', next)
          localStorage.setItem('sangita_lyrics_dynamic_bg', 'true')
        } catch {}
        return next
      })
      return
    }

    // Single click detected: start timer for ~1.5s delay to allow double-click window
    lastClickTimeRef.current = now
    setIsPendingClick(true)

    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current)
    }

    clickTimerRef.current = setTimeout(() => {
      setIsPendingClick(false)
      lastClickTimeRef.current = 0
      clickTimerRef.current = null

      setTheme((prev) => {
        // If in monochrome mode (black or white), return to colorful themes
        if (prev === 'black' || prev === 'white') {
          const next = 'combo1'
          try {
            localStorage.setItem('sangita_lyrics_theme', next)
            localStorage.setItem('sangita_lyrics_dynamic_bg', 'true')
          } catch {}
          return next
        }

        // Cycle through the 7 colorful combinations: default -> combo1 -> combo2 -> combo3 -> combo4 -> red -> green -> blue -> default
        const idx = COLORFUL_THEMES.indexOf(prev)
        let next
        if (idx === -1) {
          next = COLORFUL_THEMES[0] // combo1
        } else if (idx === COLORFUL_THEMES.length - 1) {
          next = 'default'
        } else {
          next = COLORFUL_THEMES[idx + 1]
        }

        try {
          localStorage.setItem('sangita_lyrics_theme', next)
          localStorage.setItem('sangita_lyrics_dynamic_bg', next !== 'default' ? 'true' : 'false')
        } catch {}
        return next
      })
    }, 1500)
  }, [COLORFUL_THEMES])

  useEffect(() => {
    return () => {
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current)
      }
    }
  }, [])

  const toggleFullscreen = useCallback(async () => {
    const isCurrentlyFs = !!(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement
    )

    if (!isCurrentlyFs && !isFullscreen) {
      setIsFullscreen(true)
      try {
        const el = fullContainerRef.current || document.documentElement
        if (el?.requestFullscreen) {
          await el.requestFullscreen()
        } else if (el?.webkitRequestFullscreen) {
          await el.webkitRequestFullscreen()
        } else if (el?.mozRequestFullScreen) {
          await el.mozRequestFullScreen()
        } else if (el?.msRequestFullscreen) {
          await el.msRequestFullscreen()
        }
      } catch {
        // Fallback: CSS fullscreen active
      }
    } else {
      setIsFullscreen(false)
      try {
        if (document.exitFullscreen) {
          await document.exitFullscreen()
        } else if (document.webkitExitFullscreen) {
          await document.webkitExitFullscreen()
        } else if (document.mozCancelFullScreen) {
          await document.mozCancelFullScreen()
        } else if (document.msExitFullscreen) {
          await document.msExitFullscreen()
        }
      } catch {
        // Fallback
      }
    }
  }, [isFullscreen])

  // Sync fullscreen state with native browser events (e.g. Esc or F11)
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFs = !!(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement
      )
      setIsFullscreen(isFs)
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange)
    document.addEventListener('mozfullscreenchange', handleFullscreenChange)
    document.addEventListener('MSFullscreenChange', handleFullscreenChange)

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange)
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange)
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange)
    }
  }, [])

  // Auto-hide controls in movie/cinema fullscreen mode when inactive
  const handleMouseMove = useCallback(() => {
    if (!isFullscreen) return
    setControlsVisible(true)
    if (hideControlsTimeoutRef.current) {
      clearTimeout(hideControlsTimeoutRef.current)
    }
    hideControlsTimeoutRef.current = setTimeout(() => {
      setControlsVisible(false)
    }, 3500)
  }, [isFullscreen])

  useEffect(() => {
    if (!isFullscreen) {
      setControlsVisible(true)
      if (hideControlsTimeoutRef.current) {
        clearTimeout(hideControlsTimeoutRef.current)
      }
    }
  }, [isFullscreen])

  useEffect(() => {
    if (isFullscreen) {
      document.body.classList.add('lyrics-fullscreen-active')
    } else {
      document.body.classList.remove('lyrics-fullscreen-active')
    }
    return () => {
      document.body.classList.remove('lyrics-fullscreen-active')
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {})
      }
    }
  }, [isFullscreen])

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isFullscreen) {
        if (document.fullscreenElement && document.exitFullscreen) {
          document.exitFullscreen().catch(() => {})
        }
        setIsFullscreen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isFullscreen])

  const handleClose = useCallback(() => {
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {})
    }
    setIsFullscreen(false)
    if (onClose) {
      onClose()
    }
  }, [onClose])

  const trackKey = track?.path || track?.name || 'default'
  const [userOffsetSec, setUserOffsetSec] = useState(() => {
    try {
      const saved = localStorage.getItem(`sangita_lyrics_offset_${trackKey}`)
      const parsed = parseFloat(saved)
      return Number.isFinite(parsed) ? parsed : 0
    } catch {
      return 0
    }
  })

  // Update offset when track changes
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`sangita_lyrics_offset_${trackKey}`)
      const parsed = parseFloat(saved)
      setUserOffsetSec(Number.isFinite(parsed) ? parsed : 0)
    } catch {
      setUserOffsetSec(0)
    }
  }, [trackKey])

  const safeOffset = Number.isFinite(userOffsetSec) ? userOffsetSec : 0

  const handleAdjustOffset = (delta) => {
    setUserOffsetSec((prev) => {
      const current = Number.isFinite(prev) ? prev : 0
      const next = Math.round((current + delta) * 10) / 10
      try {
        localStorage.setItem(`sangita_lyrics_offset_${trackKey}`, next.toString())
      } catch {}
      return next
    })
  }

  const handleResetOffset = () => {
    setUserOffsetSec(0)
    try {
      localStorage.removeItem(`sangita_lyrics_offset_${trackKey}`)
    } catch {}
  }

  const rawLyrics = lyricsData?.raw || ''
  const hasLyrics = !!lyricsData?.has_lyrics

  const { lines, isSynced } = useMemo(() => {
    return parseLRC(rawLyrics)
  }, [rawLyrics])

  // Find active line index based on currentTime + 150ms lookahead + user calibration
  const activeIndex = useMemo(() => {
    if (!isSynced || !Array.isArray(lines) || lines.length === 0) return -1
    const target = currentTime + 0.15 + safeOffset

    let found = -1
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].time <= target) {
        found = i
      } else {
        break
      }
    }
    return found
  }, [lines, currentTime, isSynced, userOffsetSec])

  // Handle user manual scroll interruption
  const handleUserScroll = useCallback(() => {
    setUserIsScrolling(true)
    if (userScrollTimeoutRef.current) {
      clearTimeout(userScrollTimeoutRef.current)
    }
    userScrollTimeoutRef.current = setTimeout(() => {
      setUserIsScrolling(false)
    }, 4000)
  }, [])

  const hasMountedRef = useRef(false)

  // Auto-scroll active line to center when not interrupted
  useEffect(() => {
    if (userIsScrolling) return

    const container = containerRef.current

    if (activeIndex < 0) {
      if (container && container.scrollTop > 0) {
        if (typeof container.scrollTo === 'function') {
          container.scrollTo({ top: 0, behavior: hasMountedRef.current ? 'smooth' : 'auto' })
        } else {
          container.scrollTop = 0
        }
      }
      hasMountedRef.current = true
      return
    }

    const activeLine = activeLineRef.current
    if (container && activeLine) {
      const containerRect = container.getBoundingClientRect()
      const activeRect = activeLine.getBoundingClientRect()
      const currentScrollTop = container.scrollTop

      // Target scrollTop that aligns the center of the active line with the center of the container
      const relativeTop = activeRect.top - containerRect.top + currentScrollTop
      const targetScrollTop = Math.max(
        0,
        relativeTop - (containerRect.height / 2) + (activeRect.height / 2)
      )

      const behavior = hasMountedRef.current ? 'smooth' : 'auto'
      if (typeof container.scrollTo === 'function') {
        container.scrollTo({
          top: targetScrollTop,
          behavior
        })
      } else if (typeof activeLine.scrollIntoView === 'function') {
        activeLine.scrollIntoView({
          behavior,
          block: 'center'
        })
      }
      hasMountedRef.current = true
    } else if (activeLine?.scrollIntoView) {
      activeLine.scrollIntoView({
        behavior: hasMountedRef.current ? 'smooth' : 'auto',
        block: 'center'
      })
      hasMountedRef.current = true
    }
  }, [activeIndex, userIsScrolling])

  useEffect(() => {
    return () => {
      if (userScrollTimeoutRef.current) clearTimeout(userScrollTimeoutRef.current)
    }
  }, [])

  const resumeAutoScroll = () => {
    setUserIsScrolling(false)
    const container = containerRef.current
    const activeLine = activeLineRef.current
    if (container && activeLine) {
      const containerRect = container.getBoundingClientRect()
      const activeRect = activeLine.getBoundingClientRect()
      const relativeTop = activeRect.top - containerRect.top + container.scrollTop
      const targetScrollTop = Math.max(
        0,
        relativeTop - (containerRect.height / 2) + (activeRect.height / 2)
      )
      if (typeof container.scrollTo === 'function') {
        container.scrollTo({ top: targetScrollTop, behavior: 'smooth' })
      } else if (typeof activeLine.scrollIntoView === 'function') {
        activeLine.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    } else if (activeLineRef.current && typeof activeLineRef.current.scrollIntoView === 'function') {
      activeLineRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  const handleLineClick = (lineTime) => {
    if (lineTime !== null && typeof lineTime === 'number' && onSeek) {
      onSeek(lineTime)
    }
  }

  const isDynamic = ['combo1', 'combo2', 'combo3', 'combo4'].includes(theme)
  const themeClass = theme && theme !== 'default' ? `theme-${theme}` : ''

  return (
    <div
      ref={fullContainerRef}
      className={`lyrics-view-container ${isFullscreen ? 'fullscreen-mode' : ''} ${isDynamic ? 'dynamic-bg' : ''} ${themeClass} ${isFullscreen && !controlsVisible ? 'cursor-hidden' : ''}`}
      onMouseMove={handleMouseMove}
      data-testid="lyrics-view"
    >
      {/* Top Floating Header */}
      <div className={`lyrics-view-header ${isFullscreen && !controlsVisible ? 'controls-hidden' : ''}`}>
        <div className="lyrics-track-info">
          <span className="lyrics-tag">SYNCED LYRICS</span>
          <h2 className="lyrics-track-title" title={track?.name}>
            {track?.name || 'Now Playing'}
          </h2>
          <span className="lyrics-track-artist">
            {track?.artist || track?.playlist || 'Sangita Audio'}
          </span>
        </div>

        <div className="lyrics-header-actions">
          {isSynced && (
            <div className="lyrics-sync-nudge-group" title="Fine-tune audio/lyrics synchronization if early or late">
              <button
                className="btn-sync-nudge"
                onClick={() => handleAdjustOffset(-0.5)}
                title="Shift lyrics earlier (-0.5s)"
                data-testid="lyrics-nudge-earlier"
              >
                -0.5s
              </button>
              <button
                className={`btn-sync-offset-pill ${safeOffset !== 0 ? 'calibrated' : ''}`}
                onClick={handleResetOffset}
                title="Click to reset sync calibration to 0.0s"
                data-testid="lyrics-offset-reset"
              >
                {safeOffset === 0 ? 'Sync: 0.0s' : `${safeOffset > 0 ? '+' : ''}${safeOffset.toFixed(1)}s`}
              </button>
              <button
                className="btn-sync-nudge"
                onClick={() => handleAdjustOffset(+0.5)}
                title="Shift lyrics later (+0.5s)"
                data-testid="lyrics-nudge-later"
              >
                +0.5s
              </button>
            </div>
          )}

          {userIsScrolling && isSynced && (
            <button
              className="btn-sync-scroll"
              onClick={resumeAutoScroll}
              title="Jump to currently playing line"
              data-testid="lyrics-sync-scroll-btn"
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
              </svg>
              <span>Jump to Current</span>
            </button>
          )}

          {/* Dynamic Moving Gradient Background Toggle */}
          <button
            className={`btn-icon lyrics-action-icon-btn lyrics-ambient-btn ${theme !== 'default' ? 'active' : ''} ${isPendingClick ? 'pending-click' : ''}`}
            onClick={handleAmbientClick}
            title={theme === 'default' ? "Turn on moving background" : "Turn off moving background"}
            data-testid="lyrics-ambient-bg-btn"
          >
            <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor">
              <path d="M12 2L9.5 8.5 3 11l6.5 2.5L12 20l2.5-6.5L21 11l-6.5-2.5L12 2zm7 13l-1.25 2.75L15 19l2.75 1.25L19 23l1.25-2.75L23 19l-2.75-1.25L19 15zM5 3L3.75 5.75 1 7l2.75 1.25L5 11l1.25-2.75L9 7 6.25 5.75 5 3z"/>
            </svg>
          </button>

          {/* Maximize / Minimize Fullscreen Toggle */}
          <button
            className={`btn-icon lyrics-action-icon-btn lyrics-maximize-btn ${isFullscreen ? 'active' : ''}`}
            onClick={toggleFullscreen}
            title={isFullscreen ? "Minimize to normal view (Esc)" : "Maximize (Full screen)"}
            data-testid="lyrics-maximize-btn"
          >
            {isFullscreen ? (
              <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor">
                <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/>
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor">
                <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
              </svg>
            )}
          </button>

          {/* Close 'X' Button */}
          <button
            className="btn-icon lyrics-close-btn"
            onClick={handleClose}
            title="Close Lyrics (Return to Playlist)"
            data-testid="lyrics-close-btn"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Main Lyrics Body */}
      <div
        className={`lyrics-scroll-body ${isSynced ? 'is-synced-mode' : 'is-plain-mode'}`}
        ref={containerRef}
        onWheel={handleUserScroll}
        onTouchMove={handleUserScroll}
      >
        {loading ? (
          <div className="lyrics-empty-state">
            <div className="spinner" />
            <p>Loading synced lyrics…</p>
          </div>
        ) : !hasLyrics || lines.length === 0 ? (
          <div className="lyrics-empty-state" data-testid="lyrics-empty">
            <div className="music-note-card" title="Playing music">
              <span className="music-note-symbol">♪</span>
            </div>
            <h3>No lyrics avaliable Sorry :)</h3>
            <button className="btn-modal-primary" onClick={onClose} style={{ marginTop: 16 }}>
              Return to Library
            </button>
          </div>
        ) : (
          <div className={`lyrics-lines-wrapper ${isSynced ? 'is-synced' : 'is-plain'}`}>
            {lines.map((line, idx) => {
              const isActive = idx === activeIndex
              const isPast = idx < activeIndex
              const isFuture = idx > activeIndex

              return (
                <div
                  key={idx}
                  ref={isActive ? activeLineRef : null}
                  className={`lyric-line ${isActive ? 'active' : ''} ${isPast ? 'past' : ''} ${isFuture ? 'future' : ''} ${isSynced ? 'clickable' : ''}`}
                  onClick={() => handleLineClick(line.time)}
                  data-testid={`lyric-line-${idx}`}
                  title={isSynced ? `Click to jump to ${line.text || 'this line'}` : undefined}
                >
                  <span className="lyric-text">
                    {line.text && line.text !== '♪' ? (
                      line.text
                    ) : (
                      <span className="music-note-symbol">♪</span>
                    )}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Floating Movie Cinema Playback Controls in Fullscreen */}
      {isFullscreen && (
        <div
          className={`lyrics-fullscreen-player ${!controlsVisible ? 'controls-hidden' : ''}`}
          data-testid="lyrics-fs-player"
        >
          <button
            className="lyrics-fs-play-btn"
            onClick={onTogglePlay}
            title={isPlaying ? "Pause" : "Play"}
            data-testid="lyrics-fs-play-btn"
          >
            {isPlaying ? (
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                <path d="M8 5v14l11-7z"/>
              </svg>
            )}
          </button>
          <span className="lyrics-fs-time">{formatLyricsTime(currentTime)}</span>
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.5}
            value={currentTime || 0}
            onChange={(e) => onSeek && onSeek(parseFloat(e.target.value))}
            className="lyrics-fs-slider"
            title="Seek position"
            data-testid="lyrics-fs-slider"
          />
          <span className="lyrics-fs-time">{formatLyricsTime(duration)}</span>
        </div>
      )}
    </div>
  )
}

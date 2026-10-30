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

export function findActiveLineIndex(lines, targetTime) {
  if (!Array.isArray(lines) || lines.length === 0) return -1
  if (targetTime < lines[0].time) return -1

  let low = 0
  let high = lines.length - 1
  let result = -1

  while (low <= high) {
    const mid = (low + high) >> 1
    if (lines[mid].time <= targetTime) {
      result = mid
      low = mid + 1
    } else {
      high = mid - 1
    }
  }

  return result
}

export default function LyricsView({
  track,
  audioRef,
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
  const userIsScrollingRef = useRef(false)
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

    // Double-click detected: 2 clicks within 1.0 second (1000ms)
    if (elapsed < 1000 && lastClickTimeRef.current > 0) {
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

    // Single click detected: start timer for 1.0s delay to allow double-click window
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
    }, 1000)
  }, [COLORFUL_THEMES])

  useEffect(() => {
    return () => {
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current)
      }
    }
  }, [])

  const toggleFullscreen = useCallback(async () => {
    // Reset manual scroll interrupted state so entering/exiting fullscreen tracks immediately
    userIsScrollingRef.current = false
    setUserIsScrolling(false)
    if (userScrollTimeoutRef.current) {
      clearTimeout(userScrollTimeoutRef.current)
    }

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
      userIsScrollingRef.current = false
      setUserIsScrolling(false)
      if (userScrollTimeoutRef.current) {
        clearTimeout(userScrollTimeoutRef.current)
      }
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

  // Keep a ref to the latest currentTime prop so rAF loops have access without closure lag
  const currentTimeRef = useRef(currentTime)
  useEffect(() => {
    currentTimeRef.current = currentTime
  }, [currentTime])

  // Synchronously compute initial active index
  const [activeIndex, setActiveIndex] = useState(() => {
    if (!isSynced || !Array.isArray(lines) || lines.length === 0) return -1
    return findActiveLineIndex(lines, currentTime + 0.15 + safeOffset)
  })
  const activeIndexRef = useRef(activeIndex)

  // Returns the precise playback timestamp:
  // - If the local HTMLAudioElement is actively playing, reads audio.currentTime for sub-frame precision.
  // - If remote playback (e.g. phone controlling PC), audio is paused, or audioElement isn't running,
  //   reliably uses the reactive currentTime state prop from App.jsx.
  const getEffectiveCurrentTime = useCallback(() => {
    const audioElement = audioRef?.current || (typeof document !== 'undefined' ? document.querySelector('audio') : null)
    if (
      audioElement &&
      !audioElement.paused &&
      !audioElement.ended &&
      typeof audioElement.currentTime === 'number' &&
      !isNaN(audioElement.currentTime) &&
      audioElement.currentTime > 0
    ) {
      return audioElement.currentTime
    }
    return currentTimeRef.current
  }, [audioRef])

  // Sync state when currentTime prop changes externally or while paused
  useEffect(() => {
    if (!isSynced || !Array.isArray(lines) || lines.length === 0) {
      if (activeIndexRef.current !== -1) {
        activeIndexRef.current = -1
        setActiveIndex(-1)
      }
      return
    }

    const currentSec = getEffectiveCurrentTime()
    const targetTime = currentSec + 0.15 + safeOffset
    const newIdx = findActiveLineIndex(lines, targetTime)
    if (newIdx !== activeIndexRef.current) {
      activeIndexRef.current = newIdx
      setActiveIndex(newIdx)
      if (userIsScrollingRef.current) {
        userIsScrollingRef.current = false
        setUserIsScrolling(false)
      }
    }
  }, [currentTime, safeOffset, lines, isSynced, getEffectiveCurrentTime])

  // Real-time rAF loop while playing: reads effective playback time directly and triggers state update when index changes
  useEffect(() => {
    if (!isPlaying || !isSynced || !Array.isArray(lines) || lines.length === 0) return

    let rafId = null

    const tick = () => {
      const currentSec = getEffectiveCurrentTime()
      const targetTime = currentSec + 0.15 + safeOffset
      const newIdx = findActiveLineIndex(lines, targetTime)

      if (newIdx !== activeIndexRef.current) {
        activeIndexRef.current = newIdx
        setActiveIndex(newIdx)
        // Auto-resume auto-scroll when next line activates
        if (userIsScrollingRef.current) {
          userIsScrollingRef.current = false
          setUserIsScrolling(false)
          if (userScrollTimeoutRef.current) {
            clearTimeout(userScrollTimeoutRef.current)
          }
        }
      }

      rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)
    return () => {
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [isPlaying, isSynced, lines, safeOffset, getEffectiveCurrentTime])

  // Smooth lerp scrolling engine (Apple Music / Spotify fluid glide)
  const targetScrollRef = useRef(0)
  const scrollRafRef = useRef(null)

  const scrollToActiveLine = useCallback((forcedIndex = null, forceOverride = false, instant = false) => {
    if (forceOverride) {
      userIsScrollingRef.current = false
      setUserIsScrolling(false)
      if (userScrollTimeoutRef.current) {
        clearTimeout(userScrollTimeoutRef.current)
      }
    }
    if (userIsScrollingRef.current) return
    const container = containerRef.current
    if (!container) return

    const idx = forcedIndex !== null ? forcedIndex : activeIndexRef.current
    if (idx < 0) {
      targetScrollRef.current = 0
    } else {
      const activeLineEl = container.querySelector(`[data-line-index="${idx}"]`)
      if (activeLineEl) {
        const containerRect = container.getBoundingClientRect()
        if (containerRect.height > 0) {
          const lineRect = activeLineEl.getBoundingClientRect()
          const currentScrollTop = container.scrollTop

          // Target position at ~50% (middle) of container
          const relativeTop = lineRect.top - containerRect.top + currentScrollTop
          const targetOffset = containerRect.height * 0.50
          targetScrollRef.current = Math.max(0, relativeTop - targetOffset + (lineRect.height * 0.5))
        }
      }
    }

    const prefersReducedMotion = typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (instant || prefersReducedMotion) {
      if (scrollRafRef.current) {
        cancelAnimationFrame(scrollRafRef.current)
        scrollRafRef.current = null
      }
      container.scrollTop = targetScrollRef.current
      return
    }

    if (!scrollRafRef.current) {
      const step = () => {
        if (userIsScrollingRef.current || !containerRef.current) {
          scrollRafRef.current = null
          return
        }

        const current = containerRef.current.scrollTop
        const target = targetScrollRef.current
        const diff = target - current

        if (Math.abs(diff) < 0.75) {
          containerRef.current.scrollTop = target
          scrollRafRef.current = null
          return
        }

        // Fluid 0.065 lerp step smoothly curves toward target with extra silky deceleration
        containerRef.current.scrollTop = current + diff * 0.065
        scrollRafRef.current = requestAnimationFrame(step)
      }
      scrollRafRef.current = requestAnimationFrame(step)
    }
  }, [])

  useEffect(() => {
    scrollToActiveLine()
  }, [activeIndex, scrollToActiveLine])

  // Automatically re-center active lyrics whenever fullscreen mode is entered or exited
  useEffect(() => {
    userIsScrollingRef.current = false
    setUserIsScrolling(false)
    if (userScrollTimeoutRef.current) {
      clearTimeout(userScrollTimeoutRef.current)
    }

    // Double-pulse to catch both immediate CSS layout change and native browser fullscreen animation
    const t0 = requestAnimationFrame(() => {
      scrollToActiveLine(null, true, true)
    })
    const t1 = setTimeout(() => {
      scrollToActiveLine(null, true, false)
    }, 60)
    const t2 = setTimeout(() => {
      scrollToActiveLine(null, true, false)
    }, 200)
    const t3 = setTimeout(() => {
      scrollToActiveLine(null, true, false)
    }, 450)

    return () => {
      cancelAnimationFrame(t0)
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
    }
  }, [isFullscreen, scrollToActiveLine])

  // Automatically re-center active lyrics on container resize or device orientation change
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let ro = null
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => {
        if (!userIsScrollingRef.current) {
          scrollToActiveLine(null, false, false)
        }
      })
      ro.observe(container)
    }

    const handleWindowResize = () => {
      if (!userIsScrollingRef.current) {
        scrollToActiveLine(null, false, false)
      }
    }
    window.addEventListener('resize', handleWindowResize)
    window.addEventListener('orientationchange', handleWindowResize)

    return () => {
      if (ro) ro.disconnect()
      window.removeEventListener('resize', handleWindowResize)
      window.removeEventListener('orientationchange', handleWindowResize)
    }
  }, [scrollToActiveLine])

  // Handle user manual scroll interruption (pause auto-scroll and resume after 10 seconds of inactivity)
  const handleUserScroll = useCallback(() => {
    userIsScrollingRef.current = true
    setUserIsScrolling(true)
    if (scrollRafRef.current) {
      cancelAnimationFrame(scrollRafRef.current)
      scrollRafRef.current = null
    }
    if (userScrollTimeoutRef.current) {
      clearTimeout(userScrollTimeoutRef.current)
    }
    userScrollTimeoutRef.current = setTimeout(() => {
      userIsScrollingRef.current = false
      setUserIsScrolling(false)
      scrollToActiveLine()
    }, 10000)
  }, [scrollToActiveLine])

  const resumeAutoScroll = useCallback(() => {
    userIsScrollingRef.current = false
    setUserIsScrolling(false)
    if (userScrollTimeoutRef.current) {
      clearTimeout(userScrollTimeoutRef.current)
    }
    scrollToActiveLine(null, true)
  }, [scrollToActiveLine])

  const handleLineClick = useCallback((lineTime, lineIndex) => {
    if (lineTime !== null && typeof lineTime === 'number' && onSeek) {
      onSeek(lineTime)
    }
    userIsScrollingRef.current = false
    setUserIsScrolling(false)
    if (userScrollTimeoutRef.current) {
      clearTimeout(userScrollTimeoutRef.current)
    }
    scrollToActiveLine(lineIndex, true)
  }, [onSeek, scrollToActiveLine])

  // Keyboard navigation on lyric lines (ArrowUp/Down, Enter/Space to seek, Home/End)
  const handleLineKeyDown = useCallback((e, line, idx) => {
    if (!isSynced) return

    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleLineClick(line.time, idx)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      const nextIdx = Math.min(lines.length - 1, idx + 1)
      const nextEl = containerRef.current?.querySelector(`[data-line-index="${nextIdx}"]`)
      nextEl?.focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const prevIdx = Math.max(0, idx - 1)
      const prevEl = containerRef.current?.querySelector(`[data-line-index="${prevIdx}"]`)
      prevEl?.focus()
    } else if (e.key === 'Home') {
      e.preventDefault()
      const firstEl = containerRef.current?.querySelector(`[data-line-index="0"]`)
      firstEl?.focus()
    } else if (e.key === 'End') {
      e.preventDefault()
      const lastEl = containerRef.current?.querySelector(`[data-line-index="${lines.length - 1}"]`)
      lastEl?.focus()
    }
  }, [isSynced, lines.length, handleLineClick])

  useEffect(() => {
    return () => {
      if (userScrollTimeoutRef.current) clearTimeout(userScrollTimeoutRef.current)
      if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current)
    }
  }, [])

  const isDynamic = ['combo1', 'combo2', 'combo3', 'combo4'].includes(theme)
  const themeClass = theme && theme !== 'default' ? `theme-${theme}` : ''

  return (
    <div
      ref={fullContainerRef}
      className={`lyrics-view-container ${isFullscreen ? 'fullscreen-mode' : ''} ${isDynamic ? 'dynamic-bg' : ''} ${themeClass} ${isFullscreen && !controlsVisible ? 'cursor-hidden' : ''}`}
      onMouseMove={handleMouseMove}
      onTouchStart={handleMouseMove}
      onClick={handleMouseMove}
      data-testid="lyrics-view"
    >
      {/* Top Floating Header */}
      <div className="lyrics-view-header">
        <div className="lyrics-track-info">
          <h2 className="lyrics-track-title" title={track?.name}>
            {track?.name || 'Now Playing'}
          </h2>
          <div className="lyrics-track-meta">
            <span className="lyrics-track-artist">
              {track?.artist || track?.playlist || 'Sangita Audio'}
            </span>
            <span className="lyrics-track-timestamp" title="Current track time">
              • {formatLyricsTime(currentTime)} / {formatLyricsTime(duration)}
            </span>
          </div>
        </div>

        <div className={`lyrics-header-actions ${isFullscreen && !controlsVisible ? 'controls-hidden' : ''}`}>
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

      {/* Subtle Persistent Exit Cue in Fullscreen */}
      {isFullscreen && (
        <button
          type="button"
          className="lyrics-fs-exit-cue"
          onClick={toggleFullscreen}
          title="Exit full screen (Esc)"
          aria-label="Exit full screen"
          data-testid="lyrics-fs-exit-cue"
        >
          <kbd>Esc</kbd>
          <span>Exit</span>
        </button>
      )}

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
            <h3>No lyrics available</h3>
            <p>Lyrics haven't been synchronized or added for this song yet.</p>
            <button className="btn-modal-primary" onClick={onClose} style={{ marginTop: 16 }}>
              Return to Library
            </button>
          </div>
        ) : (
          <div className={`lyrics-lines-wrapper ${isSynced ? 'is-synced' : 'is-plain'}`}>
            {lines.map((line, idx) => {
              const isActive = idx === activeIndex
              const isPast = activeIndex >= 0 && idx < activeIndex
              const isFuture = activeIndex >= 0 && idx > activeIndex
              const distance = activeIndex >= 0 ? Math.abs(idx - activeIndex) : -1

              let distClass = ''
              if (isActive) distClass = 'distance-0'
              else if (distance === 1) distClass = 'distance-1'
              else if (distance === 2) distClass = 'distance-2'
              else if (distance >= 3) distClass = 'distance-far'

              return (
                <div
                  key={idx}
                  ref={isActive ? activeLineRef : null}
                  data-line-index={idx}
                  role={isSynced ? 'button' : undefined}
                  tabIndex={isSynced ? 0 : undefined}
                  aria-current={isActive ? 'time' : undefined}
                  className={`lyric-line ${isActive ? 'active' : ''} ${isPast ? 'past' : ''} ${isFuture ? 'future' : ''} ${distClass} ${isSynced ? 'clickable' : ''}`}
                  onClick={() => handleLineClick(line.time, idx)}
                  onKeyDown={(e) => handleLineKeyDown(e, line, idx)}
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
                  {isSynced && line.time !== null && (
                    <span className="lyric-line-preview" aria-hidden="true">
                      <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
                        <path d="M8 5v14l11-7z"/>
                      </svg>
                      <span>{formatLyricsTime(line.time)}</span>
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Floating "Return to Current Line" Pill when user has scrolled away */}
      {userIsScrolling && isSynced && (
        <div className="lyrics-floating-return-container">
          <button
            className="btn-sync-scroll btn-floating-return"
            onClick={resumeAutoScroll}
            title="Return to currently playing line"
            data-testid="lyrics-sync-scroll-btn"
            aria-label="Return to currently playing line"
          >
            <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
              <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
            </svg>
            <span>Return to Current Line</span>
          </button>
        </div>
      )}

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

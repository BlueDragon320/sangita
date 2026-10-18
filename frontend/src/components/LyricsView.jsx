import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'

function strHue(str) {
  let h = 0
  for (const c of (str || '')) h = (h * 31 + c.charCodeAt(0)) | 0
  return Math.abs(h) % 360
}

function parseLRC(lrcText) {
  if (!lrcText || typeof lrcText !== 'string') return { lines: [], isSynced: false }

  const lines = []
  const rawLines = lrcText.split(/\r?\n/)
  // Regex to match [mm:ss.xx] or [mm:ss.xxx]
  const timeRegex = /\[(\d{2}):(\d{2})(?:\.(\d{1,3}))?\]/g

  let hasTimestamp = false

  for (const raw of rawLines) {
    const trimmed = raw.trim()
    if (!trimmed) continue

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
        const timeInSec = min * 60 + sec + ms
        lines.push({ time: timeInSec, text })
      }
    } else if (!hasTimestamp && !trimmed.startsWith('[')) {
      // Plain unsynced text line
      lines.push({ time: null, text: trimmed })
    }
  }

  if (hasTimestamp) {
    lines.sort((a, b) => (a.time || 0) - (b.time || 0))

    // Prepend intro instrumental note line if first lyric line starts after 3s
    if (lines.length > 0 && lines[0].time > 3) {
      lines.unshift({ time: 0, text: '♪', isInstrumental: true })
    }

    // Insert instrumental note lines for long gaps (>= 8 seconds) between lyrics
    const withInstrumentals = []
    for (let i = 0; i < lines.length; i++) {
      withInstrumentals.push(lines[i])
      if (i < lines.length - 1) {
        const gap = lines[i + 1].time - lines[i].time
        if (gap >= 8) {
          withInstrumentals.push({
            time: lines[i].time + 4,
            text: '♪',
            isInstrumental: true
          })
        }
      }
    }

    return { lines: withInstrumentals, isSynced: true }
  }

  return { lines, isSynced: false }
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
  const containerRef = useRef(null)
  const activeLineRef = useRef(null)
  const userScrollTimeoutRef = useRef(null)
  const [userIsScrolling, setUserIsScrolling] = useState(false)

  const rawLyrics = lyricsData?.raw || ''
  const hasLyrics = !!lyricsData?.has_lyrics

  const { lines, isSynced } = useMemo(() => {
    return parseLRC(rawLyrics)
  }, [rawLyrics])

  // Find active line index based on currentTime + 150ms lookahead
  const activeIndex = useMemo(() => {
    if (!isSynced || lines.length === 0) return -1
    const target = currentTime + 0.15

    let found = -1
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].time <= target) {
        found = i
      } else {
        break
      }
    }
    return found
  }, [lines, currentTime, isSynced])

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

  // Auto-scroll active line to center when not interrupted
  useEffect(() => {
    if (!userIsScrolling && activeLineRef.current && activeIndex >= 0) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      })
    }
  }, [activeIndex, userIsScrolling])

  useEffect(() => {
    return () => {
      if (userScrollTimeoutRef.current) clearTimeout(userScrollTimeoutRef.current)
    }
  }, [])

  const hue = strHue(track?.name || 'Sangita')

  const resumeAutoScroll = () => {
    setUserIsScrolling(false)
    if (activeLineRef.current) {
      activeLineRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  const handleLineClick = (lineTime) => {
    if (lineTime !== null && typeof lineTime === 'number' && onSeek) {
      onSeek(lineTime)
    }
  }

  return (
    <div
      className="lyrics-view-container"
      style={{
        '--lyrics-hue': `${hue}deg`,
        background: `radial-gradient(circle at 50% 20%, hsl(${hue}, 45%, 16%) 0%, var(--bg) 80%)`
      }}
      data-testid="lyrics-view"
    >
      {/* Top Floating Header */}
      <div className="lyrics-view-header">
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

          <button
            className="btn-icon lyrics-close-btn"
            onClick={onClose}
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
        className="lyrics-scroll-body"
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
            <div className={`music-note-card ${isPlaying ? 'glowing' : ''}`} title="Playing music">
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
    </div>
  )
}

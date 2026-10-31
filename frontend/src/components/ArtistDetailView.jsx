import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import TrackList from './TrackList.jsx'
import './DiscoverView.css'

function strHue(str) {
  let h = 0
  for (const c of (str || '')) h = (h * 31 + c.charCodeAt(0)) | 0
  return Math.abs(h) % 360
}

function formatTotalDuration(tracks = [], durations = {}) {
  let totalSec = 0
  for (const t of tracks) {
    if (durations[t.path]) {
      totalSec += durations[t.path]
    }
  }
  const count = tracks.length
  if (totalSec <= 0) {
    return `${count} song${count !== 1 ? 's' : ''}`
  }
  const hrs = Math.floor(totalSec / 3600)
  const mins = Math.floor((totalSec % 3600) / 60)
  if (hrs > 0) {
    return `${count} song${count !== 1 ? 's' : ''}, about ${hrs} hr ${mins} min`
  }
  return `${count} song${count !== 1 ? 's' : ''}, ${mins} min`
}

export default function ArtistDetailView({
  artistId,
  artistName,
  artist: initialArtist,
  playlists = {},
  trackMetadata = {},
  durations = {},
  token,
  currentTrack,
  isPlaying,
  onPlayTrack,
  onTogglePlay,
  onPlayAll,
  onShuffle,
  favorites = [],
  onToggleFavorite,
  onAddToPlaylist,
  onDownloadTrack,
  onBack,
  onToast,
  onRefreshPlaylists,
  userPlaylists = [],
  playlistMetadata = {},
  savedArtists = [],
  savedTracks = [],
  onToggleSaveArtist,
  onToggleSaveTrack
}) {
  const [v2ArtistDetails, setV2ArtistDetails] = useState(null)
  const [imgErr, setImgErr] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false)
  const [showAddAllModal, setShowAddAllModal] = useState(false)
  const [availablePlaylists, setAvailablePlaylists] = useState([])
  const [selectedPlaylistId, setSelectedPlaylistId] = useState('')
  const [createNew, setCreateNew] = useState(false)
  const [newPlaylistName, setNewPlaylistName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [toastMessage, setToastMessage] = useState(null)
  const [modalError, setModalError] = useState(null)
  const addAllTriggerBtnRef = useRef(null)
  const addAllModalRef = useRef(null)
  const menuRef = useRef(null)
  const actionMenuRef = useRef(null)

  // Escape key & click-outside listeners for dropdown menus
  useEffect(() => {
    if (!isMenuOpen && !isActionMenuOpen) return

    const handlePointerDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsMenuOpen(false)
      }
      if (actionMenuRef.current && !actionMenuRef.current.contains(e.target)) {
        setIsActionMenuOpen(false)
      }
    }

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsMenuOpen(false)
        setIsActionMenuOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isMenuOpen, isActionMenuOpen])

  // Complete dialog accessibility for Add All Tracks to Playlist
  useEffect(() => {
    if (!showAddAllModal) return

    const previousFocus = document.activeElement

    const timer = setTimeout(() => {
      if (!addAllModalRef.current) return
      const focusable = addAllModalRef.current.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
      if (focusable.length > 0) {
        focusable[0].focus()
      }
    }, 0)

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setShowAddAllModal(false)
        return
      }

      if (e.key === 'Tab') {
        if (!addAllModalRef.current) return
        const focusable = Array.from(addAllModalRef.current.querySelectorAll(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        ))
        if (focusable.length === 0) return

        const first = focusable[0]
        const last = focusable[focusable.length - 1]

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault()
            last.focus()
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault()
            first.focus()
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('keydown', handleKeyDown)
      if (addAllTriggerBtnRef.current && typeof addAllTriggerBtnRef.current.focus === 'function') {
        addAllTriggerBtnRef.current.focus()
      } else if (previousFocus && typeof previousFocus.focus === 'function') {
        previousFocus.focus()
      }
    }
  }, [showAddAllModal])

  const displayName = v2ArtistDetails?.name || initialArtist?.name || artistName || 'Unknown Artist'
  const effectiveArtistId = artistId || v2ArtistDetails?.id || initialArtist?.id || encodeURIComponent(displayName)

  const [isSavedLocal, setIsSavedLocal] = useState(null)

  const isSavedProp = useMemo(() => {
    if (v2ArtistDetails?.is_saved !== undefined) return Boolean(v2ArtistDetails.is_saved)
    if (initialArtist?.is_saved !== undefined) return Boolean(initialArtist.is_saved)
    if (Array.isArray(savedArtists)) {
      return savedArtists.some(a => {
        const aId = typeof a === 'object' ? (a?.id || a?.name) : a
        return String(aId) === String(effectiveArtistId) || String(aId) === String(displayName) || String(aId) === String(artistId)
      })
    }
    return false
  }, [v2ArtistDetails, initialArtist, savedArtists, effectiveArtistId, displayName, artistId])

  const isSaved = isSavedLocal !== null ? isSavedLocal : isSavedProp

  const handleToggleSaveArtist = useCallback(async () => {
    const nextSaved = !isSaved

    if (effectiveArtistId && token) {
      try {
        const method = nextSaved ? 'POST' : 'DELETE'
        const response = await fetch(`/api/v2/artists/${encodeURIComponent(effectiveArtistId)}/save`, {
          method,
          headers: { Authorization: `Bearer ${token}` }
        })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
      } catch (err) {
        console.warn('Failed to toggle artist save:', err)
        onToast?.('Could not update your library. Please try again.')
        return
      }
    } else return

    setIsSavedLocal(nextSaved)

    if (onToggleSaveArtist) {
      onToggleSaveArtist(effectiveArtistId, nextSaved, v2ArtistDetails || initialArtist)
    }

    const msg = nextSaved ? `Saved ${displayName} to your library` : `Removed ${displayName} from your library`
    setToastMessage(msg)
    onToast?.(msg)
  }, [isSaved, effectiveArtistId, token, onToggleSaveArtist, v2ArtistDetails, initialArtist, displayName, onToast])

  // Fetch detailed artist from /api/v2/artists/:id
  useEffect(() => {
    let isMounted = true
    if (!artistId && !displayName) return

    async function fetchArtistDetails() {
      const idToFetch = artistId || encodeURIComponent(displayName)
      try {
        const res = await fetch(`/api/v2/artists/${encodeURIComponent(idToFetch)}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        })
        if (res.ok && isMounted) {
          const data = await res.json()
          if (data && typeof data === 'object') {
            setV2ArtistDetails(data)
          }
        }
      } catch (err) {
        // Fallback is handled via props
      }
    }

    fetchArtistDetails()
    return () => { isMounted = false }
  }, [artistId, displayName, token])

  // Aggregate tracks for this artist
  const tracks = useMemo(() => {
    // 1. If v2ArtistDetails has tracks
    const rawV2Tracks = v2ArtistDetails?.tracks || initialArtist?.tracks
    if (Array.isArray(rawV2Tracks) && rawV2Tracks.length > 0) {
      return rawV2Tracks.map((item, idx) => {
        if (typeof item === 'object' && item.path) {
          return {
            id: item.id || `artist-track-${idx}`,
            name: item.name || item.title || item.path.split('/').pop().replace(/\.[^/.]+$/, ''),
            path: item.path,
            artist: displayName,
            playlist: displayName,
            ...item
          }
        }
        const p = String(item)
        return {
          id: `artist-${displayName}-${idx}`,
          path: p,
          name: p.split('/').pop().replace(/\.[^/.]+$/, ''),
          artist: displayName,
          playlist: displayName
        }
      })
    }

    // 2. Fallback: Lookup in library playlists & trackMetadata
    const matchedTracks = []
    const seenPaths = new Set()

    // Match exact folder
    if (playlists[displayName]) {
      playlists[displayName].forEach((p, idx) => {
        if (!seenPaths.has(p)) {
          seenPaths.add(p)
          matchedTracks.push({
            id: `artist-${displayName}-${idx}`,
            path: p,
            name: p.split('/').pop().replace(/\.[^/.]+$/, ''),
            artist: displayName,
            playlist: displayName
          })
        }
      })
    }

    // Match tracks where metadata artist matches displayName
    const lowerName = displayName.toLowerCase()
    Object.entries(playlists).forEach(([folderName, paths]) => {
      paths.forEach((p, idx) => {
        if (seenPaths.has(p)) return
        const meta = trackMetadata[p]
        if (meta?.artist && meta.artist.toLowerCase() === lowerName) {
          seenPaths.add(p)
          matchedTracks.push({
            id: `artist-meta-${idx}-${p}`,
            path: p,
            name: meta.title || p.split('/').pop().replace(/\.[^/.]+$/, ''),
            artist: displayName,
            playlist: folderName
          })
        }
      })
    })

    return matchedTracks
  }, [v2ArtistDetails, initialArtist, displayName, playlists, trackMetadata])

  const rawImageUrl = v2ArtistDetails?.image_url || initialArtist?.image_url
  const firstTrackPath = v2ArtistDetails?.first_track_path || initialArtist?.first_track_path || tracks[0]?.path
  const bio = v2ArtistDetails?.bio || initialArtist?.bio || ''

  // Artwork URL
  const coverUrl = useMemo(() => {
    let target = rawImageUrl
    if (!target && firstTrackPath) {
      const encoded = firstTrackPath.split('/').map(encodeURIComponent).join('/')
      target = `/api/cover/${encoded}`
    }
    if (!target && displayName) {
      target = `/api/cover/${encodeURIComponent(displayName)}`
    }
    if (!target) return null

    if (target.startsWith('http://') || target.startsWith('https://') || target.startsWith('data:')) {
      return target
    }

    if (!target.startsWith('/')) {
      target = `/${target}`
    }

    if (target.startsWith('/api/cover/')) {
      if (target.includes('token=')) {
        return target
      }
      const sep = target.includes('?') ? '&' : '?'
      return `${target}${sep}token=${encodeURIComponent(token || '')}&v=2`
    }

    const clean = target.replace(/^\//, '')
    const encoded = clean.split('/').map(encodeURIComponent).join('/')
    return `/api/cover/${encoded}?token=${encodeURIComponent(token || '')}&v=2`
  }, [rawImageUrl, firstTrackPath, displayName, token])

  useEffect(() => {
    setImgErr(false)
  }, [coverUrl])

  const hue = strHue(displayName)
  const isPlayingThisArtist = Boolean(isPlaying && tracks.some(t => t.path === currentTrack?.path))
  const isEmpty = tracks.length === 0

  const handlePlayAllClick = useCallback(() => {
    if (tracks.length === 0) return
    if (isPlayingThisArtist && onTogglePlay) {
      onTogglePlay()
      return
    }
    if (onPlayAll) {
      onPlayAll(tracks)
    } else if (onPlayTrack) {
      onPlayTrack(tracks[0], 0, tracks)
    }
  }, [tracks, isPlayingThisArtist, onTogglePlay, onPlayAll, onPlayTrack])

  const handleShuffleClick = useCallback(() => {
    if (tracks.length === 0) return
    if (onShuffle) {
      onShuffle(tracks)
    } else if (onPlayTrack) {
      const shuffled = [...tracks].sort(() => Math.random() - 0.5)
      onPlayTrack(shuffled[0], 0, shuffled)
    }
  }, [tracks, onShuffle, onPlayTrack])

  const userPlaylistsRef = useRef(userPlaylists)
  userPlaylistsRef.current = userPlaylists
  const playlistMetadataRef = useRef(playlistMetadata)
  playlistMetadataRef.current = playlistMetadata
  const playlistsRef = useRef(playlists)
  playlistsRef.current = playlists

  useEffect(() => {
    if (!showAddAllModal) return
    let isMounted = true
    async function loadPlaylists() {
      try {
        const res = await fetch('/api/v2/playlists', {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        })
        if (res.ok && isMounted) {
          const data = await res.json()
          const list = Array.isArray(data) ? data : (data?.playlists || [])
          const personal = list.filter(p => !p.is_folder_playlist && p.is_owner !== false)
          setAvailablePlaylists(personal)
          if (personal.length > 0) {
            setSelectedPlaylistId(personal[0].id)
            setCreateNew(false)
          } else {
            setCreateNew(true)
          }
          return
        }
      } catch {}

      if (isMounted) {
        const derived = []
        const uPlaylists = userPlaylistsRef.current
        const pMeta = playlistMetadataRef.current
        const pls = playlistsRef.current
        if (Array.isArray(uPlaylists)) {
          uPlaylists.forEach(name => {
            const meta = pMeta?.[name]
            derived.push({
              id: meta?.id || name,
              title: name,
              name: name,
              track_count: pls?.[name]?.length || 0
            })
          })
        }
        setAvailablePlaylists(derived)
        if (derived.length > 0) {
          setSelectedPlaylistId(derived[0].id)
          setCreateNew(false)
        } else {
          setCreateNew(true)
        }
      }
    }
    loadPlaylists()
    return () => { isMounted = false }
  }, [showAddAllModal, token])

  useEffect(() => {
    if (toastMessage) {
      const t = setTimeout(() => setToastMessage(null), 4000)
      return () => clearTimeout(t)
    }
  }, [toastMessage])

  const handleAddAllSubmit = async (e) => {
    e?.preventDefault()
    setIsSubmitting(true)
    setModalError(null)

    const effectiveArtistId = artistId || v2ArtistDetails?.id || initialArtist?.id || encodeURIComponent(displayName)

    let targetName = ''
    let payload = {}

    if (createNew) {
      if (!newPlaylistName.trim()) {
        setModalError('Please enter a playlist name')
        setIsSubmitting(false)
        return
      }
      targetName = newPlaylistName.trim()
      payload = { new_playlist_name: targetName, title: targetName, create_new: true }
    } else {
      const plObj = availablePlaylists.find(p => String(p.id) === String(selectedPlaylistId) || p.title === selectedPlaylistId || p.name === selectedPlaylistId)
      targetName = plObj?.title || plObj?.name || 'Playlist'
      payload = { playlist_id: selectedPlaylistId, playlist_name: targetName }
    }

    try {
      const res = await fetch(`/api/v2/artists/${encodeURIComponent(effectiveArtistId)}/add-to-playlist`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(payload)
      })

      if (res.ok) {
        const data = await res.json()
        const added = data.tracks_added ?? data.added ?? tracks.length
        const skipped = data.duplicates_skipped ?? data.skipped ?? data.duplicates ?? 0
        const msg = `Added ${added} track${added === 1 ? '' : 's'} to ${targetName}${skipped > 0 ? ` (${skipped} duplicate${skipped === 1 ? '' : 's'} skipped)` : ''}`
        setToastMessage(msg)
        setShowAddAllModal(false)
        setCreateNew(false)
        setNewPlaylistName('')
        onToast?.(msg)
        onRefreshPlaylists?.()
      } else {
        const err = await res.json().catch(() => ({}))
        setModalError(err.error || 'Failed to add tracks to playlist')
      }
    } catch (err) {
      setModalError(err.message || 'Network error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="artist-detail-view" data-testid="artist-detail-view">
      {/* Top Back Navigation */}
      {onBack && (
        <div className="artist-detail-top-nav">
          <button
            type="button"
            className="artist-back-btn"
            onClick={onBack}
            aria-label="Back to Discover"
            data-testid="artist-back-btn"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
            </svg>
            <span>Back to Discover</span>
          </button>
        </div>
      )}

      {/* Artist Hero Banner (Spotify playlist format) */}
      <div
        className="hero-container artist-hero"
        style={{ '--hero-accent-hue': `${hue}deg` }}
        data-testid="artist-hero"
      >
        {/* Top-Right 3-Dots / More Options Menu */}
        <div className="hero-top-right" ref={menuRef} data-testid="artist-top-right">
          <button
            type="button"
            className={`btn-action-icon hero-more-btn ${isMenuOpen ? 'active' : ''}`}
            onClick={() => setIsMenuOpen(prev => !prev)}
            title="More options"
            aria-label="More options"
            aria-haspopup="menu"
            aria-expanded={isMenuOpen}
            data-testid="artist-more-btn"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
            </svg>
          </button>

          {isMenuOpen && (
            <div
              className="hero-dropdown-menu"
              role="menu"
              aria-label="Artist actions"
              data-testid="artist-more-menu"
            >
              <button
                type="button"
                role="menuitem"
                className="hero-menu-item"
                disabled={isEmpty}
                aria-disabled={isEmpty}
                onClick={() => {
                  setIsMenuOpen(false)
                  setShowAddAllModal(true)
                }}
                data-testid="artist-menu-add-btn"
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M12 5v14M5 12h14"/>
                </svg>
                <span>Add to Playlist</span>
              </button>

              <button
                type="button"
                role="menuitem"
                className="hero-menu-item"
                onClick={() => {
                  setIsMenuOpen(false)
                  handleToggleSaveArtist()
                }}
                data-testid="artist-menu-save-btn"
              >
                {isSaved ? (
                  <>
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                    </svg>
                    <span>Remove from Library</span>
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
                      <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                    </svg>
                    <span>Save Artist to Library</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Hero Banner Header: Left Art + Right Metadata */}
        <div className="hero-header-content">
          <div className="hero-art-container artist-hero-art-container">
            <div className="hero-art artist-hero-avatar-wrap" data-testid="artist-hero-avatar">
              {!imgErr && coverUrl ? (
                <img
                  src={coverUrl}
                  alt={displayName}
                  onError={() => setImgErr(true)}
                  className="artist-hero-avatar-img hero-cover-single"
                  data-testid="artist-avatar"
                />
              ) : (
                <div
                  className="artist-hero-avatar-fallback hero-art-placeholder"
                  style={{
                    background: `linear-gradient(135deg, hsl(${hue}, 60%, 35%), hsl(${(hue + 45) % 360}, 55%, 20%))`
                  }}
                  data-testid="artist-avatar"
                >
                  {displayName.slice(0, 1).toUpperCase()}
                </div>
              )}
            </div>
          </div>

          <div className="hero-meta artist-hero-info">
            <span className="hero-tag hero-tag-public">Artist</span>
            <h1 className="hero-title artist-hero-title" data-testid="artist-name" title={displayName}>
              {displayName}
            </h1>
            {bio ? (
              <p className="hero-description-text" data-testid="artist-bio">{bio}</p>
            ) : null}
            <div className="hero-creator-row">
              <span className="hero-stats artist-hero-stats" data-testid="artist-track-count">
                {formatTotalDuration(tracks, durations)}
              </span>
            </div>
          </div>
        </div>

        {/* Action Bar (Play, Shuffle, Save, Add to Playlist, More Options) */}
        <div className="hero-action-bar" data-testid="hero-action-bar">
          <div className="hero-action-left" data-testid="hero-action-left">
            {/* Circular Green Play Button */}
            <button
              type="button"
              className="btn-hero-play artist-play-btn"
              onClick={isEmpty ? undefined : handlePlayAllClick}
              disabled={isEmpty}
              aria-disabled={isEmpty}
              title={isEmpty ? "No tracks to play" : isPlayingThisArtist ? "Pause" : "Play"}
              aria-label={isPlayingThisArtist ? "Pause" : `Play all tracks by ${displayName}`}
              data-testid="artist-play-all-btn"
            >
              {isPlayingThisArtist ? (
                <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor">
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor" style={{ marginLeft: 3 }}>
                  <path d="M8 5v14l11-7z"/>
                </svg>
              )}
            </button>

            {/* Shuffle Button */}
            <button
              type="button"
              className="btn-action-icon btn-action-shuffle artist-shuffle-btn"
              onClick={isEmpty ? undefined : handleShuffleClick}
              disabled={isEmpty}
              aria-disabled={isEmpty}
              title={isEmpty ? "No tracks to shuffle" : "Shuffle"}
              aria-label={`Shuffle tracks by ${displayName}`}
              data-testid="artist-shuffle-btn"
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4zM14.83 13.41l-1.41 1.41 2.13 2.13L13.5 19H19v-5.5l-2.04 2.04z"/>
              </svg>
            </button>

            {/* Save to Library Icon Button */}
            <button
              type="button"
              className={`btn-action-icon artist-save-btn ${isSaved ? 'active glow saved' : ''}`}
              onClick={handleToggleSaveArtist}
              title={isSaved ? "Remove from Library" : "Save Artist to Library"}
              aria-label={isSaved ? "Remove from Library" : "Save Artist to Library"}
              data-testid="artist-save-btn"
            >
              {isSaved ? (
                <svg viewBox="0 0 24 24" width="22" height="22" fill="var(--accent, #10B981)">
                  <path d="M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2z"/>
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                </svg>
              )}
            </button>

            {/* Add All to Playlist Button */}
            <button
              type="button"
              ref={addAllTriggerBtnRef}
              className="btn-action-icon artist-add-all-btn"
              onClick={() => setShowAddAllModal(true)}
              disabled={isEmpty}
              aria-disabled={isEmpty}
              title="Add all to playlist"
              aria-label={`Add all tracks by ${displayName} to playlist`}
              data-testid="artist-add-all-btn"
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                <path d="M14 10H2v2h12v-2zm0-4H2v2h12V6zm4 8v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zM2 16h8v-2H2v2z"/>
              </svg>
            </button>

            {/* 3-Dots More Options Menu in Action Bar */}
            <div className="hero-more-wrapper" ref={actionMenuRef}>
              <button
                type="button"
                className={`btn-action-icon hero-more-btn ${isActionMenuOpen ? 'active' : ''}`}
                onClick={() => setIsActionMenuOpen(prev => !prev)}
                title="More options"
                aria-label="More options"
                aria-haspopup="menu"
                aria-expanded={isActionMenuOpen}
                data-testid="artist-action-more-btn"
              >
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                  <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
                </svg>
              </button>

              {isActionMenuOpen && (
                <div
                  className="hero-dropdown-menu"
                  role="menu"
                  aria-label="Artist actions"
                  data-testid="artist-action-dropdown-menu"
                >
                  <button
                    type="button"
                    role="menuitem"
                    className="hero-menu-item"
                    disabled={isEmpty}
                    aria-disabled={isEmpty}
                    onClick={() => {
                      setIsActionMenuOpen(false)
                      setShowAddAllModal(true)
                    }}
                    data-testid="artist-action-menu-add-btn"
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path d="M12 5v14M5 12h14"/>
                    </svg>
                    <span>Add to Playlist</span>
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    className="hero-menu-item"
                    onClick={() => {
                      setIsActionMenuOpen(false)
                      handleToggleSaveArtist()
                    }}
                    data-testid="artist-action-menu-save-btn"
                  >
                    {isSaved ? (
                      <>
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
                          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                        </svg>
                        <span>Remove from Library</span>
                      </>
                    ) : (
                      <>
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
                          <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                        </svg>
                        <span>Save Artist to Library</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="hero-action-right" />
        </div>
      </div>

      {/* Integrated Track List */}
      <div className="spotify-tracklist-container artist-tracklist-section" data-testid="artist-tracklist">
        {isEmpty ? (
          <div className="artist-empty-tracks empty-state" data-testid="artist-empty-tracks">
            <div className="empty-state-icon-wrapper" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
            </div>
            <p className="empty-state-title">No tracks found for this artist.</p>
            <button
              type="button"
              className="btn-secondary"
              onClick={onBack}
              data-testid="artist-empty-back-btn"
            >
              Back to Discover
            </button>
          </div>
        ) : (
          <TrackList
            tracks={tracks}
            currentIndex={tracks.findIndex(t => t.path === currentTrack?.path)}
            isPlaying={isPlaying}
            onPlayTrack={(track, idx) => {
              if (onPlayTrack) {
                onPlayTrack(track, idx, tracks)
              }
            }}
            onTogglePlay={onTogglePlay}
            durations={durations}
            token={token}
            favorites={favorites}
            onToggleFavorite={onToggleFavorite}
            onAddToPlaylist={onAddToPlaylist}
            onDownloadTrack={onDownloadTrack}
            savedArtists={savedArtists}
            savedTracks={savedTracks}
            onToggleSaveArtist={onToggleSaveArtist}
            onToggleSaveTrack={onToggleSaveTrack}
          />
        )}
      </div>

      {/* Feedback Toast */}
      {toastMessage && (
        <div className="artist-feedback-toast" role="status" aria-live="polite" data-testid="artist-toast">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
          </svg>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Add All to Playlist Dialog */}
      {showAddAllModal && typeof document !== 'undefined' && createPortal(
        <div className="modal-backdrop" onClick={() => setShowAddAllModal(false)}>
          <div
            ref={addAllModalRef}
            className="create-playlist-modal artist-add-all-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-all-dialog-title"
            onClick={e => e.stopPropagation()}
            data-testid="artist-add-all-dialog"
          >
            <div className="modal-header">
              <h3 id="add-all-dialog-title" className="modal-title">Add All Tracks to Playlist</h3>
              <button
                type="button"
                className="btn-icon modal-close-btn"
                onClick={() => setShowAddAllModal(false)}
                aria-label="Close"
                data-testid="btn-close-add-all"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleAddAllSubmit} className="create-playlist-form">
              {modalError && (
                <div className="modal-error" role="alert" data-testid="add-all-error" style={{ color: 'var(--red)', marginBottom: 12 }}>
                  {modalError}
                </div>
              )}

              <div className="form-group">
                <label>Choose destination playlist</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 6 }}>
                  {!createNew ? (
                    <>
                      {availablePlaylists.length > 0 ? (
                        <select
                          className="modal-select-input"
                          value={selectedPlaylistId}
                          onChange={e => setSelectedPlaylistId(e.target.value)}
                          data-testid="select-target-playlist"
                        >
                          {availablePlaylists.map(p => (
                            <option key={p.id || p.name} value={p.id || p.name}>
                              {p.title || p.name} ({p.track_count ?? 0} tracks)
                            </option>
                          ))}
                        </select>
                      ) : (
                        <p style={{ fontSize: '13px', color: 'var(--text-dim)', margin: 0 }}>
                          No personal playlists found.
                        </p>
                      )}

                      <button
                        type="button"
                        className="btn-link"
                        style={{ textAlign: 'left', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: '13px', fontWeight: 600 }}
                        onClick={() => setCreateNew(true)}
                        data-testid="btn-toggle-create-new"
                      >
                        + Create new playlist
                      </button>
                    </>
                  ) : (
                    <>
                      <input
                        type="text"
                        className="modal-text-input"
                        placeholder="New playlist name..."
                        value={newPlaylistName}
                        onChange={e => setNewPlaylistName(e.target.value)}
                        data-testid="input-new-playlist-name"
                        autoFocus
                      />

                      {availablePlaylists.length > 0 && (
                        <button
                          type="button"
                          className="btn-link"
                          style={{ textAlign: 'left', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: '13px', fontWeight: 600 }}
                          onClick={() => setCreateNew(false)}
                          data-testid="btn-toggle-choose-existing"
                        >
                          ← Choose existing playlist
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              <div className="modal-footer" style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowAddAllModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={isSubmitting || (!createNew && !selectedPlaylistId) || (createNew && !newPlaylistName.trim())}
                  data-testid="btn-confirm-add-all"
                >
                  {isSubmitting ? 'Adding...' : 'Add all to playlist'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

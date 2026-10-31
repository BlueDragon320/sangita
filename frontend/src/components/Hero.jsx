import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

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

function QuadCell({ track, token, index }) {
  const [cellErr, setCellErr] = useState(false)
  const coverUrl = track?.path
    ? `/api/cover/${track.path.split('/').map(encodeURIComponent).join('/')}?token=${encodeURIComponent(token || '')}&v=2`
    : null

  if (!cellErr && coverUrl && token) {
    return (
      <div className="hero-quad-cell">
        <img
          src={coverUrl}
          alt=""
          onError={() => setCellErr(true)}
          className="hero-quad-img"
        />
      </div>
    )
  }

  return (
    <div className="hero-quad-cell hero-quad-cell-fallback">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="var(--text-dim)">
        <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
      </svg>
    </div>
  )
}

function HeroArt({ playlistName, tracks = [], token }) {
  const [imgErr, setImgErr] = useState(false)
  const firstTrackPath = tracks[0]?.path
  const coverUrl = firstTrackPath
    ? `/api/cover/${firstTrackPath.split('/').map(encodeURIComponent).join('/')}?token=${encodeURIComponent(token || '')}&v=2`
    : playlistName
    ? `/api/cover/${encodeURIComponent(playlistName)}?token=${encodeURIComponent(token || '')}&v=2`
    : null

  if (playlistName === 'Favorites') {
    return (
      <div className="hero-art-container">
        <div className="hero-art hero-art-fav">
          <svg viewBox="0 0 24 24" width="72" height="72" fill="#FFFFFF">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
          </svg>
        </div>
      </div>
    )
  }

  // If playlist has 4+ tracks, show 4-quad collage like Spotify
  if (tracks.length >= 4 && token) {
    const quadTracks = tracks.slice(0, 4)
    return (
      <div className="hero-art-container">
        <div className="hero-art hero-art-quad-grid">
          {quadTracks.map((t, i) => (
            <QuadCell key={t.path || i} track={t} token={token} index={i} />
          ))}
        </div>
      </div>
    )
  }

  if (!imgErr && coverUrl && token) {
    return (
      <div className="hero-art-container">
        <div className="hero-art hero-art-cover">
          <img
            src={coverUrl}
            key={firstTrackPath || playlistName}
            alt={playlistName || 'Cover'}
            onError={() => setImgErr(true)}
            className="hero-cover-single"
          />
        </div>
      </div>
    )
  }

  const hue = strHue(playlistName || 'Library')
  return (
    <div className="hero-art-container">
      <div
        className="hero-art hero-art-placeholder"
        style={{
          background: `linear-gradient(135deg, hsl(${hue}, 55%, 28%), hsl(${(hue + 60) % 360}, 50%, 14%))`
        }}
      >
        <svg viewBox="0 0 24 24" width="56" height="56" fill="var(--emerald)">
          <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
        </svg>
      </div>
    </div>
  )
}

function Hero({
  playlistName,
  tracks = [],
  isPlaying,
  isShuffle,
  onPlay,
  onShuffle,
  onDownload,
  onAddToPlaylist,
  onSaveToMyPlaylists,
  username = 'admin',
  owner,
  currentUser,
  role,
  isAdmin = false,
  isOwner = false,
  canEdit,
  visibility = 'public',
  description = '',
  unavailableCount,
  onEditPlaylist,
  onDeletePlaylist,
  playlistId,
  durations = {},
  token,
  isSaved = false,
  is_saved = false,
  onToggleSave,
  savedArtists = [],
  savedTracks = [],
  onToggleSaveArtist,
  onToggleSaveTrack
}) {
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [editName, setEditName] = useState(playlistName || '')
  const [editDesc, setEditDesc] = useState(description || '')
  const [editVis, setEditVis] = useState(visibility || 'public')
  const [isSavedState, setIsSavedState] = useState(Boolean(isSaved || is_saved))

  useEffect(() => {
    setIsSavedState(Boolean(isSaved || is_saved))
  }, [isSaved, is_saved])

  const editModalRef = useRef(null)
  const deleteDialogRef = useRef(null)
  const menuRef = useRef(null)
  const previousFocusRef = useRef(null)

  useEffect(() => {
    setEditName(playlistName || '')
    setEditDesc(description || '')
    setEditVis(visibility || 'public')
  }, [playlistName, description, visibility])

  // Focus management when edit modal opens/closes
  useEffect(() => {
    if (showEditModal) {
      previousFocusRef.current = document.activeElement
      const timer = setTimeout(() => {
        const input = document.getElementById('edit-name-input')
        if (input) {
          input.focus()
          input.select?.()
        }
      }, 20)
      return () => clearTimeout(timer)
    } else if (previousFocusRef.current && !showDeleteDialog) {
      previousFocusRef.current.focus?.()
      previousFocusRef.current = null
    }
  }, [showEditModal, showDeleteDialog])

  // Escape key listener for dialogs and dropdown menu + accessibility focus trap
  useEffect(() => {
    if (!showEditModal && !showDeleteDialog && !isMenuOpen) return

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        if (isMenuOpen) {
          setIsMenuOpen(false)
          return
        }
        setShowEditModal(false)
        setShowDeleteDialog(false)
        return
      }

      if (e.key === 'Tab' && (showEditModal || showDeleteDialog)) {
        const activeModal = showEditModal ? editModalRef.current : deleteDialogRef.current
        if (!activeModal) return
        const focusable = activeModal.querySelectorAll(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
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
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showEditModal, showDeleteDialog, isMenuOpen])

  // Click / pointer outside listener for dropdown menu
  useEffect(() => {
    if (!isMenuOpen) return

    const handlePointerDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsMenuOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('mousedown', handlePointerDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('mousedown', handlePointerDown)
    }
  }, [isMenuOpen])

  const count = tracks.length
  const isEmpty = count === 0
  const hue = strHue(playlistName || 'Library')

  const effectiveOwner = owner || username || 'Admin'
  const isPrivate = visibility === 'private'

  // Permission calculation: owner or admin
  const isOwnerUser = Boolean(
    isOwner ||
    canEdit ||
    (currentUser && owner && currentUser.toLowerCase() === owner.toLowerCase())
  )
  const isAdminUser = Boolean(
    isAdmin ||
    role === 'admin'
  )
  const isReserved = playlistName === 'Favorites' || playlistName === 'Library'
  const canManage = (isOwnerUser || isAdminUser) && !isReserved

  // Unavailable tracks count
  const countUnavailable = typeof unavailableCount === 'number'
    ? unavailableCount
    : tracks.filter(t => t.is_unavailable).length

  const handleSaveEdit = (e) => {
    e?.preventDefault()
    if (!editName.trim()) return
    if (onEditPlaylist) {
      onEditPlaylist({
        ...(playlistId ? { id: playlistId } : {}),
        name: editName.trim(),
        description: editDesc.trim(),
        visibility: editVis
      })
    }
    setShowEditModal(false)
  }

  const handleConfirmDelete = () => {
    if (onDeletePlaylist) {
      if (playlistId) {
        onDeletePlaylist(playlistName, playlistId)
      } else {
        onDeletePlaylist(playlistName)
      }
    }
    setShowDeleteDialog(false)
  }

  const handleToggleSave = async () => {
    const nextSaved = !isSavedState
    setIsSavedState(nextSaved)
    if (onToggleSave) {
      onToggleSave(nextSaved)
    }
    const idToUse = playlistId
    if (idToUse && token) {
      try {
        const method = nextSaved ? 'POST' : 'DELETE'
        await fetch(`/api/v2/playlists/${encodeURIComponent(idToUse)}/save`, {
          method,
          headers: { Authorization: `Bearer ${token}` }
        })
      } catch (err) {
        console.warn('Failed to toggle save:', err)
      }
    }
  }

  return (
    <div
      className="hero-container"
      style={{
        '--hero-accent-hue': `${hue}deg`
      }}
      data-testid="hero-banner"
    >
      {/* Top-Right 3-Dots / More Options Menu */}
      <div className="hero-top-right" ref={menuRef} data-testid="hero-top-right">
        <button
          type="button"
          className={`btn-action-icon hero-more-btn ${isMenuOpen ? 'active' : ''}`}
          onClick={() => setIsMenuOpen(prev => !prev)}
          title="More options"
          aria-label="More options"
          aria-haspopup="menu"
          aria-expanded={isMenuOpen}
          data-testid="hero-more-btn"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
          </svg>
        </button>

        {isMenuOpen && (
          <div
            className="hero-dropdown-menu"
            role="menu"
            aria-label="Playlist actions"
            data-testid="hero-more-menu"
          >
            {onAddToPlaylist && (
              <button
                type="button"
                role="menuitem"
                className="hero-menu-item"
                disabled={isEmpty}
                aria-disabled={isEmpty}
                onClick={() => {
                  if (isEmpty) return
                  setIsMenuOpen(false)
                  onAddToPlaylist(tracks[0])
                }}
                data-testid="hero-add-pill-btn"
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M12 5v14M5 12h14"/>
                </svg>
                <span>Add to Playlist</span>
              </button>
            )}

            {canManage && (
              <button
                type="button"
                role="menuitem"
                className="hero-menu-item"
                onClick={() => {
                  setIsMenuOpen(false)
                  setShowEditModal(true)
                }}
                data-testid="hero-edit-btn"
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
                  <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                </svg>
                <span>Edit Details</span>
              </button>
            )}

            {onSaveToMyPlaylists && !isOwnerUser && (
              <button
                type="button"
                role="menuitem"
                className="hero-menu-item"
                onClick={() => {
                  setIsMenuOpen(false)
                  onSaveToMyPlaylists({
                    playlistName,
                    playlistId,
                    tracks
                  })
                }}
                data-testid="hero-menu-save-btn"
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
                  <path d="M14 10H2v2h12v-2zm0-4H2v2h12V6zm4 8v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zM2 16h8v-2H2v2z"/>
                </svg>
                <span>Add to My Playlists</span>
              </button>
            )}

            {canManage && (
              <button
                type="button"
                role="menuitem"
                className="hero-menu-item hero-menu-item-danger"
                onClick={() => {
                  setIsMenuOpen(false)
                  setShowDeleteDialog(true)
                }}
                data-testid="hero-delete-btn"
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
                  <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                </svg>
                <span>Delete Playlist</span>
              </button>
            )}

            {!onAddToPlaylist && !canManage && (!onSaveToMyPlaylists || isOwnerUser) && (
              <div className="hero-menu-empty">
                No actions available
              </div>
            )}
          </div>
        )}
      </div>

      {/* Accessible Unavailable Songs Alert Banner */}
      {countUnavailable > 0 && (
        <div
          className="hero-unavailable-banner"
          role="alert"
          aria-live="polite"
          data-testid="hero-unavailable-banner"
        >
          <div className="hero-unavailable-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
            </svg>
          </div>
          <span className="hero-unavailable-text">
            {countUnavailable} song{countUnavailable === 1 ? '' : 's'} unavailable under your library permissions
          </span>
        </div>
      )}

      {/* Top Banner Header: Left Art + Right Metadata */}
      <div className="hero-header-content">
        <HeroArt playlistName={playlistName || 'Library'} tracks={tracks} token={token} />

        <div className="hero-meta">
          <span className={`hero-tag ${isPrivate ? 'hero-tag-private' : 'hero-tag-public'}`} data-testid="hero-visibility-badge">
            {isPrivate ? 'Private' : 'Public Playlist'}
          </span>
          <h1 className="hero-title" title={playlistName || 'Library'}>
            {playlistName || 'Library'}
          </h1>
          {description && !description.startsWith('Folder playlist for ') && (
            <p className="hero-description-text" data-testid="hero-description">{description}</p>
          )}
          <div className="hero-creator-row">
            <div className="hero-avatar">
              {(effectiveOwner || 'A')[0].toUpperCase()}
            </div>
            <span className="hero-creator-by">By @</span>
            <span className="hero-creator-name">{effectiveOwner}</span>
            <span className="hero-dot">•</span>
            <span className="hero-stats">
              {formatTotalDuration(tracks, durations)}
            </span>
          </div>
        </div>
      </div>

      {/* Action Bar (Play & Shuffle on left) */}
      <div className="hero-action-bar" data-testid="hero-action-bar">
        <div className="hero-action-left" data-testid="hero-action-left">
          <button
            className="btn-hero-play"
            onClick={isEmpty ? undefined : onPlay}
            disabled={isEmpty}
            aria-disabled={isEmpty}
            title={isEmpty ? "No tracks to play" : isPlaying ? "Pause" : "Play"}
            aria-label={isPlaying ? "Pause" : "Play"}
            data-testid="hero-play-btn"
          >
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

          <button
            className={`btn-action-icon btn-action-shuffle ${isShuffle ? 'active glow' : ''}`}
            onClick={isEmpty ? undefined : onShuffle}
            disabled={isEmpty}
            aria-disabled={isEmpty}
            title={isEmpty ? "No tracks to shuffle" : isShuffle ? 'Shuffle ON' : 'Shuffle OFF'}
            aria-label={isShuffle ? "Shuffle on" : "Shuffle off"}
            data-testid="hero-shuffle-btn"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4zM14.83 13.41l-1.41 1.41 2.13 2.13L13.5 19H19v-5.5l-2.04 2.04z"/>
            </svg>
          </button>

          {!isOwnerUser && !isReserved && (
            <button
              type="button"
              className={`btn-hero-save ${isSavedState ? 'saved' : ''}`}
              onClick={handleToggleSave}
              aria-label={isSavedState ? "Remove from Library" : "Add to Library"}
              title={isSavedState ? "Remove from Library" : "Add to Library"}
              data-testid="hero-save-btn"
            >
              {isSavedState ? (
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
                  <span>Add to Library</span>
                </>
              )}
            </button>
          )}
        </div>

        <div className="hero-action-right" data-testid="hero-action-right" />
      </div>

      {/* Edit Playlist Details Dialog */}
      {showEditModal && typeof document !== 'undefined' && createPortal(
        <div className="modal-backdrop" onClick={() => setShowEditModal(false)}>
          <div
            ref={editModalRef}
            className="create-playlist-modal hero-edit-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-playlist-title"
            onClick={e => e.stopPropagation()}
            data-testid="hero-edit-modal"
          >
            <div className="modal-header">
              <div className="modal-title-group modal-title-group-with-icon">
                <div className="modal-icon-badge" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                  </svg>
                </div>
                <div>
                  <h3 id="edit-playlist-title" className="modal-title">Edit Playlist Details</h3>
                  <p className="modal-desc">Update title, description, and visibility settings</p>
                </div>
              </div>
              <button
                type="button"
                className="btn-icon modal-close-btn"
                onClick={() => setShowEditModal(false)}
                title="Close"
                aria-label="Close edit dialog"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                  <path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="create-playlist-form hero-edit-form">
              <div className="form-group">
                <label htmlFor="edit-name-input">Playlist Name</label>
                <input
                  id="edit-name-input"
                  type="text"
                  className="modal-text-input"
                  placeholder="Playlist Name"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  maxLength={50}
                  required
                  autoFocus
                  data-testid="edit-playlist-name-input"
                />
              </div>

              <div className="form-group">
                <div className="form-label-row">
                  <label htmlFor="edit-desc-input">Description (optional)</label>
                  <span className="char-count" aria-live="polite">{editDesc.length}/200</span>
                </div>
                <textarea
                  id="edit-desc-input"
                  className="modal-text-input modal-textarea"
                  placeholder="Add an optional description"
                  value={editDesc}
                  onChange={e => setEditDesc(e.target.value)}
                  maxLength={200}
                  rows={2}
                  data-testid="edit-playlist-desc-input"
                />
              </div>

              <div className="form-group">
                <label id="edit-vis-label">Visibility</label>
                <div
                  className="visibility-radio-group"
                  role="radiogroup"
                  aria-labelledby="edit-vis-label"
                >
                  <label
                    htmlFor="edit-vis-private"
                    className={`visibility-radio-card ${editVis === 'private' ? 'selected' : ''}`}
                    data-testid="edit-visibility-private"
                  >
                    <input
                      type="radio"
                      id="edit-vis-private"
                      name="edit-visibility"
                      value="private"
                      checked={editVis === 'private'}
                      onChange={() => setEditVis('private')}
                      className="visibility-radio-input"
                    />
                    <div className="visibility-icon-col" aria-hidden="true">
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                        <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
                      </svg>
                    </div>
                    <div className="visibility-info-col">
                      <div className="visibility-option-title">Private</div>
                      <div className="visibility-option-copy">Only you and administrators can view this playlist</div>
                    </div>
                  </label>

                  <label
                    htmlFor="edit-vis-public"
                    className={`visibility-radio-card ${editVis === 'public' ? 'selected' : ''}`}
                    data-testid="edit-visibility-public"
                  >
                    <input
                      type="radio"
                      id="edit-vis-public"
                      name="edit-visibility"
                      value="public"
                      checked={editVis === 'public'}
                      onChange={() => setEditVis('public')}
                      className="visibility-radio-input"
                    />
                    <div className="visibility-icon-col" aria-hidden="true">
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                      </svg>
                    </div>
                    <div className="visibility-info-col">
                      <div className="visibility-option-title">Public</div>
                      <div className="visibility-option-copy">Discoverable by all signed-in users on Sangita</div>
                    </div>
                  </label>
                </div>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-modal-secondary"
                  onClick={() => setShowEditModal(false)}
                  data-testid="edit-playlist-cancel-btn"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-modal-primary"
                  disabled={!editName.trim()}
                  data-testid="edit-playlist-save-btn"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Delete Playlist Confirmation Alert Dialog */}
      {showDeleteDialog && typeof document !== 'undefined' && createPortal(
        <div className="modal-backdrop" onClick={() => setShowDeleteDialog(false)}>
          <div
            ref={deleteDialogRef}
            className="create-playlist-modal hero-delete-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-dialog-title"
            aria-describedby="delete-dialog-desc"
            onClick={e => e.stopPropagation()}
            data-testid="hero-delete-dialog"
          >
            <div className="modal-header">
              <div className="modal-title-group modal-title-group-with-icon">
                <div className="modal-icon-badge modal-icon-badge-danger" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                  </svg>
                </div>
                <div>
                  <h3 id="delete-dialog-title" className="modal-title">Delete Playlist</h3>
                  <p className="modal-desc">This action cannot be undone</p>
                </div>
              </div>
              <button
                type="button"
                className="btn-icon modal-close-btn"
                onClick={() => setShowDeleteDialog(false)}
                title="Close"
                aria-label="Close delete dialog"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                  <path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
              </button>
            </div>
            <div className="create-playlist-form hero-delete-form">
              <p id="delete-dialog-desc" className="delete-dialog-message">
                Are you sure you want to delete "{playlistName}"? This action cannot be undone.
              </p>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-modal-secondary"
                  onClick={() => setShowDeleteDialog(false)}
                  data-testid="delete-playlist-cancel-btn"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-modal-primary btn-modal-danger"
                  onClick={handleConfirmDelete}
                  data-testid="delete-playlist-confirm-btn"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

export default React.memo(Hero)

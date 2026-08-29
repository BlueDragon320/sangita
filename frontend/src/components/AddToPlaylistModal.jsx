import React, { useState, useEffect } from 'react'

function PlusIcon({ width = 16, height = 16 }) {
  return (
    <svg viewBox="0 0 24 24" width={width} height={height} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14"/>
    </svg>
  )
}

function CheckIcon({ width = 16, height = 16 }) {
  return (
    <svg viewBox="0 0 24 24" width={width} height={height} fill="none" stroke="var(--emerald)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  )
}

function HeartIcon({ filled }) {
  return filled ? (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="var(--emerald)">
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
  )
}

export default function AddToPlaylistModal({
  track,
  playlists = {},
  favorites = [],
  token,
  onClose,
  onToggleFavorite,
  onUpdatePlaylists
}) {
  const [newPlaylistName, setNewPlaylistName] = useState('')
  const [loadingAction, setLoadingAction] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  if (!track) return null

  // User playlists (excluding Library)
  const playlistNames = Object.keys(playlists).filter(name => name !== 'Library')
  const isFav = favorites.includes(track.path)

  const handleToggleTrackInPlaylist = async (pName) => {
    if (pName === 'Favorites') {
      if (onToggleFavorite) onToggleFavorite(track.path)
      return
    }

    const currentTracks = playlists[pName] || []
    const isInPlaylist = currentTracks.includes(track.path)
    setLoadingAction(pName)
    setErrorMsg('')

    try {
      if (isInPlaylist) {
        // Remove track
        const res = await fetch(`/api/user-playlists/${encodeURIComponent(pName)}/tracks`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ track_path: track.path })
        })
        if (res.ok) {
          if (onUpdatePlaylists) {
            onUpdatePlaylists(prev => ({
              ...prev,
              [pName]: (prev[pName] || []).filter(p => p !== track.path)
            }))
          }
        }
      } else {
        // Add track
        const res = await fetch(`/api/user-playlists/${encodeURIComponent(pName)}/tracks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ track_path: track.path })
        })
        if (res.ok) {
          if (onUpdatePlaylists) {
            onUpdatePlaylists(prev => ({
              ...prev,
              [pName]: [...(prev[pName] || []), track.path]
            }))
          }
        }
      }
    } catch (err) {
      console.error('[AddToPlaylist] Error:', err)
      setErrorMsg('Failed to update playlist')
    } finally {
      setLoadingAction('')
    }
  }

  const handleCreateAndAdd = async (e) => {
    e.preventDefault()
    const trimmed = newPlaylistName.trim()
    if (!trimmed) return
    if (trimmed === 'Favorites' || trimmed === 'Library') {
      setErrorMsg('Cannot use reserved playlist name')
      return
    }

    setLoadingAction('create')
    setErrorMsg('')

    try {
      // 1. Create playlist
      const createRes = await fetch('/api/user-playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: trimmed })
      })

      if (!createRes.ok) {
        throw new Error('Failed to create playlist')
      }

      // 2. Add track to new playlist
      const addRes = await fetch(`/api/user-playlists/${encodeURIComponent(trimmed)}/tracks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ track_path: track.path })
      })

      if (addRes.ok) {
        if (onUpdatePlaylists) {
          onUpdatePlaylists(prev => ({
            ...prev,
            [trimmed]: [track.path]
          }))
        }
        setNewPlaylistName('')
      }
    } catch (err) {
      console.error('[CreatePlaylist] Error:', err)
      setErrorMsg('Failed to create playlist')
    } finally {
      setLoadingAction('')
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose} data-testid="add-playlist-backdrop">
      <div className="add-playlist-modal" onClick={e => e.stopPropagation()} data-testid="add-playlist-modal">
        <div className="modal-header">
          <div className="modal-title-group">
            <h3>Add to playlist</h3>
            <p className="modal-subtitle" title={track.name}>
              {track.name}
            </p>
          </div>
          <button className="btn-icon modal-close-btn" onClick={onClose} title="Close" data-testid="add-playlist-close">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>

        {errorMsg && <div className="modal-error-banner">{errorMsg}</div>}

        <div className="modal-body-list">
          {/* Favorites Option */}
          <div
            className={`playlist-check-row ${isFav ? 'selected' : ''}`}
            onClick={() => handleToggleTrackInPlaylist('Favorites')}
            data-testid="add-to-favorites-row"
          >
            <div className="playlist-check-left">
              <div className="playlist-mini-icon fav-icon-bg">
                <HeartIcon filled={isFav} />
              </div>
              <span className="playlist-check-name">Favorites</span>
            </div>
            <div className="playlist-check-status">
              {isFav ? <CheckIcon /> : <div className="empty-check-circle" />}
            </div>
          </div>

          {/* User Playlists */}
          {playlistNames.filter(n => n !== 'Favorites').map(pName => {
            const isIn = (playlists[pName] || []).includes(track.path)
            const isLoading = loadingAction === pName

            return (
              <div
                key={pName}
                className={`playlist-check-row ${isIn ? 'selected' : ''} ${isLoading ? 'loading' : ''}`}
                onClick={() => handleToggleTrackInPlaylist(pName)}
                data-testid={`playlist-check-${pName}`}
              >
                <div className="playlist-check-left">
                  <div className="playlist-mini-icon">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                      <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                    </svg>
                  </div>
                  <span className="playlist-check-name" title={pName}>{pName}</span>
                </div>
                <div className="playlist-check-status">
                  {isIn ? <CheckIcon /> : <div className="empty-check-circle" />}
                </div>
              </div>
            )
          })}
        </div>

        {/* Create New Playlist Inline Form */}
        <form className="modal-create-form" onSubmit={handleCreateAndAdd}>
          <input
            type="text"
            placeholder="New playlist name..."
            value={newPlaylistName}
            onChange={e => setNewPlaylistName(e.target.value)}
            className="modal-create-input"
            data-testid="new-playlist-input"
            maxLength={60}
          />
          <button
            type="submit"
            disabled={!newPlaylistName.trim() || loadingAction === 'create'}
            className="btn-create-playlist"
            data-testid="create-playlist-btn"
          >
            <PlusIcon width={14} height={14} />
            <span>Create</span>
          </button>
        </form>
      </div>
    </div>
  )
}

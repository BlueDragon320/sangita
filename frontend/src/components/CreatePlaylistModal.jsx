import React, { useState } from 'react'

export default function CreatePlaylistModal({ isOpen, onClose, onCreated, token }) {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (!isOpen) return null

  const handleCreate = async (e) => {
    e?.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Please enter a playlist name')
      return
    }
    if (trimmed.toLowerCase() === 'favorites' || trimmed.toLowerCase() === 'library') {
      setError('That name is reserved')
      return
    }

    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/user-playlists', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: trimmed })
      })
      const data = await res.json()
      if (res.ok) {
        setName('')
        onCreated && onCreated(trimmed)
        onClose()
      } else {
        setError(data.error || 'Failed to create playlist')
      }
    } catch (err) {
      setError('Network error, please try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose} data-testid="create-playlist-backdrop">
      <div
        className="create-playlist-modal"
        onClick={e => e.stopPropagation()}
        data-testid="create-playlist-modal"
      >
        <div className="modal-header">
          <div className="modal-title-group">
            <div className="modal-icon-badge">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                <path d="M14 10H2v2h12v-2zm0-4H2v2h12V6zm4 8v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zM2 16h8v-2H2v2z"/>
              </svg>
            </div>
            <div>
              <h3>Create New Playlist</h3>
              <p>Build your custom collection of songs</p>
            </div>
          </div>
          <button className="btn-icon modal-close-btn" onClick={onClose} title="Close">
            ✕
          </button>
        </div>

        <form onSubmit={handleCreate} className="modal-body">
          {error && <div className="modal-error">{error}</div>}
          <div className="form-group">
            <label htmlFor="playlist-name-input">Playlist Name</label>
            <input
              id="playlist-name-input"
              type="text"
              className="modal-text-input"
              placeholder="e.g. Summer Roadtrip, Chill Nights"
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
              maxLength={50}
              disabled={loading}
              data-testid="playlist-name-input"
            />
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="btn-modal-secondary"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-modal-primary"
              disabled={loading || !name.trim()}
              data-testid="create-playlist-submit-btn"
            >
              {loading ? 'Creating…' : 'Create Playlist'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

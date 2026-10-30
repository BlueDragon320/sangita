import React, { useState, useRef, useEffect } from 'react'

export default function CreatePlaylistModal({ isOpen, onClose, onCreated, token }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [visibility, setVisibility] = useState('private')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const modalRef = useRef(null)
  const previousFocusRef = useRef(null)

  useEffect(() => {
    if (!isOpen) return

    previousFocusRef.current = document.activeElement

    const timer = setTimeout(() => {
      const input = document.getElementById('playlist-name-input')
      if (input) {
        input.focus()
      } else if (modalRef.current) {
        const focusable = modalRef.current.querySelectorAll(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
        if (focusable.length > 0) focusable[0].focus()
      }
    }, 0)

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
        return
      }

      if (e.key === 'Tab') {
        if (!modalRef.current) return
        const focusable = Array.from(modalRef.current.querySelectorAll(
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
      if (previousFocusRef.current && typeof previousFocusRef.current.focus === 'function') {
        previousFocusRef.current.focus()
      }
    }
  }, [isOpen, onClose])

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
      const v2Payload = {
        title: trimmed,
        description: description.trim(),
        visibility
      }
      let resData = null
      let ok = false

      try {
        const res = await fetch('/api/v2/playlists', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          body: JSON.stringify(v2Payload)
        })
        if (res.ok) {
          resData = await res.json()
          ok = true
        }
      } catch (e) {
        // Fallback below
      }

      if (!ok) {
        const legacyPayload = {
          name: trimmed,
          description: description.trim(),
          visibility
        }
        const res = await fetch('/api/user-playlists', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          body: JSON.stringify(legacyPayload)
        })
        if (res.ok) {
          resData = await res.json()
          ok = true
        } else {
          try {
            const data = await res.json()
            setError(data.error || 'Failed to create playlist')
          } catch {
            setError('Failed to create playlist')
          }
          return
        }
      }

      if (ok) {
        setName('')
        setDescription('')
        setVisibility('private')
        const playlistId = resData?.id
        if (onCreated) {
          onCreated(trimmed, playlistId, resData)
        }
        onClose()
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
        ref={modalRef}
        className="create-playlist-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-playlist-title"
        onClick={e => e.stopPropagation()}
        data-testid="create-playlist-modal"
      >
        <div className="modal-header">
          <div className="modal-title-group modal-title-group-with-icon">
            <div className="modal-icon-badge" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                <path d="M14 10H2v2h12v-2zm0-4H2v2h12V6zm4 8v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zM2 16h8v-2H2v2z"/>
              </svg>
            </div>
            <div>
              <h3 id="create-playlist-title" className="modal-title">Create New Playlist</h3>
              <p className="modal-desc">Build your custom collection of songs</p>
            </div>
          </div>
          <button className="btn-icon modal-close-btn" onClick={onClose} title="Close" aria-label="Close dialog">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>

        <form onSubmit={handleCreate} className="create-playlist-form">
          {error && <div className="modal-error-banner" role="alert">{error}</div>}
          
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

          <div className="form-group">
            <div className="form-label-row">
              <label htmlFor="playlist-description-input">Description (optional)</label>
              <span className="char-count" aria-live="polite">{description.length}/200</span>
            </div>
            <textarea
              id="playlist-description-input"
              className="modal-text-input modal-textarea"
              placeholder="Add an optional description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              maxLength={200}
              rows={2}
              disabled={loading}
              data-testid="playlist-description-input"
            />
          </div>

          <div className="form-group">
            <label id="visibility-group-label">Visibility</label>
            <div
              className="visibility-radio-group"
              role="radiogroup"
              aria-labelledby="visibility-group-label"
              data-testid="playlist-visibility-radiogroup"
            >
              {/* Private (Default) Option */}
              <label
                htmlFor="visibility-private"
                className={`visibility-radio-card ${visibility === 'private' ? 'selected' : ''}`}
                data-testid="visibility-option-private"
              >
                <input
                  type="radio"
                  id="visibility-private"
                  name="visibility"
                  value="private"
                  checked={visibility === 'private'}
                  onChange={() => setVisibility('private')}
                  disabled={loading}
                  className="visibility-radio-input"
                  data-testid="visibility-radio-private"
                />
                <div className="visibility-icon-col" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                    <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
                  </svg>
                </div>
                <div className="visibility-info-col">
                  <div className="visibility-option-title">
                    <span>Private</span>
                    <span className="visibility-default-tag">(Default)</span>
                  </div>
                  <div className="visibility-option-copy">
                    Only you and administrators can view this playlist.
                  </div>
                </div>
              </label>

              {/* Public Option */}
              <label
                htmlFor="visibility-public"
                className={`visibility-radio-card ${visibility === 'public' ? 'selected' : ''}`}
                data-testid="visibility-option-public"
              >
                <input
                  type="radio"
                  id="visibility-public"
                  name="visibility"
                  value="public"
                  checked={visibility === 'public'}
                  onChange={() => setVisibility('public')}
                  disabled={loading}
                  className="visibility-radio-input"
                  data-testid="visibility-radio-public"
                />
                <div className="visibility-icon-col" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                  </svg>
                </div>
                <div className="visibility-info-col">
                  <div className="visibility-option-title">
                    <span>Public</span>
                  </div>
                  <div className="visibility-option-copy">
                    Discoverable by all signed-in users on Sangita.
                  </div>
                </div>
              </label>
            </div>
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

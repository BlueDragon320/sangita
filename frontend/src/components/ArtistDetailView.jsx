import React, { useState, useEffect, useMemo, useCallback } from 'react'
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
  onPlayAll,
  onShuffle,
  favorites = [],
  onToggleFavorite,
  onAddToPlaylist,
  onDownloadTrack,
  onBack
}) {
  const [v2ArtistDetails, setV2ArtistDetails] = useState(null)
  const [imgErr, setImgErr] = useState(false)

  const displayName = v2ArtistDetails?.name || initialArtist?.name || artistName || 'Unknown Artist'

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

  // Artwork URL
  const coverUrl = useMemo(() => {
    if (v2ArtistDetails?.image_url) return v2ArtistDetails.image_url
    if (initialArtist?.image_url) return initialArtist.image_url
    const firstTrackPath = tracks[0]?.path
    if (firstTrackPath && token) {
      return `/api/cover/${firstTrackPath.split('/').map(encodeURIComponent).join('/')}?token=${encodeURIComponent(token)}&v=2`
    }
    if (displayName && token) {
      return `/api/cover/${encodeURIComponent(displayName)}?token=${encodeURIComponent(token)}&v=2`
    }
    return null
  }, [v2ArtistDetails, initialArtist, tracks, displayName, token])

  const hue = strHue(displayName)

  const handlePlayAllClick = useCallback(() => {
    if (tracks.length === 0) return
    if (onPlayAll) {
      onPlayAll(tracks)
    } else if (onPlayTrack) {
      onPlayTrack(tracks[0], 0, tracks)
    }
  }, [tracks, onPlayAll, onPlayTrack])

  const handleShuffleClick = useCallback(() => {
    if (tracks.length === 0) return
    if (onShuffle) {
      onShuffle(tracks)
    } else if (onPlayTrack) {
      const shuffled = [...tracks].sort(() => Math.random() - 0.5)
      onPlayTrack(shuffled[0], 0, shuffled)
    }
  }, [tracks, onShuffle, onPlayTrack])

  return (
    <div className="artist-detail-view" data-testid="artist-detail-view">
      {/* Top Back Navigation */}
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

      {/* Artist Hero Header */}
      <div
        className="artist-hero"
        data-testid="artist-hero"
        style={{ '--hero-accent-hue': `${hue}deg` }}
      >
        <div className="artist-hero-avatar-wrap" data-testid="artist-hero-avatar">
          {!imgErr && coverUrl ? (
            <img
              src={coverUrl}
              alt={displayName}
              onError={() => setImgErr(true)}
              className="artist-hero-avatar-img"
              data-testid="artist-avatar"
            />
          ) : (
            <div
              className="artist-hero-avatar-fallback"
              style={{
                background: `linear-gradient(135deg, hsl(${hue}, 60%, 35%), hsl(${(hue + 45) % 360}, 55%, 20%))`
              }}
              data-testid="artist-avatar"
            >
              {displayName.slice(0, 1).toUpperCase()}
            </div>
          )}
        </div>

        <div className="artist-hero-info">
          <span className="artist-hero-badge">Artist</span>
          <h1 className="artist-hero-title" data-testid="artist-name">
            {displayName}
          </h1>
          <div className="artist-hero-stats">
            <span data-testid="artist-track-count">
              {formatTotalDuration(tracks, durations)}
            </span>
          </div>
        </div>
      </div>

      {/* Transport Controls Bar */}
      <div className="artist-transport-bar">
        <button
          type="button"
          className="artist-play-all-btn"
          onClick={handlePlayAllClick}
          disabled={tracks.length === 0}
          aria-label={`Play all tracks by ${displayName}`}
          data-testid="artist-play-all-btn"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
          <span>Play All</span>
        </button>

        <button
          type="button"
          className="artist-shuffle-btn"
          onClick={handleShuffleClick}
          disabled={tracks.length === 0}
          aria-label={`Shuffle tracks by ${displayName}`}
          data-testid="artist-shuffle-btn"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4zM14.83 13.41l-1.41 1.41 2.13 2.13L13.5 19H19v-5.5l-2.04 2.04z" />
          </svg>
          <span>Shuffle</span>
        </button>
      </div>

      {/* Integrated Track List */}
      <div className="artist-tracklist-section" data-testid="artist-tracklist">
        {tracks.length === 0 ? (
          <div className="artist-empty-tracks" data-testid="artist-empty-tracks">
            No tracks found for this artist.
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
            durations={durations}
            token={token}
            favorites={favorites}
            onToggleFavorite={onToggleFavorite}
            onAddToPlaylist={onAddToPlaylist}
            onDownloadTrack={onDownloadTrack}
          />
        )}
      </div>
    </div>
  )
}

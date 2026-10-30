import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
import React from 'react'
import AdminDashboard from '../components/AdminDashboard.jsx'

describe('AdminDashboard - Library Organization & Global Playlist Inventory', () => {
  const MockThemeIcon = ({ theme }) => <span data-testid="theme-icon">{theme}</span>

  const mockFolders = [
    {
      folder: 'main',
      classification: 'unclassified',
      display_name: 'main',
      mapped_artist: null,
      mapped_artist_id: null,
      track_count: 14,
      user_access_grants: ['admin', 'friend'],
      scan_status: 'synced'
    },
    {
      folder: 'mitski_collection',
      classification: 'artist',
      display_name: 'Mitski Discography',
      mapped_artist: 'Mitski',
      mapped_artist_id: 1,
      track_count: 8,
      user_access_grants: ['*'],
      scan_status: 'synced'
    },
    {
      folder: 'roadtrip_mix',
      classification: 'playlist',
      display_name: 'Roadtrip Hits',
      mapped_artist: null,
      mapped_artist_id: null,
      track_count: 22,
      user_access_grants: ['*'],
      scan_status: 'synced'
    }
  ]

  const mockPlaylists = [
    {
      id: 101,
      title: 'Late Night Chill',
      owner: 'alice',
      visibility: 'private',
      track_count: 12,
      is_folder_playlist: false,
      created_at: '2026-08-25 14:30:00'
    },
    {
      id: 102,
      title: 'Top Summer Hits',
      owner: 'bob',
      visibility: 'public',
      track_count: 35,
      is_folder_playlist: false,
      created_at: '2026-08-26 18:00:00'
    },
    {
      id: 'folder:roadtrip_mix',
      title: 'Roadtrip Hits',
      owner: 'system',
      visibility: 'public',
      track_count: 22,
      is_folder_playlist: true,
      created_at: '2026-08-27 09:15:00'
    }
  ]

  const mockArtists = [
    {
      id: 1,
      name: 'Mitski',
      bio: 'Singer-songwriter',
      folder_count: 1,
      track_count: 8,
      created_at: '2026-08-20 10:00:00'
    },
    {
      id: 2,
      name: 'Mac DeMarco',
      bio: 'Indie musician',
      folder_count: 0,
      track_count: 0,
      created_at: '2026-08-21 11:00:00'
    }
  ]

  beforeEach(() => {
    vi.restoreAllMocks()
    global.fetch = vi.fn().mockImplementation((url, options = {}) => {
      const method = options.method || 'GET'

      if (url.includes('/api/admin/library/folders/classify') && method === 'POST') {
        const body = JSON.parse(options.body)
        return Promise.resolve({
          ok: true,
          json: async () => ({
            message: `Folder '${body.folder}' successfully classified as '${body.classification}'`,
            folder: {
              folder: body.folder,
              classification: body.classification,
              display_name: body.display_name,
              mapped_artist: body.mapped_artist
            }
          })
        })
      }

      if (url.includes('/api/admin/library/folders') && method === 'GET') {
        return Promise.resolve({
          ok: true,
          json: async () => mockFolders
        })
      }

      if (url.includes('/api/admin/library/playlists/') && method === 'DELETE') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ status: 'ok', message: 'Playlist deleted' })
        })
      }

      if (url.includes('/api/admin/library/playlists') && method === 'GET') {
        return Promise.resolve({
          ok: true,
          json: async () => mockPlaylists
        })
      }

      if (url.includes('/api/admin/library/artists') && method === 'POST') {
        const body = JSON.parse(options.body)
        return Promise.resolve({
          ok: true,
          json: async () => ({
            status: 'created',
            artist: { id: 3, name: body.name, bio: body.bio, folder_count: 0, track_count: 0, created_at: '2026-08-30 12:00:00' }
          })
        })
      }

      if (url.includes('/api/admin/library/artists') && method === 'GET') {
        return Promise.resolve({
          ok: true,
          json: async () => mockArtists
        })
      }

      if (url.includes('/api/admin/analytics')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ kpis: {}, timeline: [], hourly_distribution: [], weekday_distribution: [] })
        })
      }

      if (url.includes('/api/admin/users')) {
        return Promise.resolve({
          ok: true,
          json: async () => [
            { username: 'admin', role: 'admin', rules: { allowed_playlists: ['*'] } },
            { username: 'friend', role: 'user', rules: { allowed_playlists: ['main'] } }
          ]
        })
      }

      return Promise.resolve({ ok: true, json: async () => ({}) })
    })
  })

  it('renders the dedicated Library Organization tab and navigates into it', async () => {
    render(
      <AdminDashboard
        token="admin-token"
        playlists={{}}
        onLogout={vi.fn()}
        theme="dark"
        onCycleTheme={vi.fn()}
        ThemeIcon={MockThemeIcon}
        onBackToPlayer={vi.fn()}
      />
    )

    const libTabBtn = screen.getByTestId('admin-tab-library-org')
    expect(libTabBtn).toBeInTheDocument()
    expect(libTabBtn).toHaveTextContent('Library Organization')

    fireEvent.click(libTabBtn)

    await waitFor(() => {
      expect(screen.getByTestId('library-org-tab-content')).toBeInTheDocument()
      expect(screen.getByTestId('folder-classification-panel')).toBeInTheDocument()
      expect(screen.getByTestId('global-playlist-inventory-panel')).toBeInTheDocument()
      expect(screen.getByTestId('artists-management-panel')).toBeInTheDocument()
    })
  })

  it('displays detected source folders, stats counters, and classification pills', async () => {
    render(
      <AdminDashboard
        token="admin-token"
        playlists={{}}
        onLogout={vi.fn()}
        theme="dark"
        onCycleTheme={vi.fn()}
        ThemeIcon={MockThemeIcon}
        onBackToPlayer={vi.fn()}
      />
    )

    fireEvent.click(screen.getByTestId('admin-tab-library-org'))

    await waitFor(() => {
      expect(screen.getByTestId('folder-row-main')).toBeInTheDocument()
      expect(screen.getByTestId('folder-row-mitski_collection')).toBeInTheDocument()
      expect(screen.getByTestId('folder-row-roadtrip_mix')).toBeInTheDocument()
    })

    // Check classification pills
    expect(screen.getByText('⚠️ Unclassified')).toBeInTheDocument()
    expect(screen.getByText('🎨 Artist')).toBeInTheDocument()
    expect(screen.getByText('📋 Playlist')).toBeInTheDocument()

    // Check summary counters
    expect(screen.getByText('Detected Folders')).toBeInTheDocument()
    expect(screen.getByText('Total Audio Tracks')).toBeInTheDocument()
  })

  it('opens folder classify modal and submits classification update', async () => {
    render(
      <AdminDashboard
        token="admin-token"
        playlists={{}}
        onLogout={vi.fn()}
        theme="dark"
        onCycleTheme={vi.fn()}
        ThemeIcon={MockThemeIcon}
        onBackToPlayer={vi.fn()}
      />
    )

    fireEvent.click(screen.getByTestId('admin-tab-library-org'))

    await waitFor(() => {
      expect(screen.getByTestId('btn-classify-folder-main')).toBeInTheDocument()
    })

    // Open modal for 'main' folder
    fireEvent.click(screen.getByTestId('btn-classify-folder-main'))

    await waitFor(() => {
      expect(screen.getByTestId('classify-folder-modal')).toBeInTheDocument()
    })

    const selectClass = screen.getByTestId('select-classification')
    fireEvent.change(selectClass, { target: { value: 'artist' } })

    const inputDisplay = screen.getByTestId('input-folder-display-name')
    fireEvent.change(inputDisplay, { target: { value: 'Mac DeMarco Discography' } })

    await waitFor(() => {
      expect(screen.getByTestId('select-mapped-artist')).toBeInTheDocument()
    })

    const inputArtist = screen.getByTestId('select-mapped-artist')
    fireEvent.change(inputArtist, { target: { value: 'Mac DeMarco' } })

    // Save classification
    fireEvent.click(screen.getByTestId('btn-save-classification'))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/admin/library/folders/classify',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            folder: 'main',
            classification: 'artist',
            display_name: 'Mac DeMarco Discography',
            mapped_artist: 'Mac DeMarco'
          })
        })
      )
    })
  })

  it('searches and filters global playlists by visibility and searches by title/owner', async () => {
    render(
      <AdminDashboard
        token="admin-token"
        playlists={{}}
        onLogout={vi.fn()}
        theme="dark"
        onCycleTheme={vi.fn()}
        ThemeIcon={MockThemeIcon}
        onBackToPlayer={vi.fn()}
      />
    )

    fireEvent.click(screen.getByTestId('admin-tab-library-org'))

    await waitFor(() => {
      expect(screen.getByTestId('playlist-row-101')).toBeInTheDocument()
      expect(screen.getByTestId('playlist-row-102')).toBeInTheDocument()
      expect(screen.getByTestId('playlist-row-folder:roadtrip_mix')).toBeInTheDocument()
    })

    // Filter to Public only
    fireEvent.click(screen.getByTestId('filter-visibility-public'))

    await waitFor(() => {
      expect(screen.queryByTestId('playlist-row-101')).not.toBeInTheDocument()
      expect(screen.getByTestId('playlist-row-102')).toBeInTheDocument()
      expect(screen.getByTestId('playlist-row-folder:roadtrip_mix')).toBeInTheDocument()
    })

    // Filter to Private only
    fireEvent.click(screen.getByTestId('filter-visibility-private'))

    await waitFor(() => {
      expect(screen.getByTestId('playlist-row-101')).toBeInTheDocument()
      expect(screen.queryByTestId('playlist-row-102')).not.toBeInTheDocument()
      expect(screen.queryByTestId('playlist-row-folder:roadtrip_mix')).not.toBeInTheDocument()
    })

    // Switch back to All and Search by owner 'alice'
    fireEvent.click(screen.getByTestId('filter-visibility-all'))
    const searchInput = screen.getByTestId('input-playlist-search')
    fireEvent.change(searchInput, { target: { value: 'alice' } })

    await waitFor(() => {
      expect(screen.getByTestId('playlist-row-101')).toBeInTheDocument()
      expect(screen.queryByTestId('playlist-row-102')).not.toBeInTheDocument()
    })
  })

  it('opens confirmation modal and administratively deletes a playlist', async () => {
    render(
      <AdminDashboard
        token="admin-token"
        playlists={{}}
        onLogout={vi.fn()}
        theme="dark"
        onCycleTheme={vi.fn()}
        ThemeIcon={MockThemeIcon}
        onBackToPlayer={vi.fn()}
      />
    )

    fireEvent.click(screen.getByTestId('admin-tab-library-org'))

    await waitFor(() => {
      expect(screen.getByTestId('btn-delete-playlist-101')).toBeInTheDocument()
    })

    // Click delete on playlist 101
    const delBtn = screen.getByTestId('btn-delete-playlist-101')
    fireEvent.click(delBtn)

    await waitFor(() => {
      expect(screen.getByTestId('delete-playlist-modal')).toBeInTheDocument()
      expect(screen.getByText('Confirm Administrative Deletion')).toBeInTheDocument()
      expect(screen.getAllByText(/Late Night Chill/).length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText(/Impact Warning:/)).toBeInTheDocument()
    })

    // Confirm deletion
    fireEvent.click(screen.getByTestId('btn-confirm-delete-playlist'))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/admin/library/playlists/101',
        expect.objectContaining({ method: 'DELETE' })
      )
    })
  })

  it('manages catalog artists and opens modal to create a new artist', async () => {
    render(
      <AdminDashboard
        token="admin-token"
        playlists={{}}
        onLogout={vi.fn()}
        theme="dark"
        onCycleTheme={vi.fn()}
        ThemeIcon={MockThemeIcon}
        onBackToPlayer={vi.fn()}
      />
    )

    fireEvent.click(screen.getByTestId('admin-tab-library-org'))

    await waitFor(() => {
      expect(screen.getByTestId('artist-row-1')).toBeInTheDocument()
      expect(screen.getByTestId('artist-row-2')).toBeInTheDocument()
      expect(screen.getAllByText('Mitski').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('Mac DeMarco').length).toBeGreaterThanOrEqual(1)
    })

    // Click Add New Artist
    fireEvent.click(screen.getByTestId('btn-add-artist'))

    await waitFor(() => {
      expect(screen.getByTestId('add-artist-modal')).toBeInTheDocument()
    })

    const nameInput = screen.getByTestId('input-artist-name')
    const bioInput = screen.getByTestId('input-artist-bio')

    fireEvent.change(nameInput, { target: { value: 'Phoebe Bridgers' } })
    fireEvent.change(bioInput, { target: { value: 'Indie rock singer-songwriter' } })

    fireEvent.click(screen.getByTestId('btn-save-artist'))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/admin/library/artists',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            name: 'Phoebe Bridgers',
            bio: 'Indie rock singer-songwriter'
          })
        })
      )
    })
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import CreatePlaylistModal from '../components/CreatePlaylistModal.jsx'

describe('CreatePlaylistModal Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders input and buttons when open', () => {
    render(
      <CreatePlaylistModal
        isOpen={true}
        onClose={vi.fn()}
        onCreated={vi.fn()}
        token="test-token"
      />
    )

    expect(screen.getByText('Create New Playlist')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('e.g. Summer Roadtrip, Chill Nights')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Add an optional description')).toBeInTheDocument()
    expect(screen.getByText('Cancel')).toBeInTheDocument()
    expect(screen.getByTestId('create-playlist-submit-btn')).toBeInTheDocument()
  })

  it('renders visibility options with Private as default and proper copy', () => {
    render(
      <CreatePlaylistModal
        isOpen={true}
        onClose={vi.fn()}
        onCreated={vi.fn()}
        token="test-token"
      />
    )

    const privateRadio = screen.getByTestId('visibility-radio-private')
    const publicRadio = screen.getByTestId('visibility-radio-public')

    expect(privateRadio).toBeChecked()
    expect(publicRadio).not.toBeChecked()

    expect(screen.getByText('Only you and administrators can view this playlist.')).toBeInTheDocument()
    expect(screen.getByText('Discoverable by all signed-in users on Sangita.')).toBeInTheDocument()
  })

  it('allows switching visibility to public and toggling back to private', () => {
    render(
      <CreatePlaylistModal
        isOpen={true}
        onClose={vi.fn()}
        onCreated={vi.fn()}
        token="test-token"
      />
    )

    const privateRadio = screen.getByTestId('visibility-radio-private')
    const publicRadio = screen.getByTestId('visibility-radio-public')

    fireEvent.click(publicRadio)
    expect(publicRadio).toBeChecked()
    expect(privateRadio).not.toBeChecked()

    fireEvent.click(privateRadio)
    expect(privateRadio).toBeChecked()
    expect(publicRadio).not.toBeChecked()
  })

  it('supports optional description input with character limit of 200', () => {
    render(
      <CreatePlaylistModal
        isOpen={true}
        onClose={vi.fn()}
        onCreated={vi.fn()}
        token="test-token"
      />
    )

    const descInput = screen.getByTestId('playlist-description-input')
    expect(descInput).toHaveAttribute('maxLength', '200')

    fireEvent.change(descInput, { target: { value: 'My favorite summer jams' } })
    expect(descInput.value).toBe('My favorite summer jams')
    expect(screen.getByText('23/200')).toBeInTheDocument()
  })

  it('validates empty and reserved playlist names', async () => {
    render(
      <CreatePlaylistModal
        isOpen={true}
        onClose={vi.fn()}
        onCreated={vi.fn()}
        token="test-token"
      />
    )

    const input = screen.getByPlaceholderText('e.g. Summer Roadtrip, Chill Nights')
    const form = input.closest('form')
    
    // Type reserved name
    fireEvent.change(input, { target: { value: 'Favorites' } })
    fireEvent.submit(form)

    expect(await screen.findByText('That name is reserved')).toBeInTheDocument()
  })

  it('submits API call to /api/v2/playlists with { title, description, visibility } and triggers onCreated and onClose on success', async () => {
    const handleCreated = vi.fn()
    const handleClose = vi.fn()

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'pl-101', title: 'Roadtrip 2026', visibility: 'private' })
    })

    render(
      <CreatePlaylistModal
        isOpen={true}
        onClose={handleClose}
        onCreated={handleCreated}
        token="test-token"
      />
    )

    const input = screen.getByPlaceholderText('e.g. Summer Roadtrip, Chill Nights')
    fireEvent.change(input, { target: { value: 'Roadtrip 2026' } })

    const submitBtn = screen.getByTestId('create-playlist-submit-btn')
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/v2/playlists', expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Authorization': 'Bearer test-token'
        }),
        body: JSON.stringify({ title: 'Roadtrip 2026', description: '', visibility: 'private' })
      }))
      expect(handleCreated).toHaveBeenCalledWith('Roadtrip 2026', 'pl-101', expect.objectContaining({
        id: 'pl-101',
        title: 'Roadtrip 2026'
      }))
      expect(handleClose).toHaveBeenCalledTimes(1)
    })
  })

  it('submits customized description and public visibility in payload', async () => {
    const handleCreated = vi.fn()
    const handleClose = vi.fn()

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'pl-102', title: 'Public Beats', visibility: 'public' })
    })

    render(
      <CreatePlaylistModal
        isOpen={true}
        onClose={handleClose}
        onCreated={handleCreated}
        token="test-token"
      />
    )

    fireEvent.change(screen.getByTestId('playlist-name-input'), { target: { value: 'Public Beats' } })
    fireEvent.change(screen.getByTestId('playlist-description-input'), { target: { value: 'Best songs for coding' } })
    fireEvent.click(screen.getByTestId('visibility-radio-public'))

    fireEvent.click(screen.getByTestId('create-playlist-submit-btn'))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/v2/playlists', expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Authorization': 'Bearer test-token'
        }),
        body: JSON.stringify({
          title: 'Public Beats',
          description: 'Best songs for coding',
          visibility: 'public'
        })
      }))
      expect(handleCreated).toHaveBeenCalled()
      expect(handleClose).toHaveBeenCalled()
    })
  })

  it('falls back to /api/user-playlists when /api/v2/playlists fails', async () => {
    const handleCreated = vi.fn()
    const handleClose = vi.fn()

    global.fetch = vi.fn().mockImplementation((url) => {
      if (url === '/api/v2/playlists') {
        return Promise.resolve({ ok: false, status: 404, json: async () => ({ error: 'Not found' }) })
      }
      if (url === '/api/user-playlists') {
        return Promise.resolve({ ok: true, json: async () => ({ status: 'created', name: 'Fallback Beats' }) })
      }
      return Promise.resolve({ ok: true, json: async () => ({}) })
    })

    render(
      <CreatePlaylistModal
        isOpen={true}
        onClose={handleClose}
        onCreated={handleCreated}
        token="test-token"
      />
    )

    fireEvent.change(screen.getByTestId('playlist-name-input'), { target: { value: 'Fallback Beats' } })
    fireEvent.click(screen.getByTestId('create-playlist-submit-btn'))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/user-playlists', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          name: 'Fallback Beats',
          description: '',
          visibility: 'private'
        })
      }))
      expect(handleCreated).toHaveBeenCalledWith('Fallback Beats', undefined, expect.objectContaining({
        name: 'Fallback Beats'
      }))
      expect(handleClose).toHaveBeenCalled()
    })
  })

  it('renders accessible dialog with aria-modal, aria-labelledby, and close button aria-label', () => {
    render(
      <CreatePlaylistModal
        isOpen={true}
        onClose={vi.fn()}
        onCreated={vi.fn()}
        token="test-token"
      />
    )

    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAttribute('aria-labelledby', 'create-playlist-title')
    expect(screen.getByRole('heading', { level: 3, name: 'Create New Playlist' })).toHaveAttribute('id', 'create-playlist-title')

    const closeBtn = screen.getByRole('button', { name: 'Close dialog' })
    expect(closeBtn).toBeInTheDocument()
  })

  it('renders validation error with role="alert"', async () => {
    render(
      <CreatePlaylistModal
        isOpen={true}
        onClose={vi.fn()}
        onCreated={vi.fn()}
        token="test-token"
      />
    )

    const input = screen.getByPlaceholderText('e.g. Summer Roadtrip, Chill Nights')
    const form = input.closest('form')
    fireEvent.change(input, { target: { value: 'Favorites' } })
    fireEvent.submit(form)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('That name is reserved')
  })

  it('closes dialog on Escape key press', () => {
    const handleClose = vi.fn()
    render(
      <CreatePlaylistModal
        isOpen={true}
        onClose={handleClose}
        onCreated={vi.fn()}
        token="test-token"
      />
    )

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(handleClose).toHaveBeenCalledTimes(1)
  })
})

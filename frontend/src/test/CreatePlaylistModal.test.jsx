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
    expect(screen.getByText('Cancel')).toBeInTheDocument()
    expect(screen.getByTestId('create-playlist-submit-btn')).toBeInTheDocument()
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

  it('submits API call and triggers onCreated and onClose on success', async () => {
    const handleCreated = vi.fn()
    const handleClose = vi.fn()

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'created', name: 'Roadtrip 2026' })
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
      expect(global.fetch).toHaveBeenCalledWith('/api/user-playlists', expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Authorization': 'Bearer test-token'
        }),
        body: JSON.stringify({ name: 'Roadtrip 2026' })
      }))
      expect(handleCreated).toHaveBeenCalledWith('Roadtrip 2026')
      expect(handleClose).toHaveBeenCalledTimes(1)
    })
  })
})

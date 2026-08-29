import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import Sidebar from '../components/Sidebar.jsx'

describe('Sidebar Component & Collapse / Expand', () => {
  const mockPlaylists = {
    'Chill Vibes': ['song1.mp3', 'song2.mp3'],
    'Rock Classics': ['rock1.mp3', 'rock2.mp3', 'rock3.mp3'],
    'Library': ['all1.mp3']
  }

  it('renders all playlists when expanded', () => {
    render(
      <Sidebar
        playlists={mockPlaylists}
        currentPlaylist="Chill Vibes"
        onSelect={vi.fn()}
        isOpen={false}
        sidebarCollapsed={false}
        onToggleSidebar={vi.fn()}
      />
    )

    expect(screen.getByText('Sangita')).toBeInTheDocument()
    expect(screen.getByText('Your Library')).toBeInTheDocument()
    expect(screen.getByText('Chill Vibes')).toBeInTheDocument()
    expect(screen.getByText('Rock Classics')).toBeInTheDocument()
    expect(screen.getByText('Playlist • 2 songs')).toBeInTheDocument()
    expect(screen.getByText('Artist • 3 songs')).toBeInTheDocument()
  })

  it('calls onToggleSidebar when the 3-line toggle button is clicked', () => {
    const handleToggle = vi.fn()
    render(
      <Sidebar
        playlists={mockPlaylists}
        currentPlaylist="Chill Vibes"
        onSelect={vi.fn()}
        isOpen={false}
        sidebarCollapsed={false}
        onToggleSidebar={handleToggle}
      />
    )

    const toggleBtn = screen.getByTestId('sidebar-toggle-btn')
    fireEvent.click(toggleBtn)
    expect(handleToggle).toHaveBeenCalledTimes(1)
  })

  it('hides textual labels and toolbar when sidebarCollapsed is true', () => {
    render(
      <Sidebar
        playlists={mockPlaylists}
        currentPlaylist="Chill Vibes"
        onSelect={vi.fn()}
        isOpen={false}
        sidebarCollapsed={true}
        onToggleSidebar={vi.fn()}
      />
    )

    const sidebar = screen.getByTestId('sidebar')
    expect(sidebar).toHaveClass('collapsed')

    expect(screen.queryByText('Sangita')).not.toBeInTheDocument()
    expect(screen.queryByTestId('library-toolbar')).not.toBeInTheDocument()
    expect(screen.queryByText('Chill Vibes')).not.toBeInTheDocument()
  })

  it('allows playlist selection by clicking item in both expanded and collapsed modes', () => {
    const handleSelect = vi.fn()
    const { rerender } = render(
      <Sidebar
        playlists={mockPlaylists}
        currentPlaylist="Chill Vibes"
        onSelect={handleSelect}
        isOpen={false}
        sidebarCollapsed={false}
        onToggleSidebar={vi.fn()}
      />
    )

    const rockItem = screen.getByTestId('sidebar-playlist-Rock Classics')
    fireEvent.click(rockItem)
    expect(handleSelect).toHaveBeenCalledWith('Rock Classics')

    // Rerender collapsed
    rerender(
      <Sidebar
        playlists={mockPlaylists}
        currentPlaylist="Rock Classics"
        onSelect={handleSelect}
        isOpen={false}
        sidebarCollapsed={true}
        onToggleSidebar={vi.fn()}
      />
    )

    const chillItem = screen.getByTestId('sidebar-playlist-Chill Vibes')
    fireEvent.click(chillItem)
    expect(handleSelect).toHaveBeenCalledWith('Chill Vibes')
  })

  it('filters playlists using the search input', () => {
    render(
      <Sidebar
        playlists={mockPlaylists}
        currentPlaylist="Chill Vibes"
        onSelect={vi.fn()}
        isOpen={false}
        sidebarCollapsed={false}
        onToggleSidebar={vi.fn()}
      />
    )

    const searchInput = screen.getByTestId('library-search-input')
    fireEvent.change(searchInput, { target: { value: 'Rock' } })

    expect(screen.getByText('Rock Classics')).toBeInTheDocument()
    expect(screen.queryByText('Chill Vibes')).not.toBeInTheDocument()
  })

  it('filters between Playlists and Artists buttons', () => {
    const mockData = {
      'Alan Walker': ['faded.mp3'],
      'Chill Vibes Playlist': ['chill.mp3']
    }
    render(
      <Sidebar
        playlists={mockData}
        currentPlaylist="Alan Walker"
        onSelect={vi.fn()}
        isOpen={false}
        sidebarCollapsed={false}
        onToggleSidebar={vi.fn()}
      />
    )

    const playlistsChip = screen.getByTestId('lib-chip-playlists')
    const artistsChip = screen.getByTestId('lib-chip-artists')

    expect(playlistsChip).toBeInTheDocument()
    expect(artistsChip).toBeInTheDocument()

    // Click Playlists
    fireEvent.click(playlistsChip)
    expect(screen.getByText('Chill Vibes Playlist')).toBeInTheDocument()
    expect(screen.queryByText('Alan Walker')).not.toBeInTheDocument()

    // Click Artists
    fireEvent.click(artistsChip)
    expect(screen.getByText('Alan Walker')).toBeInTheDocument()
    expect(screen.queryByText('Chill Vibes Playlist')).not.toBeInTheDocument()
  })
})

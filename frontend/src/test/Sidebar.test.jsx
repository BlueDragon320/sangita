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
    expect(screen.getByText('Your library')).toBeInTheDocument()
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

  it('supports accessible brand toggle button with aria-expanded and keyboard triggers', () => {
    const handleToggle = vi.fn()
    const { rerender } = render(
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
    expect(toggleBtn).toHaveAttribute('role', 'button')
    expect(toggleBtn).toHaveAttribute('tabIndex', '0')
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'true')
    expect(toggleBtn).toHaveAttribute('aria-label', 'Collapse sidebar')

    // Keyboard trigger with Enter
    fireEvent.keyDown(toggleBtn, { key: 'Enter' })
    expect(handleToggle).toHaveBeenCalledTimes(1)

    // Keyboard trigger with Space
    fireEvent.keyDown(toggleBtn, { key: ' ' })
    expect(handleToggle).toHaveBeenCalledTimes(2)

    // Rerender collapsed
    rerender(
      <Sidebar
        playlists={mockPlaylists}
        currentPlaylist="Chill Vibes"
        onSelect={vi.fn()}
        isOpen={false}
        sidebarCollapsed={true}
        onToggleSidebar={handleToggle}
      />
    )
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'false')
    expect(toggleBtn).toHaveAttribute('aria-label', 'Expand sidebar')
  })

  it('renders close button when mobile drawer is open (isOpen=true) and calls onCloseDrawer', () => {
    const handleClose = vi.fn()
    render(
      <Sidebar
        playlists={mockPlaylists}
        currentPlaylist="Chill Vibes"
        onSelect={vi.fn()}
        isOpen={true}
        sidebarCollapsed={false}
        onToggleSidebar={vi.fn()}
        onCloseDrawer={handleClose}
      />
    )

    const closeBtn = screen.getByTestId('sidebar-close-btn')
    expect(closeBtn).toBeInTheDocument()
    expect(closeBtn).toHaveAttribute('aria-label', 'Close library menu')

    fireEvent.click(closeBtn)
    expect(handleClose).toHaveBeenCalledTimes(1)
  })

  it('calls onToggleSidebar if onCloseDrawer is omitted when close button is clicked', () => {
    const handleToggle = vi.fn()
    render(
      <Sidebar
        playlists={mockPlaylists}
        currentPlaylist="Chill Vibes"
        onSelect={vi.fn()}
        isOpen={true}
        sidebarCollapsed={false}
        onToggleSidebar={handleToggle}
      />
    )

    const closeBtn = screen.getByTestId('sidebar-close-btn')
    fireEvent.click(closeBtn)
    expect(handleToggle).toHaveBeenCalledTimes(1)
  })

  it('closes mobile drawer on Escape key press when open', () => {
    const handleClose = vi.fn()
    render(
      <Sidebar
        playlists={mockPlaylists}
        currentPlaylist="Chill Vibes"
        onSelect={vi.fn()}
        isOpen={true}
        sidebarCollapsed={false}
        onCloseDrawer={handleClose}
      />
    )

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(handleClose).toHaveBeenCalledTimes(1)
  })

  it('renders a compact Discover icon button when collapsed and library is empty', () => {
    const handleDiscover = vi.fn()
    render(
      <Sidebar
        playlists={{}}
        currentPlaylist=""
        onSelect={vi.fn()}
        isOpen={false}
        sidebarCollapsed={true}
        onDiscover={handleDiscover}
      />
    )

    const compactDiscoverBtn = screen.getByTestId('sidebar-empty-collapsed-btn')
    expect(compactDiscoverBtn).toBeInTheDocument()
    expect(compactDiscoverBtn).toHaveAttribute('aria-label', 'Discover')

    fireEvent.click(compactDiscoverBtn)
    expect(handleDiscover).toHaveBeenCalledTimes(1)
  })

  it('renders Create Playlist button in library toolbar and calls onCreatePlaylist', () => {
    const handleCreate = vi.fn()
    render(
      <Sidebar
        playlists={mockPlaylists}
        currentPlaylist="Chill Vibes"
        onSelect={vi.fn()}
        isOpen={false}
        sidebarCollapsed={false}
        onToggleSidebar={vi.fn()}
        onCreatePlaylist={handleCreate}
      />
    )

    const createBtn = screen.getByTestId('sidebar-create-playlist-btn')
    expect(createBtn).toBeInTheDocument()
    expect(createBtn).toHaveAttribute('aria-label', 'Create playlist')

    fireEvent.click(createBtn)
    expect(handleCreate).toHaveBeenCalledTimes(1)
  })

  it('makes playlist items keyboard-accessible with Enter and Space keys', () => {
    const handleSelect = vi.fn()
    render(
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
    expect(rockItem).toHaveAttribute('role', 'button')
    expect(rockItem).toHaveAttribute('tabIndex', '0')

    // Trigger with Enter key
    fireEvent.keyDown(rockItem, { key: 'Enter' })
    expect(handleSelect).toHaveBeenCalledWith('Rock Classics')

    // Trigger with Space key
    fireEvent.keyDown(rockItem, { key: ' ' })
    expect(handleSelect).toHaveBeenCalledWith('Rock Classics')
    expect(handleSelect).toHaveBeenCalledTimes(2)
  })

  it('renders both playlists and artists together by default in unified list without section heading text', () => {
    const customPlaylists = {
      'Favorites': ['fav.mp3'],
      'My Private Mix': ['s1.mp3'],
      'Pop Hits Playlist': ['pop.mp3'],
      'Coldplay': ['yellow.mp3']
    }

    render(
      <Sidebar
        playlists={customPlaylists}
        userPlaylists={['My Private Mix']}
        playlistMetadata={{
          'My Private Mix': { visibility: 'private' }
        }}
        currentPlaylist="Favorites"
        onSelect={vi.fn()}
        isOpen={false}
        sidebarCollapsed={false}
        onToggleSidebar={vi.fn()}
      />
    )

    expect(screen.getByTestId('sidebar-section-unified')).toBeInTheDocument()

    // Section heading texts must NOT be present in the sidebar
    expect(screen.queryByText('My Playlists')).not.toBeInTheDocument()
    expect(screen.queryByText('Folder Playlists')).not.toBeInTheDocument()
    expect(document.querySelector('.sidebar-section-title')).not.toBeInTheDocument()

    // Items themselves are rendered and visible together by default
    expect(screen.getByText('Favorites')).toBeInTheDocument()
    expect(screen.getByText('My Private Mix')).toBeInTheDocument()
    expect(screen.getByText('Pop Hits Playlist')).toBeInTheDocument()
    expect(screen.getByText('Coldplay')).toBeInTheDocument()
  })

  it('renders items in correct order: Favorites pinned first, then playlists and artists merged and sorted alphabetically', () => {
    const customPlaylists = {
      'Pop Hits': ['pop.mp3'],
      'Favorites': ['fav.mp3'],
      'Arijit Singh': ['arijit.mp3'],
      'My Workout': ['workout.mp3']
    }

    render(
      <Sidebar
        playlists={customPlaylists}
        userPlaylists={['My Workout']}
        folderClassifications={{
          'Pop Hits': 'playlist',
          'Arijit Singh': 'artist'
        }}
        currentPlaylist="Favorites"
        onSelect={vi.fn()}
      />
    )

    const items = screen.getAllByRole('button').filter(el => el.classList.contains('playlist-item'))
    const itemNames = items.map(el => el.querySelector('.playlist-item-name')?.textContent)
    expect(itemNames).toEqual(['Favorites', 'Arijit Singh', 'My Workout', 'Pop Hits'])
  })

  it('does not display intrusive public or private badges in sidebar for a clean retail storefront', () => {
    const customPlaylists = {
      'Private Jam': ['s1.mp3'],
      'Public Party': ['s2.mp3']
    }

    render(
      <Sidebar
        playlists={customPlaylists}
        userPlaylists={['Private Jam', 'Public Party']}
        playlistMetadata={{
          'Private Jam': { visibility: 'private' },
          'Public Party': { visibility: 'public' }
        }}
        currentPlaylist="Private Jam"
        onSelect={vi.fn()}
        isOpen={false}
        sidebarCollapsed={false}
        onToggleSidebar={vi.fn()}
      />
    )

    expect(screen.getByTestId('sidebar-playlist-Private Jam')).toBeInTheDocument()
    expect(screen.getByTestId('sidebar-playlist-Public Party')).toBeInTheDocument()
    expect(screen.queryByTestId('playlist-visibility-Private Jam')).not.toBeInTheDocument()
    expect(screen.queryByTestId('playlist-visibility-Public Party')).not.toBeInTheDocument()
    expect(screen.queryByText('Private')).not.toBeInTheDocument()
    expect(screen.queryByText('Public')).not.toBeInTheDocument()
  })

  it('renders Discover navigation button and triggers onDiscover or onSelect', () => {
    const handleDiscover = vi.fn()
    const handleSelect = vi.fn()

    const { rerender } = render(
      <Sidebar
        playlists={mockPlaylists}
        currentPlaylist="Chill Vibes"
        onSelect={handleSelect}
        onDiscover={handleDiscover}
        isOpen={false}
        sidebarCollapsed={false}
        onToggleSidebar={vi.fn()}
      />
    )

    const discoverBtn = screen.getByTestId('sidebar-discover-btn')
    expect(discoverBtn).toBeInTheDocument()
    expect(screen.getByText('Discover')).toBeInTheDocument()

    fireEvent.click(discoverBtn)
    expect(handleDiscover).toHaveBeenCalledTimes(1)

    // When onDiscover is omitted, falls back to onSelect('Discover')
    rerender(
      <Sidebar
        playlists={mockPlaylists}
        currentPlaylist="Chill Vibes"
        onSelect={handleSelect}
        isOpen={false}
        sidebarCollapsed={false}
        onToggleSidebar={vi.fn()}
      />
    )

    fireEvent.click(screen.getByTestId('sidebar-discover-btn'))
    expect(handleSelect).toHaveBeenCalledWith('Discover')
  })

  it('uses folderClassifications to separate folders into Artists and Playlists overriding heuristics', () => {
    const customPlaylists = {
      // By heuristic "Arijit Singh" would be artist, but classification overrides to playlist
      'Arijit Singh': ['song1.mp3'],
      // By heuristic "Workout Playlist" would be playlist, but classification overrides to artist
      'Workout Playlist': ['song2.mp3']
    }

    render(
      <Sidebar
        playlists={customPlaylists}
        folderClassifications={{
          'Arijit Singh': 'playlist',
          'Workout Playlist': 'artist'
        }}
        currentPlaylist="Arijit Singh"
        onSelect={vi.fn()}
      />
    )

    expect(screen.getByTestId('sidebar-playlist-Arijit Singh')).toHaveTextContent('Playlist • 1 song')
    expect(screen.getByTestId('sidebar-playlist-Workout Playlist')).toHaveTextContent('Artist • 1 song')

    // Filter by Playlists
    fireEvent.click(screen.getByTestId('lib-chip-playlists'))
    expect(screen.getByTestId('sidebar-playlist-Arijit Singh')).toBeInTheDocument()
    expect(screen.queryByTestId('sidebar-playlist-Workout Playlist')).not.toBeInTheDocument()

    // Filter by Artists
    fireEvent.click(screen.getByTestId('lib-chip-artists'))
    expect(screen.getByTestId('sidebar-playlist-Workout Playlist')).toBeInTheDocument()
    expect(screen.queryByTestId('sidebar-playlist-Arijit Singh')).not.toBeInTheDocument()
  })

  it('ensures personal playlists take precedence and are treated as user playlists even if physical folder shares the same name', () => {
    const customPlaylists = {
      'Chill Beats': ['p1.mp3', 'p2.mp3']
    }

    render(
      <Sidebar
        playlists={customPlaylists}
        userPlaylists={['Chill Beats']}
        playlistMetadata={{
          'Chill Beats': { id: 'user-cb', visibility: 'public', isOwner: true }
        }}
        folderClassifications={{
          'Chill Beats': 'playlist' // Physical folder also named "Chill Beats"
        }}
        currentPlaylist="Chill Beats"
        onSelect={vi.fn()}
      />
    )

    const item = screen.getByTestId('sidebar-playlist-Chill Beats')
    expect(item).toBeInTheDocument()
    expect(screen.queryByTestId('playlist-visibility-Chill Beats')).not.toBeInTheDocument()
    expect(item).toHaveTextContent('Playlist • 2 songs')
  })

  it('ensures Favorites always stays pinned at top in all, playlists, and artists filter views', () => {
    const customPlaylists = {
      'Favorites': ['fav1.mp3'],
      'main': ['art1.mp3'], // Artist
      'Raju': ['p1.mp3', 'p2.mp3'] // Playlist
    }

    const { rerender } = render(
      <Sidebar
        playlists={customPlaylists}
        folderClassifications={{
          'main': 'artist',
          'Raju': 'playlist'
        }}
        currentPlaylist="Favorites"
        onSelect={vi.fn()}
      />
    )

    const getRenderedItemNames = () => {
      const items = screen.getAllByRole('button').filter(el => el.classList.contains('playlist-item'))
      return items.map(el => el.querySelector('.playlist-item-name')?.textContent)
    }

    // 1. By default ('all'): Favorites pinned at top, then main (Artist) and Raju (Playlist) directly together in alphabetical order
    expect(getRenderedItemNames()).toEqual(['Favorites', 'main', 'Raju'])

    // 2. In 'playlists' view: Favorites + playlists only
    fireEvent.click(screen.getByTestId('lib-chip-playlists'))
    expect(getRenderedItemNames()).toEqual(['Favorites', 'Raju'])
    expect(screen.queryByText('main')).not.toBeInTheDocument()

    // 3. In 'artists' view: Favorites + artists only (Favorites always stays!)
    fireEvent.click(screen.getByTestId('lib-chip-artists'))
    expect(getRenderedItemNames()).toEqual(['Favorites', 'main'])
    expect(screen.queryByText('Raju')).not.toBeInTheDocument()
  })

  it('keeps personal library personal: only displays user own playlists, Favorites, and explicitly saved playlists, excluding unsaved public playlists', () => {
    const playlists = {
      'Favorites': [{ id: 1, title: 'Fav Song' }],
      'My Playlist': [{ id: 2, title: 'My Song' }],
      'Saved Stranger Playlist': [{ id: 3, title: 'Stranger Song' }],
      'Unsaved Public Playlist': [{ id: 4, title: 'Public Song' }]
    }
    const playlistMetadata = {
      'My Playlist': { is_owner: true, is_saved: false },
      'Saved Stranger Playlist': { is_owner: false, is_saved: true },
      'Unsaved Public Playlist': { is_owner: false, is_saved: false, visibility: 'public' }
    }

    render(
      <Sidebar
        playlists={playlists}
        userPlaylists={['My Playlist', 'Saved Stranger Playlist', 'Unsaved Public Playlist']}
        playlistMetadata={playlistMetadata}
        username="alice"
        currentPlaylist="Favorites"
        onSelect={vi.fn()}
      />
    )

    expect(screen.getByText('Favorites')).toBeInTheDocument()
    expect(screen.getByText('My Playlist')).toBeInTheDocument()
    expect(screen.getByText('Saved Stranger Playlist')).toBeInTheDocument()
    expect(screen.queryByText('Unsaved Public Playlist')).not.toBeInTheDocument()
  })
})


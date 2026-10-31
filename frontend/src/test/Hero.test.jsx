import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import Hero from '../components/Hero.jsx'

describe('Hero Component & Spotify Layout', () => {
  const mockTracks = [
    { id: '1', name: 'Faded', path: 'Alan Walker/Faded.mp3' },
    { id: '2', name: 'Alone', path: 'Alan Walker/Alone.mp3' }
  ]

  const mockDurations = {
    'Alan Walker/Faded.mp3': 200,
    'Alan Walker/Alone.mp3': 160
  }

  it('renders playlist title, Public Playlist tag, creator avatar and duration stats', () => {
    render(
      <Hero
        playlistName="Classics"
        tracks={mockTracks}
        isPlaying={false}
        isShuffle={false}
        onPlay={vi.fn()}
        onShuffle={vi.fn()}
        onDownload={vi.fn()}
        username="VaibhavOp"
        durations={mockDurations}
        token="token"
      />
    )

    expect(screen.getByText('Public Playlist')).toBeInTheDocument()
    expect(screen.getByText('Classics')).toBeInTheDocument()
    expect(screen.getByText('VaibhavOp')).toBeInTheDocument()
    expect(screen.getByText(/2 songs, 6 min/)).toBeInTheDocument()
  })

  it('triggers onPlay when big play button is clicked', () => {
    const handlePlay = vi.fn()
    render(
      <Hero
        playlistName="Classics"
        tracks={mockTracks}
        isPlaying={false}
        isShuffle={false}
        onPlay={handlePlay}
        onShuffle={vi.fn()}
        onDownload={vi.fn()}
        username="VaibhavOp"
        durations={mockDurations}
        token="token"
      />
    )

    const playBtn = screen.getByTestId('hero-play-btn')
    fireEvent.click(playBtn)
    expect(handlePlay).toHaveBeenCalledTimes(1)
  })

  it('triggers onShuffle when shuffle button is clicked', () => {
    const handleShuffle = vi.fn()
    render(
      <Hero
        playlistName="Classics"
        tracks={mockTracks}
        isPlaying={false}
        isShuffle={false}
        onPlay={vi.fn()}
        onShuffle={handleShuffle}
        onDownload={vi.fn()}
        username="VaibhavOp"
        durations={mockDurations}
        token="token"
      />
    )

    const shuffleBtn = screen.getByTestId('hero-shuffle-btn')
    fireEvent.click(shuffleBtn)
    expect(handleShuffle).toHaveBeenCalledTimes(1)
  })

  it('renders 4-track quad collage grid when playlist has 4 or more tracks', () => {
    const fourTracks = [
      { id: '1', name: 'Song 1', path: 'Pl/Song1.mp3' },
      { id: '2', name: 'Song 2', path: 'Pl/Song2.mp3' },
      { id: '3', name: 'Song 3', path: 'Pl/Song3.mp3' },
      { id: '4', name: 'Song 4', path: 'Pl/Song4.mp3' },
    ]
    const { container } = render(
      <Hero
        playlistName="Collage Playlist"
        tracks={fourTracks}
        isPlaying={false}
        isShuffle={false}
        onPlay={vi.fn()}
        onShuffle={vi.fn()}
        onDownload={vi.fn()}
        username="VaibhavOp"
        durations={{}}
        token="valid-token"
      />
    )

    const quadGrid = container.querySelector('.hero-art-quad-grid')
    expect(quadGrid).toBeInTheDocument()
    const images = container.querySelectorAll('.hero-quad-img')
    expect(images.length).toBe(4)
  })

  it('handles individual quad cell error without destroying the entire collage grid', () => {
    const fourTracks = [
      { id: '1', name: 'Song 1', path: 'Pl/Song1.mp3' },
      { id: '2', name: 'Song 2', path: 'Pl/Song2.mp3' },
      { id: '3', name: 'Song 3', path: 'Pl/Song3.mp3' },
      { id: '4', name: 'Song 4', path: 'Pl/Song4.mp3' },
    ]
    const { container } = render(
      <Hero
        playlistName="Collage Playlist"
        tracks={fourTracks}
        isPlaying={false}
        isShuffle={false}
        onPlay={vi.fn()}
        onShuffle={vi.fn()}
        onDownload={vi.fn()}
        username="VaibhavOp"
        durations={{}}
        token="valid-token"
      />
    )

    const images = container.querySelectorAll('.hero-quad-img')
    expect(images.length).toBe(4)

    // Trigger error on first image only
    fireEvent.error(images[0])

    // Grid remains intact with fallback cell in place
    expect(container.querySelector('.hero-art-quad-grid')).toBeInTheDocument()
    expect(container.querySelector('.hero-quad-cell-fallback')).toBeInTheDocument()
    // The remaining 3 images are still rendered
    expect(container.querySelectorAll('.hero-quad-img').length).toBe(3)
  })

  it('disables action buttons and adds aria-disabled when playlist has zero tracks', () => {
    const handlePlay = vi.fn()
    const handleShuffle = vi.fn()

    render(
      <Hero
        playlistName="Empty Playlist"
        tracks={[]}
        isPlaying={false}
        isShuffle={false}
        onPlay={handlePlay}
        onShuffle={handleShuffle}
        onDownload={vi.fn()}
        username="VaibhavOp"
        durations={{}}
        token="valid-token"
      />
    )

    const playBtn = screen.getByTestId('hero-play-btn')
    const shuffleBtn = screen.getByTestId('hero-shuffle-btn')

    expect(playBtn).toBeDisabled()
    expect(playBtn).toHaveAttribute('aria-disabled', 'true')
    expect(shuffleBtn).toBeDisabled()
    expect(shuffleBtn).toHaveAttribute('aria-disabled', 'true')

    fireEvent.click(playBtn)
    fireEvent.click(shuffleBtn)
    expect(handlePlay).not.toHaveBeenCalled()
    expect(handleShuffle).not.toHaveBeenCalled()
  })

  it('deduplicates action bar by removing redundant mix button and shows More Options', () => {
    render(
      <Hero
        playlistName="Classics"
        tracks={mockTracks}
        isPlaying={false}
        isShuffle={true}
        onPlay={vi.fn()}
        onShuffle={vi.fn()}
        onDownload={vi.fn()}
        username="VaibhavOp"
        durations={mockDurations}
        token="token"
      />
    )

    // Redundant mix button should no longer exist
    expect(screen.queryByTestId('hero-mix-pill-btn')).not.toBeInTheDocument()
    // More options button is present
    expect(screen.getByTestId('hero-more-btn')).toBeInTheDocument()
    // Shuffle button has active glow state
    const shuffleBtn = screen.getByTestId('hero-shuffle-btn')
    expect(shuffleBtn).toHaveClass('active')
    expect(shuffleBtn).toHaveClass('glow')
  })

  it('renders Private visibility badge and By @username owner tag', () => {
    render(
      <Hero
        playlistName="Secret Tunes"
        tracks={mockTracks}
        isPlaying={false}
        isShuffle={false}
        onPlay={vi.fn()}
        onShuffle={vi.fn()}
        owner="Alice"
        visibility="private"
      />
    )

    const badge = screen.getByTestId('hero-visibility-badge')
    expect(badge).toHaveTextContent('Private')
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('By @')).toBeInTheDocument()
  })

  it('provides Edit Details and Delete buttons inside 3-dots menu for owner/admin with full accessible dialog interactions', () => {
    const handleEdit = vi.fn()
    const handleDelete = vi.fn()

    render(
      <Hero
        playlistName="My Roadtrip"
        tracks={mockTracks}
        isPlaying={false}
        isShuffle={false}
        onPlay={vi.fn()}
        onShuffle={vi.fn()}
        owner="Bob"
        currentUser="Bob"
        isOwner={true}
        visibility="private"
        description="Great roadtrip beats"
        onEditPlaylist={handleEdit}
        onDeletePlaylist={handleDelete}
      />
    )

    // Standalone Edit and Delete buttons should NOT exist directly in the action bar
    expect(screen.queryByTestId('hero-edit-btn')).not.toBeInTheDocument()
    expect(screen.queryByTestId('hero-delete-btn')).not.toBeInTheDocument()

    // 3-dots button is rendered and accessible
    const moreBtn = screen.getByTestId('hero-more-btn')
    expect(moreBtn).toHaveAttribute('aria-haspopup', 'menu')
    expect(moreBtn).toHaveAttribute('aria-expanded', 'false')

    // Click 3-dots button to open menu
    fireEvent.click(moreBtn)
    expect(moreBtn).toHaveAttribute('aria-expanded', 'true')
    const menu = screen.getByTestId('hero-more-menu')
    expect(menu).toHaveAttribute('role', 'menu')

    // Find Edit Details inside menu
    const editBtn = screen.getByTestId('hero-edit-btn')
    expect(editBtn).toHaveAttribute('role', 'menuitem')
    expect(editBtn).toHaveTextContent('Edit Details')

    // Test Edit Modal
    fireEvent.click(editBtn)
    expect(screen.queryByTestId('hero-more-menu')).not.toBeInTheDocument()
    expect(screen.getByTestId('hero-edit-modal')).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Edit Playlist Details' })).toBeInTheDocument()

    const nameInput = screen.getByTestId('edit-playlist-name-input')
    const descInput = screen.getByTestId('edit-playlist-desc-input')
    expect(nameInput.value).toBe('My Roadtrip')
    expect(descInput.value).toBe('Great roadtrip beats')

    fireEvent.change(nameInput, { target: { value: 'Epic Roadtrip' } })
    fireEvent.click(screen.getByTestId('edit-visibility-public'))
    fireEvent.click(screen.getByTestId('edit-playlist-save-btn'))

    expect(handleEdit).toHaveBeenCalledWith({
      name: 'Epic Roadtrip',
      description: 'Great roadtrip beats',
      visibility: 'public'
    })
    expect(screen.queryByTestId('hero-edit-modal')).not.toBeInTheDocument()

    // Open 3-dots menu again for Delete
    fireEvent.click(moreBtn)
    const deleteBtn = screen.getByTestId('hero-delete-btn')
    expect(deleteBtn).toHaveAttribute('role', 'menuitem')
    expect(deleteBtn).toHaveClass('hero-menu-item-danger')

    // Click Delete from menu to open confirmation dialog
    fireEvent.click(deleteBtn)
    expect(screen.queryByTestId('hero-more-menu')).not.toBeInTheDocument()
    const deleteDialog = screen.getByTestId('hero-delete-dialog')
    expect(deleteDialog).toHaveAttribute('role', 'alertdialog')
    expect(screen.getByText(/Are you sure you want to delete "My Roadtrip"\?/)).toBeInTheDocument()

    // Test cancel
    fireEvent.click(screen.getByTestId('delete-playlist-cancel-btn'))
    expect(screen.queryByTestId('hero-delete-dialog')).not.toBeInTheDocument()
    expect(handleDelete).not.toHaveBeenCalled()

    // Reopen menu and confirm delete
    fireEvent.click(moreBtn)
    fireEvent.click(screen.getByTestId('hero-delete-btn'))
    fireEvent.click(screen.getByTestId('delete-playlist-confirm-btn'))
    expect(handleDelete).toHaveBeenCalledWith('My Roadtrip')
    expect(screen.queryByTestId('hero-delete-dialog')).not.toBeInTheDocument()
  })

  it('places Play and Shuffle buttons in hero-action-left and 3-Dots menu in hero-top-right, removing List view format indicator', () => {
    const handleAddToPlaylist = vi.fn()
    const handleEdit = vi.fn()
    const handleDelete = vi.fn()
    render(
      <Hero
        playlistName="Workout Hits"
        tracks={mockTracks}
        isPlaying={false}
        isShuffle={false}
        onPlay={vi.fn()}
        onShuffle={vi.fn()}
        onAddToPlaylist={handleAddToPlaylist}
        onEditPlaylist={handleEdit}
        onDeletePlaylist={handleDelete}
        owner="Alice"
        currentUser="Alice"
        isOwner={true}
      />
    )

    const heroBanner = screen.getByTestId('hero-banner')
    const heroTopRight = screen.getByTestId('hero-top-right')
    const actionBar = screen.getByTestId('hero-action-bar')
    const actionLeft = screen.getByTestId('hero-action-left')

    expect(heroBanner).toContainElement(heroTopRight)
    expect(actionBar).toContainElement(actionLeft)

    // Play and Shuffle buttons are located in hero-action-left
    const playBtn = screen.getByTestId('hero-play-btn')
    const shuffleBtn = screen.getByTestId('hero-shuffle-btn')
    expect(actionLeft).toContainElement(playBtn)
    expect(actionLeft).toContainElement(shuffleBtn)

    // 3-dots / more options button is located in hero-top-right
    const moreBtn = screen.getByTestId('hero-more-btn')
    expect(heroTopRight).toContainElement(moreBtn)

    // Verify that "List" text or view-format-indicator is NOT in the document
    expect(screen.queryByText('List')).not.toBeInTheDocument()
    expect(screen.queryByTestId('view-format-indicator')).not.toBeInTheDocument()
    expect(document.querySelector('.view-format-indicator')).toBeNull()

    // Standalone buttons should not be in the action bar
    expect(screen.queryByTestId('hero-add-pill-btn')).not.toBeInTheDocument()
    expect(screen.queryByTestId('hero-edit-btn')).not.toBeInTheDocument()
    expect(screen.queryByTestId('hero-delete-btn')).not.toBeInTheDocument()

    // Verify clicking hero-more-btn in the top right opens the hero-more-menu and displays options
    fireEvent.click(moreBtn)
    const menu = screen.getByTestId('hero-more-menu')
    expect(menu).toBeInTheDocument()
    expect(heroTopRight).toContainElement(menu)

    expect(screen.getByTestId('hero-edit-btn')).toHaveTextContent('Edit Details')
    expect(screen.getByTestId('hero-delete-btn')).toHaveTextContent('Delete Playlist')
    const addBtn = screen.getByTestId('hero-add-pill-btn')
    expect(addBtn).toBeInTheDocument()

    // Clicking Add to Playlist triggers callback and closes menu
    fireEvent.click(addBtn)
    expect(handleAddToPlaylist).toHaveBeenCalledWith(mockTracks[0])
    expect(screen.queryByTestId('hero-more-menu')).not.toBeInTheDocument()
  })

  it('closes 3-dots dropdown menu when pressing Escape or clicking outside', () => {
    render(
      <Hero
        playlistName="My Roadtrip"
        tracks={mockTracks}
        isPlaying={false}
        isShuffle={false}
        onPlay={vi.fn()}
        onShuffle={vi.fn()}
        owner="Bob"
        currentUser="Bob"
        isOwner={true}
      />
    )

    const moreBtn = screen.getByTestId('hero-more-btn')

    // Open menu
    fireEvent.click(moreBtn)
    expect(screen.getByTestId('hero-more-menu')).toBeInTheDocument()

    // Press Escape -> should close
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByTestId('hero-more-menu')).not.toBeInTheDocument()

    // Reopen menu
    fireEvent.click(moreBtn)
    expect(screen.getByTestId('hero-more-menu')).toBeInTheDocument()

    // Click outside -> should close
    fireEvent.mouseDown(document.body)
    expect(screen.queryByTestId('hero-more-menu')).not.toBeInTheDocument()
  })

  it('renders Private visibility badge with crisp styling and without murky blur', () => {
    const { container } = render(
      <Hero
        playlistName="Secret Tunes"
        tracks={mockTracks}
        isPlaying={false}
        isShuffle={false}
        onPlay={vi.fn()}
        onShuffle={vi.fn()}
        owner="Alice"
        visibility="private"
      />
    )

    const badge = screen.getByTestId('hero-visibility-badge')
    expect(badge).toHaveTextContent('Private')
    expect(badge).toHaveClass('hero-tag')
    expect(badge).toHaveClass('hero-tag-private')

    const heroContainer = container.querySelector('.hero-container')
    expect(heroContainer).toBeInTheDocument()
    // Verify hero container and badge have crisp classes
    expect(heroContainer).not.toHaveClass('blur')
    expect(badge).not.toHaveClass('blur')
  })

  it('renders accessible alert banner when unavailableCount > 0', () => {
    render(
      <Hero
        playlistName="Classics"
        tracks={mockTracks}
        isPlaying={false}
        isShuffle={false}
        onPlay={vi.fn()}
        unavailableCount={3}
      />
    )

    const banner = screen.getByRole('alert')
    expect(banner).toBeInTheDocument()
    expect(banner).toHaveAttribute('data-testid', 'hero-unavailable-banner')
    expect(banner).toHaveTextContent('3 songs unavailable under your library permissions')
  })

  it('renders Edit Details modal in a document.body portal with modern header, icon badge, micro-labels, and visibility cards', () => {
    const handleEdit = vi.fn()
    const { container } = render(
      <Hero
        playlistName="Late Night Vibes"
        tracks={mockTracks}
        isPlaying={false}
        isShuffle={false}
        owner="Alice"
        currentUser="Alice"
        isOwner={true}
        visibility="private"
        description="Chill tunes for coding"
        onEditPlaylist={handleEdit}
      />
    )

    // Open dropdown and click Edit Details
    fireEvent.click(screen.getByTestId('hero-more-btn'))
    fireEvent.click(screen.getByTestId('hero-edit-btn'))

    const editModal = screen.getByTestId('hero-edit-modal')
    expect(editModal).toBeInTheDocument()

    // Verify PORTAL: The modal is rendered under document.body and NOT inside .hero-container
    const heroContainer = container.querySelector('.hero-container')
    expect(heroContainer).toBeInTheDocument()
    expect(heroContainer).not.toContainElement(editModal)
    expect(document.body).toContainElement(editModal)

    // Verify Modern Header Structure
    expect(screen.getByText('Edit Playlist Details')).toBeInTheDocument()
    expect(screen.getByText('Update title, description, and visibility settings')).toBeInTheDocument()
    expect(editModal.querySelector('.modal-icon-badge')).toBeInTheDocument()
    expect(screen.getByLabelText('Close edit dialog')).toBeInTheDocument()

    // Form inputs and Character Counter
    const nameInput = screen.getByTestId('edit-playlist-name-input')
    const descInput = screen.getByTestId('edit-playlist-desc-input')
    const saveBtn = screen.getByTestId('edit-playlist-save-btn')
    expect(nameInput.value).toBe('Late Night Vibes')
    expect(descInput.value).toBe('Chill tunes for coding')
    expect(screen.getByText('22/200')).toBeInTheDocument()

    // Save button disabled when name is cleared
    fireEvent.change(nameInput, { target: { value: '   ' } })
    expect(saveBtn).toBeDisabled()

    // Restore name and type into description
    fireEvent.change(nameInput, { target: { value: 'Midnight Beats' } })
    expect(saveBtn).not.toBeDisabled()

    fireEvent.change(descInput, { target: { value: 'Deep focus music' } })
    expect(screen.getByText('16/200')).toBeInTheDocument()

    // Visibility Cards
    const privateCard = screen.getByTestId('edit-visibility-private')
    const publicCard = screen.getByTestId('edit-visibility-public')
    expect(privateCard).toHaveClass('selected')
    expect(publicCard).not.toHaveClass('selected')
    expect(screen.getByText('Only you and administrators can view this playlist')).toBeInTheDocument()
    expect(screen.getByText('Discoverable by all signed-in users on Sangita')).toBeInTheDocument()

    // Switch to Public
    fireEvent.click(publicCard)
    expect(publicCard).toHaveClass('selected')
    expect(privateCard).not.toHaveClass('selected')

    // Submit form
    fireEvent.click(saveBtn)
    expect(handleEdit).toHaveBeenCalledWith({
      name: 'Midnight Beats',
      description: 'Deep focus music',
      visibility: 'public'
    })
    expect(screen.queryByTestId('hero-edit-modal')).not.toBeInTheDocument()
  })

  it('closes Edit modal when clicking the backdrop or pressing Escape', () => {
    render(
      <Hero
        playlistName="Study Sessions"
        tracks={mockTracks}
        isPlaying={false}
        isShuffle={false}
        owner="Alice"
        currentUser="Alice"
        isOwner={true}
      />
    )

    // Open Edit modal
    fireEvent.click(screen.getByTestId('hero-more-btn'))
    fireEvent.click(screen.getByTestId('hero-edit-btn'))
    expect(screen.getByTestId('hero-edit-modal')).toBeInTheDocument()

    // Dismiss with Escape key
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByTestId('hero-edit-modal')).not.toBeInTheDocument()

    // Reopen and dismiss with close button
    fireEvent.click(screen.getByTestId('hero-more-btn'))
    fireEvent.click(screen.getByTestId('hero-edit-btn'))
    expect(screen.getByTestId('hero-edit-modal')).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('Close edit dialog'))
    expect(screen.queryByTestId('hero-edit-modal')).not.toBeInTheDocument()

    // Reopen and dismiss by clicking backdrop outside the modal
    fireEvent.click(screen.getByTestId('hero-more-btn'))
    fireEvent.click(screen.getByTestId('hero-edit-btn'))
    const backdrop = document.body.querySelector('.modal-backdrop')
    expect(backdrop).toBeInTheDocument()

    // Clicking inside the modal does not close it
    fireEvent.click(screen.getByTestId('hero-edit-modal'))
    expect(screen.getByTestId('hero-edit-modal')).toBeInTheDocument()

    // Clicking backdrop closes it
    fireEvent.click(backdrop)
    expect(screen.queryByTestId('hero-edit-modal')).not.toBeInTheDocument()
  })

  it('renders Add to Library / Remove from Library in 3-dot menu for non-owner playlists without cluttering action bar', () => {
    const handleToggleSave = vi.fn()
    const { rerender } = render(
      <Hero
        playlistName="Stranger Playlist"
        playlistId="pl-99"
        tracks={mockTracks}
        isPlaying={false}
        isShuffle={false}
        owner="bob"
        currentUser="alice"
        isOwner={false}
        isSaved={false}
        onToggleSave={handleToggleSave}
      />
    )

    // Action bar does not have duplicate save button
    expect(screen.queryByTestId('hero-save-btn')).not.toBeInTheDocument()

    // 3-dot menu has Add to Library
    const moreBtn = screen.getByTestId('hero-more-btn')
    fireEvent.click(moreBtn)

    const menuSaveBtn = screen.getByTestId('hero-menu-save-btn')
    expect(menuSaveBtn).toBeInTheDocument()
    expect(menuSaveBtn).toHaveTextContent('Add to Library')

    fireEvent.click(menuSaveBtn)
    expect(handleToggleSave).toHaveBeenCalledWith(true)

    // Rerender as saved
    rerender(
      <Hero
        playlistName="Stranger Playlist"
        playlistId="pl-99"
        tracks={mockTracks}
        isPlaying={false}
        isShuffle={false}
        owner="bob"
        currentUser="alice"
        isOwner={false}
        isSaved={true}
        onToggleSave={handleToggleSave}
      />
    )

    fireEvent.click(screen.getByTestId('hero-more-btn'))
    const menuRemoveBtn = screen.getByTestId('hero-menu-save-btn')
    expect(menuRemoveBtn).toHaveTextContent('Remove from Library')
  })

  it('suppresses auto-generated Folder playlist descriptions while rendering custom descriptions', () => {
    const { rerender } = render(
      <Hero
        playlistName="Lo-Fi Beats"
        tracks={mockTracks}
        isPlaying={false}
        isShuffle={false}
        description="Folder playlist for Lo-Fi Beats"
      />
    )

    // Generated "Folder playlist for ..." description should be suppressed
    expect(screen.queryByTestId('hero-description')).not.toBeInTheDocument()
    expect(screen.queryByText(/Folder playlist for/)).not.toBeInTheDocument()

    // Custom user description should be rendered
    rerender(
      <Hero
        playlistName="Lo-Fi Beats"
        tracks={mockTracks}
        isPlaying={false}
        isShuffle={false}
        description="Handcrafted chill beats to study and relax to"
      />
    )

    expect(screen.getByTestId('hero-description')).toBeInTheDocument()
    expect(screen.getByText('Handcrafted chill beats to study and relax to')).toBeInTheDocument()
  })

  it('renders Public Playlist with unobtrusive text styling class', () => {
    render(
      <Hero
        playlistName="Global Top 50"
        tracks={mockTracks}
        isPlaying={false}
        isShuffle={false}
        isPrivate={false}
      />
    )

    const badge = screen.getByTestId('hero-visibility-badge')
    expect(badge).toHaveTextContent('Public Playlist')
    expect(badge).toHaveClass('hero-tag-public')
  })
})

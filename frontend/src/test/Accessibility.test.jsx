import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import fs from 'fs'
import path from 'path'

import Player from '../components/Player.jsx'
import AddToPlaylistModal from '../components/AddToPlaylistModal.jsx'
import CreatePlaylistModal from '../components/CreatePlaylistModal.jsx'
import DevicePanel from '../components/DevicePanel.jsx'
import ArtistDetailView from '../components/ArtistDetailView.jsx'

// WCAG 2.1 Contrast Calculation Utilities
function sRGBtoLin(colorVal) {
  return colorVal <= 0.04045 ? colorVal / 12.92 : Math.pow((colorVal + 0.055) / 1.055, 2.4)
}

function hexToRgb(hex) {
  hex = hex.replace('#', '').trim()
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('')
  return [
    parseInt(hex.substr(0, 2), 16) / 255,
    parseInt(hex.substr(2, 2), 16) / 255,
    parseInt(hex.substr(4, 2), 16) / 255
  ]
}

function getRelativeLuminance(hex) {
  const [r, g, b] = hexToRgb(hex)
  return 0.2126 * sRGBtoLin(r) + 0.7152 * sRGBtoLin(g) + 0.0722 * sRGBtoLin(b)
}

function getContrastRatio(hex1, hex2) {
  const lum1 = getRelativeLuminance(hex1)
  const lum2 = getRelativeLuminance(hex2)
  const lighter = Math.max(lum1, lum2)
  const darker = Math.min(lum1, lum2)
  return (lighter + 0.05) / (darker + 0.05)
}

describe('Automated Web Accessibility & Screen Reader Test Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  // =========================================================================
  // 1. Screen Reader Live Regions (aria-live="polite", role="status")
  // =========================================================================
  describe('Screen Reader Live Regions', () => {
    it('renders a polite status live region for track changes in Player.jsx', () => {
      const { rerender } = render(
        <Player
          track={null}
          playlist="Rock Classics"
          isPlaying={false}
          isShuffle={false}
          isLoop={false}
          onTogglePlay={vi.fn()}
          onNext={vi.fn()}
          onPrev={vi.fn()}
          onToggleShuffle={vi.fn()}
          onToggleLoop={vi.fn()}
          currentTime={0}
          duration={0}
          onSeek={vi.fn()}
          volume={80}
          onVolumeChange={vi.fn()}
          formatTime={(s) => `${s}`}
          isActiveDevice={true}
          activeDeviceName="Laptop"
          syncState={null}
          devices={[]}
          myDeviceId="dev-1"
        />
      )

      // Live region exists even when nothing is playing
      const liveRegion = screen.getByRole('status')
      expect(liveRegion).toBeInTheDocument()
      expect(liveRegion).toHaveAttribute('aria-live', 'polite')
      expect(liveRegion).toHaveClass('sr-only')
      expect(liveRegion).toHaveTextContent('')

      // Track starts playing
      rerender(
        <Player
          track={{
            id: 't-1',
            name: 'Bohemian Rhapsody',
            artist: 'Queen',
            playlist: 'Rock Classics',
            path: '/music/queen.mp3'
          }}
          playlist="Rock Classics"
          isPlaying={true}
          isShuffle={false}
          isLoop={false}
          onTogglePlay={vi.fn()}
          onNext={vi.fn()}
          onPrev={vi.fn()}
          onToggleShuffle={vi.fn()}
          onToggleLoop={vi.fn()}
          currentTime={10}
          duration={354}
          onSeek={vi.fn()}
          volume={80}
          onVolumeChange={vi.fn()}
          formatTime={(s) => `${s}`}
          isActiveDevice={true}
          activeDeviceName="Laptop"
          syncState={null}
          devices={[]}
          myDeviceId="dev-1"
        />
      )

      // Announces "Now playing: Bohemian Rhapsody by Queen"
      expect(liveRegion).toHaveTextContent('Now playing: Bohemian Rhapsody by Queen')

      // Track changes to another song
      rerender(
        <Player
          track={{
            id: 't-2',
            title: 'Hotel California',
            artist: 'Eagles',
            playlist: 'Rock Classics',
            path: '/music/eagles.mp3'
          }}
          playlist="Rock Classics"
          isPlaying={true}
          isShuffle={false}
          isLoop={false}
          onTogglePlay={vi.fn()}
          onNext={vi.fn()}
          onPrev={vi.fn()}
          onToggleShuffle={vi.fn()}
          onToggleLoop={vi.fn()}
          currentTime={0}
          duration={390}
          onSeek={vi.fn()}
          volume={80}
          onVolumeChange={vi.fn()}
          formatTime={(s) => `${s}`}
          isActiveDevice={true}
          activeDeviceName="Laptop"
          syncState={null}
          devices={[]}
          myDeviceId="dev-1"
        />
      )

      // Updates dynamically to "Now playing: Hotel California by Eagles"
      expect(liveRegion).toHaveTextContent('Now playing: Hotel California by Eagles')
    })

    it('falls back gracefully to playlist or "Unknown Artist" when track metadata artist is missing', () => {
      const { rerender } = render(
        <Player
          track={{
            id: 't-3',
            name: 'Stairway to Heaven',
            playlist: 'Led Zeppelin IV'
          }}
          playlist="Led Zeppelin IV"
          isPlaying={true}
          currentTime={0}
          duration={480}
          isActiveDevice={true}
          syncState={null}
          devices={[]}
          myDeviceId="dev-1"
        />
      )

      const liveRegion = screen.getByRole('status')
      expect(liveRegion).toHaveTextContent('Now playing: Stairway to Heaven by Led Zeppelin IV')

      // Track with neither artist nor playlist
      rerender(
        <Player
          track={{
            id: 't-4',
            name: 'Untitled Track'
          }}
          playlist=""
          isPlaying={true}
          currentTime={0}
          duration={120}
          isActiveDevice={true}
          syncState={null}
          devices={[]}
          myDeviceId="dev-1"
        />
      )

      expect(liveRegion).toHaveTextContent('Now playing: Untitled Track by Unknown Artist')
    })

    it('announces track changes in remote playback mode as well', () => {
      render(
        <Player
          track={null}
          playlist=""
          isPlaying={false}
          currentTime={15}
          duration={200}
          isActiveDevice={false}
          activeDeviceName="Living Room Speaker"
          syncState={{
            activeDeviceId: 'speaker-99',
            isPlaying: true,
            trackId: '/music/Pink Floyd/Comfortably Numb.mp3',
            durationMs: 382000
          }}
          devices={[{ deviceId: 'speaker-99', deviceName: 'Living Room Speaker' }]}
          myDeviceId="laptop-1"
          onSendRemote={vi.fn()}
        />
      )

      const liveRegion = screen.getByRole('status')
      expect(liveRegion).toHaveAttribute('aria-live', 'polite')
      expect(liveRegion).toHaveTextContent('Now playing: Comfortably Numb by Remote Track')
    })

    it('announces library feedback via aria-live status toasts in ArtistDetailView', async () => {
      global.fetch = vi.fn().mockImplementation((url) => {
        if (url.includes('/api/v2/artists/')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              id: 'anuv-jain',
              name: 'Anuv Jain',
              bio: 'Indie Artist',
              is_saved: false,
              tracks: [
                { id: '1', title: 'Baarishein', duration: 200, path: '/music/Baarishein.mp3' }
              ]
            })
          })
        }
        return Promise.resolve({ ok: true, json: async () => ({}) })
      })

      const onToggleSave = vi.fn().mockResolvedValue(true)
      render(
        <ArtistDetailView
          artistId="anuv-jain"
          artistName="Anuv Jain"
          token="test-token"
          playlists={{}}
          onToggleSaveArtist={onToggleSave}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Anuv Jain')).toBeInTheDocument()
      })

      const followBtn = screen.getByTestId('artist-save-btn')
      fireEvent.click(followBtn)

      await waitFor(() => {
        const toast = screen.getByTestId('artist-toast')
        expect(toast).toHaveAttribute('role', 'status')
        expect(toast).toHaveAttribute('aria-live', 'polite')
        expect(toast).toHaveTextContent(/Saved (?:Anuv Jain|artist) to your library/i)
      })
    })

    it('provides accessible transfer feedback announcement in DevicePanel', () => {
      render(
        <DevicePanel
          devices={[
            { deviceId: 'dev-1', deviceName: 'My Laptop', deviceType: 'laptop' },
            { deviceId: 'dev-2', deviceName: 'Phone', deviceType: 'phone' }
          ]}
          myDeviceId="dev-1"
          activeDeviceId="dev-1"
          onTransfer={vi.fn()}
          onClose={vi.fn()}
        />
      )

      const liveRegion = screen.getByText((content, element) => {
        return element?.getAttribute('aria-live') === 'polite'
      })
      expect(liveRegion).toBeInTheDocument()
      expect(liveRegion).toHaveClass('sr-only')
    })
  })

  // =========================================================================
  // 2. Modal Dialog Accessibility: Roles, Attributes, Escape & Focus Trapping
  // =========================================================================
  describe('Modal Dialog Accessibility', () => {
    it('verifies AddToPlaylistModal has role="dialog", aria-modal="true", and aria-labelledby', () => {
      render(
        <AddToPlaylistModal
          track={{ id: '1', name: 'Song One', path: '/music/song1.mp3' }}
          playlists={{ 'Late Night': ['/music/song1.mp3'] }}
          favorites={[]}
          token="test-token"
          onClose={vi.fn()}
        />
      )

      const dialog = screen.getByRole('dialog')
      expect(dialog).toHaveAttribute('aria-modal', 'true')
      expect(dialog).toHaveAttribute('aria-labelledby', 'add-playlist-title')
      expect(document.getElementById('add-playlist-title')).toHaveTextContent('Add to playlist')
    })

    it('verifies CreatePlaylistModal has role="dialog", aria-modal="true", and aria-labelledby', () => {
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
      expect(document.getElementById('create-playlist-title')).toHaveTextContent('Create new playlist')
    })

    it('verifies DevicePanel has role="dialog", aria-modal="true", and aria-labelledby', () => {
      render(
        <DevicePanel
          devices={[{ deviceId: 'dev-1', deviceName: 'My Laptop', deviceType: 'laptop' }]}
          myDeviceId="dev-1"
          activeDeviceId="dev-1"
          onTransfer={vi.fn()}
          onClose={vi.fn()}
        />
      )

      const dialog = screen.getByRole('dialog')
      expect(dialog).toHaveAttribute('aria-modal', 'true')
      expect(dialog).toHaveAttribute('aria-labelledby', 'device-panel-title')
    })

    it('dismisses modals when Escape key is pressed', () => {
      const handleCloseAdd = vi.fn()
      const { unmount: unmountAdd } = render(
        <AddToPlaylistModal
          track={{ id: '1', name: 'Song One', path: '/music/song1.mp3' }}
          playlists={{}}
          favorites={[]}
          token="test-token"
          onClose={handleCloseAdd}
        />
      )
      fireEvent.keyDown(window, { key: 'Escape' })
      expect(handleCloseAdd).toHaveBeenCalledTimes(1)
      unmountAdd()

      const handleCloseCreate = vi.fn()
      const { unmount: unmountCreate } = render(
        <CreatePlaylistModal
          isOpen={true}
          onClose={handleCloseCreate}
          onCreated={vi.fn()}
          token="test-token"
        />
      )
      fireEvent.keyDown(window, { key: 'Escape' })
      expect(handleCloseCreate).toHaveBeenCalledTimes(1)
      unmountCreate()

      const handleCloseDevice = vi.fn()
      render(
        <DevicePanel
          devices={[{ deviceId: 'dev-1', deviceName: 'My Laptop', deviceType: 'laptop' }]}
          myDeviceId="dev-1"
          activeDeviceId="dev-1"
          onTransfer={vi.fn()}
          onClose={handleCloseDevice}
        />
      )
      fireEvent.keyDown(window, { key: 'Escape' })
      expect(handleCloseDevice).toHaveBeenCalledTimes(1)
    })

    it('traps Tab navigation within AddToPlaylistModal', () => {
      render(
        <AddToPlaylistModal
          track={{ id: '1', name: 'Song One', path: '/music/song1.mp3' }}
          playlists={{ 'Chill Vibes': [] }}
          favorites={[]}
          token="test-token"
          onClose={vi.fn()}
        />
      )

      const dialog = screen.getByRole('dialog')
      const focusable = dialog.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
      expect(focusable.length).toBeGreaterThan(1)

      const firstElement = focusable[0]
      const lastElement = focusable[focusable.length - 1]

      // Focus last element and press Tab -> should wrap to first element
      lastElement.focus()
      expect(document.activeElement).toBe(lastElement)
      fireEvent.keyDown(window, { key: 'Tab', shiftKey: false })
      expect(document.activeElement).toBe(firstElement)

      // Focus first element and press Shift+Tab -> should wrap to last element
      firstElement.focus()
      expect(document.activeElement).toBe(firstElement)
      fireEvent.keyDown(window, { key: 'Tab', shiftKey: true })
      expect(document.activeElement).toBe(lastElement)
    })

    it('traps Tab navigation within CreatePlaylistModal', () => {
      render(
        <CreatePlaylistModal
          isOpen={true}
          onClose={vi.fn()}
          onCreated={vi.fn()}
          token="test-token"
        />
      )

      const dialog = screen.getByRole('dialog')
      const focusable = dialog.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
      expect(focusable.length).toBeGreaterThan(1)

      const firstElement = focusable[0]
      const lastElement = focusable[focusable.length - 1]

      // Wrap forward from last to first
      lastElement.focus()
      fireEvent.keyDown(window, { key: 'Tab', shiftKey: false })
      expect(document.activeElement).toBe(firstElement)

      // Wrap backwards from first to last
      firstElement.focus()
      fireEvent.keyDown(window, { key: 'Tab', shiftKey: true })
      expect(document.activeElement).toBe(lastElement)
    })

    it('traps Tab navigation within DevicePanel', () => {
      render(
        <DevicePanel
          devices={[
            { deviceId: 'dev-1', deviceName: 'My Laptop', deviceType: 'laptop' },
            { deviceId: 'dev-2', deviceName: 'Headphones', deviceType: 'speaker' }
          ]}
          myDeviceId="dev-1"
          activeDeviceId="dev-1"
          onTransfer={vi.fn()}
          onClose={vi.fn()}
        />
      )

      const dialog = screen.getByRole('dialog')
      const focusable = dialog.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
      expect(focusable.length).toBeGreaterThan(1)

      const firstElement = focusable[0]
      const lastElement = focusable[focusable.length - 1]

      lastElement.focus()
      fireEvent.keyDown(window, { key: 'Tab', shiftKey: false })
      expect(document.activeElement).toBe(firstElement)

      firstElement.focus()
      fireEvent.keyDown(window, { key: 'Tab', shiftKey: true })
      expect(document.activeElement).toBe(lastElement)
    })
  })

  // =========================================================================
  // 3. Color Contrast Math Verifying WCAG AA Compliance across Themes
  // =========================================================================
  describe('Color Contrast Verification across AMOLED, Dark, and Light Themes', () => {
    const cssPath = path.resolve(__dirname, '../index.css')
    const cssContent = fs.readFileSync(cssPath, 'utf-8')

    // Helper to extract a property value from a CSS rule block
    function extractToken(block, property) {
      const match = block.match(new RegExp(`${property}:\\s*([^;]+);`))
      return match ? match[1].trim() : null
    }

    // Extract theme blocks
    const amoledMatch = cssContent.match(/:root,\s*\[data-theme="amoled"\]\s*\{([^}]+)\}/)
    const darkMatch = cssContent.match(/\[data-theme="dark"\]\s*\{([^}]+)\}/)
    const lightMatch = cssContent.match(/\[data-theme="light"\]\s*\{([^}]+)\}/)

    expect(amoledMatch).not.toBeNull()
    expect(darkMatch).not.toBeNull()
    expect(lightMatch).not.toBeNull()

    const amoledBlock = amoledMatch[1]
    const darkBlock = darkMatch[1]
    const lightBlock = lightMatch[1]

    it('verifies AMOLED theme contrast ratios meet WCAG AA (>=4.5:1 text, >=3:1 UI)', () => {
      const bg = extractToken(amoledBlock, '--bg') || '#000000'
      const surface = extractToken(amoledBlock, '--surface') || '#000000'
      const text = extractToken(amoledBlock, '--text') || '#FFFFFF'
      const textSub = extractToken(amoledBlock, '--text-sub') || '#A1A1A6'
      const textDim = extractToken(amoledBlock, '--text-dim') || '#85858B'
      const accent = extractToken(amoledBlock, '--accent') || '#66A3BF'
      const btnText = extractToken(amoledBlock, '--btn-text') || '#051329'

      // Normal text on background >= 4.5:1
      const textBgContrast = getContrastRatio(text, bg)
      expect(textBgContrast).toBeGreaterThanOrEqual(4.5)
      expect(textBgContrast).toBeCloseTo(21.0, 1)

      const textSurfaceContrast = getContrastRatio(text, surface)
      expect(textSurfaceContrast).toBeGreaterThanOrEqual(4.5)

      // Secondary text on background >= 4.5:1
      const textSubContrast = getContrastRatio(textSub, bg)
      expect(textSubContrast).toBeGreaterThanOrEqual(4.5)
      expect(textSubContrast).toBeGreaterThan(8.0)

      const textDimContrast = getContrastRatio(textDim, bg)
      expect(textDimContrast).toBeGreaterThanOrEqual(4.5)
      expect(textDimContrast).toBeGreaterThan(5.5)

      // Accent button text on accent container >= 4.5:1
      const btnTextContrast = getContrastRatio(btnText, accent)
      expect(btnTextContrast).toBeGreaterThanOrEqual(4.5)
      expect(btnTextContrast).toBeGreaterThan(6.5)

      // Active UI indicator (accent on background) >= 3:1
      const accentUiContrast = getContrastRatio(accent, bg)
      expect(accentUiContrast).toBeGreaterThanOrEqual(3.0)
      expect(accentUiContrast).toBeGreaterThan(7.0)
    })

    it('verifies Dark Obsidian theme contrast ratios meet WCAG AA (>=4.5:1 text, >=3:1 UI)', () => {
      const bg = extractToken(darkBlock, '--bg') || '#141415'
      const surface = extractToken(darkBlock, '--surface') || '#19191B'
      const text = extractToken(darkBlock, '--text') || '#EDEDED'
      const textSub = extractToken(darkBlock, '--text-sub') || '#A1A1A6'
      const textDim = extractToken(darkBlock, '--text-dim') || '#85858B'
      const accent = extractToken(darkBlock, '--accent') || '#66A3BF'
      const btnText = extractToken(darkBlock, '--btn-text') || '#051329'

      // Normal text on background >= 4.5:1
      const textBgContrast = getContrastRatio(text, bg)
      expect(textBgContrast).toBeGreaterThanOrEqual(4.5)
      expect(textBgContrast).toBeGreaterThan(15.0)

      const textSurfaceContrast = getContrastRatio(text, surface)
      expect(textSurfaceContrast).toBeGreaterThanOrEqual(4.5)

      // Secondary text on background >= 4.5:1
      const textSubContrast = getContrastRatio(textSub, bg)
      expect(textSubContrast).toBeGreaterThanOrEqual(4.5)
      expect(textSubContrast).toBeGreaterThan(7.0)

      const textDimContrast = getContrastRatio(textDim, bg)
      expect(textDimContrast).toBeGreaterThanOrEqual(4.5)
      expect(textDimContrast).toBeGreaterThan(5.0)

      // Accent button text on accent container >= 4.5:1
      const btnTextContrast = getContrastRatio(btnText, accent)
      expect(btnTextContrast).toBeGreaterThanOrEqual(4.5)
      expect(btnTextContrast).toBeGreaterThan(6.5)

      // Active UI indicator (accent on background) >= 3:1
      const accentUiContrast = getContrastRatio(accent, bg)
      expect(accentUiContrast).toBeGreaterThanOrEqual(3.0)
      expect(accentUiContrast).toBeGreaterThan(6.0)
    })

    it('verifies Light Zinc theme contrast ratios meet WCAG AA (>=4.5:1 text, >=3:1 UI)', () => {
      const bg = extractToken(lightBlock, '--bg') || '#FAFAFA'
      const surface = extractToken(lightBlock, '--surface') || '#FFFFFF'
      const text = extractToken(lightBlock, '--text') || '#171717'
      const textSub = extractToken(lightBlock, '--text-sub') || '#525252'
      const textDim = extractToken(lightBlock, '--text-dim') || '#737373'
      const accent = extractToken(lightBlock, '--accent') || '#032F72'
      const btnText = extractToken(lightBlock, '--btn-text') || '#FFFFFF'

      // Normal text on background >= 4.5:1
      const textBgContrast = getContrastRatio(text, bg)
      expect(textBgContrast).toBeGreaterThanOrEqual(4.5)
      expect(textBgContrast).toBeGreaterThan(17.0)

      const textSurfaceContrast = getContrastRatio(text, surface)
      expect(textSurfaceContrast).toBeGreaterThanOrEqual(4.5)
      expect(textSurfaceContrast).toBeGreaterThan(17.0)

      // Secondary text on background >= 4.5:1
      const textSubContrast = getContrastRatio(textSub, bg)
      expect(textSubContrast).toBeGreaterThanOrEqual(4.5)
      expect(textSubContrast).toBeGreaterThan(7.0)

      const textDimContrast = getContrastRatio(textDim, bg)
      expect(textDimContrast).toBeGreaterThanOrEqual(4.5)

      // Accent button text on accent container >= 4.5:1
      const btnTextContrast = getContrastRatio(btnText, accent)
      expect(btnTextContrast).toBeGreaterThanOrEqual(4.5)
      // Deep navy #032F72 with white text achieves >12:1 (WCAG AAA)
      expect(btnTextContrast).toBeGreaterThan(12.0)

      // Active UI indicator (accent on background & surface) >= 3:1
      const accentBgContrast = getContrastRatio(accent, bg)
      expect(accentBgContrast).toBeGreaterThanOrEqual(3.0)
      expect(accentBgContrast).toBeGreaterThan(12.0)

      const accentSurfaceContrast = getContrastRatio(accent, surface)
      expect(accentSurfaceContrast).toBeGreaterThanOrEqual(3.0)
      expect(accentSurfaceContrast).toBeGreaterThan(12.0)
    })
  })

  // =========================================================================
  // 4. Reduced Motion Media Query Presence & Effectiveness
  // =========================================================================
  describe('Reduced Motion Accessibility Support', () => {
    const cssPath = path.resolve(__dirname, '../index.css')
    const cssContent = fs.readFileSync(cssPath, 'utf-8')

    it('contains @media (prefers-reduced-motion: reduce) rule in index.css', () => {
      expect(cssContent).toMatch(/@media\s*\(\s*prefers-reduced-motion:\s*reduce\s*\)/)
    })

    it('neutralizes animation-duration and transition-duration for reduced-motion users', () => {
      const motionBlockMatch = cssContent.match(/@media\s*\(\s*prefers-reduced-motion:\s*reduce\s*\)\s*\{([\s\S]*?)\n\}/)
      expect(motionBlockMatch).not.toBeNull()
      const motionBlock = motionBlockMatch[1]

      // Universal transition & animation dampening
      expect(motionBlock).toMatch(/animation-duration:\s*0\.01ms\s*!important;/)
      expect(motionBlock).toMatch(/transition-duration:\s*0\.01ms\s*!important;/)
      expect(motionBlock).toMatch(/scroll-behavior:\s*auto\s*!important;/)

      // Stops continuous decorative spinning and equalizer animations
      expect(motionBlock).toMatch(/\.spinner/)
      expect(motionBlock).toMatch(/\.equalizer-bar/)
      expect(motionBlock).toMatch(/animation:\s*none\s*!important;/)
    })

    it('verifies LyricsView checks prefers-reduced-motion media query for smooth scrolling', () => {
      const lyricsViewPath = path.resolve(__dirname, '../components/LyricsView.jsx')
      const lyricsViewContent = fs.readFileSync(lyricsViewPath, 'utf-8')
      expect(lyricsViewContent).toContain('(prefers-reduced-motion: reduce)')
    })
  })
})

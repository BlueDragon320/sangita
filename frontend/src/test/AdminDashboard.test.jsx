import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import React from 'react'
import AdminDashboard from '../components/AdminDashboard.jsx'

describe('AdminDashboard Component', () => {
  const MockThemeIcon = ({ theme }) => <span data-testid="theme-icon">{theme}</span>

  const mockAnalyticsData = {
    timeframe: '7d',
    start_date: '2026-08-22 00:00:00',
    end_date: '2026-08-29 16:00:00',
    kpis: {
      total_seconds: 36000,
      total_hours: 10.0,
      total_plays: 120,
      unique_listeners: 4,
      active_devices: 6,
      avg_daily_seconds: 5142,
      avg_daily_minutes: 85.7,
      avg_session_seconds: 300,
      avg_session_minutes: 5.0,
      peak_hour: {
        hour: 20,
        label: '8:00 PM – 9:00 PM',
        seconds: 7200,
        hours: 2.0,
        percentage: 20.0
      },
      peak_vs_avg: {
        peak_hour_seconds: 7200,
        avg_hourly_seconds: 214.3,
        peak_vs_avg_ratio: 33.6,
        total_active_hours: 18
      }
    },
    timeline: [
      { key: '2026-08-23', label: 'Sun', full_label: 'Sunday, Aug 23', seconds: 3600, minutes: 60, hours: 1, plays: 12, active_users: 2 },
      { key: '2026-08-24', label: 'Mon', full_label: 'Monday, Aug 24', seconds: 7200, minutes: 120, hours: 2, plays: 24, active_users: 3 },
      { key: '2026-08-25', label: 'Tue', full_label: 'Tuesday, Aug 25', seconds: 5400, minutes: 90, hours: 1.5, plays: 18, active_users: 3 },
      { key: '2026-08-26', label: 'Wed', full_label: 'Wednesday, Aug 26', seconds: 3600, minutes: 60, hours: 1, plays: 12, active_users: 2 },
      { key: '2026-08-27', label: 'Thu', full_label: 'Thursday, Aug 27', seconds: 5400, minutes: 90, hours: 1.5, plays: 18, active_users: 4 },
      { key: '2026-08-28', label: 'Fri', full_label: 'Friday, Aug 28', seconds: 7200, minutes: 120, hours: 2, plays: 24, active_users: 4 },
      { key: '2026-08-29', label: 'Sat', full_label: 'Saturday, Aug 29', seconds: 3600, minutes: 60, hours: 1, plays: 12, active_users: 2 }
    ],
    hourly_distribution: Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      label: `${i % 12 || 12} ${i < 12 ? 'AM' : 'PM'}`,
      full_label: `${i % 12 || 12}:00 ${i < 12 ? 'AM' : 'PM'}`,
      seconds: i === 20 ? 7200 : 1200,
      minutes: i === 20 ? 120 : 20,
      hours: i === 20 ? 2 : 0.33,
      plays: i === 20 ? 24 : 4,
      percentage: i === 20 ? 20.0 : 3.3
    })),
    weekday_distribution: [
      { dow: 1, label: 'Mon', full_label: 'Monday', seconds: 7200, minutes: 120, hours: 2, plays: 24, percentage: 20 },
      { dow: 2, label: 'Tue', full_label: 'Tuesday', seconds: 5400, minutes: 90, hours: 1.5, plays: 18, percentage: 15 },
      { dow: 3, label: 'Wed', full_label: 'Wednesday', seconds: 3600, minutes: 60, hours: 1, plays: 12, percentage: 10 },
      { dow: 4, label: 'Thu', full_label: 'Thursday', seconds: 5400, minutes: 90, hours: 1.5, plays: 18, percentage: 15 },
      { dow: 5, label: 'Fri', full_label: 'Friday', seconds: 7200, minutes: 120, hours: 2, plays: 24, percentage: 20 },
      { dow: 6, label: 'Sat', full_label: 'Saturday', seconds: 3600, minutes: 60, hours: 1, plays: 12, percentage: 10 },
      { dow: 0, label: 'Sun', full_label: 'Sunday', seconds: 3600, minutes: 60, hours: 1, plays: 12, percentage: 10 }
    ],
    top_tracks: [
      {
        track_id: 'Chill Vibes/Song 1.mp3',
        name: 'Song 1',
        artist: 'Artist One',
        playlist: 'Chill Vibes',
        total_seconds: 14400,
        hours: 4.0,
        play_count: 48,
        unique_listeners: 4,
        last_played: '2026-08-29 15:30:00'
      }
    ],
    top_artists: [
      { artist: 'Artist One', total_seconds: 14400, hours: 4.0, play_count: 48, track_count: 5, percentage: 40.0 }
    ],
    top_playlists: [
      { playlist: 'Chill Vibes', total_seconds: 20000, hours: 5.5, play_count: 60, unique_tracks: 10, unique_listeners: 4, percentage: 55.5 }
    ],
    device_stats: [
      { device_type: 'desktop', total_seconds: 24000, count: 80, percentage: 66.7 },
      { device_type: 'mobile', total_seconds: 12000, count: 40, percentage: 33.3 }
    ],
    os_stats: [
      { os: 'Linux', total_seconds: 24000, count: 80, percentage: 66.7 },
      { os: 'Android', total_seconds: 12000, count: 40, percentage: 33.3 }
    ],
    browser_stats: [
      { browser: 'Chrome', total_seconds: 36000, count: 120, percentage: 100 }
    ],
    format_stats: [
      { format: 'MP3', count: 100, percentage: 80.0 },
      { format: 'FLAC', count: 25, percentage: 20.0 }
    ],
    live_sessions: [
      {
        id: 1,
        username: 'admin',
        track_id: 'Chill Vibes/Song 1.mp3',
        name: 'Song 1',
        artist: 'Artist One',
        playlist: 'Chill Vibes',
        device_id: 'dev-1',
        device_name: 'Desktop',
        device_type: 'desktop',
        browser: 'Chrome',
        os: 'Linux',
        timestamp: '2026-08-29 15:58:00',
        duration_sec: 180
      }
    ],
    system_metrics: {
      total_tracks: 125,
      total_playlists: 4,
      total_library_seconds: 25000,
      total_library_hours: 6.9,
      registered_users: 2,
      recorded_events: 120,
      db_size_bytes: 102400,
      music_size_bytes: 1048576000,
      cache_entries: 125
    }
  }

  const mockUsersData = [
    { username: 'admin', role: 'admin', rules: { allowed_playlists: ['*'] } },
    { username: 'friend', role: 'user', rules: { allowed_playlists: ['Chill Vibes'] } }
  ]

  const mockLogsData = {
    events: [
      {
        id: 1,
        username: 'admin',
        track_id: 'Chill Vibes/Song 1.mp3',
        name: 'Song 1',
        artist: 'Artist One',
        playlist: 'Chill Vibes',
        device_name: 'Desktop',
        browser: 'Chrome',
        os: 'Linux',
        timestamp: '2026-08-29 15:58:00',
        duration_sec: 180
      }
    ],
    total: 1,
    page: 1,
    limit: 25,
    total_pages: 1
  }

  beforeEach(() => {
    vi.restoreAllMocks()
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/api/admin/analytics')) {
        return Promise.resolve({ ok: true, json: async () => mockAnalyticsData })
      }
      if (url.includes('/api/admin/users') && !url.includes('/stats')) {
        return Promise.resolve({ ok: true, json: async () => mockUsersData })
      }
      if (url.includes('/api/admin/users') && url.includes('/stats')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            username: 'admin',
            role: 'admin',
            total_seconds: 3600,
            play_count: 12,
            favorite_track: 'Song 1',
            rules: { allowed_playlists: ['*'] },
            timeline: []
          })
        })
      }
      if (url.includes('/api/admin/logs')) {
        return Promise.resolve({ ok: true, json: async () => mockLogsData })
      }
      if (url.includes('/api/admin/lyrics/status')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            job: { state: 'idle' },
            resources: { host_cpu_percent: 12.5, cpu_count: 8, host_ram_used_mb: 4096, host_ram_total_mb: 16384, host_ram_percent: 25.0 },
            remote_whisper_url: 'http://192.168.1.50:8000',
            remote_settings: { cpu_threads: 4, max_ram_mb: 8192, total_cores: 16, total_ram_mb: 32768 }
          })
        })
      }
      if (url.includes('/api/admin/lyrics/remote-telemetry')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            online: true,
            latency_ms: 12,
            gpu_name: 'NVIDIA GeForce RTX 4080',
            has_cuda: true,
            total_vram_mb: 16384,
            used_vram_mb: 2048,
            gpu: { name: 'NVIDIA GeForce RTX 4080', total_vram_mb: 16384, used_vram_mb: 2048, gpu_util_pct: 24 },
            cpu: { percent: 18.5, cores: 16, model: 'AMD Ryzen 9 5950X' },
            ram: { total_mb: 32768, used_mb: 8192, percent: 25.0 },
            specs: { cpu_model: 'AMD Ryzen 9 5950X', total_cores: 16, total_ram_mb: 32768, gpu_name: 'NVIDIA GeForce RTX 4080' },
            throughput: { avg_sec_per_song: 3.2, songs_per_min: 18.7, total_processed: 50 },
            limits: { cpu_threads: 4, max_ram_mb: 8192, total_cores: 16, total_ram_mb: 32768 }
          })
        })
      }
      return Promise.resolve({ ok: true, json: async () => ({}) })
    })
  })


  it('renders AdminDashboard layout with KPI cards and peak hour metrics', async () => {
    const handleBack = vi.fn()
    const handleLogout = vi.fn()

    render(
      <AdminDashboard
        token="test-token"
        playlists={{ 'Chill Vibes': ['song1.mp3'] }}
        onLogout={handleLogout}
        theme="dark"
        onCycleTheme={vi.fn()}
        ThemeIcon={MockThemeIcon}
        onBackToPlayer={handleBack}
      />
    )

    expect(screen.getByText('Sangita Admin Console')).toBeInTheDocument()

    // Wait for analytics data to render
    await waitFor(() => {
      expect(screen.getByTestId('kpi-total-time')).toBeInTheDocument()
      expect(screen.getByTestId('kpi-total-plays')).toBeInTheDocument()
      expect(screen.getByTestId('kpi-peak-hour')).toBeInTheDocument()
      expect(screen.getAllByText('8:00 PM – 9:00 PM').length).toBeGreaterThanOrEqual(1)
    })

    // Click Back to Player button
    const backBtn = screen.getByTestId('admin-back-btn')
    fireEvent.click(backBtn)
    expect(handleBack).toHaveBeenCalledTimes(1)
  })

  it('switches between tabs: Music & Catalog, Live & Stream Logs, User Accounts, System Health', async () => {
    render(
      <AdminDashboard
        token="test-token"
        playlists={{ 'Chill Vibes': ['song1.mp3'] }}
        onLogout={vi.fn()}
        theme="dark"
        onCycleTheme={vi.fn()}
        ThemeIcon={MockThemeIcon}
        onBackToPlayer={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByTestId('analytics-tab-content')).toBeInTheDocument()
    })

    // Switch to Music & Catalog Tab
    fireEvent.click(screen.getByTestId('admin-tab-music'))
    await waitFor(() => {
      expect(screen.getByTestId('music-tab-content')).toBeInTheDocument()
      expect(screen.getByText('Top 20 Most Played Tracks')).toBeInTheDocument()
      expect(screen.getAllByText('Artist One').length).toBeGreaterThanOrEqual(1)
    })

    // Switch to Live & Stream Logs Tab
    fireEvent.click(screen.getByTestId('admin-tab-live'))
    await waitFor(() => {
      expect(screen.getByTestId('live-tab-content')).toBeInTheDocument()
      expect(screen.getByText('Real-Time Active Listeners')).toBeInTheDocument()
    })

    // Switch to User Accounts Tab
    fireEvent.click(screen.getByTestId('admin-tab-users'))
    await waitFor(() => {
      expect(screen.getByTestId('users-tab-content')).toBeInTheDocument()
      expect(screen.getByText('User Accounts Management')).toBeInTheDocument()
      expect(screen.getByTestId('user-card-admin')).toBeInTheDocument()
      expect(screen.getByTestId('user-card-friend')).toBeInTheDocument()
    })

    // Switch to System Health Tab
    fireEvent.click(screen.getByTestId('admin-tab-system'))
    await waitFor(() => {
      expect(screen.getByTestId('system-tab-content')).toBeInTheDocument()
      expect(screen.getByText('Audio Formats & Codecs Distribution')).toBeInTheDocument()
    })
  })

  it('allows adding a new user from the User Accounts tab', async () => {
    render(
      <AdminDashboard
        token="test-token"
        playlists={{ 'Chill Vibes': ['song1.mp3'] }}
        onLogout={vi.fn()}
        theme="dark"
        onCycleTheme={vi.fn()}
        ThemeIcon={MockThemeIcon}
        onBackToPlayer={vi.fn()}
      />
    )

    // Switch to Users tab
    fireEvent.click(screen.getByTestId('admin-tab-users'))
    await waitFor(() => {
      expect(screen.getByTestId('add-user-btn')).toBeInTheDocument()
    })

    // Click Add New User
    fireEvent.click(screen.getByTestId('add-user-btn'))
    expect(screen.getByTestId('user-modal')).toBeInTheDocument()

    // Fill Form
    fireEvent.change(screen.getByTestId('input-username'), { target: { value: 'newuser' } })
    fireEvent.change(screen.getByTestId('input-password'), { target: { value: 'pass123' } })

    // Save
    fireEvent.click(screen.getByTestId('btn-save-user'))
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/admin/users',
        expect.objectContaining({ method: 'POST' })
      )
    })
  })

  it('handles timeframe changes and metric toggles', async () => {
    render(
      <AdminDashboard
        token="test-token"
        playlists={{ 'Chill Vibes': ['song1.mp3'] }}
        onLogout={vi.fn()}
        theme="dark"
        onCycleTheme={vi.fn()}
        ThemeIcon={MockThemeIcon}
        onBackToPlayer={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByTestId('kpi-total-time')).toBeInTheDocument()
    })

    // Click 30 Days timeframe
    fireEvent.click(screen.getByTestId('timeframe-btn-30d'))
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('timeframe=30d'),
        expect.anything()
      )
    })

    // Toggle metric to Stream Plays
    fireEvent.click(screen.getByTestId('metric-btn-plays'))
    expect(screen.getByTestId('metric-btn-plays')).toHaveClass('active')
  })

  it('allows selecting timezone preference and persists to localStorage', async () => {
    render(
      <AdminDashboard
        token="test-token"
        playlists={{ 'Chill Vibes': ['song1.mp3'] }}
        onLogout={vi.fn()}
        theme="dark"
        onCycleTheme={vi.fn()}
        ThemeIcon={MockThemeIcon}
        onBackToPlayer={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByTestId('admin-tz-select')).toBeInTheDocument()
    })

    const tzSelect = screen.getByTestId('admin-tz-select')
    expect(tzSelect.value).toBe('Asia/Kolkata')

    // Change to UTC
    fireEvent.change(tzSelect, { target: { value: 'UTC' } })
    expect(tzSelect.value).toBe('UTC')
    expect(localStorage.getItem('sangita_timezone')).toBe('UTC')

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('tz=UTC'),
        expect.anything()
      )
    })
  })

  it('renders Lyrics Engine tab without crashing', async () => {
    render(
      <AdminDashboard
        token="test-token"
        playlists={{ 'Chill Vibes': ['song1.mp3'] }}
        onLogout={vi.fn()}
        theme="dark"
        onCycleTheme={vi.fn()}
        ThemeIcon={MockThemeIcon}
        onBackToPlayer={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByTestId('admin-tab-lyrics')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('admin-tab-lyrics'))

    await waitFor(() => {
      expect(screen.getByTestId('lyrics-engine-content')).toBeInTheDocument()
    })
  })

  it('renders Connected PC resource monitor cards and dynamically adapts hardware safeguards to detected specs', async () => {
    render(
      <AdminDashboard
        token="test-token"
        playlists={{ 'Chill Vibes': ['song1.mp3'] }}
        onLogout={vi.fn()}
        theme="dark"
        onCycleTheme={vi.fn()}
        ThemeIcon={MockThemeIcon}
        onBackToPlayer={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByTestId('admin-tab-lyrics')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('admin-tab-lyrics'))

    await waitFor(() => {
      expect(screen.getByTestId('lyrics-engine-content')).toBeInTheDocument()
    })

    // 1. Verify Connected PC Telemetry KPI cards (Below Host CPU, RAM, GPU, and Coverage)
    await waitFor(() => {
      expect(screen.getByTestId('connected-pc-cpu-card')).toBeInTheDocument()
      expect(screen.getByTestId('connected-pc-ram-card')).toBeInTheDocument()
      expect(screen.getByTestId('connected-pc-gpu-card')).toBeInTheDocument()
      expect(screen.getByTestId('connected-pc-eta-card')).toBeInTheDocument()
    })

    // Connected PC CPU Card displays CPU %, Cores & Model
    const cpuCard = screen.getByTestId('connected-pc-cpu-card')
    expect(cpuCard).toHaveTextContent('18.5%')
    expect(cpuCard).toHaveTextContent('AMD Ryzen 9 5950X')

    // Connected PC RAM Card displays used GB and total GB
    const ramCard = screen.getByTestId('connected-pc-ram-card')
    expect(ramCard).toHaveTextContent('8.00 GB')
    expect(ramCard).toHaveTextContent('32.0 GB Total')

    // Connected PC GPU Card displays GPU Model & VRAM
    const gpuCard = screen.getByTestId('connected-pc-gpu-card')
    expect(gpuCard).toHaveTextContent('NVIDIA GeForce RTX 4080')
    expect(gpuCard).toHaveTextContent('2048 / 16384 MB VRAM')

    // Connected PC ETA / Throughput card
    const etaCard = screen.getByTestId('connected-pc-eta-card')
    expect(etaCard).toHaveTextContent('3.2s / song')
    expect(etaCard).toHaveTextContent('18.7 songs/min')

    // 2. Verify Detected PC Specs Profile Banner
    const specsBanner = screen.getByTestId('detected-pc-specs-banner')
    expect(specsBanner).toHaveTextContent('AMD Ryzen 9 5950X')
    expect(specsBanner).toHaveTextContent('16 Logical Threads Available')
    expect(specsBanner).toHaveTextContent('32.0 GB Physical RAM')
    expect(specsBanner).toHaveTextContent('NVIDIA GeForce RTX 4080')

    // 3. Verify Dynamic Sliders Bounds adapted to detected 16 cores and 32GB RAM
    const threadsSlider = screen.getByTestId('remote-pc-threads-slider')
    const ramSlider = screen.getByTestId('remote-pc-ram-slider')
    expect(threadsSlider).toHaveAttribute('max', '16')
    expect(ramSlider).toHaveAttribute('max', '32768')

    // 4. Test Spec Presets: Quiet (25%) and Turbo (85%)
    const quietBtn = screen.getByText(/Quiet \(25% Specs\)/i)
    fireEvent.click(quietBtn)
    expect(threadsSlider).toHaveValue('4') // 25% of 16
    expect(ramSlider).toHaveValue('8192') // 25% of 32768

    const turboBtn = screen.getByText(/Turbo \(85% Specs\)/i)
    fireEvent.click(turboBtn)
    expect(threadsSlider).toHaveValue('14') // 85% of 16
    expect(ramSlider).toHaveValue('24576') // 75% of 32768
  })

  it('supports full keyboard arrow navigation across tabs with wrapping, Home and End keys', async () => {
    render(
      <AdminDashboard
        token="test-token"
        playlists={{ 'Chill Vibes': ['song1.mp3'] }}
        onLogout={vi.fn()}
        theme="dark"
        onCycleTheme={vi.fn()}
        ThemeIcon={MockThemeIcon}
        onBackToPlayer={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByTestId('admin-tab-analytics')).toBeInTheDocument()
    })

    const analyticsTab = screen.getByTestId('admin-tab-analytics')
    analyticsTab.focus()

    // 1. ArrowRight moves from analytics -> music
    fireEvent.keyDown(analyticsTab, { key: 'ArrowRight', code: 'ArrowRight' })
    await waitFor(() => {
      expect(screen.getByTestId('music-tab-content')).toBeInTheDocument()
      expect(screen.getByTestId('admin-tab-music')).toHaveAttribute('aria-selected', 'true')
    })

    // 2. ArrowRight moves from music -> live (Activity)
    const musicTab = screen.getByTestId('admin-tab-music')
    fireEvent.keyDown(musicTab, { key: 'ArrowRight', code: 'ArrowRight' })
    await waitFor(() => {
      expect(screen.getByTestId('live-tab-content')).toBeInTheDocument()
      expect(screen.getByTestId('admin-tab-live')).toHaveAttribute('aria-selected', 'true')
    })

    // 3. ArrowLeft moves from live back to music
    const liveTab = screen.getByTestId('admin-tab-live')
    fireEvent.keyDown(liveTab, { key: 'ArrowLeft', code: 'ArrowLeft' })
    await waitFor(() => {
      expect(screen.getByTestId('music-tab-content')).toBeInTheDocument()
      expect(screen.getByTestId('admin-tab-music')).toHaveAttribute('aria-selected', 'true')
    })

    // 4. End key jumps to system tab
    fireEvent.keyDown(musicTab, { key: 'End', code: 'End' })
    await waitFor(() => {
      expect(screen.getByTestId('system-tab-content')).toBeInTheDocument()
      expect(screen.getByTestId('admin-tab-system')).toHaveAttribute('aria-selected', 'true')
    })

    // 5. Home key jumps to analytics tab
    const systemTab = screen.getByTestId('admin-tab-system')
    fireEvent.keyDown(systemTab, { key: 'Home', code: 'Home' })
    await waitFor(() => {
      expect(screen.getByTestId('analytics-tab-content')).toBeInTheDocument()
      expect(screen.getByTestId('admin-tab-analytics')).toHaveAttribute('aria-selected', 'true')
    })
  })

  it('renders proper ARIA semantics for tablist and individual tabs', async () => {
    render(
      <AdminDashboard
        token="test-token"
        playlists={{ 'Chill Vibes': ['song1.mp3'] }}
        onLogout={vi.fn()}
        theme="dark"
        onCycleTheme={vi.fn()}
        ThemeIcon={MockThemeIcon}
        onBackToPlayer={vi.fn()}
      />
    )

    const tablist = screen.getByRole('tablist', { name: /admin sections/i })
    expect(tablist).toBeInTheDocument()

    const tabs = screen.getAllByRole('tab')
    expect(tabs.length).toBe(7)

    // Analytics tab is selected by default
    const analyticsTab = screen.getByTestId('admin-tab-analytics')
    expect(analyticsTab).toHaveAttribute('aria-selected', 'true')
    expect(analyticsTab).toHaveAttribute('tabIndex', '0')

    // Music tab is unselected
    const musicTab = screen.getByTestId('admin-tab-music')
    expect(musicTab).toHaveAttribute('aria-selected', 'false')
    expect(musicTab).toHaveAttribute('tabIndex', '-1')

    // Switch to Users tab
    fireEvent.click(screen.getByTestId('admin-tab-users'))
    await waitFor(() => {
      expect(screen.getByTestId('admin-tab-users')).toHaveAttribute('aria-selected', 'true')
      expect(screen.getByTestId('admin-tab-analytics')).toHaveAttribute('aria-selected', 'false')
    })
  })

  it('renders and allows toggling expandable disclosure sections in Overview and Lyrics tabs', async () => {
    render(
      <AdminDashboard
        token="test-token"
        playlists={{ 'Chill Vibes': ['song1.mp3'] }}
        onLogout={vi.fn()}
        theme="dark"
        onCycleTheme={vi.fn()}
        ThemeIcon={MockThemeIcon}
        onBackToPlayer={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByTestId('disclosure-diurnal')).toBeInTheDocument()
      expect(screen.getByTestId('disclosure-platforms')).toBeInTheDocument()
    })

    // Click diurnal disclosure summary to toggle
    const diurnalSummary = screen.getByTestId('disclosure-diurnal')
    fireEvent.click(diurnalSummary)
    expect(diurnalSummary).toBeInTheDocument()

    // Switch to Lyrics tab and verify lyrics disclosures
    fireEvent.click(screen.getByTestId('admin-tab-lyrics'))
    await waitFor(() => {
      expect(screen.getByTestId('disclosure-lyrics-telemetry')).toBeInTheDocument()
      expect(screen.getByTestId('disclosure-lyrics-config')).toBeInTheDocument()
      expect(screen.getByTestId('disclosure-lyrics-logs')).toBeInTheDocument()
    })

    // Click config disclosure summary
    const configSummary = screen.getByTestId('disclosure-lyrics-config')
    fireEvent.click(configSummary)
    expect(configSummary).toBeInTheDocument()
  })

  it('renders timezone selector inside filters toolbar with proper aria and persistence', async () => {
    render(
      <AdminDashboard
        token="test-token"
        playlists={{ 'Chill Vibes': ['song1.mp3'] }}
        onLogout={vi.fn()}
        theme="dark"
        onCycleTheme={vi.fn()}
        ThemeIcon={MockThemeIcon}
        onBackToPlayer={vi.fn()}
      />
    )

    // Verify timezone selector exists within the toolbar
    const toolbar = screen.getByRole('toolbar', { name: /analytics filters toolbar/i })
    expect(toolbar).toBeInTheDocument()

    const tzSelect = screen.getByTestId('admin-tz-select')
    expect(toolbar).toContainElement(tzSelect)

    // Test selection and persistence
    fireEvent.change(tzSelect, { target: { value: 'America/New_York' } })
    expect(tzSelect.value).toBe('America/New_York')
    expect(localStorage.getItem('sangita_timezone')).toBe('America/New_York')

    await waitFor(() => {
      expect(screen.queryByTestId('analytics-loading')).not.toBeInTheDocument()
    })
  })

  it('renders distinct loading state and avoids showing zero KPI cards while analytics are loading', async () => {
    // Analytics request remains pending
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/api/admin/analytics')) {
        return new Promise(() => {}) // pending
      }
      if (url.includes('/api/admin/users')) {
        return Promise.resolve({ ok: true, json: async () => mockUsersData })
      }
      return Promise.resolve({ ok: true, json: async () => ({}) })
    })

    render(
      <AdminDashboard
        token="test-token"
        playlists={{ 'Chill Vibes': ['song1.mp3'] }}
        onLogout={vi.fn()}
        theme="dark"
        onCycleTheme={vi.fn()}
        ThemeIcon={MockThemeIcon}
        onBackToPlayer={vi.fn()}
      />
    )

    // Verify loading indicator is present
    expect(screen.getByTestId('analytics-loading')).toBeInTheDocument()
    expect(screen.getByText(/loading analytics metrics/i)).toBeInTheDocument()

    // Ensure zero-value KPI cards are NOT displayed while loading
    expect(screen.queryByTestId('kpi-total-time')).not.toBeInTheDocument()
    expect(screen.queryByTestId('kpi-total-plays')).not.toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByTestId('analytics-loading')).toBeInTheDocument()
    })
  })

  it('renders distinct failure state with specific retry when analytics request fails', async () => {
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/api/admin/analytics')) {
        return Promise.reject(new Error('Backend connection failed'))
      }
      if (url.includes('/api/admin/users')) {
        return Promise.resolve({ ok: true, json: async () => mockUsersData })
      }
      return Promise.resolve({ ok: true, json: async () => ({}) })
    })

    render(
      <AdminDashboard
        token="test-token"
        playlists={{ 'Chill Vibes': ['song1.mp3'] }}
        onLogout={vi.fn()}
        theme="dark"
        onCycleTheme={vi.fn()}
        ThemeIcon={MockThemeIcon}
        onBackToPlayer={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByTestId('analytics-error')).toBeInTheDocument()
      expect(screen.getByText('Failed to Load Analytics')).toBeInTheDocument()
      expect(screen.getAllByText('Backend connection failed').length).toBeGreaterThanOrEqual(1)
    })

    // Verify retry button specifically calls fetchAnalytics again
    const retryBtn = screen.getByRole('button', { name: /retry analytics/i })
    expect(retryBtn).toBeInTheDocument()

    // Mock successful retry
    global.fetch.mockImplementation((url) => {
      if (url.includes('/api/admin/analytics')) {
        return Promise.resolve({ ok: true, json: async () => mockAnalyticsData })
      }
      return Promise.resolve({ ok: true, json: async () => ({}) })
    })

    fireEvent.click(retryBtn)
    await waitFor(() => {
      expect(screen.getByTestId('kpi-total-time')).toBeInTheDocument()
      expect(screen.queryByTestId('analytics-error')).not.toBeInTheDocument()
    })
  })

  it('keeps lyrics generation scope controls visible while disclosures start collapsed', async () => {
    render(
      <AdminDashboard
        token="test-token"
        playlists={{ 'Chill Vibes': ['song1.mp3'] }}
        onLogout={vi.fn()}
        theme="dark"
        onCycleTheme={vi.fn()}
        ThemeIcon={MockThemeIcon}
        onBackToPlayer={vi.fn()}
      />
    )

    fireEvent.click(screen.getByTestId('admin-tab-lyrics'))

    await waitFor(() => {
      expect(screen.getByTestId('lyrics-engine-content')).toBeInTheDocument()
    })

    // Scope controls are prominently visible outside any disclosure
    expect(screen.getByTestId('lyrics-api-toggle-button')).toBeInTheDocument()
    expect(screen.getByText('Entire Library')).toBeInTheDocument()
    expect(screen.getByText('Select Playlist')).toBeInTheDocument()
    expect(screen.getByText('Single Song')).toBeInTheDocument()

    // Disclosures start collapsed (not open)
    const telemetryDisclosure = screen.getByTestId('disclosure-lyrics-telemetry').closest('details')
    const configDisclosure = screen.getByTestId('disclosure-lyrics-config').closest('details')
    const logsDisclosure = screen.getByTestId('disclosure-lyrics-logs').closest('details')

    expect(telemetryDisclosure).not.toHaveAttribute('open')
    expect(configDisclosure).not.toHaveAttribute('open')
    expect(logsDisclosure).not.toHaveAttribute('open')
  })

  it('keeps users tab selected and reachable in keyboard tab order when viewing user details', async () => {
    render(
      <AdminDashboard
        token="test-token"
        playlists={{ 'Chill Vibes': ['song1.mp3'] }}
        onLogout={vi.fn()}
        theme="dark"
        onCycleTheme={vi.fn()}
        ThemeIcon={MockThemeIcon}
        onBackToPlayer={vi.fn()}
      />
    )

    // Switch to Users tab
    fireEvent.click(screen.getByTestId('admin-tab-users'))
    await waitFor(() => {
      expect(screen.getByTestId('user-card-admin')).toBeInTheDocument()
    })

    // Click admin user card to open user details subview
    fireEvent.click(screen.getByTestId('user-card-admin'))
    await waitFor(() => {
      expect(screen.getByTestId('user-detail-back-btn')).toBeInTheDocument()
    })

    // Users tab MUST retain aria-selected="true" and tabIndex="0"
    const usersTab = screen.getByTestId('admin-tab-users')
    expect(usersTab).toHaveAttribute('aria-selected', 'true')
    expect(usersTab).toHaveAttribute('tabIndex', '0')
    expect(usersTab).toHaveClass('active')

    // Click back to user list
    fireEvent.click(screen.getByTestId('user-detail-back-btn'))
    await waitFor(() => {
      expect(screen.getByTestId('user-card-admin')).toBeInTheDocument()
    })
    expect(usersTab).toHaveAttribute('aria-selected', 'true')
    expect(usersTab).toHaveAttribute('tabIndex', '0')
  })

  it('changing timeframe filter clears old numbers and immediately shows loading state, preventing stale numbers from displaying under a new timeframe', async () => {
    let resolveAnalyticsPromise
    const originalAnalyticsData = { ...mockAnalyticsData, kpis: { ...mockAnalyticsData.kpis, total_seconds: 36000, total_plays: 120 } }
    const updatedAnalyticsData = { ...mockAnalyticsData, timeframe: '30d', kpis: { ...mockAnalyticsData.kpis, total_seconds: 72000, total_plays: 450 } }

    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/api/admin/analytics')) {
        if (url.includes('timeframe=30d')) {
          return new Promise((resolve) => {
            resolveAnalyticsPromise = () => resolve({ ok: true, json: async () => updatedAnalyticsData })
          })
        }
        return Promise.resolve({ ok: true, json: async () => originalAnalyticsData })
      }
      if (url.includes('/api/admin/users')) {
        return Promise.resolve({ ok: true, json: async () => mockUsersData })
      }
      return Promise.resolve({ ok: true, json: async () => ({}) })
    })

    render(
      <AdminDashboard
        token="test-token"
        playlists={{ 'Chill Vibes': ['song1.mp3'] }}
        onLogout={vi.fn()}
        theme="dark"
        onCycleTheme={vi.fn()}
        ThemeIcon={MockThemeIcon}
        onBackToPlayer={vi.fn()}
      />
    )

    // Wait for initial analytics to load
    await waitFor(() => {
      expect(screen.getByTestId('kpi-total-time')).toHaveTextContent('10h 0m')
      expect(screen.getByTestId('kpi-total-plays')).toHaveTextContent('120')
    })

    // Click on 30d timeframe
    fireEvent.click(screen.getByTestId('timeframe-btn-30d'))

    // Immediately shows loading state and clears old stale KPI numbers
    expect(screen.getByTestId('analytics-loading')).toBeInTheDocument()
    expect(screen.getByText(/loading analytics metrics/i)).toBeInTheDocument()
    expect(screen.queryByTestId('kpi-total-time')).not.toBeInTheDocument()
    expect(screen.queryByTestId('kpi-total-plays')).not.toBeInTheDocument()

    // Resolve the promise for 30d
    resolveAnalyticsPromise()

    // Now updated data renders
    await waitFor(() => {
      expect(screen.getByTestId('kpi-total-time')).toHaveTextContent('20h 0m')
      expect(screen.getByTestId('kpi-total-plays')).toHaveTextContent('450')
      expect(screen.queryByTestId('analytics-loading')).not.toBeInTheDocument()
    })
  })

  it('renders distinct loading state in Users tab while usersLoading is true', async () => {
    let resolveUsersPromise
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/api/admin/analytics')) {
        return Promise.resolve({ ok: true, json: async () => mockAnalyticsData })
      }
      if (url.includes('/api/admin/users') && !url.includes('/stats')) {
        return new Promise((resolve) => {
          resolveUsersPromise = () => resolve({ ok: true, json: async () => mockUsersData })
        })
      }
      return Promise.resolve({ ok: true, json: async () => ({}) })
    })

    render(
      <AdminDashboard
        token="test-token"
        playlists={{ 'Chill Vibes': ['song1.mp3'] }}
        onLogout={vi.fn()}
        theme="dark"
        onCycleTheme={vi.fn()}
        ThemeIcon={MockThemeIcon}
        onBackToPlayer={vi.fn()}
      />
    )

    // Switch to Users tab while user fetch is still pending
    fireEvent.click(screen.getByTestId('admin-tab-users'))

    // Verify distinct users loading state
    expect(screen.getByTestId('users-loading')).toBeInTheDocument()
    expect(screen.getByText(/loading user accounts\.\.\./i)).toBeInTheDocument()
    expect(screen.queryByTestId('user-card-admin')).not.toBeInTheDocument()

    // Resolve users fetch
    resolveUsersPromise()

    // Users should now appear
    await waitFor(() => {
      expect(screen.getByTestId('user-card-admin')).toBeInTheDocument()
      expect(screen.queryByTestId('users-loading')).not.toBeInTheDocument()
    })
  })

  it('renders distinct loading state for activity logs while logsLoading is true and live sessions while analytics is pending', async () => {
    let resolveLogsPromise
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/api/admin/analytics')) {
        return new Promise(() => {}) // pending analytics
      }
      if (url.includes('/api/admin/logs')) {
        return new Promise((resolve) => {
          resolveLogsPromise = () => resolve({ ok: true, json: async () => mockLogsData })
        })
      }
      if (url.includes('/api/admin/users')) {
        return Promise.resolve({ ok: true, json: async () => mockUsersData })
      }
      return Promise.resolve({ ok: true, json: async () => ({}) })
    })

    render(
      <AdminDashboard
        token="test-token"
        playlists={{ 'Chill Vibes': ['song1.mp3'] }}
        onLogout={vi.fn()}
        theme="dark"
        onCycleTheme={vi.fn()}
        ThemeIcon={MockThemeIcon}
        onBackToPlayer={vi.fn()}
      />
    )

    // Switch to Activity (Live) tab
    fireEvent.click(screen.getByTestId('admin-tab-live'))

    // Verify live sessions loading state (analytics pending)
    expect(screen.getByTestId('live-sessions-loading')).toBeInTheDocument()
    expect(screen.getByText(/checking active streams\.\.\./i)).toBeInTheDocument()

    // Verify logs loading state
    expect(screen.getByTestId('logs-loading')).toBeInTheDocument()
    expect(screen.getByText(/loading stream audit logs\.\.\./i)).toBeInTheDocument()

    // Resolve logs fetch
    resolveLogsPromise()

    // Logs table should now appear
    await waitFor(() => {
      expect(screen.queryByTestId('logs-loading')).not.toBeInTheDocument()
      expect(screen.getByText(/playback stream audit log/i)).toBeInTheDocument()
    })
  })

  it('renders distinct loading state in Music tab while analyticsLoading is true', async () => {
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/api/admin/analytics')) {
        return new Promise(() => {}) // pending
      }
      if (url.includes('/api/admin/users')) {
        return Promise.resolve({ ok: true, json: async () => mockUsersData })
      }
      return Promise.resolve({ ok: true, json: async () => ({}) })
    })

    render(
      <AdminDashboard
        token="test-token"
        playlists={{ 'Chill Vibes': ['song1.mp3'] }}
        onLogout={vi.fn()}
        theme="dark"
        onCycleTheme={vi.fn()}
        ThemeIcon={MockThemeIcon}
        onBackToPlayer={vi.fn()}
      />
    )

    fireEvent.click(screen.getByTestId('admin-tab-music'))

    expect(screen.getByTestId('music-analytics-loading')).toBeInTheDocument()
    expect(screen.getByText(/loading catalog metrics\.\.\./i)).toBeInTheDocument()

    // Await async handlers settling
    await waitFor(() => {
      expect(screen.getByTestId('admin-tab-music')).toHaveAttribute('aria-selected', 'true')
    })
  })

  it('renders distinct failure state in Music tab when analytics request fails', async () => {
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/api/admin/analytics')) {
        return Promise.reject(new Error('Music catalog fetch failed'))
      }
      if (url.includes('/api/admin/users')) {
        return Promise.resolve({ ok: true, json: async () => mockUsersData })
      }
      return Promise.resolve({ ok: true, json: async () => ({}) })
    })

    render(
      <AdminDashboard
        token="test-token"
        playlists={{ 'Chill Vibes': ['song1.mp3'] }}
        onLogout={vi.fn()}
        theme="dark"
        onCycleTheme={vi.fn()}
        ThemeIcon={MockThemeIcon}
        onBackToPlayer={vi.fn()}
      />
    )

    fireEvent.click(screen.getByTestId('admin-tab-music'))

    await waitFor(() => {
      expect(screen.getByTestId('music-analytics-error')).toBeInTheDocument()
      expect(screen.getByText('Failed to Load Music Analytics')).toBeInTheDocument()
      expect(screen.getAllByText('Music catalog fetch failed').length).toBeGreaterThanOrEqual(1)
    })
  })

  it('discards out-of-order responses so older delayed requests cannot overwrite newer filter results', async () => {
    let resolve30dPromise
    let resolve7dPromise

    const data7d = {
      ...mockAnalyticsData,
      timeframe: '7d',
      kpis: { ...mockAnalyticsData.kpis, total_plays: 120, total_hours: 10.0 }
    }
    const data30d = {
      ...mockAnalyticsData,
      timeframe: '30d',
      kpis: { ...mockAnalyticsData.kpis, total_plays: 450, total_hours: 20.0 }
    }

    let initial7dResolved = false

    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/api/admin/analytics')) {
        if (url.includes('timeframe=30d')) {
          // Request 1 (for 30d, delayed)
          return new Promise((resolve) => {
            resolve30dPromise = () => resolve({ ok: true, json: async () => data30d })
          })
        }
        if (url.includes('timeframe=7d')) {
          if (!initial7dResolved) {
            initial7dResolved = true
            return Promise.resolve({ ok: true, json: async () => data7d })
          }
          // Request 2 (for 7d, resolves first)
          return new Promise((resolve) => {
            resolve7dPromise = () => resolve({ ok: true, json: async () => data7d })
          })
        }
        return Promise.resolve({ ok: true, json: async () => data7d })
      }
      if (url.includes('/api/admin/users')) {
        return Promise.resolve({ ok: true, json: async () => mockUsersData })
      }
      return Promise.resolve({ ok: true, json: async () => ({}) })
    })

    render(
      <AdminDashboard
        token="test-token"
        playlists={{ 'Chill Vibes': ['song1.mp3'] }}
        onLogout={vi.fn()}
        theme="dark"
        onCycleTheme={vi.fn()}
        ThemeIcon={MockThemeIcon}
        onBackToPlayer={vi.fn()}
      />
    )

    // Wait for initial 7d analytics to load
    await waitFor(() => {
      expect(screen.getByTestId('kpi-total-plays')).toHaveTextContent('120')
      expect(screen.getByTestId('kpi-total-time')).toHaveTextContent('10h 0m')
    })

    // User switches to 30d: Request 1 starts (delayed)
    fireEvent.click(screen.getByTestId('timeframe-btn-30d'))
    expect(screen.getByTestId('analytics-loading')).toBeInTheDocument()

    // User rapidly switches back to 7d: Request 2 starts
    fireEvent.click(screen.getByTestId('timeframe-btn-7d'))
    expect(screen.getByTestId('analytics-loading')).toBeInTheDocument()

    // Request 2 (7d) resolves FIRST with 7d data
    await act(async () => {
      resolve7dPromise()
    })

    // Assert that Request 2 (7d) data is displayed
    await waitFor(() => {
      expect(screen.getByTestId('kpi-total-plays')).toHaveTextContent('120')
      expect(screen.getByTestId('kpi-total-time')).toHaveTextContent('10h 0m')
      expect(screen.queryByTestId('analytics-loading')).not.toBeInTheDocument()
    })

    // Request 1 (30d) resolves LATER with 30d data
    await act(async () => {
      resolve30dPromise()
    })

    // Wait to allow any potential state updates to settle
    await new Promise((r) => setTimeout(r, 50))

    // Assert that 7d data is STILL displayed and 30d data did NOT overwrite it
    expect(screen.getByTestId('kpi-total-plays')).toHaveTextContent('120')
    expect(screen.getByTestId('kpi-total-time')).toHaveTextContent('10h 0m')
    expect(screen.queryByText('450')).not.toBeInTheDocument()
    expect(screen.queryByText('20h 0m')).not.toBeInTheDocument()
    expect(screen.queryByTestId('analytics-loading')).not.toBeInTheDocument()
  })

  it('discards slower failure from an older request after a newer request succeeds', async () => {
    let reject30dPromise
    let resolve7dPromise

    const data7d = {
      ...mockAnalyticsData,
      timeframe: '7d',
      kpis: { ...mockAnalyticsData.kpis, total_plays: 120, total_hours: 10.0 }
    }

    let initial7dResolved = false

    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/api/admin/analytics')) {
        if (url.includes('timeframe=30d')) {
          // Request 1 (slow, fails)
          return new Promise((_, reject) => {
            reject30dPromise = (err) => reject(err || new Error('Network timeout on 30d'))
          })
        }
        if (url.includes('timeframe=7d')) {
          if (!initial7dResolved) {
            initial7dResolved = true
            return Promise.resolve({ ok: true, json: async () => data7d })
          }
          // Request 2 (fast, succeeds)
          return new Promise((resolve) => {
            resolve7dPromise = () => resolve({ ok: true, json: async () => data7d })
          })
        }
        return Promise.resolve({ ok: true, json: async () => data7d })
      }
      if (url.includes('/api/admin/users')) {
        return Promise.resolve({ ok: true, json: async () => mockUsersData })
      }
      return Promise.resolve({ ok: true, json: async () => ({}) })
    })

    render(
      <AdminDashboard
        token="test-token"
        playlists={{ 'Chill Vibes': ['song1.mp3'] }}
        onLogout={vi.fn()}
        theme="dark"
        onCycleTheme={vi.fn()}
        ThemeIcon={MockThemeIcon}
        onBackToPlayer={vi.fn()}
      />
    )

    // Wait for initial 7d analytics to load
    await waitFor(() => {
      expect(screen.getByTestId('kpi-total-plays')).toHaveTextContent('120')
    })

    // User switches to 30d: Request 1 starts (slow)
    fireEvent.click(screen.getByTestId('timeframe-btn-30d'))
    expect(screen.getByTestId('analytics-loading')).toBeInTheDocument()

    // User switches back to 7d: Request 2 starts (fast)
    fireEvent.click(screen.getByTestId('timeframe-btn-7d'))
    expect(screen.getByTestId('analytics-loading')).toBeInTheDocument()

    // Request 2 (fast) succeeds first
    await act(async () => {
      resolve7dPromise()
    })

    await waitFor(() => {
      expect(screen.getByTestId('kpi-total-plays')).toHaveTextContent('120')
      expect(screen.queryByTestId('analytics-loading')).not.toBeInTheDocument()
    })

    // Request 1 (slow) fails later
    await act(async () => {
      reject30dPromise(new Error('Network timeout on 30d'))
    })

    // Wait to allow any potential state updates to settle
    await new Promise((r) => setTimeout(r, 50))

    // Assert that successful 7d data is STILL displayed and error did NOT overwrite it
    expect(screen.getByTestId('kpi-total-plays')).toHaveTextContent('120')
    expect(screen.queryByTestId('analytics-error')).not.toBeInTheDocument()
    expect(screen.queryByText(/Network timeout on 30d/i)).not.toBeInTheDocument()
    expect(screen.queryByTestId('analytics-loading')).not.toBeInTheDocument()
  })

  it('keeps analytics available when users fail and clears the user error after retry', async () => {
    let usersFail = true
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/api/admin/users')) {
        return usersFail
          ? Promise.reject(new Error('Database error loading users'))
          : Promise.resolve({ ok: true, json: async () => mockUsersData })
      }
      if (url.includes('/api/admin/analytics')) {
        return Promise.resolve({ ok: true, json: async () => mockAnalyticsData })
      }
      return Promise.resolve({ ok: true, json: async () => ({}) })
    })

    render(<AdminDashboard token="test-token" playlists={{}} onLogout={vi.fn()} theme="dark"
      onCycleTheme={vi.fn()} ThemeIcon={MockThemeIcon} onBackToPlayer={vi.fn()} />)

    await waitFor(() => expect(screen.getByTestId('kpi-total-plays')).toHaveTextContent('120'))
    expect(screen.queryByTestId('analytics-error')).not.toBeInTheDocument()
    fireEvent.click(screen.getByTestId('admin-tab-users'))
    await screen.findByTestId('users-error')
    usersFail = false
    fireEvent.click(screen.getByRole('button', { name: /retry loading users/i }))
    await waitFor(() => expect(screen.queryByTestId('users-error')).not.toBeInTheDocument())
    expect(screen.queryByText('Database error loading users')).not.toBeInTheDocument()
    fireEvent.click(screen.getByTestId('admin-tab-analytics'))
    expect(screen.getByTestId('kpi-total-plays')).toHaveTextContent('120')
  })

  it('renders distinct error state when users fetch fails and hides empty results message', async () => {
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/api/admin/users')) {
        return Promise.reject(new Error('Database error loading users'))
      }
      if (url.includes('/api/admin/analytics')) {
        return Promise.resolve({ ok: true, json: async () => mockAnalyticsData })
      }
      return Promise.resolve({ ok: true, json: async () => ({}) })
    })

    render(
      <AdminDashboard
        token="test-token"
        playlists={{ 'Chill Vibes': ['song1.mp3'] }}
        onLogout={vi.fn()}
        theme="dark"
        onCycleTheme={vi.fn()}
        ThemeIcon={MockThemeIcon}
        onBackToPlayer={vi.fn()}
      />
    )

    fireEvent.click(screen.getByTestId('admin-tab-users'))

    await waitFor(() => {
      expect(screen.getByTestId('users-error')).toBeInTheDocument()
      expect(screen.getByText('Failed to Load Users')).toBeInTheDocument()
      expect(screen.getAllByText('Database error loading users').length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText(/retry loading users/i)).toBeInTheDocument()
    })

    // Crucial requirement: empty-results message is NOT displayed
    expect(screen.queryByText('No users match filters.')).not.toBeInTheDocument()
  })

  it('renders distinct error state when audit logs fetch fails and hides empty results message', async () => {
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/api/admin/logs')) {
        return Promise.reject(new Error('Database timeout loading audit logs'))
      }
      if (url.includes('/api/admin/users')) {
        return Promise.resolve({ ok: true, json: async () => mockUsersData })
      }
      if (url.includes('/api/admin/analytics')) {
        return Promise.resolve({ ok: true, json: async () => mockAnalyticsData })
      }
      return Promise.resolve({ ok: true, json: async () => ({}) })
    })

    render(
      <AdminDashboard
        token="test-token"
        playlists={{ 'Chill Vibes': ['song1.mp3'] }}
        onLogout={vi.fn()}
        theme="dark"
        onCycleTheme={vi.fn()}
        ThemeIcon={MockThemeIcon}
        onBackToPlayer={vi.fn()}
      />
    )

    fireEvent.click(screen.getByTestId('admin-tab-live'))

    await waitFor(() => {
      expect(screen.getByTestId('logs-error')).toBeInTheDocument()
      expect(screen.getByText('Failed to Load Audit Logs')).toBeInTheDocument()
      expect(screen.getAllByText('Database timeout loading audit logs').length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText(/retry loading logs/i)).toBeInTheDocument()
    })

    // Crucial requirement: empty-results message is NOT displayed
    expect(screen.queryByText('No log events match query.')).not.toBeInTheDocument()
  })

  it('renders distinct error state when live sessions fetch fails and hides empty sessions message', async () => {
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/api/admin/analytics')) {
        return Promise.reject(new Error('Failed to load active streams'))
      }
      if (url.includes('/api/admin/users')) {
        return Promise.resolve({ ok: true, json: async () => mockUsersData })
      }
      if (url.includes('/api/admin/logs')) {
        return Promise.resolve({ ok: true, json: async () => mockLogsData })
      }
      return Promise.resolve({ ok: true, json: async () => ({}) })
    })

    render(
      <AdminDashboard
        token="test-token"
        playlists={{ 'Chill Vibes': ['song1.mp3'] }}
        onLogout={vi.fn()}
        theme="dark"
        onCycleTheme={vi.fn()}
        ThemeIcon={MockThemeIcon}
        onBackToPlayer={vi.fn()}
      />
    )

    fireEvent.click(screen.getByTestId('admin-tab-live'))

    await waitFor(() => {
      expect(screen.getByTestId('live-sessions-error')).toBeInTheDocument()
      expect(screen.getByText('Failed to Load Live Sessions')).toBeInTheDocument()
      expect(screen.getAllByText('Failed to load active streams').length).toBeGreaterThanOrEqual(1)
    })

    // Crucial requirement: empty sessions message is NOT displayed
    expect(screen.queryByText('No users currently streaming audio.')).not.toBeInTheDocument()
  })

  it('renders Playlists table in Music & Catalog tab with owner and visibility, toggling visibility via PUT /api/v2/admin/playlists/:id/visibility', async () => {
    const mockPlaylists = [
      { id: 201, title: 'Summer Party', owner: 'dj_dave', visibility: 'public', track_count: 15 },
      { id: 202, title: 'Secret Lounge', owner: 'secret_agent', visibility: 'private', track_count: 8 }
    ]

    global.fetch = vi.fn().mockImplementation((url, opts) => {
      if (url.includes('/api/admin/library/playlists') && (!opts || opts.method === 'GET' || !opts.method)) {
        return Promise.resolve({ ok: true, json: async () => mockPlaylists })
      }
      if (url.includes('/api/v2/admin/playlists/201/visibility') && opts?.method === 'PUT') {
        return Promise.resolve({ ok: true, json: async () => ({ status: 'success', visibility: 'private' }) })
      }
      if (url.includes('/api/admin/analytics')) {
        return Promise.resolve({ ok: true, json: async () => mockAnalyticsData })
      }
      if (url.includes('/api/admin/users')) {
        return Promise.resolve({ ok: true, json: async () => mockUsersData })
      }
      return Promise.resolve({ ok: true, json: async () => ({}) })
    })

    render(
      <AdminDashboard
        token="test-token"
        playlists={{ 'Chill Vibes': ['song1.mp3'] }}
        onLogout={vi.fn()}
        theme="dark"
        onCycleTheme={vi.fn()}
        ThemeIcon={MockThemeIcon}
        onBackToPlayer={vi.fn()}
      />
    )

    fireEvent.click(screen.getByTestId('admin-tab-music'))

    await waitFor(() => {
      expect(screen.getByTestId('playlist-row-201')).toBeInTheDocument()
      expect(screen.getByTestId('playlist-row-202')).toBeInTheDocument()
    })

    expect(screen.getByTestId('playlist-owner-201')).toHaveTextContent('dj_dave')
    expect(screen.getByTestId('playlist-visibility-201')).toHaveTextContent('public')
    expect(screen.getByTestId('playlist-owner-202')).toHaveTextContent('secret_agent')
    expect(screen.getByTestId('playlist-visibility-202')).toHaveTextContent('private')

    // Click toggle visibility button on 201
    const toggleBtn = screen.getByTestId('btn-toggle-visibility-201')
    expect(toggleBtn).toHaveTextContent('Make Private')
    fireEvent.click(toggleBtn)

    await waitFor(() => {
      expect(screen.getByTestId('playlist-visibility-201')).toHaveTextContent('private')
    })
  })

  it('manages playlist access grants in Music tab: opens modal, lists granted users, grants access, and revokes access', async () => {
    const mockPlaylists = [
      { id: 301, title: 'VIP Playlist', owner: 'vip_owner', visibility: 'private', track_count: 10 }
    ]

    global.fetch = vi.fn().mockImplementation((url, opts) => {
      if (url.includes('/api/admin/library/playlists')) {
        return Promise.resolve({ ok: true, json: async () => mockPlaylists })
      }
      if (url.includes('/api/v2/admin/playlists/301/access')) {
        if (!opts || opts.method === 'GET' || !opts.method) {
          return Promise.resolve({ ok: true, json: async () => ({ users: ['alice', 'bob'] }) })
        }
        if (opts.method === 'POST') {
          const body = JSON.parse(opts.body)
          if (body.grant_user) {
            return Promise.resolve({ ok: true, json: async () => ({ status: 'granted', user: body.grant_user }) })
          }
          if (body.revoke_user) {
            return Promise.resolve({ ok: true, json: async () => ({ status: 'revoked', user: body.revoke_user }) })
          }
        }
      }
      if (url.includes('/api/admin/analytics')) {
        return Promise.resolve({ ok: true, json: async () => mockAnalyticsData })
      }
      if (url.includes('/api/admin/users')) {
        return Promise.resolve({ ok: true, json: async () => mockUsersData })
      }
      return Promise.resolve({ ok: true, json: async () => ({}) })
    })

    render(
      <AdminDashboard
        token="test-token"
        playlists={{ 'Chill Vibes': ['song1.mp3'] }}
        onLogout={vi.fn()}
        theme="dark"
        onCycleTheme={vi.fn()}
        ThemeIcon={MockThemeIcon}
        onBackToPlayer={vi.fn()}
      />
    )

    fireEvent.click(screen.getByTestId('admin-tab-music'))

    await waitFor(() => {
      expect(screen.getByTestId('btn-manage-access-301')).toBeInTheDocument()
    })

    // Open access modal
    fireEvent.click(screen.getByTestId('btn-manage-access-301'))

    await waitFor(() => {
      expect(screen.getByTestId('playlist-access-modal')).toBeInTheDocument()
      expect(screen.getByTestId('access-user-row-alice')).toBeInTheDocument()
      expect(screen.getByTestId('access-user-row-bob')).toBeInTheDocument()
    })

    // Grant access to charlie
    const input = screen.getByTestId('input-grant-user')
    fireEvent.change(input, { target: { value: 'charlie' } })
    const grantBtn = screen.getByTestId('btn-grant-access')
    fireEvent.click(grantBtn)

    await waitFor(() => {
      expect(screen.getByTestId('access-user-row-charlie')).toBeInTheDocument()
    })

    // Revoke access from alice
    const revokeBtn = screen.getByTestId('btn-revoke-alice')
    fireEvent.click(revokeBtn)

    await waitFor(() => {
      expect(screen.queryByTestId('access-user-row-alice')).not.toBeInTheDocument()
    })
  })
})


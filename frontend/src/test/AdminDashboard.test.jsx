import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
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
      if (url.includes('/api/admin/logs')) {
        return Promise.resolve({ ok: true, json: async () => mockLogsData })
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
})

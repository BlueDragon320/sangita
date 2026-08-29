import { useState, useEffect } from 'react'

function strHue(str) {
  let h = 0; for (const c of str) h = (h*31+c.charCodeAt(0))|0; return Math.abs(h)%360
}

function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return '0s'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

// Visual SVG Icons for Spotify Theme
const BackIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
    <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
  </svg>
)
const PlusIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
    <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
  </svg>
)
const EditIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
  </svg>
)
const TrashIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
  </svg>
)
const ClockIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
    <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z" />
  </svg>
)
const UsersIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
    <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
  </svg>
)
const DeviceIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
    <path d="M4 6h18V4H4c-1.1 0-2 .9-2 2v11H0v3h14v-3H4V6zm19 2h-6c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h6c.55 0 1-.45 1-1V9c0-.55-.45-1-1-1zm-1 9h-4v-7h4v7z" />
  </svg>
)

export default function AdminDashboard({
  token, playlists, onLogout, theme, onCycleTheme, ThemeIcon, onBackToPlayer
}) {
  const [activeTab, setActiveTab] = useState('users') // 'users' or 'stats'
  const [users, setUsers] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  
  // User detail view state
  const [selectedUser, setSelectedUser] = useState(null)
  const [userDetailStats, setUserDetailStats] = useState(null)
  const [detailTimeframe, setDetailTimeframe] = useState('7d')
  const [detailStartDate, setDetailStartDate] = useState('')
  const [detailEndDate, setDetailEndDate] = useState('')

  // Modal / Form state
  const [showModal, setShowModal] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  
  const [formUsername, setFormUsername] = useState('')
  const [formPassword, setFormPassword] = useState('')
  const [formRole, setFormRole] = useState('user')
  const [formAllowedAll, setFormAllowedAll] = useState(true)
  const [formAllowedPlaylists, setFormAllowedPlaylists] = useState([])

  // Search/Filter/Sort states
  const [userSearchQuery, setUserSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortBy, setSortBy] = useState('username')

  const playlistNames = Object.keys(playlists || {})

  // Check if a user is currently active (seen in the last 2 minutes)
  function getUserLiveStatus(username) {
    if (!stats?.history) return false
    const userDevices = stats.history.filter(h => h.username === username)
    if (userDevices.length === 0) return false
    
    // Check if any device was updated within the last 120 seconds
    const now = Date.now()
    return userDevices.some(d => {
      if (!d.last_seen) return false
      const lastSeenTime = new Date(d.last_seen + "Z").getTime()
      return (now - lastSeenTime) < 120 * 1000
    })
  }

  const filteredUsers = users
    .filter(u => {
      const matchSearch = u.username.toLowerCase().includes(userSearchQuery.toLowerCase())
      const matchRole = roleFilter === 'all' || u.role === roleFilter
      const isActive = getUserLiveStatus(u.username)
      const matchStatus = statusFilter === 'all' || (statusFilter === 'active' && isActive) || (statusFilter === 'offline' && !isActive)
      return matchSearch && matchRole && matchStatus
    })
    .sort((a, b) => {
      if (sortBy === 'username') {
        return a.username.localeCompare(b.username)
      }
      if (sortBy === 'role') {
        return a.role.localeCompare(b.role)
      }
      if (sortBy === 'status') {
        const aActive = getUserLiveStatus(a.username)
        const bActive = getUserLiveStatus(b.username)
        return (bActive ? 1 : 0) - (aActive ? 1 : 0)
      }
      return 0
    })

  const fetchUsers = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/users', {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) throw new Error('Failed to fetch users')
      const data = await res.json()
      setUsers(data)
    } catch (err) {
      setError(err.message || 'Failed to load users.')
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/stats', {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) throw new Error('Failed to fetch stats')
      const data = await res.json()
      setStats(data)
    } catch (err) {
      setError(err.message || 'Failed to load statistics.')
    } finally {
      setLoading(false)
    }
  }

  const fetchUserDetailStats = async (username, tf = '7d', start = '', end = '') => {
    setLoading(true)
    setError('')
    try {
      let url = `/api/admin/users/${encodeURIComponent(username)}/stats?timeframe=${tf}`
      if (tf === 'custom' && start && end) {
        url += `&start_date=${start}&end_date=${end}`
      }
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) throw new Error('Failed to fetch user details')
      const data = await res.json()
      setUserDetailStats(data)
    } catch (err) {
      setError(err.message || 'Failed to load user details.')
    } finally {
      setLoading(false)
    }
  }

  // Load basic users on mount
  useEffect(() => {
    if (token) {
      fetchUsers()
      fetchStats() // Fetch stats too to cross-reference active users
    }
  }, [token])

  // React to tab or user selection updates
  useEffect(() => {
    if (token) {
      if (selectedUser) {
        fetchUserDetailStats(selectedUser, detailTimeframe, detailStartDate, detailEndDate)
      } else if (activeTab === 'stats') {
        fetchStats()
      }
    }
  }, [token, activeTab, selectedUser, detailTimeframe])

  const handleApplyCustomDate = () => {
    if (detailStartDate && detailEndDate) {
      fetchUserDetailStats(selectedUser, 'custom', detailStartDate, detailEndDate)
    }
  }

  const openAddModal = () => {
    setIsEditing(false)
    setFormUsername('')
    setFormPassword('')
    setFormRole('user')
    setFormAllowedAll(true)
    setFormAllowedPlaylists([])
    setError('')
    setSuccess('')
    setShowModal(true)
  }

  const openEditModal = (user) => {
    setIsEditing(true)
    setFormUsername(user.username)
    setFormPassword('')
    setFormRole(user.role)
    const allowed = user.rules?.allowed_playlists || ['*']
    if (allowed.includes('*')) {
      setFormAllowedAll(true)
      setFormAllowedPlaylists([])
    } else {
      setFormAllowedAll(false)
      setFormAllowedPlaylists(allowed)
    }
    setError('')
    setSuccess('')
    setShowModal(true)
  }

  const handlePlaylistCheckbox = (plName) => {
    setFormAllowedPlaylists(prev => 
      prev.includes(plName) ? prev.filter(p => p !== plName) : [...prev, plName]
    )
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!formUsername.trim()) {
      setError('Username is required')
      return
    }

    if (!isEditing && !formPassword) {
      setError('Password is required')
      return
    }

    const payload = {
      username: formUsername.trim(),
      role: formRole,
      rules: {
        allowed_playlists: formAllowedAll ? ['*'] : formAllowedPlaylists
      }
    }

    if (formPassword) {
      payload.password = formPassword
    }

    try {
      const url = isEditing ? `/api/admin/users/${encodeURIComponent(formUsername)}` : '/api/admin/users'
      const method = isEditing ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Operation failed')
      }

      setSuccess(isEditing ? 'User updated successfully!' : 'User created successfully!')
      setTimeout(() => setShowModal(false), 800)
      fetchUsers()
      if (selectedUser) {
        fetchUserDetailStats(selectedUser, detailTimeframe, detailStartDate, detailEndDate)
      }
    } catch (err) {
      setError(err.message || 'An error occurred.')
    }
  }

  const handleDeleteUser = async (username) => {
    if (!window.confirm(`Are you sure you want to delete user "${username}"?`)) return
    setError('')
    setSuccess('')
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(username)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Delete failed')
      setSuccess('User deleted successfully!')
      fetchUsers()
      if (selectedUser === username) {
        setSelectedUser(null)
      }
    } catch (err) {
      setError(err.message || 'Failed to delete user.')
    }
  }



  // General Dashboard Aggregates
  const totalPlaySeconds = stats?.time_per_user?.reduce((acc, curr) => acc + curr.total_seconds, 0) || 0
  const totalUniqueDevices = new Set(stats?.history?.map(h => h.device_id)).size || 0
  const totalUniqueUsers = users?.length || stats?.time_per_user?.length || 0
  const maxSongSeconds = stats?.most_played?.[0]?.total_seconds || 1

  // User detail aggregates
  const graphMaxSeconds = Math.max(...(userDetailStats?.graph_data?.map(d => d.seconds) || []), 1)

  // Custom Spotify-style SVG Chart component
  function SpotifyUsageChart({ data, maxVal }) {
    if (!data || data.length === 0) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '220px', color: 'var(--text-dim)' }}>
          No playback stats recorded for this timeframe.
        </div>
      )
    }

    const width = 800
    const height = 220
    const paddingLeft = 60
    const paddingRight = 20
    const paddingTop = 20
    const paddingBottom = 40
    
    const chartWidth = width - paddingLeft - paddingRight
    const chartHeight = height - paddingTop - paddingBottom
    
    const barCount = data.length
    const barWidth = Math.max(8, Math.min(36, (chartWidth / barCount) * 0.55))
    const gap = barCount > 1 ? (chartWidth - (barWidth * barCount)) / (barCount - 1) : 0
    
    return (
      <div className="spotify-chart-wrapper" style={{ overflowX: 'auto', width: '100%' }}>
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', minWidth: '600px', display: 'block' }}>
          <defs>
            <linearGradient id="chartBarGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" />
              <stop offset="100%" stopColor="var(--accent-dim)" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
            const y = paddingTop + chartHeight * (1 - ratio)
            const labelVal = Math.round(maxVal * ratio)
            return (
              <g key={idx}>
                <line 
                  x1={paddingLeft} 
                  y1={y} 
                  x2={width - paddingRight} 
                  y2={y} 
                  stroke="var(--border)" 
                  strokeWidth="1" 
                  strokeDasharray="4,4" 
                />
                <text 
                  x={paddingLeft - 12} 
                  y={y + 4} 
                  fill="var(--text-dim)" 
                  fontSize="10" 
                  fontWeight="600"
                  textAnchor="end"
                >
                  {formatDuration(labelVal)}
                </text>
              </g>
            )
          })}

          {/* Bars */}
          {data.map((dp, i) => {
            const barHeight = maxVal > 0 ? (dp.seconds / maxVal) * chartHeight : 0
            const x = paddingLeft + i * (barWidth + gap)
            const y = height - paddingBottom - barHeight
            
            return (
              <g key={i} className="chart-bar-group">
                {/* Hover block highlight */}
                <rect 
                  x={x - (gap / 2)} 
                  y={paddingTop} 
                  width={barWidth + gap} 
                  height={chartHeight} 
                  fill="transparent" 
                  className="chart-hover-region"
                />
                
                {/* Bar */}
                {barHeight > 0 && (
                  <rect
                    x={x}
                    y={y}
                    width={barWidth}
                    height={barHeight}
                    fill="url(#chartBarGradient)"
                    rx="4"
                    ry="4"
                    style={{ transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}
                  />
                )}
                
                {/* Hover details tooltip directly inside SVG element (native and fast) */}
                <title>{`${dp.label}: ${formatDuration(dp.seconds)}`}</title>

                {/* X Axis Label */}
                <text
                  x={x + barWidth / 2}
                  y={height - paddingBottom + 16}
                  fill="var(--text-dim)"
                  fontSize="9"
                  fontWeight="600"
                  textAnchor="middle"
                  transform={data.length > 12 ? `rotate(-15, ${x + barWidth / 2}, ${height - paddingBottom + 16})` : ''}
                >
                  {dp.label}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
    )
  }

  return (
    <div className="admin-layout" data-theme={theme}>
      {/* Modern Glassmorphism styling property definitions */}
      <style>{`
        .admin-layout {
          --spotify-green: var(--emerald);
          --spotify-green-hover: var(--emerald-hi);
          --spotify-black: var(--bg);
          --spotify-dark-grey: var(--surface);
          --spotify-card-grey: var(--card);
          --spotify-hover-grey: var(--card-hover);
          --spotify-text-muted: var(--text-sub);
        }
        
        .admin-navbar {
          background-color: var(--surface) !important;
          border-bottom: 1px solid var(--border) !important;
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
        }

        .btn-navbar-nav {
          border: 1px solid var(--border) !important;
          color: var(--text-sub) !important;
          border-radius: var(--radius-sm) !important;
          font-family: 'Inter', sans-serif !important;
          font-weight: 700 !important;
          font-size: 10px !important;
          text-transform: uppercase !important;
          letter-spacing: 0.2em !important;
        }
        .btn-navbar-nav:hover {
          background-color: var(--card-hover) !important;
          border-color: var(--border-hi) !important;
          color: var(--text) !important;
          transform: scale(1.05);
        }

        .btn-tab {
          border-radius: var(--radius-sm) !important;
          padding: 8px 20px !important;
          font-family: 'Inter', sans-serif !important;
          font-size: 10px !important;
          font-weight: 700 !important;
          letter-spacing: 0.2em !important;
          text-transform: uppercase !important;
          border: 1px solid transparent !important;
          color: var(--text-sub) !important;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1) !important;
        }

        .btn-tab.active {
          background-color: var(--emerald) !important;
          color: #000000 !important;
          border-color: var(--emerald) !important;
          box-shadow: 0 4px 14px var(--accent-glow) !important;
        }

        .btn-add-user {
          background: var(--emerald) !important;
          border-radius: var(--radius-sm) !important;
          padding: 10px 22px !important;
          font-family: 'Inter', sans-serif !important;
          font-size: 10px !important;
          font-weight: 700 !important;
          text-transform: uppercase !important;
          letter-spacing: 0.2em !important;
          color: #000000 !important;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1) !important;
        }
        .btn-add-user:hover {
          background: var(--emerald-hi) !important;
          transform: scale(1.05) !important;
        }

        .stat-card {
          background-color: var(--card) !important;
          border: 1px solid var(--border) !important;
          border-radius: var(--radius-md) !important;
          padding: 24px !important;
          backdrop-filter: blur(12px) !important;
          -webkit-backdrop-filter: blur(12px) !important;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1) !important;
        }
        .stat-card:hover {
          background-color: var(--card-hover) !important;
          border-color: var(--border-hi) !important;
          transform: scale(1.03) !important;
        }

        .stat-card-title {
          font-family: 'Inter', sans-serif !important;
          font-size: 10px !important;
          font-weight: 700 !important;
          letter-spacing: 0.2em !important;
          text-transform: uppercase !important;
          color: var(--text-dim) !important;
        }

        .stat-card-value {
          font-family: 'Inter', sans-serif !important;
          font-size: 2.2rem !important;
          line-height: 1.05 !important;
          font-weight: 700 !important;
          letter-spacing: -0.05em !important;
          color: var(--text) !important;
        }

        .chart-panel {
          background-color: var(--card) !important;
          border: 1px solid var(--border) !important;
          border-radius: var(--radius-md) !important;
          padding: 24px !important;
          backdrop-filter: blur(12px) !important;
          -webkit-backdrop-filter: blur(12px) !important;
        }

        .user-card {
          background-color: var(--card) !important;
          border: 1px solid var(--border) !important;
          border-radius: var(--radius-md) !important;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1) !important;
          backdrop-filter: blur(12px) !important;
          -webkit-backdrop-filter: blur(12px) !important;
        }
        .user-card:hover {
          background-color: var(--card-hover) !important;
          border-color: var(--border-hi) !important;
          transform: scale(1.02) !important;
        }

        .btn-card.edit {
          background-color: var(--card) !important;
          border: 1px solid var(--border) !important;
          color: var(--text) !important;
          border-radius: var(--radius-sm) !important;
          font-family: 'Inter', sans-serif !important;
          font-size: 10px !important;
          font-weight: 700 !important;
          text-transform: uppercase !important;
          letter-spacing: 0.2em !important;
        }
        .btn-card.edit:hover {
          border-color: var(--emerald) !important;
          background-color: var(--emerald) !important;
          color: #000000 !important;
        }
        .btn-card.delete {
          border-radius: var(--radius-sm) !important;
          font-family: 'Inter', sans-serif !important;
          font-size: 10px !important;
          font-weight: 700 !important;
          text-transform: uppercase !important;
          letter-spacing: 0.2em !important;
        }

        .btn-back {
          border-radius: var(--radius-sm) !important;
          font-family: 'Inter', sans-serif !important;
          font-size: 10px !important;
          font-weight: 700 !important;
          text-transform: uppercase !important;
          letter-spacing: 0.2em !important;
        }

        .btn-timeframe {
          border-radius: var(--radius-sm) !important;
          font-family: 'Inter', sans-serif !important;
          font-size: 10px !important;
          font-weight: 700 !important;
          text-transform: uppercase !important;
          letter-spacing: 0.2em !important;
          border: 1px solid transparent !important;
          color: var(--text-sub) !important;
        }
        .btn-timeframe.active {
          background-color: var(--emerald) !important;
          color: #000000 !important;
          border-color: var(--emerald) !important;
        }

        .timeframe-bar {
          background-color: var(--card) !important;
          border: 1px solid var(--border) !important;
          border-radius: var(--radius-sm) !important;
        }

        .user-profile-header {
          background-color: var(--card) !important;
          border: 1px solid var(--border) !important;
          border-radius: var(--radius-md) !important;
          backdrop-filter: blur(12px) !important;
        }

        .graph-panel {
          background-color: var(--card) !important;
          border: 1px solid var(--border) !important;
          border-radius: var(--radius-md) !important;
          backdrop-filter: blur(12px) !important;
        }

        /* Live Badge style */
        .live-status-container {
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        
        .live-badge {
          background: rgba(52, 211, 153, 0.15);
          border: 1px solid var(--emerald);
          color: var(--emerald);
          padding: 3px 8px;
          border-radius: var(--radius-sm);
          font-family: 'Inter', sans-serif;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .live-pulse-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background-color: var(--emerald);
          box-shadow: 0 0 0 0 rgba(52, 211, 153, 0.7);
          animation: pulseGreen 1.5s infinite;
        }

        .session-history-panel {
          background-color: var(--card) !important;
          border: 1px solid var(--border) !important;
          border-radius: var(--radius-md) !important;
          backdrop-filter: blur(12px) !important;
        }

        .history-table th {
          border-bottom: 1px solid var(--border) !important;
          font-family: 'Inter', sans-serif !important;
          font-size: 10px !important;
          font-weight: 700 !important;
          text-transform: uppercase !important;
          letter-spacing: 0.2em !important;
          color: var(--text-dim) !important;
        }
        .history-table td {
          border-bottom: 1px solid var(--border) !important;
          color: var(--text-sub) !important;
        }
        .history-table tr:hover td {
          background-color: var(--card-hover) !important;
          color: var(--text) !important;
        }

        .spotify-album-cover {
          background: var(--surface);
          border: 1px solid var(--border);
          width: 40px;
          height: 40px;
          border-radius: var(--radius-sm);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--emerald);
        }

        .chart-bar-group:hover rect {
          filter: brightness(1.25);
        }
      `}</style>

      <header className="admin-navbar">
        <div className="brand">
          <div className="brand-icon" style={{ backgroundColor: 'var(--accent)', background: 'linear-gradient(135deg, var(--accent), var(--accent-dim))' }}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="black">
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
            </svg>
          </div>
          <span className="brand-name">Sangita Control Panel</span>
        </div>
        
        <div className="admin-navbar-actions">
          <button className="btn-navbar-nav" onClick={onBackToPlayer} title="Back to Music Player">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style={{ marginRight: 6 }}>
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
            </svg>
            Music Player
          </button>
          <button className="btn-navbar-theme" onClick={onCycleTheme} title="Toggle Theme">
            <ThemeIcon theme={theme} />
          </button>
          <button className="btn-navbar-logout" onClick={onLogout}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style={{ marginRight: 6 }}>
              <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/>
            </svg>
            Logout
          </button>
        </div>
      </header>

      <div className="admin-dashboard-container">
        {selectedUser ? (
          /* =================================================================
             USER DETAIL PAGE SUBVIEW (Spotify Developer Style)
             ================================================================= */
          <div className="user-detail-view">
            <button className="btn-back" onClick={() => { setSelectedUser(null); setUserDetailStats(null); }}>
              <BackIcon />
              Back to Dashboard
            </button>

            {userDetailStats && (
              <>
                {/* User Header */}
                <div className="user-profile-header" style={{ border: 'none' }}>
                  <div className="profile-info">
                    <div className="profile-avatar" style={{
                      borderRadius: '50%',
                      width: '80px',
                      height: '80px',
                      fontSize: '2rem',
                      background: `linear-gradient(135deg, hsl(${strHue(userDetailStats.username)},70%,40%), hsl(${(strHue(userDetailStats.username)+60)%360},70%,25%)`
                    }}>
                      {userDetailStats.username.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="profile-meta">
                      <h3 style={{ fontSize: '2rem', fontWeight: 800 }}>{userDetailStats.username}</h3>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
                        <span className={`role-badge ${userDetailStats.role}`}>{userDetailStats.role}</span>
                        {getUserLiveStatus(userDetailStats.username) && (
                          <span className="live-badge">
                            <span className="live-pulse-dot" />
                            LIVE NOW
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <button className="btn-add-user" onClick={() => openEditModal({
                    username: userDetailStats.username,
                    role: userDetailStats.role,
                    rules: userDetailStats.rules
                  })}>
                    <EditIcon />
                    Modify Rules
                  </button>
                </div>

                {/* Quick aggregates */}
                <div className="stats-cards-grid" style={{ marginBottom: 32 }}>
                  <div className="stat-card">
                    <span className="stat-card-title">Last Connected</span>
                    <span className="stat-card-value" style={{ fontSize: '1.3rem', height: '2.5rem', display: 'flex', alignItems: 'center' }}>
                      {userDetailStats.last_seen ? new Date(userDetailStats.last_seen + "Z").toLocaleString() : 'Never'}
                    </span>
                    <span className="stat-card-desc">Last recorded active event</span>
                  </div>
                  <div className="stat-card">
                    <span className="stat-card-title">Period Listen Time</span>
                    <span className="stat-card-value">{formatDuration(userDetailStats.total_seconds)}</span>
                    <span className="stat-card-desc">Total duration in timeframe</span>
                  </div>
                  <div className="stat-card">
                    <span className="stat-card-title">Daily Average</span>
                    <span className="stat-card-value">{formatDuration(Math.round(userDetailStats.avg_daily_seconds))}</span>
                    <span className="stat-card-desc">Average playback logged per day</span>
                  </div>
                </div>

                {/* Timeframe Selector Bar */}
                <div className="timeframe-bar">
                  <div className="timeframe-buttons">
                    {['24h', '7d', '30d', 'custom'].map((tf) => (
                      <button
                        key={tf}
                        className={`btn-timeframe ${detailTimeframe === tf ? 'active' : ''}`}
                        onClick={() => setDetailTimeframe(tf)}
                      >
                        {tf === '24h' ? '24 Hours' : tf === '7d' ? '7 Days' : tf === '30d' ? '30 Days' : 'Custom range'}
                      </button>
                    ))}
                  </div>

                  {detailTimeframe === 'custom' && (
                    <div className="custom-date-inputs">
                      <input 
                        type="date" 
                        value={detailStartDate} 
                        onChange={e => setDetailStartDate(e.target.value)} 
                        title="Start Date"
                      />
                      <span style={{ color: 'var(--text-dim)' }}>to</span>
                      <input 
                        type="date" 
                        value={detailEndDate} 
                        onChange={e => setDetailEndDate(e.target.value)}
                        title="End Date"
                      />
                      <button className="btn-apply-date" onClick={handleApplyCustomDate}>Apply</button>
                    </div>
                  )}
                </div>

                {/* Usage Time Graph (Spotify Custom SVG Chart) */}
                <div className="graph-panel">
                  <h3 className="graph-title">Listening Breakdown ({detailTimeframe === '24h' ? 'Hourly' : 'Daily'})</h3>
                  <SpotifyUsageChart data={userDetailStats.graph_data} maxVal={graphMaxSeconds} />
                </div>

                <div className="stats-charts-row">
                  {/* Playlist rules */}
                  <div className="chart-panel stats-breakdown" style={{ flex: 1 }}>
                    <h3 className="chart-panel-title">Allowed Playlists</h3>
                    <div style={{ marginTop: 12 }}>
                      {userDetailStats.rules?.allowed_playlists?.includes('*') ? (
                        <div className="rule-tag all" style={{ display: 'inline-block', fontSize: '0.9rem', padding: '6px 12px' }}>
                          All Playlists (*)
                        </div>
                      ) : !userDetailStats.rules?.allowed_playlists || userDetailStats.rules.allowed_playlists.length === 0 ? (
                        <div className="rule-tag none" style={{ display: 'inline-block', fontSize: '0.9rem', padding: '6px 12px' }}>
                          No Access Granted
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          {userDetailStats.rules.allowed_playlists.map(pl => (
                            <span key={pl} className="rule-tag playlist" style={{ fontSize: '0.85rem', padding: '6px 12px', borderRadius: '4px' }}>
                              {pl}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <button 
                      className="btn-card edit" 
                      style={{ marginTop: 24, padding: '10px 20px' }}
                      onClick={() => openEditModal({
                        username: userDetailStats.username,
                        role: userDetailStats.role,
                        rules: userDetailStats.rules
                      })}
                    >
                      Modify Allowed Playlists
                    </button>
                  </div>

                  {/* Most listen track */}
                  <div className="chart-panel most-played" style={{ flex: 1.5 }}>
                    <h3 className="chart-panel-title">Most Listened Tracks</h3>
                    {(!userDetailStats.most_played || userDetailStats.most_played.length === 0) ? (
                      <p className="no-data-msg">No tracks played in this timeframe.</p>
                    ) : (
                      <div className="most-played-list">
                        {userDetailStats.most_played.map((track, idx) => {
                          const percentage = Math.max(8, Math.round((track.total_seconds / (userDetailStats.most_played[0]?.total_seconds || 1)) * 100))
                          const filename = track.track_id.split('/').pop().replace(/\.[^/.]+$/, '')
                          return (
                            <div key={track.track_id} className="most-played-item">
                              <div className="track-meta-row">
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                  <span className="track-rank">#{idx+1}</span>
                                  <div className="spotify-album-cover">
                                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                                      <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                                    </svg>
                                  </div>
                                  <span className="track-title-label" title={filename}>{filename}</span>
                                </div>
                                <span className="track-playtime">{formatDuration(track.total_seconds)}</span>
                              </div>
                              <div className="progress-bg" style={{ marginLeft: 66 }}>
                                <div className="progress-bar" style={{ width: `${percentage}%` }} />
                              </div>
                              <span className="track-playlist-label" style={{ marginLeft: 66 }}>{track.playlist}</span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          /* =================================================================
             MAIN USER MANAGEMENT DASHBOARD (Spotify Developer Style)
             ================================================================= */
          <div className="admin-dashboard">
            <div className="dashboard-header">
              <div>
                <h2 style={{ color: '#fff' }}>User Management Dashboard</h2>
                <p className="dashboard-subtitle">Manage accounts, access privileges, and review system listening logs</p>
              </div>
              
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <div className="tab-buttons-container">
                  <button 
                    className={`btn-tab ${activeTab === 'users' ? 'active' : ''}`}
                    onClick={() => setActiveTab('users')}
                  >
                    User Accounts
                  </button>
                  <button 
                    className={`btn-tab ${activeTab === 'stats' ? 'active' : ''}`}
                    onClick={() => setActiveTab('stats')}
                  >
                    Usage Statistics
                  </button>
                </div>
                {activeTab === 'users' && (
                  <button className="btn-add-user" onClick={openAddModal}>
                    <PlusIcon />
                    Add New User
                  </button>
                )}
              </div>
            </div>

            {error && <div className="dashboard-alert error">{error}</div>}
            {success && <div className="dashboard-alert success">{success}</div>}

            {loading && !stats ? (
              <div className="loading-state">
                <div className="spinner" />
                <p>Retrieving database info...</p>
              </div>
            ) : activeTab === 'users' ? (
              <>
                <div className="admin-filters-bar">
                  <div className="admin-search-wrapper">
                    <span className="admin-search-icon">
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                        <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
                      </svg>
                    </span>
                    <input 
                      type="text" 
                      placeholder="Search users..." 
                      value={userSearchQuery}
                      onChange={e => setUserSearchQuery(e.target.value)}
                      className="admin-search-input"
                    />
                  </div>
                  <select 
                    value={roleFilter} 
                    onChange={e => setRoleFilter(e.target.value)}
                    className="admin-select"
                    title="Filter by Role"
                  >
                    <option value="all">All Roles</option>
                    <option value="admin">Administrators</option>
                    <option value="user">Standard Users</option>
                  </select>
                  <select 
                    value={statusFilter} 
                    onChange={e => setStatusFilter(e.target.value)}
                    className="admin-select"
                    title="Filter by Status"
                  >
                    <option value="all">All Statuses</option>
                    <option value="active">Active Now</option>
                    <option value="offline">Offline</option>
                  </select>
                  <select 
                    value={sortBy} 
                    onChange={e => setSortBy(e.target.value)}
                    className="admin-select"
                    title="Sort Users By"
                  >
                    <option value="username">Sort by Name</option>
                    <option value="role">Sort by Role</option>
                    <option value="status">Sort by Live Status</option>
                  </select>
                </div>
                {filteredUsers.length === 0 ? (
                  <div className="empty-state" style={{ marginTop: 40, width: '100%' }}>
                    <h3>No users match filters</h3>
                    <p>Try searching for a different username or adjusting filters.</p>
                  </div>
                ) : (
                  <div className="users-grid">
                    {filteredUsers.map(u => {
                      const hue = strHue(u.username)
                      const allowed = u.rules?.allowed_playlists || ['*']
                      const hasAll = allowed.includes('*')
                      const isUserActive = getUserLiveStatus(u.username)

                      return (
                        <div key={u.username} className="user-card" onClick={() => {
                          setSelectedUser(u.username);
                          setDetailTimeframe('7d');
                        }}>
                          <div className="user-card-header">
                            <div className="user-avatar" style={{
                              borderRadius: '50%',
                              background: `linear-gradient(135deg, hsl(${hue},65%,35%), hsl(${(hue+60)%360},65%,20%))`
                            }}>
                              {u.username.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="user-info-main">
                              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                <h3 className="user-name">{u.username}</h3>
                                {isUserActive && (
                                  <span className="live-pulse-dot" title="Listening now" />
                                )}
                              </div>
                              <span className={`role-badge ${u.role}`}>
                                {u.role}
                              </span>
                            </div>
                          </div>

                          <div className="user-rules-section">
                            <span className="rules-title">Allowed Playlists:</span>
                            {hasAll ? (
                              <span className="rule-tag all">All Playlists (*)</span>
                            ) : allowed.length === 0 ? (
                              <span className="rule-tag none">No Playlists (Muted)</span>
                            ) : (
                              <div className="rules-tags-container">
                                {allowed.slice(0, 3).map(p => (
                                  <span key={p} className="rule-tag playlist" style={{ borderRadius: '4px' }}>{p}</span>
                                ))}
                                {allowed.length > 3 && (
                                  <span className="rule-tag playlist" style={{ borderRadius: '4px' }}>+{allowed.length - 3} more</span>
                                )}
                              </div>
                            )}
                          </div>

                          <div className="user-card-actions" onClick={e => e.stopPropagation()}>
                            <button className="btn-card edit" onClick={() => {
                              setSelectedUser(u.username);
                              setDetailTimeframe('7d');
                            }}>
                              View Profile
                            </button>
                            <button className="btn-card delete" onClick={() => handleDeleteUser(u.username)}>
                              Delete
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            ) : (
              /* STATISTICS TAB VIEW */
              <div className="stats-layout">
                {/* Aggregates Cards */}
                <div className="stats-cards-grid">
                  <div className="stat-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="stat-card-title">Total Listening Time</span>
                      <span style={{ color: 'var(--spotify-green)' }}><ClockIcon /></span>
                    </div>
                    <span className="stat-card-value">{formatDuration(totalPlaySeconds)}</span>
                    <span className="stat-card-desc">Accumulated active playback</span>
                  </div>
                  <div className="stat-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="stat-card-title">Unique Listeners</span>
                      <span style={{ color: 'var(--spotify-green)' }}><UsersIcon /></span>
                    </div>
                    <span className="stat-card-value">{totalUniqueUsers}</span>
                    <span className="stat-card-desc">Registered user accounts</span>
                  </div>
                  <div className="stat-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="stat-card-title">Connected Devices</span>
                      <span style={{ color: 'var(--spotify-green)' }}><DeviceIcon /></span>
                    </div>
                    <span className="stat-card-value">{totalUniqueDevices}</span>
                    <span className="stat-card-desc">Unique sync clients registered</span>
                  </div>
                </div>

                <div className="stats-charts-row">
                  {/* Popular Music Playlist List */}
                  <div className="chart-panel most-played">
                    <h3 className="chart-panel-title">Most Played Songs</h3>
                    {(!stats?.most_played || stats.most_played.length === 0) ? (
                      <p className="no-data-msg">No playback events recorded.</p>
                    ) : (
                      <div className="most-played-list">
                        {stats.most_played.map((track, idx) => {
                          const percentage = Math.max(8, Math.round((track.total_seconds / maxSongSeconds) * 100))
                          const filename = track.track_id.split('/').pop().replace(/\.[^/.]+$/, '')
                          return (
                            <div key={track.track_id} className="most-played-item">
                              <div className="track-meta-row">
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                  <span className="track-rank">#{idx+1}</span>
                                  <div className="spotify-album-cover">
                                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                                      <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                                    </svg>
                                  </div>
                                  <span className="track-title-label" title={filename}>{filename}</span>
                                </div>
                                <span className="track-playtime">{formatDuration(track.total_seconds)}</span>
                              </div>
                              <div className="progress-bg" style={{ marginLeft: 66 }}>
                                <div className="progress-bar" style={{ width: `${percentage}%` }} />
                              </div>
                              <span className="track-playlist-label" style={{ marginLeft: 66 }}>{track.playlist}</span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {/* Browser and OS breakdowns */}
                  <div className="chart-panel stats-breakdown">
                    <h3 className="chart-panel-title">Browsers & OS Breakdown</h3>
                    
                    <div className="breakdown-section">
                      <span className="breakdown-title">Browsers</span>
                      {(!stats?.browser_stats || stats.browser_stats.length === 0) ? (
                        <p className="no-data-msg">No browser data.</p>
                      ) : (
                        stats.browser_stats.map(b => {
                          const percent = totalPlaySeconds > 0 ? Math.round((b.total_seconds / totalPlaySeconds) * 100) : 0
                          return (
                            <div key={b.browser} className="breakdown-item">
                              <div className="breakdown-header-row">
                                <span>{b.browser}</span>
                                <span>{percent}% ({formatDuration(b.total_seconds)})</span>
                              </div>
                              <div className="breakdown-bar-bg">
                                <div className="breakdown-bar fill-browser" style={{ width: `${percent}%`, backgroundColor: 'var(--accent)' }} />
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>

                    <div className="breakdown-section" style={{ marginTop: 20 }}>
                      <span className="breakdown-title">Operating Systems</span>
                      {(!stats?.os_stats || stats.os_stats.length === 0) ? (
                        <p className="no-data-msg">No OS data.</p>
                      ) : (
                        stats.os_stats.map(o => {
                          const percent = totalPlaySeconds > 0 ? Math.round((o.total_seconds / totalPlaySeconds) * 100) : 0
                          return (
                            <div key={o.os} className="breakdown-item">
                              <div className="breakdown-header-row">
                                <span>{o.os}</span>
                                <span>{percent}% ({formatDuration(o.total_seconds)})</span>
                              </div>
                              <div className="breakdown-bar-bg">
                                <div className="breakdown-bar fill-os" style={{ width: `${percent}%`, backgroundColor: 'var(--spotify-green)' }} />
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>
                </div>

                {/* User Devices & Session Log */}
                <div className="session-history-panel">
                  <h3 className="chart-panel-title">User Device & Session History</h3>
                  {(!stats?.history || stats.history.length === 0) ? (
                    <p className="no-data-msg">No activity log found.</p>
                  ) : (
                    <div className="history-table-container">
                      <table className="history-table">
                        <thead>
                          <tr>
                            <th>User</th>
                            <th>Device Name</th>
                            <th>Type</th>
                            <th>Browser / OS</th>
                            <th>Listening Time</th>
                            <th>Last Seen</th>
                          </tr>
                        </thead>
                        <tbody>
                          {stats.history.map(row => {
                            const hue = strHue(row.username)
                            const lastSeenDate = new Date(row.last_seen + "Z").toLocaleString()
                            const isUserLive = (row.last_seen && (Date.now() - new Date(row.last_seen + "Z").getTime() < 120 * 1000))
                            
                            return (
                              <tr key={`${row.username}-${row.device_id}`}>
                                <td style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                  <div className="user-avatar-mini" style={{
                                    background: `linear-gradient(135deg, hsl(${hue},65%,35%), hsl(${(hue+60)%360},65%,20%))`
                                  }}>
                                    {row.username.slice(0, 2).toUpperCase()}
                                  </div>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                    <strong style={{ color: '#fff' }}>{row.username}</strong>
                                    {isUserLive ? (
                                      <span className="live-badge">
                                        <span className="live-pulse-dot" />
                                        LIVE NOW
                                      </span>
                                    ) : (
                                      <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>offline</span>
                                    )}
                                  </div>
                                </td>
                                <td>{row.device_name}</td>
                                <td>
                                  <span className={`device-type-tag ${row.device_type}`}>
                                    {row.device_type}
                                  </span>
                                </td>
                                <td>{row.browser} / {row.os}</td>
                                <td><strong>{formatDuration(row.total_seconds)}</strong></td>
                                <td className="last-seen-cell">{lastSeenDate}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {showModal && (
          <div className="dashboard-modal-backdrop" onClick={() => setShowModal(false)}>
            <div className="dashboard-modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3>{isEditing ? `Edit User: ${formUsername}` : 'Create New User'}</h3>
                <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
              </div>
              
              <form onSubmit={handleSubmit} className="modal-form">
                {error && <div className="dashboard-alert error">{error}</div>}
                {success && <div className="dashboard-alert success">{success}</div>}

                <div className="form-group">
                  <label className="form-label">Username</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. musical_friend"
                    disabled={isEditing}
                    value={formUsername}
                    onChange={e => setFormUsername(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    {isEditing ? 'Change Password (Leave blank to keep current)' : 'Password'}
                  </label>
                  <input
                    type="password"
                    className="form-input"
                    placeholder="••••••••"
                    value={formPassword}
                    onChange={e => setFormPassword(e.target.value)}
                    required={!isEditing}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Role</label>
                  <div className="radio-group">
                    <label className="radio-label">
                      <input
                        type="radio"
                        name="role"
                        value="user"
                        checked={formRole === 'user'}
                        onChange={() => setFormRole('user')}
                      />
                      <span>Regular User</span>
                    </label>
                    <label className="radio-label">
                      <input
                        type="radio"
                        name="role"
                        value="admin"
                        checked={formRole === 'admin'}
                        onChange={() => setFormRole('admin')}
                      />
                      <span>Administrator</span>
                    </label>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Playlist Access Rules</label>
                  <label className="checkbox-label" style={{ marginBottom: 12 }}>
                    <input
                      type="checkbox"
                      checked={formAllowedAll}
                      onChange={e => setFormAllowedAll(e.target.checked)}
                    />
                    <strong>Allow Access to All Playlists (*)</strong>
                  </label>

                  {!formAllowedAll && (
                    <div className="playlists-selector">
                      <span className="selector-title">Select allowed playlists:</span>
                      {playlistNames.length === 0 ? (
                        <p className="no-playlists-error">No discovered playlists on server.</p>
                      ) : (
                        <div className="selector-grid">
                          {playlistNames.map(name => (
                            <label key={name} className="checkbox-label playlist-select">
                              <input
                                type="checkbox"
                                checked={formAllowedPlaylists.includes(name)}
                                onChange={() => handlePlaylistCheckbox(name)}
                              />
                              <span>{name}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="modal-actions">
                  <button type="button" className="btn-modal cancel" onClick={() => setShowModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn-modal submit">
                    {isEditing ? 'Save Changes' : 'Create User'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

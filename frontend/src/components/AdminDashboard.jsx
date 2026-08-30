import { useState, useEffect, useCallback, useMemo } from 'react'

function strHue(str) {
  let h = 0
  for (const c of (str || '')) h = (h * 31 + c.charCodeAt(0)) | 0
  return Math.abs(h) % 360
}

function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return '0s'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.round(seconds % 60)
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function formatNumber(num) {
  if (num === undefined || num === null) return '0'
  return Number(num).toLocaleString()
}

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 B'
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`
}

function formatTimestamp(ts, tz = 'Asia/Kolkata') {
  if (!ts) return 'Never'
  try {
    const raw = ts.endsWith('Z') ? ts : ts + 'Z'
    return new Date(raw).toLocaleString('en-US', {
      timeZone: tz,
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    })
  } catch (e) {
    try {
      return new Date(ts).toLocaleString('en-US', { timeZone: tz })
    } catch {
      return ts
    }
  }
}

// Icons
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
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
    <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z" />
  </svg>
)
const UsersIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
    <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
  </svg>
)
const DeviceIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
    <path d="M4 6h18V4H4c-1.1 0-2 .9-2 2v11H0v3h14v-3H4V6zm19 2h-6c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h6c.55 0 1-.45 1-1V9c0-.55-.45-1-1-1zm-1 9h-4v-7h4v7z" />
  </svg>
)
const MusicIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
    <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
  </svg>
)
const DownloadIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
    <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
  </svg>
)
const RefreshIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
    <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
  </svg>
)
const FlameIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
    <path d="M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67zM11.71 19c-1.78 0-3.22-1.4-3.22-3.14 0-1.62 1.05-2.76 2.81-3.12 1.77-.36 3.6-1.21 4.62-2.58.39 1.29.59 2.65.59 4.04 0 2.65-2.15 4.8-4.8 4.8z"/>
  </svg>
)
const ActivityIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
    <path d="M3 13h4l3-9 4 18 3-9h4v-2h-5l-3 9-4-18-3 9H3v2z"/>
  </svg>
)

export default function AdminDashboard({
  token,
  playlists,
  onLogout,
  theme,
  onCycleTheme,
  ThemeIcon,
  onBackToPlayer
}) {
  // Navigation Tabs: 'analytics', 'music', 'live', 'users', 'system'
  const [activeTab, setActiveTab] = useState('analytics')
  
  // Timezone State (defaults to 'Asia/Kolkata' = IST)
  const [timezone, setTimezone] = useState(() => localStorage.getItem('sangita_timezone') || 'Asia/Kolkata')
  const browserTz = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata'
    } catch {
      return 'Asia/Kolkata'
    }
  }, [])
  const effectiveTz = timezone === 'auto' ? browserTz : (timezone || 'Asia/Kolkata')

  useEffect(() => {
    localStorage.setItem('sangita_timezone', timezone)
  }, [timezone])

  // Analytics State
  const [timeframe, setTimeframe] = useState('7d')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [analytics, setAnalytics] = useState(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(true)
  const [analyticsMetric, setAnalyticsMetric] = useState('seconds') // 'seconds', 'plays', 'users'

  // Users State
  const [users, setUsers] = useState([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [userSearchQuery, setUserSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortBy, setSortBy] = useState('username')

  // User Detail Subview
  const [selectedUser, setSelectedUser] = useState(null)
  const [userDetailStats, setUserDetailStats] = useState(null)
  const [detailTimeframe, setDetailTimeframe] = useState('7d')
  const [detailStartDate, setDetailStartDate] = useState('')
  const [detailEndDate, setDetailEndDate] = useState('')

  // Modals & Forms
  const [showUserModal, setShowUserModal] = useState(false)
  const [isEditingUser, setIsEditingUser] = useState(false)
  const [formUsername, setFormUsername] = useState('')
  const [formPassword, setFormPassword] = useState('')
  const [formRole, setFormRole] = useState('user')
  const [formAllowedAll, setFormAllowedAll] = useState(true)
  const [formAllowedPlaylists, setFormAllowedPlaylists] = useState([])

  // Audit Logs State
  const [logs, setLogs] = useState([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [logsPage, setLogsPage] = useState(1)
  const [logsTotalPages, setLogsTotalPages] = useState(1)
  const [logsTotalCount, setLogsTotalCount] = useState(0)
  const [logsSearch, setLogsSearch] = useState('')
  const [logsUserFilter, setLogsUserFilter] = useState('')

  // Notifications
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const playlistNames = Object.keys(playlists || {})

  // Fetch Analytics
  const fetchAnalytics = useCallback(async () => {
    if (!token) return
    setAnalyticsLoading(true)
    setError('')
    try {
      let url = `/api/admin/analytics?timeframe=${timeframe}&tz=${encodeURIComponent(effectiveTz)}`
      if (timeframe === 'custom' && customStartDate && customEndDate) {
        url += `&start_date=${customStartDate}&end_date=${customEndDate}`
      }
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) throw new Error('Failed to load analytics')
      const data = await res.json()
      setAnalytics(data)
    } catch (err) {
      setError(err.message || 'Failed to fetch analytics data')
    } finally {
      setAnalyticsLoading(false)
    }
  }, [token, timeframe, customStartDate, customEndDate, effectiveTz])

  // Fetch Users
  const fetchUsers = useCallback(async () => {
    if (!token) return
    setUsersLoading(true)
    try {
      const res = await fetch('/api/admin/users', { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) throw new Error('Failed to load users')
      const data = await res.json()
      setUsers(data)
    } catch (err) {
      setError(err.message || 'Failed to load user accounts')
    } finally {
      setUsersLoading(false)
    }
  }, [token])

  // Fetch Logs
  const fetchLogs = useCallback(async (page = 1) => {
    if (!token) return
    setLogsLoading(true)
    try {
      let url = `/api/admin/logs?page=${page}&limit=25`
      if (logsSearch) url += `&search=${encodeURIComponent(logsSearch)}`
      if (logsUserFilter) url += `&username=${encodeURIComponent(logsUserFilter)}`
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) throw new Error('Failed to load audit logs')
      const data = await res.json()
      setLogs(data.events || [])
      setLogsPage(data.page || 1)
      setLogsTotalPages(data.total_pages || 1)
      setLogsTotalCount(data.total || 0)
    } catch (err) {
      setError(err.message || 'Failed to load audit logs')
    } finally {
      setLogsLoading(false)
    }
  }, [token, logsSearch, logsUserFilter])

  // Fetch User Detail Stats
  const fetchUserDetailStats = useCallback(async (username, tf = '7d', start = '', end = '') => {
    if (!token || !username) return
    setAnalyticsLoading(true)
    try {
      let url = `/api/admin/users/${encodeURIComponent(username)}/stats?timeframe=${tf}&tz=${encodeURIComponent(effectiveTz)}`
      if (tf === 'custom' && start && end) {
        url += `&start_date=${start}&end_date=${end}`
      }
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) throw new Error('Failed to load user profile stats')
      const data = await res.json()
      setUserDetailStats(data)
    } catch (err) {
      setError(err.message || 'Failed to load user details')
    } finally {
      setAnalyticsLoading(false)
    }
  }, [token, effectiveTz])

  // Initial and reactive effects
  useEffect(() => {
    fetchAnalytics()
    fetchUsers()
  }, [fetchAnalytics, fetchUsers])

  useEffect(() => {
    if (activeTab === 'live') {
      fetchLogs(1)
    }
  }, [activeTab, fetchLogs])

  useEffect(() => {
    if (selectedUser) {
      fetchUserDetailStats(selectedUser, detailTimeframe, detailStartDate, detailEndDate)
    }
  }, [selectedUser, detailTimeframe, detailStartDate, detailEndDate, fetchUserDetailStats])

  // Check if a user is live now
  const getUserLiveStatus = useCallback((username) => {
    if (!analytics?.live_sessions) return false
    return analytics.live_sessions.some(s => s.username === username)
  }, [analytics?.live_sessions])

  // Filtered and Sorted Users
  const filteredUsers = useMemo(() => {
    return users
      .filter(u => {
        const matchSearch = u.username.toLowerCase().includes(userSearchQuery.toLowerCase())
        const matchRole = roleFilter === 'all' || u.role === roleFilter
        const isLive = getUserLiveStatus(u.username)
        const matchStatus = statusFilter === 'all' || (statusFilter === 'active' && isLive) || (statusFilter === 'offline' && !isLive)
        return matchSearch && matchRole && matchStatus
      })
      .sort((a, b) => {
        if (sortBy === 'username') return a.username.localeCompare(b.username)
        if (sortBy === 'role') return a.role.localeCompare(b.role)
        if (sortBy === 'status') {
          const aLive = getUserLiveStatus(a.username) ? 1 : 0
          const bLive = getUserLiveStatus(b.username) ? 1 : 0
          return bLive - aLive
        }
        return 0
      })
  }, [users, userSearchQuery, roleFilter, statusFilter, sortBy, getUserLiveStatus])

  // User CRUD Handlers
  const openAddUserModal = () => {
    setIsEditingUser(false)
    setFormUsername('')
    setFormPassword('')
    setFormRole('user')
    setFormAllowedAll(true)
    setFormAllowedPlaylists([])
    setError('')
    setSuccess('')
    setShowUserModal(true)
  }

  const openEditUserModal = (user) => {
    setIsEditingUser(true)
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
    setShowUserModal(true)
  }

  const handlePlaylistCheckbox = (plName) => {
    setFormAllowedPlaylists(prev =>
      prev.includes(plName) ? prev.filter(p => p !== plName) : [...prev, plName]
    )
  }

  const handleSaveUser = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!formUsername.trim()) {
      setError('Username is required')
      return
    }
    if (!isEditingUser && !formPassword) {
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
    if (formPassword) payload.password = formPassword

    try {
      const url = isEditingUser ? `/api/admin/users/${encodeURIComponent(formUsername)}` : '/api/admin/users'
      const method = isEditingUser ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Operation failed')

      setSuccess(isEditingUser ? 'User updated successfully!' : 'User created successfully!')
      setTimeout(() => setShowUserModal(false), 700)
      fetchUsers()
      if (selectedUser) {
        fetchUserDetailStats(selectedUser, detailTimeframe, detailStartDate, detailEndDate)
      }
    } catch (err) {
      setError(err.message || 'An error occurred')
    }
  }

  const handleDeleteUser = async (username) => {
    if (!window.confirm(`Are you sure you want to permanently delete user "${username}"?`)) return
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
      setError(err.message || 'Failed to delete user')
    }
  }

  const handleExportCSV = () => {
    window.open(`/api/admin/export?token=${encodeURIComponent(token)}&tz=${encodeURIComponent(effectiveTz)}`, '_blank')
  }

  // Interactive Primary Time-Series Chart Component
  function PrimaryTimelineChart({ data, metric = 'seconds' }) {
    const [hoveredIndex, setHoveredIndex] = useState(null)

    if (!data || data.length === 0) {
      return (
        <div className="admin-empty-chart">
          <ClockIcon />
          <span>No playback activity recorded for this timeframe.</span>
        </div>
      )
    }

    const values = data.map(d => {
      if (metric === 'plays') return d.plays || 0
      if (metric === 'users') return d.active_users || 0
      return d.seconds || 0
    })
    const maxVal = Math.max(...values, 1)

    const width = 850
    const height = 240
    const paddingLeft = 55
    const paddingRight = 20
    const paddingTop = 25
    const paddingBottom = 40
    const chartWidth = width - paddingLeft - paddingRight
    const chartHeight = height - paddingTop - paddingBottom

    const barCount = data.length
    const barWidth = Math.max(6, Math.min(32, (chartWidth / barCount) * 0.65))
    const gap = barCount > 1 ? (chartWidth - (barWidth * barCount)) / (barCount - 1) : 0

    return (
      <div className="primary-chart-container">
        <svg viewBox={`0 0 ${width} ${height}`} className="primary-chart-svg">
          <defs>
            <linearGradient id="primaryChartGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--emerald)" stopOpacity="1" />
              <stop offset="100%" stopColor="var(--emerald-dim)" stopOpacity="0.4" />
            </linearGradient>
            <linearGradient id="hoverChartGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--emerald-hi)" stopOpacity="1" />
              <stop offset="100%" stopColor="var(--emerald)" stopOpacity="0.8" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
            const y = paddingTop + chartHeight * (1 - ratio)
            const labelVal = Math.round(maxVal * ratio)
            let formattedLabel = formatDuration(labelVal)
            if (metric === 'plays') formattedLabel = `${labelVal} plays`
            if (metric === 'users') formattedLabel = `${labelVal} users`

            return (
              <g key={idx}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={width - paddingRight}
                  y2={y}
                  stroke="var(--border)"
                  strokeWidth="1"
                  strokeDasharray="3,3"
                />
                <text
                  x={paddingLeft - 10}
                  y={y + 3}
                  fill="var(--text-dim)"
                  fontSize="10"
                  fontWeight="600"
                  textAnchor="end"
                >
                  {formattedLabel}
                </text>
              </g>
            )
          })}

          {/* Bars & Hover regions */}
          {data.map((dp, i) => {
            const val = values[i]
            const barHeight = maxVal > 0 ? (val / maxVal) * chartHeight : 0
            const x = paddingLeft + i * (barWidth + gap)
            const y = height - paddingBottom - barHeight
            const isHovered = hoveredIndex === i

            return (
              <g
                key={dp.key || i}
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
                style={{ cursor: 'pointer' }}
              >
                {/* Full column invisible hover region */}
                <rect
                  x={x - (gap / 2)}
                  y={paddingTop}
                  width={barWidth + gap}
                  height={chartHeight}
                  fill={isHovered ? 'rgba(255, 255, 255, 0.04)' : 'transparent'}
                />

                {/* Animated bar */}
                {barHeight > 0 && (
                  <rect
                    x={x}
                    y={y}
                    width={barWidth}
                    height={barHeight}
                    fill={isHovered ? 'url(#hoverChartGrad)' : 'url(#primaryChartGrad)'}
                    rx="4"
                    ry="4"
                    style={{ transition: 'all 0.25s ease' }}
                  />
                )}

                {/* X Axis Label */}
                {(data.length <= 14 || i % Math.ceil(data.length / 12) === 0) && (
                  <text
                    x={x + barWidth / 2}
                    y={height - paddingBottom + 16}
                    fill={isHovered ? 'var(--text)' : 'var(--text-dim)'}
                    fontSize="9"
                    fontWeight={isHovered ? '700' : '600'}
                    textAnchor="middle"
                  >
                    {dp.label}
                  </text>
                )}
              </g>
            )
          })}
        </svg>

        {/* Hover Tooltip Overlay */}
        {hoveredIndex !== null && data[hoveredIndex] && (
          <div className="chart-floating-tooltip">
            <div className="tooltip-title">{data[hoveredIndex].full_label || data[hoveredIndex].label}</div>
            <div className="tooltip-row">
              <span className="tooltip-label">Listening Time:</span>
              <span className="tooltip-value">{formatDuration(data[hoveredIndex].seconds)} ({data[hoveredIndex].hours || 0} hrs)</span>
            </div>
            <div className="tooltip-row">
              <span className="tooltip-label">Stream Plays:</span>
              <span className="tooltip-value">{data[hoveredIndex].plays || 0}</span>
            </div>
            {data[hoveredIndex].active_users !== undefined && (
              <div className="tooltip-row">
                <span className="tooltip-label">Active Users:</span>
                <span className="tooltip-value">{data[hoveredIndex].active_users}</span>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // 24-Hour Diurnal Heatmap Bar Chart
  function DiurnalHeatmapChart({ data }) {
    if (!data || data.length === 0) return null
    const maxVal = Math.max(...data.map(d => d.seconds), 1)

    return (
      <div className="diurnal-heatmap-wrapper">
        <div className="diurnal-bars-row">
          {data.map((dp) => {
            const ratio = maxVal > 0 ? dp.seconds / maxVal : 0
            const heightPct = Math.max(6, Math.round(ratio * 100))
            const isPeak = ratio >= 0.85 && dp.seconds > 0

            return (
              <div key={dp.hour} className="diurnal-col" title={`${dp.full_label}: ${formatDuration(dp.seconds)} (${dp.plays} plays)`}>
                <div className="diurnal-bar-track">
                  <div
                    className={`diurnal-bar-fill ${isPeak ? 'peak' : ''}`}
                    style={{
                      height: `${heightPct}%`,
                      backgroundColor: isPeak ? 'var(--emerald-hi)' : ratio > 0.4 ? 'var(--emerald)' : 'var(--emerald-dim)'
                    }}
                  />
                </div>
                <span className="diurnal-label">{dp.hour % 3 === 0 ? dp.label : ''}</span>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // Day of Week Distribution Chart
  function WeekdayChart({ data }) {
    if (!data || data.length === 0) return null
    const maxVal = Math.max(...data.map(d => d.seconds), 1)

    return (
      <div className="weekday-chart-list">
        {data.map((d) => {
          const ratio = maxVal > 0 ? (d.seconds / maxVal) : 0
          const widthPct = Math.max(4, Math.round(ratio * 100))

          return (
            <div key={d.label} className="weekday-row">
              <span className="weekday-name">{d.label}</span>
              <div className="weekday-bar-bg">
                <div className="weekday-bar-fill" style={{ width: `${widthPct}%` }} />
              </div>
              <span className="weekday-duration">{formatDuration(d.seconds)}</span>
              <span className="weekday-pct">{d.percentage}%</span>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="admin-layout" data-theme={theme}>
      {/* Styles */}
      <style>{`
        .admin-layout {
          height: 100vh;
          min-height: 100vh;
          overflow-y: auto;
          overflow-x: hidden;
          background-color: var(--bg);
          color: var(--text);
          font-family: 'Inter', sans-serif;
          display: flex;
          flex-direction: column;
          scroll-behavior: smooth;
        }

        .admin-layout::-webkit-scrollbar {
          width: 8px;
        }
        .admin-layout::-webkit-scrollbar-track {
          background: var(--bg);
        }
        .admin-layout::-webkit-scrollbar-thumb {
          background: var(--border);
          border-radius: 4px;
        }
        .admin-layout::-webkit-scrollbar-thumb:hover {
          background: var(--border-hi);
        }

        .admin-navbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 28px;
          background: var(--surface);
          border-bottom: 1px solid var(--border);
          position: sticky;
          top: 0;
          z-index: 100;
          backdrop-filter: blur(16px);
        }

        .admin-brand {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .admin-brand-icon {
          width: 32px;
          height: 32px;
          border-radius: var(--radius-sm);
          background: linear-gradient(135deg, var(--emerald), var(--emerald-dim));
          display: flex;
          align-items: center;
          justify-content: center;
          color: #000;
        }

        .admin-brand-title {
          font-size: 1.05rem;
          font-weight: 800;
          letter-spacing: -0.02em;
        }

        .admin-live-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(52, 211, 153, 0.12);
          border: 1px solid var(--emerald);
          color: var(--emerald);
          padding: 2px 8px;
          border-radius: 20px;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.15em;
          text-transform: uppercase;
        }

        .live-dot-pulse {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--emerald);
          box-shadow: 0 0 0 0 rgba(52, 211, 153, 0.7);
          animation: pulseGreen 1.5s infinite;
        }

        @keyframes pulseGreen {
          0% { box-shadow: 0 0 0 0 rgba(52, 211, 153, 0.7); }
          70% { box-shadow: 0 0 0 6px rgba(52, 211, 153, 0); }
          100% { box-shadow: 0 0 0 0 rgba(52, 211, 153, 0); }
        }

        .admin-navbar-actions {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .admin-nav-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          border-radius: var(--radius-sm);
          border: 1px solid var(--border);
          background: var(--card);
          color: var(--text);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.05em;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .admin-nav-btn:hover {
          background: var(--card-hover);
          border-color: var(--border-hi);
          transform: translateY(-1px);
        }

        .admin-nav-btn.primary {
          background: var(--emerald);
          color: #000;
          border-color: var(--emerald);
        }
        .admin-nav-btn.primary:hover {
          background: var(--emerald-hi);
        }

        /* Controls Subheader */
        .admin-controls-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 28px;
          background: var(--surface);
          border-bottom: 1px solid var(--border);
          flex-wrap: wrap;
          gap: 12px;
        }

        .admin-tabs-list {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }

        .admin-tab-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          border-radius: var(--radius-sm);
          border: 1px solid transparent;
          background: transparent;
          color: var(--text-sub);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .admin-tab-btn:hover {
          color: var(--text);
          background: var(--card);
        }
        .admin-tab-btn.active {
          background: var(--emerald);
          color: #000;
          border-color: var(--emerald);
          box-shadow: 0 2px 10px rgba(52, 211, 153, 0.25);
        }

        .admin-timeframe-toolbar {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .timeframe-pill-group {
          display: flex;
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          overflow: hidden;
        }

        .timeframe-pill {
          padding: 6px 12px;
          border: none;
          background: transparent;
          color: var(--text-sub);
          font-size: 10px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .timeframe-pill:hover {
          color: var(--text);
        }
        .timeframe-pill.active {
          background: var(--emerald);
          color: #000;
        }

        .custom-range-inputs {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
        }
        .custom-range-inputs input {
          background: var(--card);
          border: 1px solid var(--border);
          color: var(--text);
          padding: 5px 8px;
          border-radius: var(--radius-sm);
          font-size: 11px;
        }

        /* Dashboard Body */
        .admin-content {
          padding: 28px;
          max-width: 1400px;
          width: 100%;
          margin: 0 auto;
          flex: 1;
        }

        /* KPI Cards Grid */
        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
          margin-bottom: 24px;
        }

        .kpi-card {
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: var(--radius-card);
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          transition: transform 0.2s ease, border-color 0.2s ease;
        }
        .kpi-card:hover {
          border-color: var(--border-hi);
          transform: translateY(-2px);
        }

        .kpi-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          color: var(--text-dim);
        }
        .kpi-label {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.15em;
        }
        .kpi-icon {
          color: var(--emerald);
        }

        .kpi-value {
          font-size: 1.8rem;
          font-weight: 800;
          letter-spacing: -0.03em;
          color: var(--text);
          line-height: 1.1;
        }

        .kpi-subtext {
          font-size: 11px;
          color: var(--text-sub);
        }

        /* Panels & Cards */
        .admin-panel {
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: var(--radius-card);
          padding: 24px;
          margin-bottom: 24px;
        }

        .admin-panel-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 18px;
          flex-wrap: wrap;
          gap: 12px;
        }

        .admin-panel-title {
          font-size: 1.15rem;
          font-weight: 800;
          letter-spacing: -0.02em;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .admin-panel-subtitle {
          font-size: 12px;
          color: var(--text-sub);
          margin-top: 2px;
        }

        /* Chart Styling */
        .primary-chart-container {
          position: relative;
          width: 100%;
          overflow-x: auto;
        }
        .primary-chart-svg {
          width: 100%;
          min-width: 600px;
          height: auto;
          display: block;
        }

        .chart-floating-tooltip {
          position: absolute;
          top: 10px;
          right: 20px;
          background: var(--surface);
          border: 1px solid var(--border-hi);
          border-radius: var(--radius-sm);
          padding: 10px 14px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
          pointer-events: none;
          z-index: 10;
        }
        .tooltip-title {
          font-size: 11px;
          font-weight: 700;
          color: var(--emerald);
          margin-bottom: 4px;
        }
        .tooltip-row {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          font-size: 11px;
        }
        .tooltip-label { color: var(--text-dim); }
        .tooltip-value { color: var(--text); font-weight: 600; }

        .admin-empty-chart {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 180px;
          gap: 8px;
          color: var(--text-dim);
          font-size: 12px;
        }

        /* Diurnal & Weekday Breakdown */
        .diurnal-heatmap-wrapper {
          padding: 16px 0 8px;
        }
        .diurnal-bars-row {
          display: flex;
          align-items: flex-end;
          gap: 4px;
          height: 120px;
        }
        .diurnal-col {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          height: 100%;
          cursor: pointer;
        }
        .diurnal-bar-track {
          flex: 1;
          width: 100%;
          background: rgba(255, 255, 255, 0.03);
          border-radius: 4px;
          display: flex;
          align-items: flex-end;
          overflow: hidden;
        }
        .diurnal-bar-fill {
          width: 100%;
          border-radius: 4px;
          transition: height 0.3s ease;
        }
        .diurnal-label {
          font-size: 8px;
          font-weight: 700;
          color: var(--text-dim);
          margin-top: 6px;
        }

        .weekday-chart-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .weekday-row {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 11px;
        }
        .weekday-name {
          width: 32px;
          font-weight: 700;
          color: var(--text-sub);
        }
        .weekday-bar-bg {
          flex: 1;
          height: 8px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 4px;
          overflow: hidden;
        }
        .weekday-bar-fill {
          height: 100%;
          background: var(--emerald);
          border-radius: 4px;
          transition: width 0.3s ease;
        }
        .weekday-duration {
          width: 70px;
          text-align: right;
          font-weight: 600;
        }
        .weekday-pct {
          width: 40px;
          text-align: right;
          color: var(--text-dim);
        }

        /* 2 Column Layout */
        .admin-grid-2col {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
          margin-bottom: 24px;
        }
        @media (max-width: 900px) {
          .admin-grid-2col {
            grid-template-columns: 1fr;
          }
        }

        /* Data Tables */
        .admin-table-container {
          overflow-x: auto;
        }
        .admin-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
          font-size: 12px;
        }
        .admin-table th {
          padding: 12px 14px;
          border-bottom: 1px solid var(--border);
          color: var(--text-dim);
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.1em;
        }
        .admin-table td {
          padding: 12px 14px;
          border-bottom: 1px solid var(--border);
          color: var(--text-sub);
        }
        .admin-table tr:hover td {
          background: var(--card-hover);
          color: var(--text);
        }

        .track-rank-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: var(--surface);
          color: var(--emerald);
          font-weight: 700;
          font-size: 11px;
        }

        .rank-bar-bg {
          height: 4px;
          background: rgba(255, 255, 255, 0.08);
          border-radius: 2px;
          margin-top: 4px;
          overflow: hidden;
          width: 100px;
        }
        .rank-bar-fill {
          height: 100%;
          background: var(--emerald);
          border-radius: 2px;
        }

        /* Live Session Cards */
        .live-sessions-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 16px;
        }
        .live-card {
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: var(--radius-card);
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .live-card-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .live-card-user {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .live-user-avatar {
          width: 30px;
          height: 30px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 12px;
          color: #fff;
        }
        .live-card-song {
          font-size: 13px;
          font-weight: 700;
          color: var(--text);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .live-card-artist {
          font-size: 11px;
          color: var(--text-sub);
        }

        /* Users Grid */
        .users-grid-layout {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 16px;
        }
        .user-mgmt-card {
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: var(--radius-card);
          padding: 18px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .user-mgmt-card:hover {
          border-color: var(--border-hi);
          transform: translateY(-2px);
        }
        .user-card-top {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .user-big-avatar {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          font-weight: 800;
          color: #fff;
        }
        .role-tag {
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 9px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.1em;
        }
        .role-tag.admin { background: rgba(52, 211, 153, 0.2); color: var(--emerald); }
        .role-tag.user { background: rgba(255, 255, 255, 0.08); color: var(--text-sub); }

        .user-card-actions {
          display: flex;
          gap: 8px;
          margin-top: 4px;
        }
        .user-action-btn {
          flex: 1;
          padding: 7px 10px;
          border-radius: var(--radius-sm);
          border: 1px solid var(--border);
          background: var(--surface);
          color: var(--text);
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .user-action-btn:hover {
          background: var(--card-hover);
          border-color: var(--border-hi);
        }
        .user-action-btn.delete {
          color: var(--red);
          border-color: rgba(239, 68, 68, 0.2);
        }
        .user-action-btn.delete:hover {
          background: rgba(239, 68, 68, 0.1);
        }

        /* Filter Toolbar */
        .admin-filter-toolbar {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 20px;
          flex-wrap: wrap;
        }
        .admin-input-search {
          background: var(--card);
          border: 1px solid var(--border);
          color: var(--text);
          padding: 8px 14px;
          border-radius: var(--radius-sm);
          font-size: 12px;
          min-width: 220px;
        }
        .admin-select-input {
          background: var(--card);
          border: 1px solid var(--border);
          color: var(--text);
          padding: 8px 12px;
          border-radius: var(--radius-sm);
          font-size: 12px;
          cursor: pointer;
        }

        /* Modals */
        .admin-modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.75);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }
        .admin-modal {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-card);
          width: 100%;
          max-width: 520px;
          max-height: 90vh;
          overflow-y: auto;
          padding: 28px;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6);
        }
        .modal-title {
          font-size: 1.25rem;
          font-weight: 800;
          margin-bottom: 20px;
        }
        .form-row {
          margin-bottom: 16px;
        }
        .form-label {
          display: block;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: var(--text-dim);
          margin-bottom: 6px;
        }
        .form-input-text {
          width: 100%;
          background: var(--card);
          border: 1px solid var(--border);
          color: var(--text);
          padding: 10px 14px;
          border-radius: var(--radius-sm);
          font-size: 13px;
        }
        .modal-btn-row {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          margin-top: 24px;
        }

        .alert-banner {
          padding: 10px 16px;
          border-radius: var(--radius-sm);
          font-size: 12px;
          margin-bottom: 16px;
        }
        .alert-banner.error { background: rgba(239, 68, 68, 0.15); border: 1px solid var(--red); color: #fca5a5; }
        .alert-banner.success { background: rgba(52, 211, 153, 0.15); border: 1px solid var(--emerald); color: var(--emerald-hi); }
      `}</style>

      {/* Top Navigation Bar */}
      <header className="admin-navbar">
        <div className="admin-brand">
          <div className="admin-brand-icon">
            <MusicIcon />
          </div>
          <div>
            <div className="admin-brand-title">Sangita Admin Console</div>
          </div>
          <div className="admin-live-pill">
            <span className="live-dot-pulse" />
            <span>Active Telemetry</span>
          </div>
        </div>

        <div className="admin-navbar-actions">
          <div className="admin-tz-wrapper" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.05em' }}>TZ:</span>
            <select
              value={timezone}
              onChange={e => setTimezone(e.target.value)}
              className="admin-select-input admin-tz-select"
              style={{ padding: '6px 10px', fontSize: 11, fontWeight: 600, height: 34 }}
              title="Select Timezone (Default: IST / Asia/Kolkata)"
              data-testid="admin-tz-select"
            >
              <option value="Asia/Kolkata">IST · Kolkata (+5:30)</option>
              <option value="UTC">UTC · GMT (0:00)</option>
              <option value="auto">Auto (Browser: {browserTz})</option>
              <option value="America/New_York">EST · New York</option>
              <option value="America/Los_Angeles">PST · Los Angeles</option>
              <option value="America/Chicago">CST · Chicago</option>
              <option value="Europe/London">GMT/BST · London</option>
              <option value="Europe/Paris">CET · Paris</option>
              <option value="Europe/Berlin">CET · Berlin</option>
              <option value="Asia/Dubai">GST · Dubai (+4:00)</option>
              <option value="Asia/Singapore">SGT · Singapore (+8:00)</option>
              <option value="Asia/Tokyo">JST · Tokyo (+9:00)</option>
              <option value="Australia/Sydney">AEST · Sydney (+10:00)</option>
            </select>
          </div>
          <button className="admin-nav-btn primary" onClick={onBackToPlayer} title="Return to Music Player" data-testid="admin-back-btn">
            <BackIcon />
            <span>Back to Player</span>
          </button>
          <button className="admin-nav-btn" onClick={onCycleTheme} title="Toggle Dark/Light Mode">
            <ThemeIcon theme={theme} />
          </button>
          <button className="admin-nav-btn" onClick={onLogout} title="Sign Out">
            <span>Logout</span>
          </button>
        </div>
      </header>

      {/* Subheader Toolbar */}
      <div className="admin-controls-bar">
        <div className="admin-tabs-list">
          <button
            className={`admin-tab-btn ${activeTab === 'analytics' && !selectedUser ? 'active' : ''}`}
            onClick={() => { setActiveTab('analytics'); setSelectedUser(null); }}
            data-testid="admin-tab-analytics"
          >
            <ActivityIcon />
            <span>Overview & Analytics</span>
          </button>
          <button
            className={`admin-tab-btn ${activeTab === 'music' && !selectedUser ? 'active' : ''}`}
            onClick={() => { setActiveTab('music'); setSelectedUser(null); }}
            data-testid="admin-tab-music"
          >
            <MusicIcon />
            <span>Music & Catalog</span>
          </button>
          <button
            className={`admin-tab-btn ${activeTab === 'live' && !selectedUser ? 'active' : ''}`}
            onClick={() => { setActiveTab('live'); setSelectedUser(null); }}
            data-testid="admin-tab-live"
          >
            <FlameIcon />
            <span>Live & Stream Logs</span>
          </button>
          <button
            className={`admin-tab-btn ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => { setActiveTab('users'); }}
            data-testid="admin-tab-users"
          >
            <UsersIcon />
            <span>User Accounts</span>
          </button>
          <button
            className={`admin-tab-btn ${activeTab === 'system' && !selectedUser ? 'active' : ''}`}
            onClick={() => { setActiveTab('system'); setSelectedUser(null); }}
            data-testid="admin-tab-system"
          >
            <DeviceIcon />
            <span>System Health</span>
          </button>
        </div>

        {/* Global Timeframe Selector for Analytics & Music tabs */}
        {(activeTab === 'analytics' || activeTab === 'music') && !selectedUser && (
          <div className="admin-timeframe-toolbar">
            <div className="timeframe-pill-group">
              {['24h', '7d', '30d', '90d', 'all', 'custom'].map((tf) => (
                <button
                  key={tf}
                  className={`timeframe-pill ${timeframe === tf ? 'active' : ''}`}
                  onClick={() => setTimeframe(tf)}
                  data-testid={`timeframe-btn-${tf}`}
                >
                  {tf === '24h' ? '24 Hours' : tf === '7d' ? '7 Days' : tf === '30d' ? '30 Days' : tf === '90d' ? '90 Days' : tf === 'all' ? 'All Time' : 'Custom'}
                </button>
              ))}
            </div>

            {timeframe === 'custom' && (
              <div className="custom-range-inputs">
                <input
                  type="date"
                  value={customStartDate}
                  onChange={e => setCustomStartDate(e.target.value)}
                  title="Start Date"
                />
                <span>to</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={e => setCustomEndDate(e.target.value)}
                  title="End Date"
                />
                <button className="admin-nav-btn" onClick={fetchAnalytics}>Apply</button>
              </div>
            )}

            <button className="admin-nav-btn" onClick={fetchAnalytics} title="Refresh Telemetry">
              <RefreshIcon />
            </button>
            <button className="admin-nav-btn" onClick={handleExportCSV} title="Export CSV Report" data-testid="admin-export-btn">
              <DownloadIcon />
              <span>Export CSV</span>
            </button>
          </div>
        )}
      </div>

      {/* Notifications */}
      <div className="admin-content">
        {error && <div className="alert-banner error">{error}</div>}
        {success && <div className="alert-banner success">{success}</div>}

        {/* =========================================================================
            USER DETAIL PROFILE SUBVIEW
           ========================================================================= */}
        {selectedUser ? (
          <div className="user-detail-subview">
            <button className="admin-nav-btn" onClick={() => { setSelectedUser(null); setUserDetailStats(null); }} style={{ marginBottom: 20 }} data-testid="user-detail-back-btn">
              <BackIcon />
              <span>Back to User List</span>
            </button>

            {userDetailStats && (
              <>
                <div className="admin-panel user-profile-header">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <div
                        className="user-big-avatar"
                        style={{
                          width: '64px',
                          height: '64px',
                          fontSize: '24px',
                          background: `linear-gradient(135deg, hsl(${strHue(userDetailStats.username)}, 70%, 40%), hsl(${(strHue(userDetailStats.username)+60)%360}, 70%, 25%))`
                        }}
                      >
                        {userDetailStats.username.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h2 style={{ fontSize: '1.8rem', fontWeight: 800 }}>{userDetailStats.username}</h2>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                          <span className={`role-tag ${userDetailStats.role}`}>{userDetailStats.role}</span>
                          {getUserLiveStatus(userDetailStats.username) && (
                            <div className="admin-live-pill">
                              <span className="live-dot-pulse" />
                              <span>Listening Now</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <button className="admin-nav-btn primary" onClick={() => openEditUserModal(userDetailStats)}>
                      <EditIcon />
                      <span>Edit Permissions</span>
                    </button>
                  </div>
                </div>

                {/* User KPIs */}
                <div className="kpi-grid">
                  <div className="kpi-card">
                    <div className="kpi-header">
                      <span className="kpi-label">Period Listening</span>
                      <ClockIcon />
                    </div>
                    <div className="kpi-value">{formatDuration(userDetailStats.total_seconds)}</div>
                    <div className="kpi-subtext">{userDetailStats.total_plays || 0} track plays logged</div>
                  </div>
                  <div className="kpi-card">
                    <div className="kpi-header">
                      <span className="kpi-label">Daily Average</span>
                      <ActivityIcon />
                    </div>
                    <div className="kpi-value">{formatDuration(userDetailStats.avg_daily_seconds)}</div>
                    <div className="kpi-subtext">Average daily listen time</div>
                  </div>
                  <div className="kpi-card">
                    <div className="kpi-header">
                      <span className="kpi-label">Last Active</span>
                      <DeviceIcon />
                    </div>
                    <div className="kpi-value" style={{ fontSize: '1.2rem', height: '2rem', display: 'flex', alignItems: 'center' }}>
                      {userDetailStats.last_seen ? formatTimestamp(userDetailStats.last_seen, effectiveTz) : 'Never'}
                    </div>
                    <div className="kpi-subtext">Most recent heartbeat</div>
                  </div>
                </div>

                {/* User Timeline Breakdown Chart */}
                <div className="admin-panel">
                  <div className="admin-panel-header">
                    <div>
                      <div className="admin-panel-title">User Listening Breakdown</div>
                      <div className="admin-panel-subtitle">Listening volume across selected period</div>
                    </div>
                    <div className="timeframe-pill-group">
                      {['24h', '7d', '30d', '90d', 'custom'].map(tf => (
                        <button
                          key={tf}
                          className={`timeframe-pill ${detailTimeframe === tf ? 'active' : ''}`}
                          onClick={() => setDetailTimeframe(tf)}
                        >
                          {tf}
                        </button>
                      ))}
                    </div>
                  </div>
                  <PrimaryTimelineChart data={userDetailStats.graph_data} metric="seconds" />
                </div>

                {/* Most played by user */}
                <div className="admin-grid-2col">
                  <div className="admin-panel">
                    <div className="admin-panel-header">
                      <div className="admin-panel-title">User's Top Tracks</div>
                    </div>
                    {(!userDetailStats.most_played || userDetailStats.most_played.length === 0) ? (
                      <p className="no-data-msg">No playback events for this user.</p>
                    ) : (
                      <div className="admin-table-container">
                        <table className="admin-table">
                          <thead>
                            <tr>
                              <th>Track</th>
                              <th>Playlist</th>
                              <th>Duration</th>
                              <th>Plays</th>
                            </tr>
                          </thead>
                          <tbody>
                            {userDetailStats.most_played.map((t, idx) => (
                              <tr key={t.track_id}>
                                <td>
                                  <div style={{ fontWeight: 700, color: 'var(--text)' }}>{t.name}</div>
                                  <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>{t.artist}</div>
                                </td>
                                <td>{t.playlist}</td>
                                <td><strong>{formatDuration(t.total_seconds)}</strong></td>
                                <td>{t.pings}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  <div className="admin-panel">
                    <div className="admin-panel-header">
                      <div className="admin-panel-title">Allowed Playlists</div>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '16px 0' }}>
                      {userDetailStats.rules?.allowed_playlists?.includes('*') ? (
                        <span className="role-tag admin" style={{ fontSize: '12px', padding: '6px 12px' }}>All Playlists (*)</span>
                      ) : !userDetailStats.rules?.allowed_playlists || userDetailStats.rules.allowed_playlists.length === 0 ? (
                        <span className="role-tag user" style={{ fontSize: '12px', padding: '6px 12px' }}>No Playlists (Muted)</span>
                      ) : (
                        userDetailStats.rules.allowed_playlists.map(pl => (
                          <span key={pl} className="role-tag user" style={{ fontSize: '11px', padding: '6px 10px' }}>{pl}</span>
                        ))
                      )}
                    </div>
                    <button className="admin-nav-btn" onClick={() => openEditUserModal(userDetailStats)}>
                      <EditIcon />
                      <span>Modify Access Rules</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : activeTab === 'analytics' ? (
          /* =========================================================================
              TAB 1: OVERVIEW & ANALYTICS
             ========================================================================= */
          <div className="analytics-tab-view" data-testid="analytics-tab-content">
            {/* 6 Executive KPI Metric Cards */}
            <div className="kpi-grid">
              <div className="kpi-card" data-testid="kpi-total-time">
                <div className="kpi-header">
                  <span className="kpi-label">Total Listening</span>
                  <ClockIcon />
                </div>
                <div className="kpi-value">{formatDuration(analytics?.kpis?.total_seconds)}</div>
                <div className="kpi-subtext">{analytics?.kpis?.total_hours || 0} hours audio streamed</div>
              </div>

              <div className="kpi-card" data-testid="kpi-total-plays">
                <div className="kpi-header">
                  <span className="kpi-label">Stream Plays</span>
                  <ActivityIcon />
                </div>
                <div className="kpi-value">{formatNumber(analytics?.kpis?.total_plays)}</div>
                <div className="kpi-subtext">Individual track streams</div>
              </div>

              <div className="kpi-card" data-testid="kpi-peak-hour">
                <div className="kpi-header">
                  <span className="kpi-label">Peak Listening Hour</span>
                  <FlameIcon />
                </div>
                <div className="kpi-value" style={{ fontSize: '1.25rem', height: '2rem', display: 'flex', alignItems: 'center' }}>
                  {analytics?.kpis?.peak_hour?.label || 'N/A'}
                </div>
                <div className="kpi-subtext">{formatDuration(analytics?.kpis?.peak_hour?.seconds)} ({analytics?.kpis?.peak_hour?.percentage}%)</div>
              </div>

              <div className="kpi-card" data-testid="kpi-daily-avg">
                <div className="kpi-header">
                  <span className="kpi-label">Daily Avg / User</span>
                  <UsersIcon />
                </div>
                <div className="kpi-value">{formatDuration(analytics?.kpis?.avg_daily_seconds)}</div>
                <div className="kpi-subtext">Daily active user engagement</div>
              </div>

              <div className="kpi-card" data-testid="kpi-session-length">
                <div className="kpi-header">
                  <span className="kpi-label">Avg Session Length</span>
                  <ClockIcon />
                </div>
                <div className="kpi-value">{formatDuration(analytics?.kpis?.avg_session_seconds)}</div>
                <div className="kpi-subtext">Continuous playback session</div>
              </div>

              <div className="kpi-card" data-testid="kpi-active-listeners">
                <div className="kpi-header">
                  <span className="kpi-label">Active Listeners</span>
                  <UsersIcon />
                </div>
                <div className="kpi-value">{analytics?.kpis?.unique_listeners || 0}</div>
                <div className="kpi-subtext">{analytics?.kpis?.active_devices || 0} connected devices</div>
              </div>
            </div>

            {/* Primary Interactive Time-Series Chart */}
            <div className="admin-panel">
              <div className="admin-panel-header">
                <div>
                  <div className="admin-panel-title">
                    <ActivityIcon />
                    <span>Listening Volume & Stream Trends</span>
                  </div>
                  <div className="admin-panel-subtitle">Interactive aggregate metrics over selected timeframe</div>
                </div>

                <div className="timeframe-pill-group">
                  <button
                    className={`timeframe-pill ${analyticsMetric === 'seconds' ? 'active' : ''}`}
                    onClick={() => setAnalyticsMetric('seconds')}
                    data-testid="metric-btn-seconds"
                  >
                    Listening Time
                  </button>
                  <button
                    className={`timeframe-pill ${analyticsMetric === 'plays' ? 'active' : ''}`}
                    onClick={() => setAnalyticsMetric('plays')}
                    data-testid="metric-btn-plays"
                  >
                    Stream Plays
                  </button>
                  <button
                    className={`timeframe-pill ${analyticsMetric === 'users' ? 'active' : ''}`}
                    onClick={() => setAnalyticsMetric('users')}
                    data-testid="metric-btn-users"
                  >
                    Active Users
                  </button>
                </div>
              </div>

              <PrimaryTimelineChart data={analytics?.timeline} metric={analyticsMetric} />
            </div>

            {/* Peak Usage & Diurnal Heatmap Section */}
            <div className="admin-grid-2col">
              <div className="admin-panel">
                <div className="admin-panel-header">
                  <div>
                    <div className="admin-panel-title">
                      <FlameIcon />
                      <span>24-Hour Diurnal Peak Usage</span>
                    </div>
                    <div className="admin-panel-subtitle">Aggregate listening volume by hour of day (00:00 – 23:00)</div>
                  </div>
                </div>
                <DiurnalHeatmapChart data={analytics?.hourly_distribution} />
                <div style={{ marginTop: 14, fontSize: '11px', color: 'var(--text-sub)' }}>
                  🔥 Peak listening traffic occurs around <strong>{analytics?.kpis?.peak_hour?.label}</strong>.
                </div>
              </div>

              <div className="admin-panel">
                <div className="admin-panel-header">
                  <div>
                    <div className="admin-panel-title">
                      <ClockIcon />
                      <span>Day-of-Week Listening</span>
                    </div>
                    <div className="admin-panel-subtitle">Traffic distribution across Monday – Sunday</div>
                  </div>
                </div>
                <WeekdayChart data={analytics?.weekday_distribution} />
              </div>
            </div>

            {/* Platform & Client Telemetry */}
            <div className="admin-panel">
              <div className="admin-panel-header">
                <div>
                  <div className="admin-panel-title">
                    <DeviceIcon />
                    <span>Client & Platform Telemetry</span>
                  </div>
                  <div className="admin-panel-subtitle">Device types, operating systems, and web browsers</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 24 }}>
                {/* Devices */}
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 10 }}>Device Types</div>
                  {(analytics?.device_stats || []).map(d => (
                    <div key={d.device_type} style={{ marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: 2 }}>
                        <span style={{ textTransform: 'capitalize' }}>{d.device_type}</span>
                        <span>{d.percentage}% ({formatDuration(d.total_seconds)})</span>
                      </div>
                      <div style={{ height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: `${d.percentage}%`, height: '100%', background: 'var(--emerald)' }} />
                      </div>
                    </div>
                  ))}
                </div>

                {/* OS */}
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 10 }}>Operating Systems</div>
                  {(analytics?.os_stats || []).map(o => (
                    <div key={o.os} style={{ marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: 2 }}>
                        <span>{o.os}</span>
                        <span>{o.percentage}% ({formatDuration(o.total_seconds)})</span>
                      </div>
                      <div style={{ height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: `${o.percentage}%`, height: '100%', background: 'var(--emerald-hi)' }} />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Browsers */}
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 10 }}>Web Browsers</div>
                  {(analytics?.browser_stats || []).map(b => (
                    <div key={b.browser} style={{ marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: 2 }}>
                        <span>{b.browser}</span>
                        <span>{b.percentage}% ({formatDuration(b.total_seconds)})</span>
                      </div>
                      <div style={{ height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: `${b.percentage}%`, height: '100%', background: 'var(--accent)' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : activeTab === 'music' ? (
          /* =========================================================================
              TAB 2: MUSIC & CATALOG ANALYTICS
             ========================================================================= */
          <div className="music-tab-view" data-testid="music-tab-content">
            {/* Top 20 Most Played Songs */}
            <div className="admin-panel">
              <div className="admin-panel-header">
                <div>
                  <div className="admin-panel-title">
                    <MusicIcon />
                    <span>Top 20 Most Played Tracks</span>
                  </div>
                  <div className="admin-panel-subtitle">Tracks ranked by accumulated stream time in timeframe</div>
                </div>
              </div>

              {(!analytics?.top_tracks || analytics.top_tracks.length === 0) ? (
                <p className="no-data-msg">No track playback events recorded for this timeframe.</p>
              ) : (
                <div className="admin-table-container">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th style={{ width: 40 }}>#</th>
                        <th>Song Title & Artist</th>
                        <th>Playlist</th>
                        <th>Stream Time</th>
                        <th>Play Count</th>
                        <th>Unique Listeners</th>
                        <th>Last Streamed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.top_tracks.map((t, idx) => {
                        const topSec = analytics.top_tracks[0]?.total_seconds || 1
                        const pct = Math.max(8, Math.round((t.total_seconds / topSec) * 100))

                        return (
                          <tr key={t.track_id}>
                            <td>
                              <span className="track-rank-badge">#{idx + 1}</span>
                            </td>
                            <td>
                              <div style={{ fontWeight: 700, color: 'var(--text)' }}>{t.name}</div>
                              <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{t.artist}</div>
                            </td>
                            <td>{t.playlist}</td>
                            <td>
                              <div style={{ fontWeight: 700 }}>{formatDuration(t.total_seconds)}</div>
                              <div className="rank-bar-bg">
                                <div className="rank-bar-fill" style={{ width: `${pct}%` }} />
                              </div>
                            </td>
                            <td>{t.play_count}</td>
                            <td>{t.unique_listeners}</td>
                            <td>{t.last_played ? formatTimestamp(t.last_played, effectiveTz) : 'N/A'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Top Artists and Playlists Grid */}
            <div className="admin-grid-2col">
              {/* Artists */}
              <div className="admin-panel">
                <div className="admin-panel-header">
                  <div className="admin-panel-title">Top Artists Leaderboard</div>
                </div>
                {(!analytics?.top_artists || analytics.top_artists.length === 0) ? (
                  <p className="no-data-msg">No artist stats available.</p>
                ) : (
                  <div className="admin-table-container">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Artist</th>
                          <th>Streams</th>
                          <th>Duration</th>
                          <th>Catalog</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analytics.top_artists.map(a => (
                          <tr key={a.artist}>
                            <td style={{ fontWeight: 700, color: 'var(--text)' }}>{a.artist}</td>
                            <td>{a.play_count}</td>
                            <td>{formatDuration(a.total_seconds)}</td>
                            <td>{a.track_count} songs</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Playlists */}
              <div className="admin-panel">
                <div className="admin-panel-header">
                  <div className="admin-panel-title">Top Playlists Activity</div>
                </div>
                {(!analytics?.top_playlists || analytics.top_playlists.length === 0) ? (
                  <p className="no-data-msg">No playlist stats available.</p>
                ) : (
                  <div className="admin-table-container">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Playlist</th>
                          <th>Streams</th>
                          <th>Duration</th>
                          <th>Unique Tracks</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analytics.top_playlists.map(p => (
                          <tr key={p.playlist}>
                            <td style={{ fontWeight: 700, color: 'var(--text)' }}>{p.playlist}</td>
                            <td>{p.play_count}</td>
                            <td>{formatDuration(p.total_seconds)}</td>
                            <td>{p.unique_tracks}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : activeTab === 'live' ? (
          /* =========================================================================
              TAB 3: LIVE SESSIONS & STREAM LOGS
             ========================================================================= */
          <div className="live-tab-view" data-testid="live-tab-content">
            {/* Live Now Section */}
            <div className="admin-panel">
              <div className="admin-panel-header">
                <div>
                  <div className="admin-panel-title">
                    <FlameIcon />
                    <span>Real-Time Active Listeners</span>
                  </div>
                  <div className="admin-panel-subtitle">Clients actively streaming audio right now</div>
                </div>
                <button className="admin-nav-btn" onClick={fetchAnalytics} data-testid="live-refresh-btn">
                  <RefreshIcon />
                  <span>Refresh Status</span>
                </button>
              </div>

              {(!analytics?.live_sessions || analytics.live_sessions.length === 0) ? (
                <div className="admin-empty-chart">
                  <UsersIcon />
                  <span>No users currently streaming audio.</span>
                </div>
              ) : (
                <div className="live-sessions-grid">
                  {analytics.live_sessions.map(s => {
                    const hue = strHue(s.username)
                    return (
                      <div key={s.id} className="live-card">
                        <div className="live-card-top">
                          <div className="live-card-user">
                            <div className="live-user-avatar" style={{ background: `hsl(${hue}, 65%, 35%)` }}>
                              {s.username.slice(0, 2).toUpperCase()}
                            </div>
                            <span style={{ fontWeight: 700 }}>{s.username}</span>
                          </div>
                          <div className="admin-live-pill">
                            <span className="live-dot-pulse" />
                            <span>LIVE</span>
                          </div>
                        </div>

                        <div>
                          <div className="live-card-song" title={s.name}>{s.name}</div>
                          <div className="live-card-artist">{s.artist} • {s.playlist}</div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-dim)', borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                          <span>{s.device_name} ({s.device_type})</span>
                          <span>{s.browser} / {s.os}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Playback Stream Audit Log */}
            <div className="admin-panel">
              <div className="admin-panel-header">
                <div>
                  <div className="admin-panel-title">
                    <ActivityIcon />
                    <span>Playback Stream Audit Log</span>
                  </div>
                  <div className="admin-panel-subtitle">Searchable, paginated record of all playback pings ({logsTotalCount} total events)</div>
                </div>
                <button className="admin-nav-btn" onClick={handleExportCSV}>
                  <DownloadIcon />
                  <span>Export Log to CSV</span>
                </button>
              </div>

              <div className="admin-filter-toolbar">
                <input
                  type="text"
                  placeholder="Search song, device, browser..."
                  value={logsSearch}
                  onChange={e => setLogsSearch(e.target.value)}
                  className="admin-input-search"
                />
                <select
                  value={logsUserFilter}
                  onChange={e => setLogsUserFilter(e.target.value)}
                  className="admin-select-input"
                >
                  <option value="">All Users</option>
                  {users.map(u => (
                    <option key={u.username} value={u.username}>{u.username}</option>
                  ))}
                </select>
                <button className="admin-nav-btn" onClick={() => fetchLogs(1)}>Search</button>
              </div>

              {logs.length === 0 ? (
                <p className="no-data-msg">No log events match query.</p>
              ) : (
                <>
                  <div className="admin-table-container">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Timestamp</th>
                          <th>User</th>
                          <th>Song Title & Artist</th>
                          <th>Playlist</th>
                          <th>Device</th>
                          <th>Client (Browser / OS)</th>
                          <th>Duration</th>
                        </tr>
                      </thead>
                      <tbody>
                        {logs.map(log => (
                          <tr key={log.id}>
                            <td style={{ fontSize: '11px', whiteSpace: 'nowrap' }}>
                              {log.timestamp ? formatTimestamp(log.timestamp, effectiveTz) : 'N/A'}
                            </td>
                            <td><strong>{log.username}</strong></td>
                            <td>
                              <div style={{ fontWeight: 600, color: 'var(--text)' }}>{log.name}</div>
                              <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>{log.artist}</div>
                            </td>
                            <td>{log.playlist}</td>
                            <td>{log.device_name}</td>
                            <td>{log.browser} / {log.os}</td>
                            <td>{formatDuration(log.duration_sec)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                      Page {logsPage} of {logsTotalPages} ({logsTotalCount} total records)
                    </span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        className="admin-nav-btn"
                        disabled={logsPage <= 1}
                        onClick={() => fetchLogs(logsPage - 1)}
                      >
                        Previous
                      </button>
                      <button
                        className="admin-nav-btn"
                        disabled={logsPage >= logsTotalPages}
                        onClick={() => fetchLogs(logsPage + 1)}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : activeTab === 'users' ? (
          /* =========================================================================
              TAB 4: USER ACCOUNTS
             ========================================================================= */
          <div className="users-tab-view" data-testid="users-tab-content">
            <div className="admin-panel">
              <div className="admin-panel-header">
                <div>
                  <div className="admin-panel-title">
                    <UsersIcon />
                    <span>User Accounts Management</span>
                  </div>
                  <div className="admin-panel-subtitle">Manage login credentials and granular playlist access permissions</div>
                </div>
                <button className="admin-nav-btn primary" onClick={openAddUserModal} data-testid="add-user-btn">
                  <PlusIcon />
                  <span>Add New User</span>
                </button>
              </div>

              {/* Filters */}
              <div className="admin-filter-toolbar">
                <input
                  type="text"
                  placeholder="Search user by name..."
                  value={userSearchQuery}
                  onChange={e => setUserSearchQuery(e.target.value)}
                  className="admin-input-search"
                  data-testid="user-search-input"
                />
                <select
                  value={roleFilter}
                  onChange={e => setRoleFilter(e.target.value)}
                  className="admin-select-input"
                >
                  <option value="all">All Roles</option>
                  <option value="admin">Administrators</option>
                  <option value="user">Regular Users</option>
                </select>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="admin-select-input"
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active Now</option>
                  <option value="offline">Offline</option>
                </select>
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value)}
                  className="admin-select-input"
                >
                  <option value="username">Sort by Name</option>
                  <option value="role">Sort by Role</option>
                  <option value="status">Sort by Status</option>
                </select>
              </div>

              {filteredUsers.length === 0 ? (
                <p className="no-data-msg">No users match filters.</p>
              ) : (
                <div className="users-grid-layout">
                  {filteredUsers.map(u => {
                    const hue = strHue(u.username)
                    const allowed = u.rules?.allowed_playlists || ['*']
                    const hasAll = allowed.includes('*')
                    const isLive = getUserLiveStatus(u.username)

                    return (
                      <div
                        key={u.username}
                        className="user-mgmt-card"
                        onClick={() => { setSelectedUser(u.username); setDetailTimeframe('7d'); }}
                        data-testid={`user-card-${u.username}`}
                      >
                        <div className="user-card-top">
                          <div
                            className="user-big-avatar"
                            style={{ background: `linear-gradient(135deg, hsl(${hue},65%,35%), hsl(${(hue+60)%360},65%,20%))` }}
                          >
                            {u.username.slice(0, 2).toUpperCase()}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontWeight: 800, fontSize: '14px' }}>{u.username}</span>
                              {isLive && <span className="live-dot-pulse" title="Listening now" />}
                            </div>
                            <span className={`role-tag ${u.role}`} style={{ marginTop: 4, display: 'inline-block' }}>{u.role}</span>
                          </div>
                        </div>

                        <div style={{ fontSize: '11px', color: 'var(--text-sub)' }}>
                          <span style={{ fontWeight: 600, color: 'var(--text-dim)' }}>Access: </span>
                          {hasAll ? (
                            <span className="role-tag admin">All Playlists (*)</span>
                          ) : allowed.length === 0 ? (
                            <span className="role-tag user">No Access</span>
                          ) : (
                            <span>{allowed.slice(0, 2).join(', ')}{allowed.length > 2 ? ` +${allowed.length - 2} more` : ''}</span>
                          )}
                        </div>

                        <div className="user-card-actions" onClick={e => e.stopPropagation()}>
                          <button
                            className="user-action-btn"
                            onClick={() => { setSelectedUser(u.username); setDetailTimeframe('7d'); }}
                          >
                            Analytics Profile
                          </button>
                          <button
                            className="user-action-btn"
                            onClick={() => openEditUserModal(u)}
                          >
                            Edit
                          </button>
                          <button
                            className="user-action-btn delete"
                            onClick={() => handleDeleteUser(u.username)}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* =========================================================================
              TAB 5: SYSTEM & SERVER HEALTH
             ========================================================================= */
          <div className="system-tab-view" data-testid="system-tab-content">
            <div className="kpi-grid">
              <div className="kpi-card">
                <div className="kpi-header">
                  <span className="kpi-label">Total Tracks Indexed</span>
                  <MusicIcon />
                </div>
                <div className="kpi-value">{formatNumber(analytics?.system_metrics?.total_tracks)}</div>
                <div className="kpi-subtext">{analytics?.system_metrics?.total_playlists || 0} playlists discovered</div>
              </div>

              <div className="kpi-card">
                <div className="kpi-header">
                  <span className="kpi-label">Library Audio Duration</span>
                  <ClockIcon />
                </div>
                <div className="kpi-value">{analytics?.system_metrics?.total_library_hours || 0} hrs</div>
                <div className="kpi-subtext">Total catalog playtime</div>
              </div>

              <div className="kpi-card">
                <div className="kpi-header">
                  <span className="kpi-label">Storage Usage</span>
                  <DeviceIcon />
                </div>
                <div className="kpi-value">{formatBytes(analytics?.system_metrics?.music_size_bytes)}</div>
                <div className="kpi-subtext">Music directory on disk</div>
              </div>

              <div className="kpi-card">
                <div className="kpi-header">
                  <span className="kpi-label">Telemetry Records</span>
                  <ActivityIcon />
                </div>
                <div className="kpi-value">{formatNumber(analytics?.system_metrics?.recorded_events)}</div>
                <div className="kpi-subtext">{formatBytes(analytics?.system_metrics?.db_size_bytes)} SQLite size</div>
              </div>
            </div>

            {/* Audio Formats Breakdown */}
            <div className="admin-panel">
              <div className="admin-panel-header">
                <div className="admin-panel-title">Audio Formats & Codecs Distribution</div>
              </div>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                {(analytics?.format_stats || []).map(fmt => (
                  <div key={fmt.format} className="kpi-card" style={{ flex: 1, minWidth: 140 }}>
                    <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--emerald)' }}>{fmt.format}</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>{fmt.count} files</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{fmt.percentage}% of catalog</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit User Modal */}
      {showUserModal && (
        <div className="admin-modal-backdrop" onClick={() => setShowUserModal(false)} data-testid="user-modal">
          <div className="admin-modal" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">{isEditingUser ? `Edit User: ${formUsername}` : 'Create New User Account'}</h3>

            <form onSubmit={handleSaveUser}>
              <div className="form-row">
                <label className="form-label">Username</label>
                <input
                  type="text"
                  className="form-input-text"
                  placeholder="e.g. music_lover"
                  disabled={isEditingUser}
                  value={formUsername}
                  onChange={e => setFormUsername(e.target.value)}
                  required
                  data-testid="input-username"
                />
              </div>

              <div className="form-row">
                <label className="form-label">
                  {isEditingUser ? 'Password (Leave blank to keep unchanged)' : 'Password'}
                </label>
                <input
                  type="password"
                  className="form-input-text"
                  placeholder="••••••••"
                  value={formPassword}
                  onChange={e => setFormPassword(e.target.value)}
                  required={!isEditingUser}
                  data-testid="input-password"
                />
              </div>

              <div className="form-row">
                <label className="form-label">Account Role</label>
                <div style={{ display: 'flex', gap: 16 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '12px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="userRole"
                      checked={formRole === 'user'}
                      onChange={() => setFormRole('user')}
                    />
                    <span>Regular User</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '12px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="userRole"
                      checked={formRole === 'admin'}
                      onChange={() => setFormRole('admin')}
                    />
                    <span>Administrator</span>
                  </label>
                </div>
              </div>

              <div className="form-row">
                <label className="form-label">Playlist Access Permissions</label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '12px', marginBottom: 10, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={formAllowedAll}
                    onChange={e => setFormAllowedAll(e.target.checked)}
                  />
                  <strong>Grant access to all playlists (*)</strong>
                </label>

                {!formAllowedAll && (
                  <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 12, maxHeight: 160, overflowY: 'auto' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
                      {playlistNames.map(pl => (
                        <label key={pl} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '11px', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={formAllowedPlaylists.includes(pl)}
                            onChange={() => handlePlaylistCheckbox(pl)}
                          />
                          <span>{pl}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="modal-btn-row">
                <button type="button" className="admin-nav-btn" onClick={() => setShowUserModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="admin-nav-btn primary" data-testid="btn-save-user">
                  {isEditingUser ? 'Save Changes' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

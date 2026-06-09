import { useState, useEffect } from 'react'

function strHue(str) {
  let h = 0; for (const c of str) h = (h*31+c.charCodeAt(0))|0; return Math.abs(h)%360
}

function formatDuration(seconds) {
  if (!seconds) return '0s'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

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

  const playlistNames = Object.keys(playlists || {})

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

  useEffect(() => {
    if (token) {
      fetchUsers()
    }
  }, [token])

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

  // General Dashboard Aggregates (System-wide stats tab)
  const totalPlaySeconds = stats?.time_per_user?.reduce((acc, curr) => acc + curr.total_seconds, 0) || 0
  const totalUniqueDevices = new Set(stats?.history?.map(h => h.device_id)).size || 0
  const totalUniqueUsers = stats?.time_per_user?.length || 0
  const maxSongSeconds = stats?.most_played?.[0]?.total_seconds || 1

  // User detail aggregates
  const graphMaxSeconds = Math.max(...(userDetailStats?.graph_data?.map(d => d.seconds) || []), 1)

  return (
    <div className="admin-layout" data-theme={theme}>
      <header className="admin-navbar">
        <div className="brand">
          <div className="brand-icon">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="white">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
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
             USER DETAIL PAGE SUBVIEW
             ================================================================= */
          <div className="user-detail-view">
            <button className="btn-back" onClick={() => { setSelectedUser(null); setUserDetailStats(null); }}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
              </svg>
              Back to Dashboard
            </button>

            {userDetailStats && (
              <>
                {/* User Header */}
                <div className="user-profile-header">
                  <div className="profile-info">
                    <div className="profile-avatar" style={{
                      background: `linear-gradient(135deg, hsl(${strHue(userDetailStats.username)},60%,30%), hsl(${(strHue(userDetailStats.username)+60)%360},60%,20%))`
                    }}>
                      {userDetailStats.username.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="profile-meta">
                      <h3>{userDetailStats.username}</h3>
                      <span className={`role-badge ${userDetailStats.role}`}>{userDetailStats.role}</span>
                    </div>
                  </div>
                  
                  <button className="btn-add-user" onClick={() => openEditModal({
                    username: userDetailStats.username,
                    role: userDetailStats.role,
                    rules: userDetailStats.rules
                  })}>
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style={{ marginRight: 6 }}>
                      <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                    </svg>
                    Edit User & Playlists
                  </button>
                </div>

                {/* Quick aggregates */}
                <div className="stats-cards-grid" style={{ marginBottom: 32 }}>
                  <div className="stat-card">
                    <span className="stat-card-title">Last Activity / Login</span>
                    <span className="stat-card-value" style={{ fontSize: '1.25rem', height: '2.5rem', display: 'flex', alignItems: 'center' }}>
                      {userDetailStats.last_seen ? new Date(userDetailStats.last_seen + "Z").toLocaleString() : 'Never'}
                    </span>
                    <span className="stat-card-desc">Last recorded playback event</span>
                  </div>
                  <div className="stat-card">
                    <span className="stat-card-title">Total Usage Time</span>
                    <span className="stat-card-value">{formatDuration(userDetailStats.total_seconds)}</span>
                    <span className="stat-card-desc">Accumulated time in selected period</span>
                  </div>
                  <div className="stat-card">
                    <span className="stat-card-title">Average Daily Use</span>
                    <span className="stat-card-value">{formatDuration(Math.round(userDetailStats.avg_daily_seconds))}</span>
                    <span className="stat-card-desc">Mean daily listening in selected period</span>
                  </div>
                </div>

                {/* Timeframe Selector Bar */}
                <div className="timeframe-bar">
                  <div className="timeframe-buttons">
                    <button 
                      className={`btn-timeframe ${detailTimeframe === '24h' ? 'active' : ''}`}
                      onClick={() => { setDetailTimeframe('24h') }}
                    >
                      Last 24 Hours
                    </button>
                    <button 
                      className={`btn-timeframe ${detailTimeframe === '7d' ? 'active' : ''}`}
                      onClick={() => { setDetailTimeframe('7d') }}
                    >
                      Last 7 Days
                    </button>
                    <button 
                      className={`btn-timeframe ${detailTimeframe === '30d' ? 'active' : ''}`}
                      onClick={() => { setDetailTimeframe('30d') }}
                    >
                      Last 30 Days
                    </button>
                    <button 
                      className={`btn-timeframe ${detailTimeframe === 'custom' ? 'active' : ''}`}
                      onClick={() => { setDetailTimeframe('custom') }}
                    >
                      Custom Dates
                    </button>
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

                {/* Usage Time Graph */}
                <div className="graph-panel">
                  <h3 className="graph-title">Usage Time Graph ({
                    detailTimeframe === '24h' ? 'Hourly' : 'Daily'
                  })</h3>
                  {(!userDetailStats.graph_data || userDetailStats.graph_data.length === 0) ? (
                    <p className="no-data-msg" style={{ padding: '60px 0', textAlign: 'center' }}>No play events in this range.</p>
                  ) : (
                    <div className="bar-chart-container">
                      {userDetailStats.graph_data.map((dp, i) => {
                        const heightPercent = Math.max(4, Math.round((dp.seconds / graphMaxSeconds) * 100))
                        return (
                          <div key={i} className="chart-bar-wrapper">
                            <div className="chart-bar" style={{ height: `${heightPercent}%` }}>
                              <div className="chart-bar-tooltip">
                                {dp.label}: {formatDuration(dp.seconds)}
                              </div>
                            </div>
                            <span className="chart-label" title={dp.label}>{dp.label}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
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
                          No Playlists (Muted)
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          {userDetailStats.rules.allowed_playlists.map(pl => (
                            <span key={pl} className="rule-tag playlist" style={{ fontSize: '0.85rem', padding: '6px 12px' }}>
                              {pl}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <button 
                      className="btn-add-user" 
                      style={{ marginTop: 24, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text)' }}
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
                    <h3 className="chart-panel-title">Most Listened Songs</h3>
                    {(!userDetailStats.most_played || userDetailStats.most_played.length === 0) ? (
                      <p className="no-data-msg">No tracks played in this period.</p>
                    ) : (
                      <div className="most-played-list">
                        {userDetailStats.most_played.map((track, idx) => {
                          const percentage = Math.max(8, Math.round((track.total_seconds / (userDetailStats.most_played[0]?.total_seconds || 1)) * 100))
                          const filename = track.track_id.split('/').pop().replace(/\.[^/.]+$/, '')
                          return (
                            <div key={track.track_id} className="most-played-item">
                              <div className="track-meta-row">
                                <span className="track-rank">#{idx+1}</span>
                                <span className="track-title-label" title={filename}>{filename}</span>
                                <span className="track-playtime">{formatDuration(track.total_seconds)}</span>
                              </div>
                              <div className="progress-bg">
                                <div className="progress-bar" style={{ width: `${percentage}%` }} />
                              </div>
                              <span className="track-playlist-label">{track.playlist}</span>
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
             MAIN USER MANAGEMENT DASHBOARD
             ================================================================= */
          <div className="admin-dashboard">
            <div className="dashboard-header">
              <div>
                <h2>User Management Dashboard</h2>
                <p className="dashboard-subtitle">Manage accounts, access privileges, and review system listening logs</p>
              </div>
              
              <div style={{ display: 'flex', gap: 12 }}>
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
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style={{ marginRight: 6 }}>
                      <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                    </svg>
                    Add New User
                  </button>
                )}
              </div>
            </div>

            {error && <div className="dashboard-alert error">{error}</div>}
            {success && <div className="dashboard-alert success">{success}</div>}

            {loading ? (
              <div className="loading-state">
                <div className="spinner" />
                <p>Retrieving database info...</p>
              </div>
            ) : activeTab === 'users' ? (
              <div className="users-grid">
                {users.map(u => {
                  const hue = strHue(u.username)
                  const allowed = u.rules?.allowed_playlists || ['*']
                  const hasAll = allowed.includes('*')

                  return (
                    <div key={u.username} className="user-card" style={{ cursor: 'pointer' }} onClick={() => {
                      setSelectedUser(u.username);
                      setDetailTimeframe('7d');
                    }}>
                      <div className="user-card-header">
                        <div className="user-avatar" style={{
                          background: `linear-gradient(135deg, hsl(${hue},60%,30%), hsl(${(hue+60)%360},60%,20%))`
                        }}>
                          {u.username.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="user-info-main">
                          <h3 className="user-name">{u.username}</h3>
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
                              <span key={p} className="rule-tag playlist">{p}</span>
                            ))}
                            {allowed.length > 3 && (
                              <span className="rule-tag playlist">+{allowed.length - 3} more</span>
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
            ) : (
              /* STATISTICS TAB VIEW */
              <div className="stats-layout">
                {/* Aggregates Cards */}
                <div className="stats-cards-grid">
                  <div className="stat-card">
                    <span className="stat-card-title">Total Listening Time</span>
                    <span className="stat-card-value">{formatDuration(totalPlaySeconds)}</span>
                    <span className="stat-card-desc">Accumulated active playback</span>
                  </div>
                  <div className="stat-card">
                    <span className="stat-card-title">Unique Listeners</span>
                    <span className="stat-card-value">{totalUniqueUsers}</span>
                    <span className="stat-card-desc">Active registered accounts</span>
                  </div>
                  <div className="stat-card">
                    <span className="stat-card-title">Connected Devices</span>
                    <span className="stat-card-value">{totalUniqueDevices}</span>
                    <span className="stat-card-desc">Total unique playback devices</span>
                  </div>
                </div>

                <div className="stats-charts-row">
                  {/* Horizontal Bar Chart for Popular Music */}
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
                                <span className="track-rank">#{idx+1}</span>
                                <span className="track-title-label" title={filename}>{filename}</span>
                                <span className="track-playtime">{formatDuration(track.total_seconds)}</span>
                              </div>
                              <div className="progress-bg">
                                <div className="progress-bar" style={{ width: `${percentage}%` }} />
                              </div>
                              <span className="track-playlist-label">{track.playlist}</span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {/* Browser, OS, and Device charts */}
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
                                <div className="breakdown-bar fill-browser" style={{ width: `${percent}%` }} />
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
                                <div className="breakdown-bar fill-os" style={{ width: `${percent}%` }} />
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
                            return (
                              <tr key={`${row.username}-${row.device_id}`}>
                                <td style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                  <div className="user-avatar-mini" style={{
                                    background: `linear-gradient(135deg, hsl(${hue},60%,30%), hsl(${(hue+60)%360},60%,20%))`
                                  }}>
                                    {row.username.slice(0, 2).toUpperCase()}
                                  </div>
                                  <strong>{row.username}</strong>
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

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import SangitaLogo from './SangitaLogo.jsx'
import ThemeSelector from './ThemeSelector.jsx'
import './AdminDashboard.css'

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
const LyricsDocIcon = ({ width = 18, height = 18, className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    width={width}
    height={height}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}
  >
    {/* Under-sheet / offset layer */}
    <path d="M6 21h12a2 2 0 0 0 2-2V7" strokeOpacity="0.4" strokeWidth="1.5" />
    {/* Main front page with folded corner */}
    <path d="M4 3a1.5 1.5 0 0 1 1.5-1.5h8.5l5 5V18a1.5 1.5 0 0 1-1.5 1.5H5.5A1.5 1.5 0 0 1 4 18V3z" />
    <polyline points="14 1.5 14 6.5 19 6.5" />
    {/* Horizontal lyrics text lines */}
    <line x1="6.8" y1="7" x2="10.5" y2="7" strokeWidth="1.6" />
    <line x1="6.8" y1="9.6" x2="10.5" y2="9.6" strokeWidth="1.6" />
    <line x1="6.8" y1="12.2" x2="9.5" y2="12.2" strokeWidth="1.6" />
    <line x1="6.8" y1="14.8" x2="16" y2="14.8" strokeWidth="1.6" />
    {/* Beamed music notes */}
    <path d="M12.8 11.5V5.2l4.8-1.2v6.2" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" />
    <path d="M12.8 7.4l4.8-1.2" stroke="currentColor" strokeWidth="1.6" />
    <ellipse cx="11.4" cy="11.5" rx="1.6" ry="1.2" fill="currentColor" stroke="currentColor" strokeWidth="0.5" />
    <ellipse cx="16.4" cy="10.3" rx="1.6" ry="1.2" fill="currentColor" stroke="currentColor" strokeWidth="0.5" />
  </svg>
)

const FolderIcon = ({ width = 18, height = 18, className = '' }) => (
  <svg viewBox="0 0 24 24" width={width} height={height} fill="currentColor" className={className} style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}>
    <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
  </svg>
)

const LockIcon = ({ width = 12, height = 12 }) => (
  <svg viewBox="0 0 24 24" width={width} height={height} fill="currentColor" style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}>
    <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
  </svg>
)

const GlobeIcon = ({ width = 12, height = 12 }) => (
  <svg viewBox="0 0 24 24" width={width} height={height} fill="currentColor" style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}>
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
  </svg>
)

const AlertCircleIcon = ({ size = 28, color = 'var(--red)' }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 8 }}>
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
)

const EmptyChartIcon = ({ size = 32, color = 'var(--text-dim)' }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 8, opacity: 0.6 }}>
    <line x1="18" y1="20" x2="18" y2="10" />
    <line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" />
  </svg>
)

const EmptyArtistIcon = ({ size = 32, color = 'var(--text-dim)' }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 8, opacity: 0.6 }}>
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
)

const IdleIcon = ({ size = 28, color = 'var(--text-dim)' }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 8, opacity: 0.6 }}>
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
)

const TABS = [
  { id: 'analytics', label: 'Overview', icon: <ActivityIcon />, testId: 'admin-tab-analytics' },
  { id: 'music', label: 'Music', icon: <MusicIcon />, testId: 'admin-tab-music' },
  { id: 'live', label: 'Activity', icon: <FlameIcon />, testId: 'admin-tab-live' },
  { id: 'users', label: 'Users', icon: <UsersIcon />, testId: 'admin-tab-users' },
  { id: 'library-org', label: 'Library Organization', icon: <FolderIcon />, testId: 'admin-tab-library-org' },
  { id: 'lyrics', label: 'Lyrics', icon: <LyricsDocIcon />, testId: 'admin-tab-lyrics' },
  { id: 'system', label: 'System', icon: <DeviceIcon />, testId: 'admin-tab-system' },
]

export default function AdminDashboard({
  token,
  playlists,
  onLogout,
  theme,
  onCycleTheme,
  ThemeIcon,
  onBackToPlayer,
  onSelectTheme,
  setTheme
}) {
  // Navigation Tabs: 'analytics', 'music', 'live', 'users', 'system'
  const [activeTab, setActiveTab] = useState('analytics')
  const tabRefs = useRef({})
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const handleTabKeyDown = useCallback((e) => {
    const tabIds = TABS.map(t => t.id)
    const currentIndex = tabIds.indexOf(activeTab)
    if (currentIndex === -1) return

    let nextIndex = -1
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      nextIndex = (currentIndex + 1) % tabIds.length
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      nextIndex = (currentIndex - 1 + tabIds.length) % tabIds.length
    } else if (e.key === 'Home') {
      e.preventDefault()
      nextIndex = 0
    } else if (e.key === 'End') {
      e.preventDefault()
      nextIndex = tabIds.length - 1
    }

    if (nextIndex !== -1) {
      const nextTabId = tabIds[nextIndex]
      setActiveTab(nextTabId)
      setSelectedUser(null)
      setError('')
      setRetryAction(null)
      tabRefs.current[nextTabId]?.focus()
    }
  }, [activeTab])
  
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

  // Lyrics Engine State
  const [lyricsStatus, setLyricsStatus] = useState(null)
  const [lyricsLogs, setLyricsLogs] = useState([])
  const [lyricsLogsLoading, setLyricsLogsLoading] = useState(false)
  const [internalPlaylists, setInternalPlaylists] = useState({})
  const [lyricsConfig, setLyricsConfig] = useState({
    api: true, // ON: Queries online API first + local model fallback; OFF: direct local Whisper models
    model: 'small',
    language: 'auto',
    cores: 2,
    max_ram_mb: 4096,
    limit: 0,
    demucs: false,
    force: false,
    scope: 'all', // 'all' | 'playlist' | 'song'
    playlist: '',
    song: '',
    remote_whisper_enabled: false,
    remote_whisper_url: '',
    only_remote_gpu: false,
    model_source: 'online',
    ephemeral_ram: true,
    // Remote PC hardware safeguards
    pc_cpu_threads: 2,
    pc_max_ram_mb: 4096,
    pc_cooldown_sec: 0.5,
    pc_compute_type: 'auto',
    pc_low_priority: true
  })
  const hasLoadedLyricsNodeConfigRef = useRef(false)
  const [remoteModelModalOpen, setRemoteModelModalOpen] = useState(false)
  const [remoteGpuTestLoading, setRemoteGpuTestLoading] = useState(false)
  const [remoteGpuTestResult, setRemoteGpuTestResult] = useState(null)
  const [connectedPcTelemetry, setConnectedPcTelemetry] = useState(null)
  const [connectedPcLoading, setConnectedPcLoading] = useState(false)
  const [nodeOpStatus, setNodeOpStatus] = useState(null)
  const [lyricsActionLoading, setLyricsActionLoading] = useState(false)
  const [lyricsEditModal, setLyricsEditModal] = useState({
    open: false,
    filepath: '',
    content: '',
    loading: false,
    saving: false
  })
  const [lyricsLogFilter, setLyricsLogFilter] = useState('all')
  const [lyricsLogSearch, setLyricsLogSearch] = useState('')

  // =========================================================================
  // Library Organization State & Handlers
  // =========================================================================
  const [folders, setFolders] = useState([])
  const [foldersLoading, setFoldersLoading] = useState(false)
  const [foldersError, setFoldersError] = useState(null)

  const [adminPlaylists, setAdminPlaylists] = useState([])
  const [playlistsLoading, setPlaylistsLoading] = useState(false)
  const [playlistsError, setPlaylistsError] = useState(null)
  const [playlistSearch, setPlaylistSearch] = useState('')
  const [playlistVisibilityFilter, setPlaylistVisibilityFilter] = useState('all')

  const [artists, setArtists] = useState([])
  const [artistsLoading, setArtistsLoading] = useState(false)
  const [artistsError, setArtistsError] = useState(null)

  // Modals for Library Org
  const [classifyModal, setClassifyModal] = useState({
    open: false,
    folder: '',
    classification: 'unclassified',
    display_name: '',
    mapped_artist: '',
    mapped_artist_id: null,
    saving: false,
    error: null
  })

  const [artistModal, setArtistModal] = useState({
    open: false,
    name: '',
    bio: '',
    saving: false,
    error: null
  })

  const [deletePlaylistDialog, setDeletePlaylistDialog] = useState({
    open: false,
    playlist: null,
    deleting: false,
    error: null
  })

  const fetchFolders = useCallback(async () => {
    setFoldersLoading(true)
    setFoldersError(null)
    try {
      const res = await fetch('/api/admin/library/folders', {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) throw new Error('Failed to load folders')
      const data = await res.json()
      if (!isMountedRef.current) return
      setFolders(Array.isArray(data) ? data : (data.folders || []))
    } catch (err) {
      if (!isMountedRef.current) return
      setFoldersError(err.message)
    } finally {
      if (isMountedRef.current) {
        setFoldersLoading(false)
      }
    }
  }, [token])

  const fetchAdminPlaylists = useCallback(async () => {
    setPlaylistsLoading(true)
    setPlaylistsError(null)
    try {
      const res = await fetch('/api/admin/library/playlists', {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) throw new Error('Failed to load playlists')
      const data = await res.json()
      if (!isMountedRef.current) return
      setAdminPlaylists(Array.isArray(data) ? data : (data.playlists || []))
    } catch (err) {
      if (!isMountedRef.current) return
      setPlaylistsError(err.message)
    } finally {
      if (isMountedRef.current) {
        setPlaylistsLoading(false)
      }
    }
  }, [token])

  const fetchArtists = useCallback(async () => {
    setArtistsLoading(true)
    setArtistsError(null)
    try {
      const res = await fetch('/api/admin/library/artists', {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) throw new Error('Failed to load artists')
      const data = await res.json()
      if (!isMountedRef.current) return
      setArtists(Array.isArray(data) ? data : (data.artists || []))
    } catch (err) {
      if (!isMountedRef.current) return
      setArtistsError(err.message)
    } finally {
      if (isMountedRef.current) {
        setArtistsLoading(false)
      }
    }
  }, [token])

  useEffect(() => {
    if ((activeTab === 'library-org' || activeTab === 'music') && token) {
      if (activeTab === 'library-org') {
        fetchFolders()
        fetchArtists()
      }
      fetchAdminPlaylists()
    }
  }, [activeTab, token, fetchFolders, fetchAdminPlaylists, fetchArtists])

  const [accessModal, setAccessModal] = useState({
    open: false,
    playlist: null,
    users: [],
    loading: false,
    saving: false,
    revokingUser: null,
    error: null,
    inputUser: ''
  })

  const handleOpenAccessModal = async (pl) => {
    setAccessModal({
      open: true,
      playlist: pl,
      users: [],
      loading: true,
      saving: false,
      revokingUser: null,
      error: null,
      inputUser: ''
    })
    try {
      const res = await fetch(`/api/v2/admin/playlists/${pl.id}/access`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        const users = Array.isArray(data) ? data : (data.users || data.access_grants || data.granted_users || [])
        setAccessModal(m => ({ ...m, users, loading: false }))
      } else {
        setAccessModal(m => ({ ...m, loading: false, error: 'Failed to load access grants' }))
      }
    } catch (err) {
      setAccessModal(m => ({ ...m, loading: false, error: err.message }))
    }
  }

  const handleGrantUserAccess = async (e) => {
    e?.preventDefault()
    const usernameToGrant = accessModal.inputUser?.trim()
    if (!usernameToGrant || !accessModal.playlist) return
    setAccessModal(m => ({ ...m, saving: true, error: null }))
    try {
      const res = await fetch(`/api/v2/admin/playlists/${accessModal.playlist.id}/access`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ grant_user: usernameToGrant })
      })
      if (res.ok) {
        setAccessModal(m => ({
          ...m,
          saving: false,
          inputUser: '',
          users: m.users.some(u => (typeof u === 'string' ? u : u.username) === usernameToGrant)
            ? m.users
            : [...m.users, usernameToGrant]
        }))
      } else {
        const errData = await res.json().catch(() => ({}))
        setAccessModal(m => ({ ...m, saving: false, error: errData.error || 'Failed to grant access' }))
      }
    } catch (err) {
      setAccessModal(m => ({ ...m, saving: false, error: err.message }))
    }
  }

  const handleRevokeUserAccess = async (userToRevoke) => {
    if (!accessModal.playlist) return
    setAccessModal(m => ({ ...m, revokingUser: userToRevoke, error: null }))
    try {
      const res = await fetch(`/api/v2/admin/playlists/${accessModal.playlist.id}/access`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ revoke_user: userToRevoke })
      })
      if (res.ok) {
        setAccessModal(m => ({
          ...m,
          revokingUser: null,
          users: m.users.filter(u => (typeof u === 'string' ? u : u.username) !== userToRevoke)
        }))
      } else {
        const errData = await res.json().catch(() => ({}))
        setAccessModal(m => ({ ...m, revokingUser: null, error: errData.error || 'Failed to revoke access' }))
      }
    } catch (err) {
      setAccessModal(m => ({ ...m, revokingUser: null, error: err.message }))
    }
  }

  const handleToggleAdminPlaylistVisibility = async (pl) => {
    const newVisibility = pl.visibility === 'public' ? 'private' : 'public'
    try {
      const res = await fetch(`/api/v2/admin/playlists/${pl.id}/visibility`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ visibility: newVisibility })
      })
      if (res.ok) {
        setAdminPlaylists(prev => prev.map(p => p.id === pl.id ? { ...p, visibility: newVisibility } : p))
      }
    } catch (err) {
      console.error('Failed to toggle visibility:', err)
    }
  }

  const handleOpenClassifyModal = (f) => {
    setClassifyModal({
      open: true,
      folder: f.folder,
      classification: f.classification || 'unclassified',
      display_name: f.display_name || f.folder,
      mapped_artist: f.mapped_artist || '',
      mapped_artist_id: f.mapped_artist_id || null,
      saving: false,
      error: null
    })
  }

  const handleSaveClassification = async (e) => {
    e.preventDefault()
    if (!classifyModal.folder) return
    setClassifyModal(m => ({ ...m, saving: true, error: null }))
    try {
      const res = await fetch('/api/admin/library/folders/classify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          folder: classifyModal.folder,
          classification: classifyModal.classification,
          display_name: classifyModal.display_name,
          mapped_artist: classifyModal.mapped_artist || undefined,
          mapped_artist_id: classifyModal.mapped_artist_id || undefined
        })
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'Failed to update folder classification')
      }
      setClassifyModal(m => ({ ...m, open: false, saving: false }))
      fetchFolders()
      fetchAdminPlaylists()
      fetchArtists()
    } catch (err) {
      setClassifyModal(m => ({ ...m, saving: false, error: err.message }))
    }
  }

  const handleCreateArtist = async (e) => {
    e.preventDefault()
    if (!artistModal.name.trim()) return
    setArtistModal(m => ({ ...m, saving: true, error: null }))
    try {
      const res = await fetch('/api/admin/library/artists', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: artistModal.name.trim(),
          bio: artistModal.bio.trim()
        })
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'Failed to create artist')
      }
      setArtistModal({ open: false, name: '', bio: '', saving: false, error: null })
      fetchArtists()
    } catch (err) {
      setArtistModal(m => ({ ...m, saving: false, error: err.message }))
    }
  }

  const handleOpenDeletePlaylist = (playlist) => {
    setDeletePlaylistDialog({
      open: true,
      playlist,
      deleting: false,
      error: null
    })
  }

  const handleConfirmDeletePlaylist = async () => {
    if (!deletePlaylistDialog.playlist) return
    setDeletePlaylistDialog(d => ({ ...d, deleting: true, error: null }))
    try {
      const res = await fetch(`/api/admin/library/playlists/${deletePlaylistDialog.playlist.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'Failed to delete playlist')
      }
      setDeletePlaylistDialog({ open: false, playlist: null, deleting: false, error: null })
      fetchAdminPlaylists()
    } catch (err) {
      setDeletePlaylistDialog(d => ({ ...d, deleting: false, error: err.message }))
    }
  }

  // Escape key listener to dismiss open modals
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (showUserModal) {
          e.stopPropagation()
          setShowUserModal(false)
        } else if (lyricsEditModal.open) {
          e.stopPropagation()
          setLyricsEditModal(m => ({ ...m, open: false }))
        } else if (remoteModelModalOpen) {
          e.stopPropagation()
          setRemoteModelModalOpen(false)
        } else if (classifyModal.open) {
          e.stopPropagation()
          setClassifyModal(m => ({ ...m, open: false }))
        } else if (artistModal.open) {
          e.stopPropagation()
          setArtistModal(m => ({ ...m, open: false }))
        } else if (deletePlaylistDialog.open) {
          e.stopPropagation()
          setDeletePlaylistDialog({ open: false, playlist: null, deleting: false, error: null })
        } else if (accessModal.open) {
          e.stopPropagation()
          setAccessModal(m => ({ ...m, open: false }))
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showUserModal, lyricsEditModal.open, remoteModelModalOpen, classifyModal.open, artistModal.open, deletePlaylistDialog.open, accessModal.open])

  // Focus trap for active modal dialogs
  const hasOpenModal = showUserModal || lyricsEditModal.open || remoteModelModalOpen || classifyModal.open || artistModal.open || deletePlaylistDialog.open || accessModal.open
  useEffect(() => {
    if (!hasOpenModal) return
    const prevFocus = document.activeElement
    const timer = setTimeout(() => {
      const activeModal = document.querySelector('.admin-modal-backdrop[role="dialog"]')
      if (!activeModal) return
      const focusable = activeModal.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
      if (focusable.length > 0) {
        focusable[0].focus()
      }
    }, 0)

    const handleModalTab = (e) => {
      if (e.key !== 'Tab') return
      const activeModal = document.querySelector('.admin-modal-backdrop[role="dialog"]')
      if (!activeModal) return
      const focusable = Array.from(activeModal.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      ))
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    window.addEventListener('keydown', handleModalTab)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('keydown', handleModalTab)
      if (prevFocus && typeof prevFocus.focus === 'function') {
        prevFocus.focus()
      }
    }
  }, [hasOpenModal])

  const filteredPlaylists = useMemo(() => {
    return adminPlaylists.filter(pl => {
      if (playlistVisibilityFilter !== 'all' && pl.visibility !== playlistVisibilityFilter) {
        return false
      }
      if (playlistSearch.trim()) {
        const query = playlistSearch.trim().toLowerCase()
        const matchTitle = (pl.title || '').toLowerCase().includes(query)
        const matchOwner = (pl.owner || '').toLowerCase().includes(query)
        return matchTitle || matchOwner
      }
      return true
    })
  }, [adminPlaylists, playlistVisibilityFilter, playlistSearch])

  const folderStats = useMemo(() => {
    const total = folders.length
    const artistsCount = folders.filter(f => f.classification === 'artist').length
    const playlistsCount = folders.filter(f => f.classification === 'playlist').length
    const unclassifiedCount = folders.filter(f => f.classification === 'unclassified').length
    const totalTracks = folders.reduce((sum, f) => sum + (f.track_count || 0), 0)
    return {
      total,
      artists: artistsCount,
      playlists: playlistsCount,
      unclassified: unclassifiedCount,
      totalTracks
    }
  }, [folders])

  useEffect(() => {
    if ((!playlists || Object.keys(playlists).length === 0) && token) {
      fetch('/api/playlists', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(data => {
          if (data && typeof data === 'object') setInternalPlaylists(data)
        })
        .catch(() => {})
    }
  }, [playlists, token])

  const availablePlaylists = useMemo(() => {
    const plSource = (playlists && Object.keys(playlists).length > 0) ? playlists : internalPlaylists
    if (!plSource) return []
    if (Array.isArray(plSource)) {
      return plSource.map(p => ({
        name: typeof p === 'string' ? p : p.name,
        count: Array.isArray(p.tracks) ? p.tracks.length : 0
      })).filter(p => p.name)
    }
    return Object.entries(plSource).map(([name, tracks]) => ({
      name,
      count: Array.isArray(tracks) ? tracks.length : 0
    })).filter(p => p.count > 0)
  }, [playlists, internalPlaylists])

  const availableSongList = useMemo(() => {
    const plSource = (playlists && Object.keys(playlists).length > 0) ? playlists : internalPlaylists
    if (!plSource) return []
    const list = []
    const seen = new Set()

    const addTrack = (rawPath, plName) => {
      const path = typeof rawPath === 'string' ? rawPath : rawPath?.path || rawPath?.filepath
      if (path && !seen.has(path)) {
        seen.add(path)
        const filename = path.split('/').pop().replace(/\.[^/.]+$/, '')
        list.push({ path, title: filename, playlist: plName })
      }
    }

    if (Array.isArray(plSource)) {
      plSource.forEach(pl => {
        (pl.tracks || []).forEach(t => addTrack(t, pl.name || ''))
      })
    } else {
      Object.entries(plSource).forEach(([plName, tracks]) => {
        if (Array.isArray(tracks)) {
          tracks.forEach(t => addTrack(t, plName))
        }
      })
    }
    return list.sort((a, b) => a.title.localeCompare(b.title))
  }, [playlists, internalPlaylists])

  const fetchLyricsStatus = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetch('/api/admin/lyrics/status', {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setLyricsStatus(data)
        if (!hasLoadedLyricsNodeConfigRef.current) {
          hasLoadedLyricsNodeConfigRef.current = true
          if (data.remote_whisper_url) {
            fetchConnectedPcTelemetry(data.remote_whisper_url)
          }
          setLyricsConfig(c => {
            const next = { ...c }
            if (!c.remote_whisper_url && data.remote_whisper_url) {
              next.remote_whisper_url = data.remote_whisper_url
              next.remote_whisper_enabled = true
            }
            if (data.only_remote_gpu !== undefined) {
              next.only_remote_gpu = Boolean(data.only_remote_gpu)
            }
            if (data.model_source !== undefined) {
              next.model_source = data.model_source
            }
            if (data.ephemeral_ram !== undefined) {
              next.ephemeral_ram = Boolean(data.ephemeral_ram)
            }
            if (data.model) next.model = data.model
            if (data.compute_type) next.pc_compute_type = data.compute_type
            if (data.cooldown_sec !== undefined) next.pc_cooldown_sec = data.cooldown_sec
            if (data.cpu_threads !== undefined) next.pc_cpu_threads = data.cpu_threads
            if (data.max_ram_mb !== undefined) next.pc_max_ram_mb = data.max_ram_mb
            if (data.low_priority !== undefined) next.pc_low_priority = data.low_priority
            if (data.remote_settings) {
              if (data.remote_settings.cpu_threads !== undefined) next.pc_cpu_threads = data.remote_settings.cpu_threads
              if (data.remote_settings.max_ram_mb !== undefined) next.pc_max_ram_mb = data.remote_settings.max_ram_mb
              if (data.remote_settings.cooldown_sec !== undefined) next.pc_cooldown_sec = data.remote_settings.cooldown_sec
              if (data.remote_settings.compute_type !== undefined) next.pc_compute_type = data.remote_settings.compute_type
              if (data.remote_settings.low_priority !== undefined) next.pc_low_priority = data.remote_settings.low_priority
            }
            return next
          })
        }
      }
    } catch (err) {
      console.warn('Error fetching lyrics status:', err)
    }
  }, [token])

  const handleTestRemoteGpu = async () => {
    if (!lyricsConfig.remote_whisper_url) {
      alert('Please enter your PC/Laptop Remote Whisper URL (e.g. http://192.168.1.50:8000)')
      return
    }
    setRemoteGpuTestLoading(true)
    setRemoteGpuTestResult(null)
    try {
      const res = await fetch('/api/admin/lyrics/test-remote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ url: lyricsConfig.remote_whisper_url })
      })
      const data = await res.json()
      setRemoteGpuTestResult(data)
      if (data.online) {
        setConnectedPcTelemetry(data)
        if (data.limits) {
          setLyricsConfig(c => ({
            ...c,
            pc_cpu_threads: data.limits.cpu_threads ?? c.pc_cpu_threads,
            pc_max_ram_mb: data.limits.max_ram_mb ?? c.pc_max_ram_mb,
            pc_cooldown_sec: data.limits.cooldown_sec ?? c.pc_cooldown_sec,
            pc_compute_type: data.limits.compute_type ?? c.pc_compute_type,
            pc_low_priority: data.limits.low_priority ?? c.pc_low_priority
          }))
        }
      }
    } catch (err) {
      setRemoteGpuTestResult({ online: false, error: err.message })
    } finally {
      setRemoteGpuTestLoading(false)
    }
  }

  const fetchConnectedPcTelemetry = useCallback(async (targetUrl = null) => {
    const urlToUse = targetUrl || lyricsConfig.remote_whisper_url
    if (!urlToUse || !token) return
    try {
      setConnectedPcLoading(true)
      const res = await fetch(`/api/admin/lyrics/remote-telemetry?url=${encodeURIComponent(urlToUse)}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        if (data.online) {
          setConnectedPcTelemetry(data)
          setRemoteGpuTestResult(prev => prev ? { ...prev, ...data } : data)
        } else {
          setConnectedPcTelemetry(prev => prev ? { ...prev, online: false, error: data.error } : { online: false, error: data.error })
        }
      }
    } catch (err) {
      console.warn('Error fetching connected PC telemetry:', err)
    } finally {
      setConnectedPcLoading(false)
    }
  }, [token, lyricsConfig.remote_whisper_url])

  const handleRemotePrime = async () => {
    if (!lyricsConfig.remote_whisper_url) {
      alert('Please enter your PC / Laptop Remote Whisper URL first.')
      return
    }
    setLyricsActionLoading(true)
    setNodeOpStatus({ type: 'info', msg: `Pre-warming & loading '${lyricsConfig.model}' model into remote PC RAM/GPU...` })
    try {
      const res = await fetch('/api/admin/lyrics/remote-prime', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          url: lyricsConfig.remote_whisper_url,
          model: lyricsConfig.model,
          source: lyricsConfig.model_source,
          compute_type: lyricsConfig.pc_compute_type || 'auto',
          ram_mode: lyricsConfig.ephemeral_ram !== false
        })
      })
      const data = await res.json()
      if (res.ok && data.success !== false) {
        setNodeOpStatus({ type: 'success', msg: `Model '${lyricsConfig.model}' primed successfully in remote PC RAM/GPU.` })
        fetchLyricsStatus()
      } else {
        setNodeOpStatus({ type: 'error', msg: `Failed to prime model: ${data.error || res.statusText}` })
      }
    } catch (err) {
      setNodeOpStatus({ type: 'error', msg: `Error priming node: ${err.message}` })
    } finally {
      setLyricsActionLoading(false)
      setTimeout(() => setNodeOpStatus(null), 8000)
    }
  }

  const handleRemotePurge = async () => {
    if (!lyricsConfig.remote_whisper_url) return
    if (!window.confirm('Purge remote node memory? This will unload Whisper from PC GPU/RAM and wipe all ephemeral RAM-disk directories clean (zero local trace).')) return
    setLyricsActionLoading(true)
    setNodeOpStatus({ type: 'info', msg: 'Purging remote PC memory and wiping ephemeral RAM files...' })
    try {
      const res = await fetch('/api/admin/lyrics/remote-purge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ url: lyricsConfig.remote_whisper_url })
      })
      const data = await res.json()
      if (res.ok && data.success !== false) {
        setNodeOpStatus({ type: 'success', msg: 'Remote memory purged: GPU VRAM freed and RAM files wiped clean.' })
        fetchLyricsStatus()
      } else {
        setNodeOpStatus({ type: 'error', msg: `Failed to purge node: ${data.error || res.statusText}` })
      }
    } catch (err) {
      setNodeOpStatus({ type: 'error', msg: `Error purging node: ${err.message}` })
    } finally {
      setLyricsActionLoading(false)
      setTimeout(() => setNodeOpStatus(null), 8000)
    }
  }

  const handleSyncRemoteSettings = async () => {
    if (!lyricsConfig.remote_whisper_url) return
    setLyricsActionLoading(true)
    try {
      const res = await fetch('/api/admin/lyrics/remote-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          url: lyricsConfig.remote_whisper_url,
          cpu_threads: lyricsConfig.pc_cpu_threads,
          max_ram_mb: lyricsConfig.pc_max_ram_mb,
          cooldown_sec: lyricsConfig.pc_cooldown_sec,
          low_priority: lyricsConfig.pc_low_priority,
          compute_type: lyricsConfig.pc_compute_type
        })
      })
      const data = await res.json()
      if (res.ok && data.success !== false) {
        setNodeOpStatus({ type: 'success', msg: 'Hardware safeguards synchronized and applied to remote PC.' })
      } else {
        setNodeOpStatus({ type: 'error', msg: `Failed to sync settings: ${data.error || res.statusText}` })
      }
    } catch (err) {
      setNodeOpStatus({ type: 'error', msg: `Error saving settings: ${err.message}` })
    } finally {
      setLyricsActionLoading(false)
      setTimeout(() => setNodeOpStatus(null), 6000)
    }
  }

  const fetchLyricsLogs = useCallback(async () => {
    if (!token) return
    try {
      setLyricsLogsLoading(true)
      const res = await fetch('/api/admin/lyrics/logs?limit=100', {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setLyricsLogs(data.logs || [])
      }
    } catch (err) {
      console.warn('Error fetching lyrics logs:', err)
    } finally {
      setLyricsLogsLoading(false)
    }
  }, [token])

  useEffect(() => {
    if (activeTab === 'lyrics') {
      fetchLyricsStatus()
      fetchLyricsLogs()
      if (lyricsConfig.remote_whisper_url) {
        fetchConnectedPcTelemetry(lyricsConfig.remote_whisper_url)
      }
      const pollRate = lyricsStatus?.job?.state === 'running' ? 1000 : 3000
      const interval = setInterval(() => {
        fetchLyricsStatus()
        if (lyricsStatus?.job?.state === 'running') {
          fetchLyricsLogs()
        }
        if (lyricsConfig.remote_whisper_url) {
          fetchConnectedPcTelemetry(lyricsConfig.remote_whisper_url)
        }
      }, pollRate)
      return () => clearInterval(interval)
    }
  }, [activeTab, fetchLyricsStatus, fetchLyricsLogs, fetchConnectedPcTelemetry, lyricsStatus?.job?.state, lyricsConfig.remote_whisper_url])

  const handleStartLyricsWorker = async (overrideParams = null) => {
    try {
      setLyricsActionLoading(true)
      let payload = overrideParams ? { ...lyricsConfig, ...overrideParams } : { ...lyricsConfig }
      if (!payload.remote_whisper_enabled) {
        delete payload.remote_whisper_url
        delete payload.only_remote_gpu
        delete payload.model_source
        delete payload.ephemeral_ram
      } else {
        payload.only_remote_gpu = Boolean(lyricsConfig.only_remote_gpu)
        payload.model_source = payload.model_source || 'online'
        payload.ephemeral_ram = payload.ephemeral_ram !== undefined ? Boolean(payload.ephemeral_ram) : true
      }
      if (payload.scope === 'playlist') {
        if (!payload.playlist) {
          alert('Please select a playlist to generate lyrics for.')
          setLyricsActionLoading(false)
          return
        }
        payload.song = null
      } else if (payload.scope === 'song') {
        if (!payload.song) {
          alert('Please select a particular song to generate lyrics for.')
          setLyricsActionLoading(false)
          return
        }
        payload.playlist = null
      } else {
        payload.playlist = null
        payload.song = null
      }
      const res = await fetch('/api/admin/lyrics/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      })
      if (res.ok) {
        setTimeout(fetchLyricsStatus, 500)
      } else {
        const err = await res.json()
        alert(`Failed to start lyrics worker: ${err.error || res.statusText}`)
      }
    } catch (e) {
      alert(`Error starting worker: ${e.message}`)
    } finally {
      setLyricsActionLoading(false)
    }
  }

  const handleInitiateLyricsStart = () => {
    if (lyricsConfig.remote_whisper_enabled) {
      setRemoteModelModalOpen(true)
    } else {
      handleStartLyricsWorker()
    }
  }

  const handleStopLyricsWorker = async () => {
    if (!window.confirm('Are you sure you want to stop the lyrics generation process?')) return
    try {
      setLyricsActionLoading(true)
      const res = await fetch('/api/admin/lyrics/stop', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        setTimeout(fetchLyricsStatus, 500)
      }
    } catch (e) {
      alert(`Error stopping worker: ${e.message}`)
    } finally {
      setLyricsActionLoading(false)
    }
  }

  const handleRetrySong = (filepath, withDemucs = false) => {
    handleStartLyricsWorker({
      song: filepath,
      demucs: withDemucs,
      force: true
    })
  }

  const handleOpenEditLyrics = async (filepath) => {
    setLyricsEditModal({ open: true, filepath, content: '', loading: true, saving: false })
    try {
      const res = await fetch(`/api/lyrics/${encodeURIComponent(filepath)}?token=${encodeURIComponent(token)}`)
      if (res.ok) {
        const data = await res.json()
        setLyricsEditModal(prev => ({ ...prev, content: data.raw || '', loading: false }))
      } else {
        setLyricsEditModal(prev => ({ ...prev, loading: false }))
      }
    } catch {
      setLyricsEditModal(prev => ({ ...prev, loading: false }))
    }
  }

  const handleSaveLyrics = async (e) => {
    if (e) e.preventDefault()
    try {
      setLyricsEditModal(prev => ({ ...prev, saving: true }))
      const res = await fetch('/api/admin/lyrics/edit', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          filepath: lyricsEditModal.filepath,
          content: lyricsEditModal.content
        })
      })
      if (res.ok) {
        setLyricsEditModal({ open: false, filepath: '', content: '', loading: false, saving: false })
        fetchLyricsLogs()
        fetchLyricsStatus()
      } else {
        const err = await res.json()
        alert(`Failed to save lyrics: ${err.error || res.statusText}`)
        setLyricsEditModal(prev => ({ ...prev, saving: false }))
      }
    } catch (err) {
      alert(`Error saving lyrics: ${err.message}`)
      setLyricsEditModal(prev => ({ ...prev, saving: false }))
    }
  }

  // Notifications
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [analyticsError, setAnalyticsError] = useState(null)
  const [usersError, setUsersError] = useState(null)
  const [logsError, setLogsError] = useState(null)
  const [retryAction, setRetryAction] = useState(null)

  const playlistNames = Object.keys(playlists || {})
  const analyticsRequestIdRef = useRef(0)

  // Fetch Analytics
  const fetchAnalytics = useCallback(async () => {
    if (!token) return
    const requestId = ++analyticsRequestIdRef.current
    setAnalyticsLoading(true)
    setAnalytics(null)
    setAnalyticsError(null)
    try {
      let url = `/api/admin/analytics?timeframe=${timeframe}&tz=${encodeURIComponent(effectiveTz)}`
      if (timeframe === 'custom' && customStartDate && customEndDate) {
        url += `&start_date=${customStartDate}&end_date=${customEndDate}`
      }
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) throw new Error('Failed to load analytics')
      const data = await res.json()
      if (!isMountedRef.current || requestId !== analyticsRequestIdRef.current) return
      setAnalytics(data)
    } catch (err) {
      if (!isMountedRef.current || requestId !== analyticsRequestIdRef.current) return
      const errMsg = err.message || 'Failed to fetch analytics data'
      setAnalyticsError(errMsg)
    } finally {
      if (isMountedRef.current && requestId === analyticsRequestIdRef.current) {
        setAnalyticsLoading(false)
      }
    }
  }, [token, timeframe, customStartDate, customEndDate, effectiveTz])

  // Fetch Users
  const fetchUsers = useCallback(async () => {
    if (!token) return
    setUsersLoading(true)
    setUsersError(null)
    try {
      const res = await fetch('/api/admin/users', { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) throw new Error('Failed to load users')
      const data = await res.json()
      if (!isMountedRef.current) return
      setUsers(Array.isArray(data) ? data : [])
      setUsersError(null)
    } catch (err) {
      if (!isMountedRef.current) return
      const errMsg = err.message || 'Failed to load user accounts'
      setUsersError(errMsg)
    } finally {
      if (isMountedRef.current) {
        setUsersLoading(false)
      }
    }
  }, [token])

  // Fetch Logs
  const fetchLogs = useCallback(async (page = 1) => {
    if (!token) return
    setLogsLoading(true)
    setLogsError(null)
    try {
      let url = `/api/admin/logs?page=${page}&limit=25`
      if (logsSearch) url += `&search=${encodeURIComponent(logsSearch)}`
      if (logsUserFilter) url += `&username=${encodeURIComponent(logsUserFilter)}`
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) throw new Error('Failed to load audit logs')
      const data = await res.json()
      if (!isMountedRef.current) return
      setLogs(data.events || [])
      setLogsPage(data.page || 1)
      setLogsTotalPages(data.total_pages || 1)
      setLogsTotalCount(data.total || 0)
      setLogsError(null)
    } catch (err) {
      if (!isMountedRef.current) return
      const errMsg = err.message || 'Failed to load audit logs'
      setLogsError(errMsg)
    } finally {
      if (isMountedRef.current) {
        setLogsLoading(false)
      }
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
      if (!isMountedRef.current) return
      setUserDetailStats(data)
    } catch (err) {
      if (!isMountedRef.current) return
      setError(err.message || 'Failed to load user details')
      setRetryAction({ run: () => fetchUserDetailStats(username, tf, start, end) })
    } finally {
      if (isMountedRef.current) {
        setAnalyticsLoading(false)
      }
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
    if (!Array.isArray(users)) return []
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
    setRetryAction(null)
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
    setRetryAction(null)
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
    setRetryAction(null)
    setSuccess('')

    if (!formUsername.trim()) {
      setError('Username is required')
      setRetryAction(null)
      return
    }
    if (!isEditingUser && !formPassword) {
      setError('Password is required')
      setRetryAction(null)
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
      setRetryAction(null)
    }
  }

  const handleDeleteUser = async (username) => {
    if (!window.confirm(`Are you sure you want to permanently delete user "${username}"?`)) return
    setError('')
    setRetryAction(null)
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
      setRetryAction(null)
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

  const connectedPcStats = connectedPcTelemetry || remoteGpuTestResult
  const detectedCores = connectedPcStats?.specs?.total_cores || connectedPcStats?.limits?.total_cores || 16
  const detectedRamMb = connectedPcStats?.specs?.total_ram_mb || connectedPcStats?.ram?.total_mb || connectedPcStats?.limits?.total_ram_mb || 32768
  const detectedGpuName = connectedPcStats?.specs?.gpu_name || connectedPcStats?.gpu?.name || remoteGpuTestResult?.gpu_name || 'NVIDIA CUDA'
  const detectedCpuModel = connectedPcStats?.specs?.cpu_model || connectedPcStats?.cpu?.model || 'PC Multi-Core Processor'

  return (
    <div className="admin-layout" data-theme={theme}>
      {/* Top Navigation Bar */}
      <header className="admin-navbar">
        <div className="admin-brand">
          <div className="admin-brand-icon">
            <SangitaLogo size={28} />
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
          <button className="admin-nav-btn primary" onClick={onBackToPlayer} title="Return to Music Player" data-testid="admin-back-btn">
            <BackIcon />
            <span>Back to Player</span>
          </button>
          <ThemeSelector
            theme={theme}
            onSelectTheme={onSelectTheme || setTheme}
            onCycleTheme={onCycleTheme}
            ThemeIcon={ThemeIcon}
          />
          <button className="admin-nav-btn" onClick={onLogout} title="Sign Out">
            <span>Logout</span>
          </button>
        </div>
      </header>

      {/* Subheader Navigation & Toolbar */}
      <div className="admin-controls-bar">
        <nav className="admin-tabs-nav" aria-label="Admin Navigation">
          <div
            className="admin-tabs-list"
            role="tablist"
            aria-label="Admin Sections"
            onKeyDown={handleTabKeyDown}
          >
            {TABS.map((tab) => {
              const isSelected = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  ref={el => (tabRefs.current[tab.id] = el)}
                  role="tab"
                  id={`admin-tab-${tab.id}`}
                  aria-controls={`admin-panel-${tab.id}`}
                  aria-selected={isSelected}
                  tabIndex={isSelected ? 0 : -1}
                  className={`admin-tab-btn ${isSelected ? 'active' : ''}`}
                  onClick={() => {
                    setActiveTab(tab.id)
                    setSelectedUser(null)
                    setError('')
                    setRetryAction(null)
                  }}
                  data-testid={tab.testId}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </div>
        </nav>

        {/* Global Timeframe Selector & Timezone Toolbar for Analytics & Music tabs */}
        {(activeTab === 'analytics' || activeTab === 'music') && !selectedUser && (
          <div className="admin-timeframe-toolbar" role="toolbar" aria-label="Analytics Filters Toolbar">
            <div className="timeframe-pill-group" role="group" aria-label="Timeframe selection">
              {['24h', '7d', '30d', '90d', 'all', 'custom'].map((tf) => (
                <button
                  key={tf}
                  className={`timeframe-pill ${timeframe === tf ? 'active' : ''}`}
                  onClick={() => setTimeframe(tf)}
                  data-testid={`timeframe-btn-${tf}`}
                  aria-pressed={timeframe === tf}
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
                  aria-label="Start Date"
                />
                <span>to</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={e => setCustomEndDate(e.target.value)}
                  title="End Date"
                  aria-label="End Date"
                />
                <button className="admin-nav-btn" onClick={fetchAnalytics}>Apply</button>
              </div>
            )}

            {/* Relocated Timezone Selector */}
            <div className="admin-tz-wrapper">
              <label htmlFor="admin-tz-select" className="admin-tz-label">TZ:</label>
              <select
                id="admin-tz-select"
                value={timezone}
                onChange={e => setTimezone(e.target.value)}
                className="admin-select-input admin-tz-select"
                title="Select Timezone (Default: IST / Asia/Kolkata)"
                aria-label="Select Timezone"
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

            <button className="admin-nav-btn" onClick={fetchAnalytics} title="Refresh Telemetry" aria-label="Refresh Telemetry">
              <RefreshIcon />
            </button>
            <button className="admin-nav-btn" onClick={handleExportCSV} title="Export CSV Report" aria-label="Export CSV Report" data-testid="admin-export-btn">
              <DownloadIcon />
              <span>Export CSV</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <main className="admin-content" role="tabpanel" id={`admin-panel-${activeTab}`} aria-labelledby={`admin-tab-${activeTab}`} tabIndex={0}>
        {/* Page Heading & Short Description */}
        {!selectedUser && (
          <div className="admin-page-header">
            <div className="admin-page-header-text">
              <h1 className="admin-page-title">
                {activeTab === 'analytics' && 'Overview'}
                {activeTab === 'library-org' && 'Library Organization'}
                {activeTab === 'music' && 'Music & Catalog'}
                {activeTab === 'live' && 'Activity'}
                {activeTab === 'users' && 'Users'}
                {activeTab === 'lyrics' && 'Lyrics Engine'}
                {activeTab === 'system' && 'System Health'}
              </h1>
              <p className="admin-page-desc">
                {activeTab === 'analytics' && 'Monitor key listening trends, session activity, and audience metrics.'}
                {activeTab === 'library-org' && 'Classify source audio folders, manage catalog artists, and audit global playlists.'}
                {activeTab === 'music' && 'Inspect top tracks, artists, playlists, and library engagement.'}
                {activeTab === 'live' && 'Inspect real-time listening sessions, active streams, and audit logs.'}
                {activeTab === 'users' && 'Create, edit, and manage user accounts and access permissions.'}
                {activeTab === 'lyrics' && 'Configure and run automated Whisper lyrics generation jobs.'}
                {activeTab === 'system' && 'Inspect server health, storage, audio codecs, and technical diagnostics.'}
              </p>
            </div>
          </div>
        )}

        {/* Notifications */}
        {error && (
          <div className="alert-banner error" role="alert">
            <span>{error}</span>
            {retryAction?.run && (
              <button
                className="admin-retry-btn"
                onClick={() => {
                  const fn = retryAction.run
                  setRetryAction(null)
                  setError('')
                  fn()
                }}
              >
                Retry
              </button>
            )}
          </div>
        )}
        {success && <div className="alert-banner success" role="status">{success}</div>}

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
                          background: `linear-gradient(135deg, hsl(${strHue(userDetailStats?.username || '')}, 70%, 40%), hsl(${(strHue(userDetailStats?.username || '')+60)%360}, 70%, 25%))`
                        }}
                      >
                        {(userDetailStats?.username || selectedUser?.username || 'U').slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h2 style={{ fontSize: '1.8rem', fontWeight: 800 }}>{userDetailStats?.username || selectedUser?.username || 'User'}</h2>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                          <span className={`role-tag ${userDetailStats?.role || selectedUser?.role || 'user'}`}>{userDetailStats?.role || selectedUser?.role || 'user'}</span>
                          {getUserLiveStatus(userDetailStats?.username || selectedUser?.username) && (
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
            {analyticsLoading ? (
              <div className="admin-loading-state" data-testid="analytics-loading">
                <span className="admin-spinner" />
                <span>Loading analytics metrics...</span>
              </div>
            ) : analyticsError ? (
              <div className="admin-empty-state admin-error-state" data-testid="analytics-error" style={{ borderColor: 'var(--red)' }}>
                <AlertCircleIcon size={28} />
                <h3 style={{ color: 'var(--red)' }}>Failed to Load Analytics</h3>
                <p>{analyticsError}</p>
                <button
                  className="admin-nav-btn admin-retry-analytics-btn"
                  onClick={fetchAnalytics}
                  style={{ marginTop: 16 }}
                >
                  <RefreshIcon />
                  <span>Retry Analytics</span>
                </button>
              </div>
            ) : (!analytics?.timeline || analytics.timeline.length === 0) ? (
              <div className="admin-empty-state" data-testid="analytics-empty">
                <EmptyChartIcon size={32} />
                <h3>No listening activity recorded in this period.</h3>
                <p>Try switching to a broader timeframe like "30 Days" or "All Time".</p>
              </div>
            ) : (
              <>
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
            <details className="admin-disclosure">
              <summary className="admin-disclosure-summary" data-testid="disclosure-diurnal">
                <div className="admin-disclosure-title">
                  <FlameIcon />
                  <span>24-Hour Diurnal Peak & Day-of-Week Usage Patterns</span>
                </div>
                <span className="admin-disclosure-badge">Hourly & Daily Breakdown ▾</span>
              </summary>
              <div className="admin-disclosure-content">
                <div className="admin-grid-2col" style={{ marginBottom: 0 }}>
                  <div className="admin-panel" style={{ marginBottom: 0 }}>
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
                      Peak listening traffic occurs around <strong>{analytics?.kpis?.peak_hour?.label}</strong>.
                    </div>
                  </div>

                  <div className="admin-panel" style={{ marginBottom: 0 }}>
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
              </div>
            </details>

            {/* Platform & Client Telemetry */}
            <details className="admin-disclosure">
              <summary className="admin-disclosure-summary" data-testid="disclosure-platforms">
                <div className="admin-disclosure-title">
                  <DeviceIcon />
                  <span>Platform, Client & Device Breakdown</span>
                </div>
                <span className="admin-disclosure-badge">Devices, OS & Browsers ▾</span>
              </summary>
              <div className="admin-disclosure-content">
                <div className="admin-panel" style={{ marginBottom: 0 }}>

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
            </details>
              </>
            )}
          </div>
        ) : activeTab === 'library-org' ? (
          /* =========================================================================
              TAB: LIBRARY ORGANIZATION & GLOBAL PLAYLIST INVENTORY
             ========================================================================= */
          <div className="library-org-view" data-testid="library-org-tab-content">
            {/* 1. Folder Classification Panel */}
            <div className="admin-panel" data-testid="folder-classification-panel">
              <div className="admin-panel-header">
                <div>
                  <div className="admin-panel-title">
                    <FolderIcon width={20} height={20} />
                    <span>Folder Classification</span>
                  </div>
                  <div className="admin-panel-subtitle">
                    Classify physical audio folders as Artists or Playlists, assign custom display titles, and map catalog entities.
                  </div>
                </div>
                <button
                  type="button"
                  className="admin-nav-btn"
                  onClick={fetchFolders}
                  disabled={foldersLoading}
                  aria-label="Refresh folders"
                  data-testid="btn-refresh-folders"
                >
                  <RefreshIcon />
                  <span>{foldersLoading ? 'Scanning…' : 'Refresh Folders'}</span>
                </button>
              </div>

              {/* Summary Stats */}
              <div className="library-summary-cards">
                <div className="library-stat-card">
                  <div className="library-stat-num">{folderStats.total}</div>
                  <div className="library-stat-lbl">Detected Folders</div>
                </div>
                <div className="library-stat-card">
                  <div className="library-stat-num artist-color">{folderStats.artists}</div>
                  <div className="library-stat-lbl">Artist Folders</div>
                </div>
                <div className="library-stat-card">
                  <div className="library-stat-num playlist-color">{folderStats.playlists}</div>
                  <div className="library-stat-lbl">Playlist Folders</div>
                </div>
                <div className="library-stat-card">
                  <div className="library-stat-num unclassified-color">{folderStats.unclassified}</div>
                  <div className="library-stat-lbl">Unclassified</div>
                </div>
                <div className="library-stat-card">
                  <div className="library-stat-num">{folderStats.totalTracks}</div>
                  <div className="library-stat-lbl">Total Audio Tracks</div>
                </div>
              </div>

              {/* Folder Table */}
              {foldersLoading && folders.length === 0 ? (
                <div className="loading-state" style={{ padding: 36 }}>
                  <div className="spinner" />
                  <p>Scanning source folders…</p>
                </div>
              ) : foldersError ? (
                <div className="admin-empty-state admin-error-state" style={{ borderColor: 'var(--red)', margin: '16px 0' }}>
                  <AlertCircleIcon size={28} />
                  <h3 style={{ color: 'var(--red)' }}>Failed to Load Folders</h3>
                  <p>{foldersError}</p>
                  <button className="admin-nav-btn" onClick={fetchFolders} style={{ marginTop: 12 }}>
                    <RefreshIcon />
                    <span>Retry</span>
                  </button>
                </div>
              ) : folders.length === 0 ? (
                <div className="empty-state" style={{ padding: 36 }}>
                  <FolderIcon width={40} height={40} />
                  <h3 style={{ marginTop: 10, fontSize: '14px' }}>No Source Folders Detected</h3>
                  <p style={{ fontSize: '12px' }}>Check that MUSIC_DIR contains audio files or subdirectories.</p>
                </div>
              ) : (
                <div className="admin-table-container">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th style={{ width: '22%' }}>Source Folder</th>
                        <th style={{ width: '15%' }}>Classification</th>
                        <th style={{ width: '20%' }}>Display Name</th>
                        <th style={{ width: '18%' }}>Mapped Artist</th>
                        <th style={{ width: '10%' }}>Tracks</th>
                        <th style={{ width: '15%' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {folders.map(f => (
                        <tr key={f.folder} data-testid={`folder-row-${f.folder}`}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <FolderIcon width={16} height={16} />
                              <strong style={{ fontFamily: 'monospace', fontSize: '12.5px' }}>{f.folder}</strong>
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: 2 }}>
                              Grants: {f.user_access_grants?.includes('*') || f.user_access_grants?.length === users.length
                                ? 'All Users (*)'
                                : f.user_access_grants?.join(', ') || 'No users'}
                            </div>
                          </td>
                          <td>
                            <span className={`classification-pill ${f.classification}`}>
                              {f.classification === 'artist' ? (<><span className="status-dot artist" />Artist</>) : f.classification === 'playlist' ? (<><span className="status-dot playlist" />Playlist</>) : (<><span className="status-dot unclassified" />Unclassified</>)}
                            </span>
                          </td>
                          <td>
                            <span style={{ fontWeight: 600 }}>{f.display_name || f.folder}</span>
                          </td>
                          <td>
                            {f.mapped_artist ? (
                              <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{f.mapped_artist}</span>
                            ) : (
                              <span style={{ color: 'var(--text-dim)' }}>—</span>
                            )}
                          </td>
                          <td>
                            <span style={{ fontWeight: 600 }}>{formatNumber(f.track_count)}</span>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="admin-nav-btn small"
                              onClick={() => handleOpenClassifyModal(f)}
                              data-testid={`btn-classify-folder-${f.folder}`}
                              aria-label={`Classify folder ${f.folder}`}
                            >
                              <EditIcon />
                              <span>Classify</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* 2. Global Playlist Inventory Panel */}
            <div className="admin-panel" data-testid="global-playlist-inventory-panel">
              <div className="admin-panel-header">
                <div>
                  <div className="admin-panel-title">
                    <MusicIcon />
                    <span>Global Playlist Inventory</span>
                  </div>
                  <div className="admin-panel-subtitle">
                    Inspect all user-created and system folder playlists across all users, filter visibility, and manage administrative actions.
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  {/* Search input */}
                  <input
                    type="search"
                    className="admin-input-search"
                    placeholder="Search by title or owner…"
                    value={playlistSearch}
                    onChange={e => setPlaylistSearch(e.target.value)}
                    data-testid="input-playlist-search"
                    aria-label="Search playlists"
                  />

                  {/* Visibility Filters */}
                  <div className="timeframe-pill-group" role="group" aria-label="Filter playlists by visibility">
                    <button
                      type="button"
                      className={`timeframe-pill ${playlistVisibilityFilter === 'all' ? 'active' : ''}`}
                      onClick={() => setPlaylistVisibilityFilter('all')}
                      data-testid="filter-visibility-all"
                    >
                      All ({adminPlaylists.length})
                    </button>
                    <button
                      type="button"
                      className={`timeframe-pill ${playlistVisibilityFilter === 'public' ? 'active' : ''}`}
                      onClick={() => setPlaylistVisibilityFilter('public')}
                      data-testid="filter-visibility-public"
                    >
                      Public
                    </button>
                    <button
                      type="button"
                      className={`timeframe-pill ${playlistVisibilityFilter === 'private' ? 'active' : ''}`}
                      onClick={() => setPlaylistVisibilityFilter('private')}
                      data-testid="filter-visibility-private"
                    >
                      Private
                    </button>
                  </div>

                  <button
                    type="button"
                    className="admin-nav-btn"
                    onClick={fetchAdminPlaylists}
                    disabled={playlistsLoading}
                    aria-label="Refresh playlists"
                    data-testid="btn-refresh-playlists"
                  >
                    <RefreshIcon />
                  </button>
                </div>
              </div>

              {playlistsLoading && adminPlaylists.length === 0 ? (
                <div className="loading-state" style={{ padding: 36 }}>
                  <div className="spinner" />
                  <p>Loading playlist inventory…</p>
                </div>
              ) : playlistsError ? (
                <div className="admin-empty-state admin-error-state" style={{ borderColor: 'var(--red)', margin: '16px 0' }}>
                  <AlertCircleIcon size={28} />
                  <h3 style={{ color: 'var(--red)' }}>Failed to Load Playlists</h3>
                  <p>{playlistsError}</p>
                  <button className="admin-nav-btn" onClick={fetchAdminPlaylists} style={{ marginTop: 12 }}>
                    <RefreshIcon />
                    <span>Retry</span>
                  </button>
                </div>
              ) : filteredPlaylists.length === 0 ? (
                <div className="empty-state" style={{ padding: 36 }}>
                  <MusicIcon />
                  <h3 style={{ marginTop: 10, fontSize: '14px' }}>No Playlists Found</h3>
                  <p style={{ fontSize: '12px' }}>
                    {playlistSearch || playlistVisibilityFilter !== 'all'
                      ? 'No playlists match your search and filter criteria.'
                      : 'No user playlists or folder playlists have been recorded yet.'}
                  </p>
                </div>
              ) : (
                <div className="admin-table-container">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th style={{ width: '25%' }}>Title</th>
                        <th style={{ width: '16%' }}>Owner</th>
                        <th style={{ width: '14%' }}>Visibility</th>
                        <th style={{ width: '15%' }}>Type</th>
                        <th style={{ width: '10%' }}>Tracks</th>
                        <th style={{ width: '12%' }}>Created</th>
                        <th style={{ width: '8%', textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPlaylists.map(pl => (
                        <tr key={pl.id} data-testid={`playlist-row-${pl.id}`}>
                          <td>
                            <div style={{ fontWeight: 600, fontSize: '13px' }}>{pl.title}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>ID: {pl.id}</div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span
                                style={{
                                  display: 'inline-block',
                                  width: 8,
                                  height: 8,
                                  borderRadius: '50%',
                                  background: pl.owner === 'system' ? 'var(--accent)' : `hsl(${strHue(pl.owner)}, 70%, 55%)`
                                }}
                              />
                              <span style={{ fontWeight: 600 }}>{pl.owner}</span>
                            </div>
                          </td>
                          <td>
                            <span className={`visibility-badge ${pl.visibility}`}>
                              {pl.visibility === 'public' ? (
                                <>
                                  <GlobeIcon width={12} height={12} />
                                  <span>Public</span>
                                </>
                              ) : (
                                <>
                                  <LockIcon width={12} height={12} />
                                  <span>Private</span>
                                </>
                              )}
                            </span>
                          </td>
                          <td>
                            <span className={`playlist-type-pill ${pl.is_folder_playlist ? 'folder' : 'user'}`}>
                              {pl.is_folder_playlist ? (<><span className="status-dot folder" />Folder playlist</>) : (<><span className="status-dot user" />User playlist</>)}
                            </span>
                          </td>
                          <td>
                            <span style={{ fontWeight: 600 }}>{formatNumber(pl.track_count)}</span>
                          </td>
                          <td>
                            <span style={{ fontSize: '11px', color: 'var(--text-sub)' }}>
                              {formatTimestamp(pl.created_at, timezone)}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              type="button"
                              className="admin-action-btn delete"
                              onClick={() => handleOpenDeletePlaylist(pl)}
                              title={`Delete playlist ${pl.title}`}
                              aria-label={`Delete playlist ${pl.title}`}
                              data-testid={`btn-delete-playlist-${pl.id}`}
                            >
                              <TrashIcon />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* 3. Artists Management Panel */}
            <div className="admin-panel" data-testid="artists-management-panel">
              <div className="admin-panel-header">
                <div>
                  <div className="admin-panel-title">
                    <span>Artists Management</span>
                  </div>
                  <div className="admin-panel-subtitle">
                    Manage catalog artist profiles, descriptions, and linked audio collections.
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    type="button"
                    className="admin-nav-btn primary"
                    onClick={() => setArtistModal({ open: true, name: '', bio: '', saving: false, error: null })}
                    data-testid="btn-add-artist"
                  >
                    <PlusIcon />
                    <span>Add New Artist</span>
                  </button>
                  <button
                    type="button"
                    className="admin-nav-btn"
                    onClick={fetchArtists}
                    disabled={artistsLoading}
                    aria-label="Refresh artists"
                    data-testid="btn-refresh-artists"
                  >
                    <RefreshIcon />
                  </button>
                </div>
              </div>

              {artistsLoading && artists.length === 0 ? (
                <div className="loading-state" style={{ padding: 36 }}>
                  <div className="spinner" />
                  <p>Loading artists catalog…</p>
                </div>
              ) : artistsError ? (
                <div className="admin-empty-state admin-error-state" style={{ borderColor: 'var(--red)', margin: '16px 0' }}>
                  <AlertCircleIcon size={28} />
                  <h3 style={{ color: 'var(--red)' }}>Failed to Load Artists</h3>
                  <p>{artistsError}</p>
                  <button className="admin-nav-btn" onClick={fetchArtists} style={{ marginTop: 12 }}>
                    <RefreshIcon />
                    <span>Retry</span>
                  </button>
                </div>
              ) : artists.length === 0 ? (
                <div className="empty-state" style={{ padding: 36 }}>
                  <EmptyArtistIcon size={32} />
                  <h3 style={{ marginTop: 6, fontSize: '14px' }}>No Catalog Artists Configured</h3>
                  <p style={{ fontSize: '12px' }}>
                    Click "Add New Artist" to register an artist profile or classify a source folder to automatically register one.
                  </p>
                </div>
              ) : (
                <div className="admin-table-container">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th style={{ width: '25%' }}>Artist Name</th>
                        <th style={{ width: '35%' }}>Bio / Description</th>
                        <th style={{ width: '15%' }}>Mapped Folders</th>
                        <th style={{ width: '12%' }}>Total Tracks</th>
                        <th style={{ width: '13%' }}>Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {artists.map(a => (
                        <tr key={a.id} data-testid={`artist-row-${a.id}`}>
                          <td>
                            <strong style={{ fontSize: '13px', color: 'var(--text)' }}>{a.name}</strong>
                            <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>ID: #{a.id}</div>
                          </td>
                          <td>
                            <span style={{ color: a.bio ? 'var(--text-sub)' : 'var(--text-dim)', fontSize: '12px' }}>
                              {a.bio || 'No biography entered'}
                            </span>
                          </td>
                          <td>
                            <span style={{ fontWeight: 600 }}>{formatNumber(a.folder_count)}</span>
                          </td>
                          <td>
                            <span style={{ fontWeight: 600 }}>{formatNumber(a.track_count)}</span>
                          </td>
                          <td>
                            <span style={{ fontSize: '11px', color: 'var(--text-sub)' }}>
                              {formatTimestamp(a.created_at, timezone)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        ) : activeTab === 'music' ? (
          /* =========================================================================
              TAB 2: MUSIC & CATALOG ANALYTICS
             ========================================================================= */
          <div className="music-tab-view" data-testid="music-tab-content">
            {analyticsLoading ? (
              <div className="admin-loading-state" data-testid="music-analytics-loading">
                <span className="admin-spinner" />
                <span>Loading catalog metrics...</span>
              </div>
            ) : analyticsError ? (
              <div className="admin-empty-state admin-error-state" data-testid="music-analytics-error" style={{ borderColor: 'var(--red)' }}>
                <AlertCircleIcon size={28} />
                <h3 style={{ color: 'var(--red)' }}>Failed to Load Music Analytics</h3>
                <p>{analyticsError}</p>
                <button
                  className="admin-nav-btn"
                  onClick={fetchAnalytics}
                  style={{ marginTop: 16 }}
                >
                  <RefreshIcon />
                  <span>Retry Analytics</span>
                </button>
              </div>
            ) : (
              <>
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
              {/* Playlists Management & Access Controls */}
              <div className="admin-panel" data-testid="admin-playlists-panel" style={{ marginTop: 24 }}>
                <div className="admin-panel-header">
                  <div>
                    <div className="admin-panel-title">
                      <MusicIcon />
                      <span>All Playlists & Access Controls</span>
                    </div>
                    <div className="admin-panel-subtitle">
                      Manage playlist visibility (Public / Private) and user access grants.
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      type="button"
                      className="admin-nav-btn"
                      onClick={fetchAdminPlaylists}
                      disabled={playlistsLoading}
                      aria-label="Refresh playlists"
                      data-testid="btn-refresh-admin-playlists"
                    >
                      <RefreshIcon />
                      <span>Refresh</span>
                    </button>
                  </div>
                </div>

                {playlistsLoading && adminPlaylists.length === 0 ? (
                  <div className="loading-state" style={{ padding: 36 }}>
                    <div className="spinner" />
                    <p>Loading playlist inventory…</p>
                  </div>
                ) : playlistsError ? (
                  <div className="admin-empty-state admin-error-state" style={{ borderColor: 'var(--red)', margin: '16px 0' }}>
                    <AlertCircleIcon size={28} />
                    <h3 style={{ color: 'var(--red)' }}>Failed to Load Playlists</h3>
                    <p>{playlistsError}</p>
                    <button className="admin-nav-btn" onClick={fetchAdminPlaylists} style={{ marginTop: 12 }}>
                      <RefreshIcon />
                      <span>Retry</span>
                    </button>
                  </div>
                ) : adminPlaylists.length === 0 ? (
                  <div className="empty-state" style={{ padding: 36 }}>
                    <MusicIcon />
                    <h3 style={{ marginTop: 10, fontSize: '14px' }}>No Playlists Recorded</h3>
                    <p style={{ fontSize: '12px' }}>No user or folder playlists have been created yet.</p>
                  </div>
                ) : (
                  <div className="admin-table-container">
                    <table className="admin-table" data-testid="admin-playlists-table">
                      <thead>
                        <tr>
                          <th style={{ width: '28%' }}>Title</th>
                          <th style={{ width: '18%' }}>Owner</th>
                          <th style={{ width: '20%' }}>Visibility</th>
                          <th style={{ width: '12%' }}>Tracks</th>
                          <th style={{ width: '22%', textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adminPlaylists.map(pl => (
                          <tr key={pl.id} data-testid={`playlist-row-${pl.id}`}>
                            <td>
                              <div style={{ fontWeight: 600, fontSize: '13px' }}>{pl.title || pl.name}</div>
                              <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>ID: {pl.id}</div>
                            </td>
                            <td>
                              <span data-testid={`playlist-owner-${pl.id}`} style={{ fontWeight: 600 }}>{pl.owner}</span>
                            </td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span
                                  className={`visibility-badge ${pl.visibility}`}
                                  data-testid={`playlist-visibility-${pl.id}`}
                                >
                                  {pl.visibility === 'public' ? 'public' : 'private'}
                                </span>
                                <button
                                  type="button"
                                  className="admin-nav-btn small"
                                  onClick={() => handleToggleAdminPlaylistVisibility(pl)}
                                  title={`Toggle visibility to ${pl.visibility === 'public' ? 'private' : 'public'}`}
                                  data-testid={`btn-toggle-visibility-${pl.id}`}
                                >
                                  <span>{pl.visibility === 'public' ? 'Make Private' : 'Make Public'}</span>
                                </button>
                              </div>
                            </td>
                            <td>
                              <span style={{ fontWeight: 600 }}>{pl.track_count ?? 0}</span>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <button
                                type="button"
                                className="admin-nav-btn small"
                                onClick={() => handleOpenAccessModal(pl)}
                                data-testid={`btn-manage-access-${pl.id}`}
                                aria-label={`Manage access for ${pl.title || pl.name}`}
                              >
                                <UsersIcon width={14} height={14} />
                                <span>Manage Access</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
              </>
            )}
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

              {analyticsLoading && !analytics?.live_sessions ? (
                <div className="admin-loading-state" data-testid="live-sessions-loading">
                  <span className="admin-spinner" />
                  <span>Checking active streams...</span>
                </div>
              ) : analyticsError && !analytics?.live_sessions ? (
                <div className="admin-empty-state admin-error-state" data-testid="live-sessions-error" style={{ borderColor: 'var(--red)', margin: '20px 0' }}>
                  <AlertCircleIcon size={28} />
                  <h3 style={{ color: 'var(--red)' }}>Failed to Load Live Sessions</h3>
                  <p>{analyticsError}</p>
                  <button className="admin-nav-btn" onClick={fetchAnalytics} style={{ marginTop: 16 }}>
                    <RefreshIcon />
                    <span>Retry Loading Status</span>
                  </button>
                </div>
              ) : (!analytics?.live_sessions || analytics.live_sessions.length === 0) ? (
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

              {logsLoading ? (
                <div className="admin-loading-state" data-testid="logs-loading">
                  <span className="admin-spinner" />
                  <span>Loading stream audit logs...</span>
                </div>
              ) : logsError ? (
                <div className="admin-empty-state admin-error-state" data-testid="logs-error" style={{ borderColor: 'var(--red)', margin: '20px 0' }}>
                  <AlertCircleIcon size={28} />
                  <h3 style={{ color: 'var(--red)' }}>Failed to Load Audit Logs</h3>
                  <p>{logsError}</p>
                  <button className="admin-nav-btn" onClick={() => fetchLogs(logsPage)} style={{ marginTop: 16 }}>
                    <RefreshIcon />
                    <span>Retry Loading Logs</span>
                  </button>
                </div>
              ) : logs.length === 0 ? (
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

              {usersLoading ? (
                <div className="admin-loading-state" data-testid="users-loading">
                  <span className="admin-spinner" />
                  <span>Loading user accounts...</span>
                </div>
              ) : usersError ? (
                <div className="admin-empty-state admin-error-state" data-testid="users-error" style={{ borderColor: 'var(--red)', margin: '20px 0' }}>
                  <AlertCircleIcon size={28} />
                  <h3 style={{ color: 'var(--red)' }}>Failed to Load Users</h3>
                  <p>{usersError}</p>
                  <button className="admin-nav-btn" onClick={fetchUsers} style={{ marginTop: 16 }}>
                    <RefreshIcon />
                    <span>Retry Loading Users</span>
                  </button>
                </div>
              ) : filteredUsers.length === 0 ? (
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
        ) : activeTab === 'lyrics' ? (
          /* =========================================================================
              TAB 6: LYRICS ENGINE
             ========================================================================= */
          <div className="lyrics-engine-view" data-testid="lyrics-engine-content">
            {/* 1. Hero Header & Quick Command Center */}
            <div className="lyrics-hero-header">
              <div className="lyrics-hero-title-group">
                <div className="lyrics-hero-title-row">
                  <div className="lyrics-hero-title">Lyrics Caption & Sync Engine</div>
                  {lyricsStatus?.job?.state === 'running' ? (
                    <span className="lyrics-hero-badge running">
                      <span className="live-dot-pulse" />
                      Generating Lyrics ({lyricsStatus.job.current_index || 0} / {lyricsStatus.job.total_songs || 0})
                    </span>
                  ) : lyricsStatus?.job?.state === 'stopped' ? (
                    <span className="lyrics-hero-badge idle" style={{ borderColor: 'rgba(239, 68, 68, 0.4)', color: 'var(--red)' }}>
                      <><span className="status-dot red" />Stopped</>
                    </span>
                  ) : (
                    <span className="lyrics-hero-badge idle">
                      <><span className="status-dot green" />Engine idle & ready</>
                    </span>
                  )}
                  {lyricsConfig.remote_whisper_enabled && (
                    <span className="source-pill" style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--emerald)', border: '1px solid rgba(16, 185, 129, 0.35)', fontSize: '10.5px' }}>
                      <><span className="status-dot green" />GPU offload active</>
                    </span>
                  )}
                  {lyricsConfig.only_remote_gpu && (
                    <span className="source-pill" style={{ background: 'rgba(99, 102, 241, 0.18)', color: '#A5B4FC', border: '1px solid rgba(99, 102, 241, 0.4)', fontSize: '10.5px' }}>
                      <><span className="status-dot blue" />0% Server CPU</>
                    </span>
                  )}
                </div>
                <div className="lyrics-hero-subtitle">
                  Full-song lyrics transcription with zero-cutoff guarantee. Synchronizes online LRCLIB metadata and offloads AI transcription to your local PC NVIDIA GPU in RAM.
                </div>
              </div>

              <div className="lyrics-hero-actions">
                {lyricsStatus?.job?.state === 'running' ? (
                  <button
                    className="lyrics-main-cta stop"
                    onClick={handleStopLyricsWorker}
                    disabled={lyricsActionLoading}
                    data-testid="btn-stop-lyrics-worker"
                  >
                    <TrashIcon />
                    <span>{lyricsActionLoading ? 'Stopping…' : 'Stop Lyrics Generation'}</span>
                  </button>
                ) : (
                  <button
                    className="lyrics-main-cta start"
                    onClick={() => handleStartLyricsWorker()}
                    disabled={lyricsActionLoading}
                    data-testid="btn-start-lyrics-worker"
                  >
                    <LyricsDocIcon />
                    <span>
                      {lyricsActionLoading
                        ? 'Starting…'
                        : lyricsConfig.scope === 'playlist' && lyricsConfig.playlist
                        ? `Start Generation (${lyricsConfig.playlist})`
                        : lyricsConfig.scope === 'song' && lyricsConfig.song
                        ? 'Start Generation (1 Song)'
                        : 'Start Lyrics Generation'}
                    </span>
                  </button>
                )}
              </div>
            </div>

            {/* 2. Active Job Progress Tracker or Last Run Summary */}
            {lyricsStatus?.job?.state === 'running' ? (
              <div className="admin-panel lyrics-progress-panel">
                <div className="admin-panel-header" style={{ alignItems: 'flex-start' }}>
                  <div>
                    <div className="admin-panel-title" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <span>Active Lyrics Caption Generation</span>
                      {lyricsStatus.job.config?.api === false && (
                        <span className="source-pill whisper" style={{ fontSize: '10px' }}>
                          Direct local (API off)
                        </span>
                      )}
                      {lyricsStatus.job.config?.only_remote_gpu && (
                        <span className="source-pill" style={{ fontSize: '10px', background: 'rgba(99, 102, 241, 0.2)', color: '#A5B4FC', border: '1px solid rgba(99, 102, 241, 0.4)' }}>
                          Exclusive GPU (0% server CPU)
                        </span>
                      )}
                      {lyricsStatus.job.current_source_type === 'remote_gpu' ? (
                        <span className="engine-badge" style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#34D399', border: '1px solid rgba(16, 185, 129, 0.4)' }}>Remote PC GPU</span>
                      ) : lyricsStatus.job.current_source_type === 'api' ? (
                        <span className="engine-badge api">Online API (LRCLIB)</span>
                      ) : lyricsStatus.job.current_source_type === 'local_machine' ? (
                        <span className="engine-badge local">Local machine (Whisper 500MB model)</span>
                      ) : lyricsStatus.job.current_source_type === 'local_demucs' ? (
                        <span className="engine-badge demucs">Local Demucs isolation</span>
                      ) : lyricsStatus.job.current_source_type === 'embedded' ? (
                        <span className="engine-badge embedded">Embedded tags</span>
                      ) : (
                        <span className="engine-badge checking">Checking cache</span>
                      )}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--emerald)' }}>
                      {lyricsStatus.job.total_songs > 0
                        ? `${Math.round((lyricsStatus.job.current_index / lyricsStatus.job.total_songs) * 100)}%`
                        : '0%'}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                      {lyricsStatus.job.eta_seconds ? `${formatDuration(lyricsStatus.job.eta_seconds)} remaining` : `${lyricsStatus.job.current_index || 0} of ${lyricsStatus.job.total_songs || 0} songs`}
                    </div>
                  </div>
                </div>

                {/* Highly visible Currently Processing Song box */}
                <div className="currently-processing-box">
                  <div className="currently-processing-header">
                    <span className="currently-processing-label">
                      <span className="live-dot-pulse" />
                      Currently Processing
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: 600 }}>
                      Song {lyricsStatus.job.current_index || 1} of {lyricsStatus.job.total_songs || 1}
                    </span>
                  </div>

                  <div className="currently-processing-title-row">
                    <MusicIcon />
                    <span className="currently-processing-title">
                      {lyricsStatus.job.current_title || lyricsStatus.job.current_song?.split('/').pop()?.replace(/\.[^/.]+$/, '') || 'Processing Song...'}
                    </span>
                    {lyricsStatus.job.current_artist && (
                      <span className="currently-processing-artist">
                        by {lyricsStatus.job.current_artist}
                      </span>
                    )}
                  </div>

                  {lyricsStatus.job.current_song && (
                    <div className="currently-processing-path">
                      {lyricsStatus.job.current_song}
                    </div>
                  )}

                  <div className="currently-processing-action">
                    <span className="action-spinner" />
                    <strong>Current Engine Action:</strong> {lyricsStatus.job.current_action || (
                      lyricsStatus.job.current_source_type === 'api'
                        ? 'Querying Online API (LRCLIB database)...'
                        : lyricsStatus.job.current_source_type === 'local_machine'
                          ? 'Transcribing locally via 500MB Whisper AI model...'
                          : 'Processing track...'
                    )}
                  </div>
                </div>

                <div className="resource-bar-track" style={{ height: 8, borderRadius: 4, margin: '14px 0' }}>
                  <div
                    className="resource-bar-fill"
                    style={{
                      height: '100%',
                      width: `${lyricsStatus.job.total_songs > 0 ? (lyricsStatus.job.current_index / lyricsStatus.job.total_songs) * 100 : 0}%`,
                      background: 'var(--emerald)',
                      borderRadius: 4,
                      transition: 'width 0.4s ease'
                    }}
                  />
                </div>

                {/* Counters breakdown badges */}
                <div className="lyrics-counters-bar">
                  <div className="counter-pill">
                    <span className="counter-name">Skipped (Existing):</span>
                    <span className="counter-val">{lyricsStatus.job.counts?.skipped_existing || 0}</span>
                  </div>
                  <div className="counter-pill">
                    <span className="counter-name">Embedded Tags:</span>
                    <span className="counter-val">{lyricsStatus.job.counts?.embedded || 0}</span>
                  </div>
                  <div className="counter-pill">
                    <span className="counter-name">Online API:</span>
                    <span className="counter-val" style={{ color: '#60A5FA' }}>{lyricsStatus.job.counts?.lrclib || 0}</span>
                  </div>
                  {lyricsStatus.job.counts?.remote_gpu > 0 && (
                    <div className="counter-pill" style={{ borderColor: 'rgba(16, 185, 129, 0.4)', background: 'rgba(16, 185, 129, 0.1)' }}>
                      <span className="counter-name">Remote GPU:</span>
                      <span className="counter-val" style={{ color: '#34D399' }}>{lyricsStatus.job.counts?.remote_gpu || 0}</span>
                    </div>
                  )}
                  <div className="counter-pill">
                    <span className="counter-name">Local Whisper:</span>
                    <span className="counter-val" style={{ color: '#C084FC' }}>{lyricsStatus.job.counts?.whisper || 0}</span>
                  </div>
                  <div className="counter-pill danger">
                    <span className="counter-name">Failed:</span>
                    <span className="counter-val">{lyricsStatus.job.counts?.failed || 0}</span>
                  </div>
                </div>
              </div>
            ) : (
              lyricsStatus?.job?.last_processed && (
                <div className="last-processed-summary-box" style={{ marginBottom: 16 }}>
                  <div className="last-processed-info">
                    <span style={{ fontWeight: 700, color: 'var(--emerald)', textTransform: 'uppercase', fontSize: '11px' }}>
                      ✓ Last Processed Song:
                    </span>
                    <span style={{ fontWeight: 700, color: 'var(--text)', fontSize: '13px' }}>
                      {lyricsStatus.job.last_processed.title || lyricsStatus.job.last_processed.song}
                    </span>
                    {lyricsStatus.job.last_processed.artist && (
                      <span style={{ color: 'var(--text-sub)' }}>
                        by {lyricsStatus.job.last_processed.artist}
                      </span>
                    )}
                    <span className={`source-pill ${lyricsStatus.job.last_processed.source_type === 'api' ? 'lrclib' : lyricsStatus.job.last_processed.source_type === 'local_machine' ? 'whisper' : 'default'}`}>
                      {lyricsStatus.job.last_processed.source_label || lyricsStatus.job.last_processed.source}
                    </span>
                  </div>
                  <div style={{ color: 'var(--text-dim)', fontSize: '11px' }}>
                    Completed in {lyricsStatus.job.last_processed.processing_time_sec}s · {lyricsStatus.job.last_processed.status?.toUpperCase()}
                  </div>
                </div>
              )
            )}

            {/* Primary Lyrics Engine Controls: Generation Scope & Library Targets */}
            <div className="lyrics-scope-primary-panel" style={{ marginBottom: 18 }}>
              {/* CARD 1: Generation Scope & Library Targets */}
              <div className="lyrics-card">
                <div className="lyrics-card-header">
                  <div>
                    <div className="lyrics-card-title">
                      <span>1. Generation scope & targets</span>
                    </div>
                    <div className="lyrics-card-desc">
                      Select which tracks to transcribe and whether to query online LRCLIB first.
                    </div>
                  </div>
                </div>

                {/* Target Scope Segmented Tabs */}
                <div>
                  <label className="form-label" style={{ marginBottom: 6 }}>Target Selection</label>
                  <div className="lyrics-segmented-tabs">
                    <button
                      type="button"
                      className={`lyrics-segmented-tab ${lyricsConfig.scope === 'all' ? 'active' : ''}`}
                      onClick={() => setLyricsConfig(c => ({ ...c, scope: 'all' }))}
                      disabled={lyricsStatus?.job?.state === 'running'}
                    >
                      Entire Library
                    </button>
                    <button
                      type="button"
                      className={`lyrics-segmented-tab ${lyricsConfig.scope === 'playlist' ? 'active' : ''}`}
                      onClick={() => setLyricsConfig(c => ({ ...c, scope: 'playlist' }))}
                      disabled={lyricsStatus?.job?.state === 'running'}
                    >
                      Select Playlist
                    </button>
                    <button
                      type="button"
                      className={`lyrics-segmented-tab ${lyricsConfig.scope === 'song' ? 'active' : ''}`}
                      onClick={() => setLyricsConfig(c => ({ ...c, scope: 'song' }))}
                      disabled={lyricsStatus?.job?.state === 'running'}
                    >
                      Single Song
                    </button>
                  </div>
                </div>

                {/* Conditional Pickers */}
                {lyricsConfig.scope === 'playlist' && (
                  <div className="form-group" style={{ animation: 'fadeIn 0.2s ease' }}>
                    <label className="form-label">Choose Playlist</label>
                    <select
                      className="form-input-text"
                      value={lyricsConfig.playlist}
                      onChange={e => setLyricsConfig(c => ({ ...c, playlist: e.target.value }))}
                      disabled={lyricsStatus?.job?.state === 'running'}
                    >
                      <option value="">-- Choose a Playlist --</option>
                      {availablePlaylists.map(pl => (
                        <option key={pl.name} value={pl.name}>
                          {pl.name} ({pl.count} {pl.count === 1 ? 'song' : 'songs'})
                        </option>
                      ))}
                    </select>
                    <span className="field-hint">Generates lyrics only for tracks in this playlist</span>
                  </div>
                )}

                {lyricsConfig.scope === 'song' && (
                  <div className="form-group" style={{ animation: 'fadeIn 0.2s ease' }}>
                    <label className="form-label">Choose Particular Song</label>
                    <select
                      className="form-input-text"
                      value={lyricsConfig.song}
                      onChange={e => setLyricsConfig(c => ({ ...c, song: e.target.value }))}
                      disabled={lyricsStatus?.job?.state === 'running'}
                    >
                      <option value="">-- Choose a Song ({availableSongList.length} total) --</option>
                      {availableSongList.map(s => (
                        <option key={s.path} value={s.path}>
                          {s.title} {s.playlist ? `(${s.playlist})` : ''} — {s.path}
                        </option>
                      ))}
                    </select>
                    <span className="field-hint">Generates lyrics for this single chosen track</span>
                  </div>
                )}

                {/* Online API Engine Toggle Button */}
                <div className="form-group lyrics-api-group">
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>LRCLIB API Matching</span>
                    <span className={`lyrics-api-pill ${lyricsConfig.api ? 'on' : 'off'}`}>
                      {lyricsConfig.api ? 'API ON' : 'API OFF'}
                    </span>
                  </label>
                  <button
                    type="button"
                    className={`lyrics-api-button ${lyricsConfig.api ? 'active-api' : 'active-local'}`}
                    onClick={() => setLyricsConfig(c => ({ ...c, api: !c.api }))}
                    disabled={lyricsStatus?.job?.state === 'running'}
                    title={lyricsConfig.api ? 'Online API enabled (LRCLIB first + Whisper fallback)' : 'Online API disabled (Whisper model only)'}
                    data-testid="lyrics-api-toggle-button"
                  >
                    <div className="lyrics-api-btn-content">
                      <div className="lyrics-api-btn-left">
                        <span className="lyrics-api-btn-icon"><GlobeIcon /></span>
                        <div className="lyrics-api-btn-titles">
                          <span className="lyrics-api-btn-main">LRCLIB API: {lyricsConfig.api ? 'ON' : 'OFF'}</span>
                          <span className="lyrics-api-btn-sub">
                            {lyricsConfig.api ? 'Online Sync + Local Model Fallback' : 'Direct AI Transcription (Whisper Model Only)'}
                          </span>
                        </div>
                      </div>
                      <div className={`lyrics-api-switch ${lyricsConfig.api ? 'checked' : ''}`}>
                        <div className="lyrics-api-switch-thumb" />
                      </div>
                    </div>
                  </button>
                  <span className="field-hint">
                    {lyricsConfig.api
                      ? 'Queries online LRCLIB database first; falls back to Whisper AI if missing.'
                      : 'Bypasses internet database completely. Transcribes directly using Whisper AI.'}
                  </span>
                </div>

                {/* Batch Limit */}
                <div className="form-group">
                  <label className="form-label">Batch Limit</label>
                  <select
                    className="form-input-text"
                    value={lyricsConfig.limit}
                    onChange={e => setLyricsConfig(c => ({ ...c, limit: parseInt(e.target.value, 10) }))}
                    disabled={lyricsStatus?.job?.state === 'running' || lyricsConfig.scope === 'song'}
                  >
                    <option value="0">All Songs in Scope</option>
                    <option value="5">Benchmark 5 Songs</option>
                    <option value="10">Test 10 Songs</option>
                    <option value="25">Test 25 Songs</option>
                  </select>
                  <span className="field-hint">Max songs processed per run</span>
                </div>

                {/* Checkboxes */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                  <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '12px' }}>
                    <input
                      type="checkbox"
                      checked={lyricsConfig.force}
                      onChange={e => setLyricsConfig(c => ({ ...c, force: e.target.checked }))}
                      disabled={lyricsStatus?.job?.state === 'running'}
                    />
                    <span><strong>Force regenerate existing .lrc files</strong></span>
                  </label>
                  <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '12px' }}>
                    <input
                      type="checkbox"
                      checked={lyricsConfig.demucs}
                      onChange={e => setLyricsConfig(c => ({ ...c, demucs: e.target.checked }))}
                      disabled={lyricsStatus?.job?.state === 'running'}
                    />
                    <span>HTDemucs Vocal Separation (Isolate vocals before Whisper)</span>
                  </label>
                </div>
              </div>
            </div>

            {/* 3. Real-Time Telemetry KPI Cards & Connected PC */}
            <details className="admin-disclosure lyrics-telemetry-disclosure">
              <summary className="admin-disclosure-summary" data-testid="disclosure-lyrics-telemetry">
                <div className="admin-disclosure-title">
                  <ActivityIcon />
                  <span>Hardware Telemetry & Connected PC Monitor</span>
                </div>
                <span className="admin-disclosure-badge">Host & Connected PC Metrics ▾</span>
              </summary>
              <div className="admin-disclosure-content">
                <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', marginTop: 14 }}>
              {/* Host CPU & Per-Core */}
              <div className="kpi-card">
                <div className="kpi-header">
                  <span className="kpi-label">Host CPU Utilization</span>
                  <ActivityIcon />
                </div>
                <div className="kpi-value">
                  {lyricsStatus?.resources?.host_cpu_percent !== undefined
                    ? `${lyricsStatus.resources.host_cpu_percent.toFixed(1)}%`
                    : '—'}
                </div>
                <div className="kpi-subtext">
                  {lyricsStatus?.resources?.cpu_count || 4} Cores Pinning Engine
                </div>
                {Array.isArray(lyricsStatus?.resources?.per_core_percent) && (
                  <div className="per-core-grid" title="Per-Core Load" style={{ marginTop: 8 }}>
                    {lyricsStatus.resources.per_core_percent.map((pct, idx) => (
                      <div key={idx} className="core-bar-wrapper">
                        <span className="core-label">C{idx}</span>
                        <div className="core-bar-track">
                          <div
                            className="core-bar-fill"
                            style={{
                              width: `${Math.min(100, Math.max(0, pct))}%`,
                              background: pct > 80 ? '#EF4444' : pct > 50 ? '#F59E0B' : 'var(--emerald)'
                            }}
                          />
                        </div>
                        <span className="core-pct">{Math.round(pct)}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Host Memory */}
              <div className="kpi-card">
                <div className="kpi-header">
                  <span className="kpi-label">Host Memory (RAM)</span>
                  <DeviceIcon />
                </div>
                <div className="kpi-value">
                  {lyricsStatus?.resources?.host_ram_used_mb !== undefined
                    ? `${(lyricsStatus.resources.host_ram_used_mb / 1024).toFixed(2)} GB`
                    : '—'}
                </div>
                <div className="kpi-subtext">
                  of {lyricsStatus?.resources?.host_ram_total_mb ? `${(lyricsStatus.resources.host_ram_total_mb / 1024).toFixed(1)} GB Total (${lyricsStatus.resources.host_ram_percent?.toFixed(0)}%)` : '—'}
                </div>
                <div className="resource-bar-track" style={{ marginTop: 8 }}>
                  <div
                    className="resource-bar-fill"
                    style={{
                      width: `${Math.min(100, lyricsStatus?.resources?.host_ram_percent || 0)}%`,
                      background: (lyricsStatus?.resources?.host_ram_percent || 0) > 85 ? '#EF4444' : 'var(--emerald)'
                    }}
                  />
                </div>
              </div>

              {/* Remote GPU Telemetry */}
              <div className="kpi-card">
                <div className="kpi-header">
                  <span className="kpi-label">Remote PC GPU Node</span>
                  <ActivityIcon />
                </div>
                <div className="kpi-value" style={{ fontSize: '1.2rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {lyricsConfig.remote_whisper_enabled
                    ? (remoteGpuTestResult?.gpu_name || 'NVIDIA CUDA')
                    : 'Offload Disabled'}
                </div>
                <div className="kpi-subtext">
                  {lyricsConfig.remote_whisper_enabled
                    ? (remoteGpuTestResult?.online
                        ? `${remoteGpuTestResult.total_vram_mb} MB VRAM · Latency: ${remoteGpuTestResult.latency_ms}ms`
                        : lyricsConfig.remote_whisper_url ? 'Configured (Click Ping Node)' : 'Enter PC URL below')
                    : 'Preserves server CPU by offloading AI to PC'}
                </div>
              </div>

              {/* Overall Coverage / Summary */}
              <div className="kpi-card">
                <div className="kpi-header">
                  <span className="kpi-label">Catalog Coverage</span>
                  <MusicIcon />
                </div>
                <div className="kpi-value">
                  {lyricsStatus?.job?.current_index !== undefined && lyricsStatus?.job?.total_songs
                    ? `${lyricsStatus.job.current_index} / ${lyricsStatus.job.total_songs}`
                    : `${lyricsLogs.filter(l => l.status === 'success' || l.source).length} Processed`}
                </div>
                <div className="kpi-subtext">
                  {lyricsStatus?.job?.eta_seconds ? `ETA: ${formatDuration(lyricsStatus.job.eta_seconds)}` : 'Ready for batch runs'}
                </div>
              </div>
            </div>

            {/* Connected PC Node Telemetry (Aligned directly below each corresponding Host card) */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, marginBottom: 8 }}>
              <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--emerald)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>Connected PC node telemetry {lyricsConfig.remote_whisper_url ? `(${lyricsConfig.remote_whisper_url})` : '(Local IP Not Connected)'}</span>
                {connectedPcStats?.online ? (
                  <span className="badge-pill online" style={{ fontSize: '9px', padding: '1px 6px', background: 'rgba(16, 185, 129, 0.15)', color: 'var(--emerald)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: 10 }}>
                    LIVE SYNC
                  </span>
                ) : lyricsConfig.remote_whisper_url ? (
                  <span className="badge-pill offline" style={{ fontSize: '9px', padding: '1px 6px', background: 'rgba(239, 68, 68, 0.15)', color: 'var(--red)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 10 }}>
                    STANDBY
                  </span>
                ) : null}
              </div>
              {lyricsConfig.remote_whisper_url && (
                <button
                  type="button"
                  className="btn-sync-refresh"
                  onClick={() => fetchConnectedPcTelemetry()}
                  disabled={connectedPcLoading}
                  title="Click to refresh connected PC specs and live telemetry"
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  <span style={{ display: 'inline-block', transform: connectedPcLoading ? 'rotate(180deg)' : 'none', transition: 'transform 0.4s ease' }}><RefreshIcon /></span>
                  <span>{connectedPcLoading ? 'Refreshing…' : 'Refresh Specs'}</span>
                </button>
              )}
            </div>

            <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', marginTop: 0 }}>
              {/* Card 1 (Below Host CPU): Connected PC CPU */}
              <div className="kpi-card" data-testid="connected-pc-cpu-card">
                <div className="kpi-header">
                  <span className="kpi-label">Connected PC CPU</span>
                  <ActivityIcon />
                </div>
                <div className="kpi-value">
                  {connectedPcStats?.cpu?.percent !== undefined
                    ? `${connectedPcStats.cpu.percent.toFixed(1)}%`
                    : '—'}
                </div>
                <div className="kpi-subtext">
                  {detectedCores} Cores ({detectedCpuModel}) · Pinning {lyricsConfig.pc_cpu_threads} Threads
                </div>
                <div className="resource-bar-track" style={{ marginTop: 8 }}>
                  <div
                    className="resource-bar-fill"
                    style={{
                      width: `${Math.min(100, Math.max(0, connectedPcStats?.cpu?.percent || 0))}%`,
                      background: (connectedPcStats?.cpu?.percent || 0) > 85 ? '#EF4444' : (connectedPcStats?.cpu?.percent || 0) > 60 ? '#F59E0B' : 'var(--emerald)'
                    }}
                  />
                </div>
              </div>

              {/* Card 2 (Below Host Memory): Connected PC Memory */}
              <div className="kpi-card" data-testid="connected-pc-ram-card">
                <div className="kpi-header">
                  <span className="kpi-label">Connected PC Memory (RAM)</span>
                  <DeviceIcon />
                </div>
                <div className="kpi-value">
                  {connectedPcStats?.ram?.used_mb !== undefined
                    ? `${(connectedPcStats.ram.used_mb / 1024).toFixed(2)} GB`
                    : '—'}
                </div>
                <div className="kpi-subtext">
                  of {connectedPcStats?.ram?.total_mb ? `${(connectedPcStats.ram.total_mb / 1024).toFixed(1)} GB Total (${connectedPcStats.ram.percent?.toFixed(0) || 0}%)` : `${(detectedRamMb / 1024).toFixed(1)} GB Total`} · Cap: ${(lyricsConfig.pc_max_ram_mb / 1024).toFixed(1)} GB
                </div>
                <div className="resource-bar-track" style={{ marginTop: 8 }}>
                  <div
                    className="resource-bar-fill"
                    style={{
                      width: `${Math.min(100, connectedPcStats?.ram?.percent || 0)}%`,
                      background: (connectedPcStats?.ram?.percent || 0) > 85 ? '#EF4444' : 'var(--emerald)'
                    }}
                  />
                </div>
              </div>

              {/* Card 3 (Below Host GPU): Connected PC GPU & VRAM */}
              <div className="kpi-card" data-testid="connected-pc-gpu-card">
                <div className="kpi-header">
                  <span className="kpi-label">Connected PC GPU & VRAM</span>
                  <DeviceIcon />
                </div>
                <div className="kpi-value" style={{ fontSize: '1.2rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {detectedGpuName}
                </div>
                <div className="kpi-subtext">
                  {((connectedPcStats?.gpu?.used_vram_mb ?? connectedPcStats?.used_vram_mb) !== undefined && (connectedPcStats?.gpu?.total_vram_mb || connectedPcStats?.total_vram_mb))
                    ? `${connectedPcStats?.gpu?.used_vram_mb ?? connectedPcStats?.used_vram_mb} / ${connectedPcStats?.gpu?.total_vram_mb || connectedPcStats?.total_vram_mb} MB VRAM (${connectedPcStats?.gpu?.gpu_util_pct ?? connectedPcStats?.gpu_util_pct ?? 0}% Load · ${lyricsConfig.pc_compute_type})`
                    : (remoteGpuTestResult?.online
                        ? `${remoteGpuTestResult.total_vram_mb} MB VRAM · Latency: ${remoteGpuTestResult.latency_ms}ms`
                        : lyricsConfig.remote_whisper_url ? 'Configured (Click Ping Node)' : 'Enter PC URL below')}
                </div>
                <div className="resource-bar-track" style={{ marginTop: 8 }}>
                  <div
                    className="resource-bar-fill"
                    style={{
                      width: `${(connectedPcStats?.gpu?.total_vram_mb || connectedPcStats?.total_vram_mb) ? Math.min(100, (((connectedPcStats?.gpu?.used_vram_mb ?? connectedPcStats?.used_vram_mb) || 0) / (connectedPcStats?.gpu?.total_vram_mb || connectedPcStats?.total_vram_mb)) * 100) : (remoteGpuTestResult?.online ? 10 : 0)}%`,
                      background: '#8B5CF6'
                    }}
                  />
                </div>
              </div>

              {/* Card 4 (Below Catalog Coverage / ETA): Connected PC Batch ETA & Throughput */}
              <div className="kpi-card" data-testid="connected-pc-eta-card">
                <div className="kpi-header">
                  <span className="kpi-label">Batch ETA & Throughput</span>
                  <MusicIcon />
                </div>
                <div className="kpi-value">
                  {lyricsStatus?.job?.state === 'running' && lyricsStatus?.job?.eta_seconds
                    ? `ETA: ${formatDuration(lyricsStatus.job.eta_seconds)}`
                    : `~${connectedPcStats?.throughput?.avg_sec_per_song || 3.5}s / song`}
                </div>
                <div className="kpi-subtext">
                  {lyricsStatus?.job?.state === 'running'
                    ? `Throughput: ~${connectedPcStats?.throughput?.songs_per_min || 17.1} songs/min · ${lyricsStatus.job.current_index || 0}/${lyricsStatus.job.total_songs || 0} Songs`
                    : `Throughput: ~${connectedPcStats?.throughput?.songs_per_min || 17.1} songs/min (CUDA Accelerated)`}
                </div>
                <div className="resource-bar-track" style={{ marginTop: 8 }}>
                  <div
                    className="resource-bar-fill"
                    style={{
                      width: `${lyricsStatus?.job?.total_songs ? Math.min(100, ((lyricsStatus.job.current_index || 0) / lyricsStatus.job.total_songs) * 100) : 100}%`,
                      background: 'var(--emerald)'
                    }}
                  />
                </div>
              </div>
            </div>
              </div>
            </details>

            {/* 4. Advanced Workstation Settings & Hardware Safeguards */}
            <details className="admin-disclosure lyrics-config-disclosure">
              <summary className="admin-disclosure-summary" data-testid="disclosure-lyrics-config">
                <div className="admin-disclosure-title">
                  <LyricsDocIcon />
                  <span>Advanced Workstation Settings & Hardware Safeguards</span>
                </div>
                <span className="admin-disclosure-badge">Remote GPU, Models & Limits ▾</span>
              </summary>
              <div className="admin-disclosure-content">
                <div className="lyrics-workstation-layout" style={{ marginTop: 18 }}>
              {/* CARD 2: Remote GPU Acceleration & Zero-Trace Node (All Local PC Options Here!) */}
              <div className="lyrics-card">
                <div className="lyrics-card-header">
                  <div>
                    <div className="lyrics-card-title">
                      <span>2. Remote PC GPU node (NVIDIA CUDA)</span>
                    </div>
                    <div className="lyrics-card-desc">
                      Offload AI to your laptop/PC GPU in RAM. Manage model delivery, hardware caps, and purge remotely.
                    </div>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '12px', fontWeight: 700, flexShrink: 0 }}>
                    <input
                      type="checkbox"
                      checked={lyricsConfig.remote_whisper_enabled}
                      onChange={e => setLyricsConfig(c => ({ ...c, remote_whisper_enabled: e.target.checked }))}
                      disabled={lyricsStatus?.job?.state === 'running'}
                    />
                    <span>Enable Offload</span>
                  </label>
                </div>

                {lyricsConfig.remote_whisper_enabled ? (
                  <>
                    {/* Node URL & Test Connection */}
                    <div>
                      <label className="form-label">PC / Laptop Whisper API URL</label>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input
                          type="text"
                          className="form-input-text"
                          placeholder="e.g. http://192.168.1.50:8000"
                          value={lyricsConfig.remote_whisper_url}
                          onChange={e => setLyricsConfig(c => ({ ...c, remote_whisper_url: e.target.value }))}
                          disabled={lyricsStatus?.job?.state === 'running'}
                          style={{ flex: 1, fontSize: '12px' }}
                        />
                        <button
                          type="button"
                          className="admin-nav-btn"
                          onClick={handleTestRemoteGpu}
                          disabled={remoteGpuTestLoading || !lyricsConfig.remote_whisper_url}
                          style={{ padding: '6px 12px', fontSize: '11.5px', whiteSpace: 'nowrap' }}
                        >
                          {remoteGpuTestLoading ? 'Pinging…' : 'Ping node'}
                        </button>
                      </div>
                    </div>

                    {/* Test Result Pill */}
                    {remoteGpuTestResult && (
                      <div style={{
                        padding: '8px 12px',
                        borderRadius: 8,
                        fontSize: '11px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        background: remoteGpuTestResult.online ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                        border: remoteGpuTestResult.online ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
                        color: remoteGpuTestResult.online ? '#34D399' : '#FCA5A5'
                      }}>
                        <span className={`status-dot ${remoteGpuTestResult.online ? 'online' : 'offline'}`} />
                        {remoteGpuTestResult.online ? (
                          <div style={{ flex: 1 }}>
                            <strong>Online & Ready:</strong> {remoteGpuTestResult.gpu_name} ({remoteGpuTestResult.has_cuda ? 'CUDA' : 'CPU'}, {remoteGpuTestResult.total_vram_mb} MB VRAM, Latency: {remoteGpuTestResult.latency_ms}ms)
                          </div>
                        ) : (
                          <div style={{ flex: 1 }}>
                            <strong>Unreachable:</strong> {remoteGpuTestResult.error} — Ensure <code>server.py</code> is running on your PC.
                          </div>
                        )}
                      </div>
                    )}

                    {/* Node Operation Notice */}
                    {nodeOpStatus && (
                      <div style={{
                        padding: '8px 12px',
                        borderRadius: 8,
                        fontSize: '11.5px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        background: nodeOpStatus.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : nodeOpStatus.type === 'error' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                        border: `1px solid ${nodeOpStatus.type === 'success' ? 'rgba(16, 185, 129, 0.4)' : nodeOpStatus.type === 'error' ? 'rgba(239, 68, 68, 0.4)' : 'rgba(59, 130, 246, 0.4)'}`,
                        color: nodeOpStatus.type === 'success' ? '#34D399' : nodeOpStatus.type === 'error' ? '#FCA5A5' : '#93C5FD'
                      }}>
                        <span className={`status-dot ${nodeOpStatus.type === 'success' ? 'success' : nodeOpStatus.type === 'error' ? 'error' : 'info'}`} />
                        <span>{nodeOpStatus.msg}</span>
                      </div>
                    )}

                    {/* Model Delivery Source Selection */}
                    <div>
                      <label className="form-label" style={{ marginBottom: 6 }}>Model Delivery Source</label>
                      <div className="lyrics-delivery-options">
                        <div
                          className={`lyrics-delivery-box ${lyricsConfig.model_source !== 'server' ? 'selected' : ''}`}
                          onClick={() => setLyricsConfig(c => ({ ...c, model_source: 'online' }))}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: '12px', color: 'var(--text)' }}>
                            <span><GlobeIcon /></span>
                            <span>Online (HuggingFace)</span>
                          </div>
                          <div style={{ fontSize: '10.5px', color: 'var(--text-dim)', lineHeight: 1.3 }}>
                            PC loads directly from HuggingFace CDN or local model cache.
                          </div>
                        </div>

                        <div
                          className={`lyrics-delivery-box ${(lyricsConfig.model_source === 'server') ? 'selected server' : ''}`}
                          onClick={() => setLyricsConfig(c => ({ ...c, model_source: 'server' }))}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: '12px', color: 'var(--text)' }}>
                            <span><DeviceIcon /></span>
                            <span>Sangita Server (LAN)</span>
                          </div>
                          <div style={{ fontSize: '10.5px', color: 'var(--text-dim)', lineHeight: 1.3 }}>
                            Streams model.bin directly from server memory/cache over LAN.
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Ephemeral RAM Mode Toggle */}
                    <div style={{
                      background: lyricsConfig.ephemeral_ram !== false ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                      border: lyricsConfig.ephemeral_ram !== false ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid var(--border)',
                      borderRadius: 8,
                      padding: '10px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 10
                    }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '11.5px', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>Volatile RAM-disk mode (/dev/shm)</span>
                          <span style={{ fontSize: '9px', padding: '1px 5px', borderRadius: 4, background: 'rgba(16, 185, 129, 0.2)', color: 'var(--emerald)', fontWeight: 800 }}>
                            ZERO DISK TRACE
                          </span>
                        </div>
                        <div style={{ fontSize: '10.5px', color: 'var(--text-dim)', marginTop: 2 }}>
                          Weights stay only in PC RAM/GPU and are purged immediately when done.
                        </div>
                      </div>
                      <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', flexShrink: 0 }}>
                        <input
                          type="checkbox"
                          checked={lyricsConfig.ephemeral_ram !== false}
                          onChange={e => setLyricsConfig(c => ({ ...c, ephemeral_ram: e.target.checked }))}
                          style={{ width: 15, height: 15, accentColor: 'var(--emerald)', cursor: 'pointer' }}
                        />
                      </label>
                    </div>

                    {/* Whisper Model Size */}
                    <div className="form-group">
                      <label className="form-label">Whisper Model Size</label>
                      <select
                        className="form-input-text"
                        value={lyricsConfig.model}
                        onChange={e => setLyricsConfig(c => ({ ...c, model: e.target.value }))}
                        disabled={lyricsStatus?.job?.state === 'running'}
                      >
                        <option value="small">small (460MB — Balanced, High Accuracy, 4s/song)</option>
                        <option value="base">base (140MB — Ultra Fast, Low RAM, 2s/song)</option>
                        <option value="tiny">tiny (75MB — Minimal Footprint)</option>
                        <option value="medium">medium (1.5GB — Studio Precision)</option>
                      </select>
                      <span className="field-hint">The AI model loaded into PC GPU VRAM</span>
                    </div>

                    {/* Remote PC Safeguards Controls */}
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-sub)', textTransform: 'uppercase', marginBottom: 6 }}>
                        Remote PC hardware safeguards & throttling
                      </div>

                      {/* Detected Connected PC Specs Profile Banner */}
                      <div className="pc-specs-banner" data-testid="detected-pc-specs-banner" style={{
                        background: 'var(--card)',
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        padding: '10px 14px',
                        marginBottom: 12,
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                        gap: 12
                      }}>
                        <div>
                          <span style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>
                            Detected CPU
                          </span>
                          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text)', marginTop: 2 }}>
                            {detectedCpuModel}
                          </div>
                          <div style={{ fontSize: '10.5px', color: 'var(--emerald)' }}>
                            {detectedCores} Logical Threads Available
                          </div>
                        </div>
                        <div>
                          <span style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>
                            System RAM
                          </span>
                          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text)', marginTop: 2 }}>
                            {(detectedRamMb / 1024).toFixed(1)} GB Physical RAM
                          </div>
                          <div style={{ fontSize: '10.5px', color: 'var(--text-sub)' }}>
                            Volatile RAM-Disk Ready
                          </div>
                        </div>
                        <div>
                          <span style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>
                            GPU Acceleration
                          </span>
                          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text)', marginTop: 2 }}>
                            {detectedGpuName}
                          </div>
                          <div style={{ fontSize: '10.5px', color: 'var(--emerald)' }}>
                            {remoteGpuTestResult?.total_vram_mb || connectedPcStats?.gpu?.total_vram_mb || 0} MB VRAM ({remoteGpuTestResult?.has_cuda ? 'CUDA' : 'CPU'})
                          </div>
                        </div>
                        <div>
                          <span style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>
                            Platform / OS
                          </span>
                          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text)', marginTop: 2 }}>
                            {connectedPcStats?.specs?.os || 'Connected PC'}
                          </div>
                          <div style={{ fontSize: '10.5px', color: 'var(--text-sub)' }}>
                            {remoteGpuTestResult?.online ? `Latency: ${remoteGpuTestResult.latency_ms || 0}ms` : 'Standby'}
                          </div>
                        </div>
                      </div>

                      {/* Quick Spec Presets based on Detected Hardware */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '10.5px', color: 'var(--text-dim)', marginRight: 4, fontWeight: 700 }}>
                          Spec Presets:
                        </span>
                        <button
                          type="button"
                          className="preset-pill-btn"
                          onClick={() => setLyricsConfig(c => ({
                            ...c,
                            pc_cpu_threads: Math.max(1, Math.round(detectedCores * 0.25)),
                            pc_max_ram_mb: Math.max(1024, Math.round(detectedRamMb * 0.25)),
                            pc_cooldown_sec: 1.0
                          }))}
                          title="Uses ~25% of PC specs with 1.0s cooldown so PC stays quiet"
                          style={{ fontSize: '10.5px', padding: '3px 8px', borderRadius: 6, background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)', cursor: 'pointer' }}
                        >
                          Quiet (25% Specs)
                        </button>
                        <button
                          type="button"
                          className="preset-pill-btn"
                          onClick={() => setLyricsConfig(c => ({
                            ...c,
                            pc_cpu_threads: Math.max(2, Math.round(detectedCores * 0.50)),
                            pc_max_ram_mb: Math.max(2048, Math.round(detectedRamMb * 0.50)),
                            pc_cooldown_sec: 0.5
                          }))}
                          title="Balanced ~50% specs allocation"
                          style={{ fontSize: '10.5px', padding: '3px 8px', borderRadius: 6, background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', color: 'var(--emerald)', cursor: 'pointer' }}
                        >
                          Balanced (50% Specs)
                        </button>
                        <button
                          type="button"
                          className="preset-pill-btn"
                          onClick={() => setLyricsConfig(c => ({
                            ...c,
                            pc_cpu_threads: Math.max(4, Math.round(detectedCores * 0.85)),
                            pc_max_ram_mb: Math.max(4096, Math.round(detectedRamMb * 0.75)),
                            pc_cooldown_sec: 0.0
                          }))}
                          title="Turbo throughput ~85% core allocation"
                          style={{ fontSize: '10.5px', padding: '3px 8px', borderRadius: 6, background: 'rgba(139, 92, 246, 0.15)', border: '1px solid rgba(139, 92, 246, 0.35)', color: '#C084FC', cursor: 'pointer' }}
                        >
                          Turbo (85% Specs)
                        </button>
                      </div>

                      <div className="lyrics-safeguards-grid">
                        <div>
                          <label className="form-label" style={{ fontSize: '10.5px' }}>
                            CPU Threads: <strong>{lyricsConfig.pc_cpu_threads}</strong> of {detectedCores} ({Math.round((lyricsConfig.pc_cpu_threads / detectedCores) * 100)}%)
                          </label>
                          <input
                            type="range"
                            min="1"
                            max={Math.max(4, detectedCores)}
                            value={lyricsConfig.pc_cpu_threads}
                            onChange={e => setLyricsConfig(c => ({ ...c, pc_cpu_threads: parseInt(e.target.value, 10) || 1 }))}
                            style={{ width: '100%', accentColor: '#3b82f6' }}
                            data-testid="remote-pc-threads-slider"
                          />
                        </div>
                        <div>
                          <label className="form-label" style={{ fontSize: '10.5px' }}>
                            RAM Cap: <strong>{(lyricsConfig.pc_max_ram_mb / 1024).toFixed(1)} GB</strong> of {(detectedRamMb / 1024).toFixed(1)} GB ({Math.round((lyricsConfig.pc_max_ram_mb / detectedRamMb) * 100)}%)
                          </label>
                          <input
                            type="range"
                            min="512"
                            max={Math.max(4096, detectedRamMb)}
                            step="512"
                            value={lyricsConfig.pc_max_ram_mb}
                            onChange={e => setLyricsConfig(c => ({ ...c, pc_max_ram_mb: parseInt(e.target.value, 10) || 4096 }))}
                            style={{ width: '100%', accentColor: 'var(--emerald)' }}
                            data-testid="remote-pc-ram-slider"
                          />
                        </div>
                        <div>
                          <label className="form-label" style={{ fontSize: '10.5px' }}>GPU Cooldown</label>
                          <select
                            className="form-input-text"
                            value={lyricsConfig.pc_cooldown_sec}
                            onChange={e => setLyricsConfig(c => ({ ...c, pc_cooldown_sec: parseFloat(e.target.value) || 0 }))}
                            style={{ padding: '4px 6px', fontSize: '11px' }}
                          >
                            <option value="0">0.0s (Full Speed)</option>
                            <option value="0.25">0.25s Pause</option>
                            <option value="0.5">0.5s (Balanced)</option>
                            <option value="1.0">1.0s (Quiet Fans)</option>
                            <option value="2.0">2.0s (Cool)</option>
                          </select>
                        </div>
                        <div>
                          <label className="form-label" style={{ fontSize: '10.5px' }}>Precision</label>
                          <select
                            className="form-input-text"
                            value={lyricsConfig.pc_compute_type}
                            onChange={e => setLyricsConfig(c => ({ ...c, pc_compute_type: e.target.value }))}
                            style={{ padding: '4px 6px', fontSize: '11px' }}
                          >
                            <option value="auto">auto (Optimal)</option>
                            <option value="float16">float16 (Fastest CUDA)</option>
                            <option value="int8_float16">int8_float16 (-50% VRAM)</option>
                            <option value="int8">int8 (Low Memory)</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Quick Remote Operations Action Bar */}
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-sub)', textTransform: 'uppercase', marginBottom: 6 }}>
                        Remote node operations (control local PC from server)
                      </div>
                      <div className="lyrics-quick-actions-bar">
                        <button
                          type="button"
                          className="lyrics-action-btn prime"
                          onClick={handleRemotePrime}
                          disabled={lyricsActionLoading || !lyricsConfig.remote_whisper_url}
                          title="Pre-warms and streams model into remote PC RAM/GPU so songs transcribe instantly"
                        >
                          Prime model to RAM
                        </button>
                        <button
                          type="button"
                          className="lyrics-action-btn purge"
                          onClick={handleRemotePurge}
                          disabled={lyricsActionLoading || !lyricsConfig.remote_whisper_url}
                          title="Frees PC GPU VRAM and deletes all ephemeral RAM directories (zero trace)"
                        >
                          Purge remote RAM
                        </button>
                        <button
                          type="button"
                          className="lyrics-action-btn sync"
                          onClick={handleSyncRemoteSettings}
                          disabled={lyricsActionLoading || !lyricsConfig.remote_whisper_url}
                          title="Applies the hardware safeguards directly to your PC without visiting localhost:8000"
                        >
                          Save PC safeguards
                        </button>
                      </div>
                    </div>

                    {/* Exclusive GPU Mode Switch */}
                    <div style={{
                      padding: '8px 12px',
                      borderRadius: 8,
                      background: lyricsConfig.only_remote_gpu ? 'rgba(99, 102, 241, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                      border: lyricsConfig.only_remote_gpu ? '1px solid rgba(99, 102, 241, 0.35)' : '1px solid var(--border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 10
                    }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '11.5px', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>Exclusive GPU mode (0% server CPU fallback)</span>
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginTop: 2 }}>
                          Never runs heavy AI models on this server. If PC GPU is offline, skips AI to protect server.
                        </div>
                      </div>
                      <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', flexShrink: 0 }}>
                        <input
                          type="checkbox"
                          checked={lyricsConfig.only_remote_gpu}
                          onChange={e => setLyricsConfig(c => ({ ...c, only_remote_gpu: e.target.checked }))}
                          disabled={lyricsStatus?.job?.state === 'running'}
                          style={{ width: 15, height: 15, accentColor: '#6366f1', cursor: 'pointer' }}
                        />
                      </label>
                    </div>
                  </>
                ) : (
                  <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '12px' }}>
                    <IdleIcon size={28} />
                    <div>Remote GPU Offload is currently disabled.</div>
                    <div style={{ fontSize: '11px', marginTop: 4 }}>
                      Enable offload to accelerate transcription 5x–15x on your NVIDIA PC and keep server CPU at 0%.
                    </div>
                  </div>
                )}
              </div>

              {/* CARD 3: Server Fallback & Language Governance */}
              <div className="lyrics-card">
                <div className="lyrics-card-header">
                  <div>
                    <div className="lyrics-card-title">
                      <span>3. Server fallback governance</span>
                    </div>
                    <div className="lyrics-card-desc">
                      Resource pinning and language rules if running locally on server CPU.
                    </div>
                  </div>
                </div>

                {/* Language Detection */}
                <div className="form-group">
                  <label className="form-label">Language Detection</label>
                  <select
                    className="form-input-text"
                    value={lyricsConfig.language}
                    onChange={e => setLyricsConfig(c => ({ ...c, language: e.target.value }))}
                    disabled={lyricsStatus?.job?.state === 'running'}
                  >
                    <option value="auto">Auto-detect (Multilingual Hindi/English/Punjabi)</option>
                    <option value="hi">Hindi (hi)</option>
                    <option value="en">English (en)</option>
                    <option value="pa">Punjabi (pa)</option>
                    <option value="kn">Kannada (kn)</option>
                    <option value="ta">Tamil (ta)</option>
                    <option value="te">Telugu (te)</option>
                  </select>
                  <span className="field-hint">Audio vocal language detection model</span>
                </div>

                {/* Server CPU Cores Cap */}
                <div className="form-group">
                  <label className="form-label">Server CPU Cores Cap</label>
                  <input
                    type="number"
                    min="1"
                    max={lyricsStatus?.resources?.cpu_count || 8}
                    className="form-input-text"
                    value={lyricsConfig.cores}
                    onChange={e => setLyricsConfig(c => ({ ...c, cores: parseInt(e.target.value, 10) || 1 }))}
                    disabled={lyricsStatus?.job?.state === 'running'}
                  />
                  <span className="field-hint">Worker OS affinity cap (prevents CPU lockup)</span>
                </div>

                {/* Server Max RAM Limit */}
                <div className="form-group">
                  <label className="form-label">Server Max RAM Limit (MB)</label>
                  <input
                    type="number"
                    min="512"
                    step="256"
                    className="form-input-text"
                    value={lyricsConfig.max_ram_mb}
                    onChange={e => setLyricsConfig(c => ({ ...c, max_ram_mb: parseInt(e.target.value, 10) || 2048 }))}
                    disabled={lyricsStatus?.job?.state === 'running'}
                  />
                  <span className="field-hint">Watchdog GC memory ceiling</span>
                </div>

                {/* Fallback Whisper Model */}
                <div className="form-group">
                  <label className="form-label">Server Fallback Whisper Model</label>
                  <select
                    className="form-input-text"
                    value={lyricsConfig.model}
                    onChange={e => setLyricsConfig(c => ({ ...c, model: e.target.value }))}
                    disabled={lyricsStatus?.job?.state === 'running'}
                  >
                    <option value="small">Small (int8, ~460MB - Recommended CPU)</option>
                    <option value="medium">Medium (int8, ~1.5GB - Highest Accuracy)</option>
                    <option value="base">Base (int8, ~140MB - Fast)</option>
                    <option value="tiny">Tiny (int8, ~75MB - Ultra Fast)</option>
                  </select>
                  <span className="field-hint">Model used if GPU offload is disabled or offline</span>
                </div>
              </div>
            </div>
              </div>
            </details>

            {/* 5. Lyrics Audit Log Table */}
            <details className="admin-disclosure lyrics-logs-disclosure">
              <summary className="admin-disclosure-summary" data-testid="disclosure-lyrics-logs">
                <div className="admin-disclosure-title">
                  <span>Lyrics audit & history logs</span>
                </div>
                <span className="admin-disclosure-badge">Waterfall Results & History ▾</span>
              </summary>
              <div className="admin-disclosure-content">
                <div className="admin-panel lyrics-audit-panel">
              <div className="admin-panel-header lyrics-audit-header">
                <div>
                  <div className="admin-panel-title">Lyrics Audit & History Logs</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-sub)', marginTop: 4 }}>
                    Real-time waterfall results from embedded tags, LRCLIB, and Whisper int8 transcription.
                  </div>
                </div>
                <div className="lyrics-audit-controls">
                  <input
                    type="text"
                    placeholder="Search song, artist, source…"
                    className="form-input-text"
                    style={{ width: 190, padding: '5px 10px', fontSize: '11px' }}
                    value={lyricsLogSearch}
                    onChange={e => setLyricsLogSearch(e.target.value)}
                  />
                  <select
                    className="form-input-text"
                    style={{ width: 120, padding: '5px 10px', fontSize: '11px' }}
                    value={lyricsLogFilter}
                    onChange={e => setLyricsLogFilter(e.target.value)}
                  >
                    <option value="all">All Sources</option>
                    <option value="lrclib">LRCLIB API</option>
                    <option value="remote_gpu">Remote GPU API</option>
                    <option value="whisper">Whisper AI</option>
                    <option value="embedded">Embedded Tags</option>
                    <option value="failed">Failed Only</option>
                  </select>
                  <button
                    className="admin-nav-btn"
                    onClick={fetchLyricsLogs}
                    title="Refresh logs"
                    disabled={lyricsLogsLoading}
                    style={{ padding: '5px 10px', fontSize: '11px' }}
                  >
                    <RefreshIcon />
                  </button>
                </div>
              </div>

              {/* Table */}
              {lyricsLogsLoading && lyricsLogs.length === 0 ? (
                <div className="loading-state" style={{ padding: 36 }}><div className="spinner" /><p>Loading audit records…</p></div>
              ) : lyricsLogs.length === 0 ? (
                <div className="empty-state" style={{ padding: 36 }}>
                  <LyricsDocIcon width={44} height={44} />
                  <h3 style={{ marginTop: 10, fontSize: '14px' }}>No Lyrics Generation Logs Yet</h3>
                  <p style={{ fontSize: '12px' }}>Start lyrics caption generation or retry a song to see audit rows here.</p>
                </div>
              ) : (
                <div className="lyrics-audit-table-wrap">
                  <table className="lyrics-audit-table">
                    <thead>
                      <tr>
                        <th style={{ width: '13%' }}>Time</th>
                        <th style={{ width: '38%' }}>Track / Audio File</th>
                        <th style={{ width: '10%' }}>Source</th>
                        <th style={{ width: '8%' }}>Duration</th>
                        <th style={{ width: '8%' }}>Proc Time</th>
                        <th style={{ width: '9%' }}>Status</th>
                        <th style={{ width: '14%', textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lyricsLogs
                        .filter(row => {
                          if (lyricsLogFilter === 'failed') return row.status === 'failed'
                          if (lyricsLogFilter !== 'all') return row.source?.includes(lyricsLogFilter)
                          return true
                        })
                        .filter(row => {
                          if (!lyricsLogSearch.trim()) return true
                          const q = lyricsLogSearch.toLowerCase()
                          return (
                            (row.filepath || '').toLowerCase().includes(q) ||
                            (row.title || '').toLowerCase().includes(q) ||
                            (row.artist || '').toLowerCase().includes(q) ||
                            (row.source || '').toLowerCase().includes(q)
                          )
                        })
                        .slice(0, 100)
                        .map((row, idx) => {
                          const isSuccess = row.status === 'success' || (!row.error && row.source)
                          const srcClass = row.source === 'lrclib' ? 'lrclib' : row.source?.startsWith('whisper') ? 'whisper' : row.source === 'embedded' ? 'embedded' : 'default'
                          const cleanStr = (s) => {
                            if (!s) return ''
                            let str = String(s).trim()
                            if ((str.startsWith("['") && str.endsWith("']")) || (str.startsWith('["') && str.endsWith('"]'))) {
                              str = str.slice(2, -2)
                            }
                            return str.trim()
                          }
                          const rawTitle = cleanStr(row.title)
                          const rawArtist = cleanStr(row.artist)
                          const songTitle = rawTitle || row.filepath?.split('/').pop()?.replace(/\.[^/.]+$/, '') || 'Untitled'

                          const formatCompactLogTime = (ts) => {
                            if (!ts) return '—'
                            try {
                              const raw = ts.endsWith('Z') ? ts : ts + 'Z'
                              const d = new Date(raw)
                              const t = d.toLocaleTimeString('en-US', { timeZone: effectiveTz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
                              const m = d.toLocaleDateString('en-US', { timeZone: effectiveTz, month: 'short', day: 'numeric' })
                              return `${m}, ${t}`
                            } catch (e) {
                              return ts.replace(/^\d{4}-/, '')
                            }
                          }

                          return (
                            <tr key={idx} data-testid={`lyrics-log-row-${idx}`}>
                              <td className="lyrics-time-col" title={formatTimestamp(row.timestamp, effectiveTz)}>
                                {formatCompactLogTime(row.timestamp)}
                              </td>
                              <td className="lyrics-track-col">
                                <div className="lyrics-track-main">
                                  <div className="lyrics-track-title-row">
                                    <span className="lyrics-audio-icon"><MusicIcon /></span>
                                    <span className="lyrics-track-title-text" title={songTitle}>
                                      {songTitle}
                                    </span>
                                    {rawArtist && (
                                      <span className="lyrics-track-artist-text" title={`by ${rawArtist}`}>by {rawArtist}</span>
                                    )}
                                  </div>
                                  <div className="lyrics-track-path-text" title={row.filepath}>
                                    {row.filepath}
                                  </div>
                                  {row.error && (
                                    <div className="lyrics-track-error-text" title={row.error}>
                                      <span className="status-dot error" />{row.error}
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td>
                                {row.source === 'lrclib' ? (
                                  <span className="source-pill lrclib" title="Retrieved from LRCLIB online synchronized lyrics database">
                                    Online API
                                  </span>
                                ) : row.source === 'remote_gpu' ? (
                                  <span className="source-pill" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34D399', border: '1px solid rgba(16, 185, 129, 0.35)' }} title="Transcribed via Remote PC GPU Whisper node">
                                    Remote PC GPU
                                  </span>
                                ) : row.source?.startsWith('whisper') ? (
                                  <span className="source-pill whisper" title="Transcribed on Local Machine using 500MB Whisper AI model">
                                    Local machine (Whisper)
                                  </span>
                                ) : row.source === 'embedded' ? (
                                  <span className="source-pill embedded" title="Extracted from audio file embedded tags">
                                    Embedded tag
                                  </span>
                                ) : row.source === 'skipped_existing' ? (
                                  <span className="source-pill default" title="Already exists (.lrc file)">
                                    Cached
                                  </span>
                                ) : (
                                  <span className={`source-pill ${srcClass}`}>
                                    {row.source || 'None'}
                                  </span>
                                )}
                              </td>
                              <td className="lyrics-meta-col">
                                {formatDuration(row.duration_sec)}
                              </td>
                              <td className="lyrics-meta-col">
                                {row.processing_time_sec ? `${Number(row.processing_time_sec).toFixed(1)}s` : '—'}
                              </td>
                              <td>
                                <span className={`status-pill ${isSuccess ? 'success' : 'failed'}`}>
                                  {isSuccess ? 'SUCCESS' : 'FAILED'}
                                </span>
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                <div className="lyrics-action-btns">
                                  <button
                                    className="lyrics-action-btn"
                                    onClick={() => handleRetrySong(row.filepath, false)}
                                    title="Retry single song with Whisper"
                                    disabled={lyricsStatus?.job?.state === 'running'}
                                  >
                                    Retry
                                  </button>
                                  <button
                                    className="lyrics-action-btn demucs"
                                    onClick={() => handleRetrySong(row.filepath, true)}
                                    title="Retry single song with Demucs vocal isolation"
                                    disabled={lyricsStatus?.job?.state === 'running'}
                                  >
                                    +Demucs
                                  </button>
                                  <button
                                    className="lyrics-action-btn edit"
                                    onClick={() => handleOpenEditLyrics(row.filepath)}
                                    title="Manually edit or inspect .lrc file"
                                  >
                                    Edit
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
              </div>
            </details>
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
      </main>

      {/* Add/Edit User Modal */}
      {showUserModal && (
        <div
          className="admin-modal-backdrop"
          onClick={() => setShowUserModal(false)}
          data-testid="user-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="user-modal-title"
        >
          <div className="admin-modal" onClick={e => e.stopPropagation()}>
            <h3 id="user-modal-title" className="modal-title">{isEditingUser ? `Edit User: ${formUsername}` : 'Create New User Account'}</h3>

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

      {/* Manual LRC Editor Modal */}
      {lyricsEditModal.open && (
        <div
          className="admin-modal-backdrop"
          onClick={() => setLyricsEditModal(m => ({ ...m, open: false }))}
          data-testid="lyrics-edit-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="lyrics-edit-modal-title"
        >
          <div className="admin-modal" style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 id="lyrics-edit-modal-title" className="modal-title">Edit Synced Lyrics (.lrc)</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-sub)', marginTop: 4, wordBreak: 'break-all' }}>
                {lyricsEditModal.filepath}
              </p>
            </div>

            <form onSubmit={handleSaveLyrics}>
              <div className="form-row">
                <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>LRC Content (UTF-8)</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>Format: <code>[mm:ss.xx] Lyric line</code></span>
                </label>
                {lyricsEditModal.loading ? (
                  <div className="loading-state" style={{ padding: 30 }}><div className="spinner" /><p>Fetching existing lyrics…</p></div>
                ) : (
                  <textarea
                    className="form-input-text lrc-editor-textarea"
                    rows={14}
                    placeholder="[00:01.00] Line one of lyrics&#10;[00:05.50] Line two of lyrics..."
                    value={lyricsEditModal.content}
                    onChange={e => setLyricsEditModal(m => ({ ...m, content: e.target.value }))}
                    style={{
                      fontFamily: 'monospace',
                      fontSize: '13px',
                      lineHeight: '1.5',
                      whiteSpace: 'pre',
                      resize: 'vertical'
                    }}
                    required
                    data-testid="textarea-lrc-content"
                  />
                )}
              </div>

              <div className="modal-btn-row">
                <button
                  type="button"
                  className="admin-nav-btn"
                  onClick={() => setLyricsEditModal(m => ({ ...m, open: false }))}
                  disabled={lyricsEditModal.saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="admin-nav-btn primary"
                  disabled={lyricsEditModal.loading || lyricsEditModal.saving}
                  data-testid="btn-save-lrc"
                >
                  {lyricsEditModal.saving ? 'Saving .lrc…' : 'Save Lyrics File'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Remote GPU Whisper Model Delivery Modal */}
      {remoteModelModalOpen && (
        <div
          className="admin-modal-backdrop"
          onClick={() => setRemoteModelModalOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="remote-model-modal-title"
          data-testid="remote-model-modal"
        >
          <div className="admin-modal" style={{ maxWidth: 620 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 id="remote-model-modal-title" className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>Whisper model delivery & zero-trace GPU flow</span>
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--text-sub)', marginTop: 4 }}>
                Audio is offloaded to your PC ({lyricsConfig.remote_whisper_url || 'Remote Node'}), transcribed in GPU memory, and discarded. Choose how the AI model is streamed into RAM.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, margin: '14px 0' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-dim)' }}>
                1. Select Model Delivery Source
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {/* Option 1: Online */}
                <div
                  onClick={() => setLyricsConfig(c => ({ ...c, model_source: 'online' }))}
                  style={{
                    border: (lyricsConfig.model_source || 'online') === 'online' ? '1.5px solid var(--emerald)' : '1px solid var(--border)',
                    background: (lyricsConfig.model_source || 'online') === 'online' ? 'var(--surface)' : 'transparent',
                    borderRadius: 8,
                    padding: 14,
                    cursor: 'pointer',
                    transition: 'border-color 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: '13px', color: 'var(--text)' }}>
                    <GlobeIcon width={18} height={18} />
                    <span>Online (HuggingFace)</span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: 6, lineHeight: 1.4 }}>
                    PC downloads directly from official HuggingFace CDN or uses local cache. Fastest direct transfer.
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: 4, background: 'var(--border)', color: 'var(--text-dim)', fontWeight: 700 }}>
                      RECOMMENDED
                    </span>
                  </div>
                </div>

                {/* Option 2: From Sangita Server */}
                <div
                  onClick={() => setLyricsConfig(c => ({ ...c, model_source: 'server' }))}
                  style={{
                    border: lyricsConfig.model_source === 'server' ? '1.5px solid var(--emerald)' : '1px solid var(--border)',
                    background: lyricsConfig.model_source === 'server' ? 'var(--surface)' : 'transparent',
                    borderRadius: 8,
                    padding: 14,
                    cursor: 'pointer',
                    transition: 'border-color 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: '13px', color: 'var(--text)' }}>
                    <DeviceIcon />
                    <span>From Sangita Server</span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: 6, lineHeight: 1.4 }}>
                    Streams model weights directly from this Sangita server instance over local LAN without internet access.
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: 4, background: 'var(--border)', color: 'var(--text-dim)', fontWeight: 700 }}>
                      LAN STREAM
                    </span>
                  </div>
                </div>
              </div>

              {/* Ephemeral RAM Toggle */}
              <div style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '12px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12
              }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '12px', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>Direct ephemeral RAM storage (/dev/shm)</span>
                    <span style={{ fontSize: '10px', padding: '1px 5px', borderRadius: 4, background: 'var(--border)', color: 'var(--text-dim)', fontWeight: 700 }}>
                      ZERO LOCAL DISK FOOTPRINT
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: 3 }}>
                    Downloads/loads model directly into volatile RAM-disk and GPU VRAM. All files are automatically purged when the script finishes or exits.
                  </div>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', flexShrink: 0 }}>
                  <input
                    type="checkbox"
                    checked={lyricsConfig.ephemeral_ram !== false}
                    onChange={e => setLyricsConfig(c => ({ ...c, ephemeral_ram: e.target.checked }))}
                    style={{ width: 16, height: 16, accentColor: 'var(--emerald)', cursor: 'pointer' }}
                  />
                </label>
              </div>

              {/* Model Size Summary */}
              <div style={{ fontSize: '11px', color: 'var(--text-sub)', display: 'flex', justifyContent: 'space-between', padding: '0 4px', flexWrap: 'wrap', gap: 6 }}>
                <span>Target Model: <strong>{lyricsConfig.model || 'small'} (~460 MB)</strong></span>
                <span>Language: <strong>{lyricsConfig.language || 'auto'}</strong></span>
                <span>Offload Node: <strong>{lyricsConfig.remote_whisper_url || 'Active'}</strong></span>
              </div>
            </div>

            <div className="modal-btn-row">
              <button
                type="button"
                className="admin-nav-btn"
                onClick={() => setRemoteModelModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="admin-nav-btn primary"
                onClick={() => {
                  setRemoteModelModalOpen(false)
                  handleStartLyricsWorker({
                    model_source: lyricsConfig.model_source || 'online',
                    ephemeral_ram: lyricsConfig.ephemeral_ram !== false
                  })
                }}
                disabled={lyricsActionLoading}
              >
                Start processing (zero-trace GPU)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          LIBRARY ORGANIZATION MODALS
         ========================================================================= */}

      {/* 1. Folder Classification Modal */}
      {classifyModal.open && (
        <div
          className="admin-modal-backdrop"
          onClick={() => setClassifyModal(m => ({ ...m, open: false }))}
          data-testid="classify-folder-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="classify-folder-modal-title"
        >
          <div className="admin-modal" style={{ maxWidth: 540 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 id="classify-folder-modal-title" className="modal-title">Classify Source Folder</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-sub)', marginTop: 4 }}>
                Folder: <code style={{ color: 'var(--accent)', fontWeight: 700 }}>{classifyModal.folder}</code>
              </p>
            </div>

            {classifyModal.error && (
              <div style={{ padding: '8px 12px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid var(--red)', borderRadius: 6, color: 'var(--red)', fontSize: '12px', marginBottom: 12 }}>
                {classifyModal.error}
              </div>
            )}

            <form onSubmit={handleSaveClassification}>
              <div className="form-row">
                <label className="form-label" htmlFor="select-classification">Folder Classification Role</label>
                <select
                  id="select-classification"
                  className="form-input-text"
                  value={classifyModal.classification}
                  onChange={e => setClassifyModal(m => ({ ...m, classification: e.target.value }))}
                  data-testid="select-classification"
                >
                  <option value="unclassified">Unclassified (Default review queue)</option>
                  <option value="artist">Artist (Tracks cataloged under artist)</option>
                  <option value="playlist">Playlist (Admin-managed folder playlist)</option>
                </select>
                <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: 4 }}>
                  {classifyModal.classification === 'artist' && 'Tracks inside this folder will represent catalog discography for the mapped artist.'}
                  {classifyModal.classification === 'playlist' && 'Creates an admin-managed catalog playlist with contents discovered from this folder.'}
                  {classifyModal.classification === 'unclassified' && 'Preserves folder access permissions without publishing as an artist or playlist.'}
                </div>
              </div>

              <div className="form-row">
                <label className="form-label" htmlFor="input-folder-display-name">Display Name</label>
                <input
                  id="input-folder-display-name"
                  type="text"
                  className="form-input-text"
                  placeholder={classifyModal.folder}
                  value={classifyModal.display_name}
                  onChange={e => setClassifyModal(m => ({ ...m, display_name: e.target.value }))}
                  data-testid="input-folder-display-name"
                />
              </div>

              {classifyModal.classification === 'artist' && (
                <div className="form-row">
                  <label className="form-label" htmlFor="select-mapped-artist">Mapped Catalog Artist</label>
                  <input
                    id="select-mapped-artist"
                    type="text"
                    list="catalog-artists-datalist"
                    className="form-input-text"
                    placeholder="Enter or select artist name…"
                    value={classifyModal.mapped_artist}
                    onChange={e => setClassifyModal(m => ({ ...m, mapped_artist: e.target.value }))}
                    data-testid="select-mapped-artist"
                  />
                  <datalist id="catalog-artists-datalist">
                    {artists.map(a => (
                      <option key={a.id} value={a.name} />
                    ))}
                  </datalist>
                  <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: 4 }}>
                    Type an existing artist name or enter a new artist to automatically register them in the catalog.
                  </div>
                </div>
              )}

              <div className="modal-btn-row">
                <button
                  type="button"
                  className="admin-nav-btn"
                  onClick={() => setClassifyModal(m => ({ ...m, open: false }))}
                  disabled={classifyModal.saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="admin-nav-btn primary"
                  disabled={classifyModal.saving}
                  data-testid="btn-save-classification"
                >
                  {classifyModal.saving ? 'Saving…' : 'Save Classification'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Add Artist Modal */}
      {artistModal.open && (
        <div
          className="admin-modal-backdrop"
          onClick={() => setArtistModal(m => ({ ...m, open: false }))}
          data-testid="add-artist-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-artist-modal-title"
        >
          <div className="admin-modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 id="add-artist-modal-title" className="modal-title">Add Catalog Artist</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-sub)', marginTop: 4 }}>
                Create a registered artist profile for source folder mappings.
              </p>
            </div>

            {artistModal.error && (
              <div style={{ padding: '8px 12px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid var(--red)', borderRadius: 6, color: 'var(--red)', fontSize: '12px', marginBottom: 12 }}>
                {artistModal.error}
              </div>
            )}

            <form onSubmit={handleCreateArtist}>
              <div className="form-row">
                <label className="form-label" htmlFor="input-artist-name">Artist Name *</label>
                <input
                  id="input-artist-name"
                  type="text"
                  className="form-input-text"
                  placeholder="e.g. Mac DeMarco"
                  value={artistModal.name}
                  onChange={e => setArtistModal(m => ({ ...m, name: e.target.value }))}
                  required
                  data-testid="input-artist-name"
                />
              </div>

              <div className="form-row">
                <label className="form-label" htmlFor="input-artist-bio">Bio / Description</label>
                <textarea
                  id="input-artist-bio"
                  className="form-input-text"
                  rows={3}
                  placeholder="Artist description, genre, or notes…"
                  value={artistModal.bio}
                  onChange={e => setArtistModal(m => ({ ...m, bio: e.target.value }))}
                  data-testid="input-artist-bio"
                />
              </div>

              <div className="modal-btn-row">
                <button
                  type="button"
                  className="admin-nav-btn"
                  onClick={() => setArtistModal(m => ({ ...m, open: false }))}
                  disabled={artistModal.saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="admin-nav-btn primary"
                  disabled={artistModal.saving || !artistModal.name.trim()}
                  data-testid="btn-save-artist"
                >
                  {artistModal.saving ? 'Saving…' : 'Create Artist'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Administrative Delete Playlist Dialog */}
      {deletePlaylistDialog.open && deletePlaylistDialog.playlist && (
        <div
          className="admin-modal-backdrop"
          onClick={() => setDeletePlaylistDialog({ open: false, playlist: null, deleting: false, error: null })}
          data-testid="delete-playlist-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-playlist-dialog-title"
        >
          <div className="admin-modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 id="delete-playlist-dialog-title" className="modal-title" style={{ color: 'var(--red)' }}>
                Confirm Administrative Deletion
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--text-sub)', marginTop: 4 }}>
                You are about to permanently delete an existing playlist.
              </p>
            </div>

            {deletePlaylistDialog.error && (
              <div style={{ padding: '8px 12px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid var(--red)', borderRadius: 6, color: 'var(--red)', fontSize: '12px', marginBottom: 12 }}>
                {deletePlaylistDialog.error}
              </div>
            )}

            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 14, margin: '14px 0', fontSize: '12.5px', lineHeight: 1.6 }}>
              <div><strong>Playlist:</strong> {deletePlaylistDialog.playlist.title}</div>
              <div><strong>Owner:</strong> {deletePlaylistDialog.playlist.owner}</div>
              <div><strong>Tracks:</strong> {deletePlaylistDialog.playlist.track_count} tracks</div>
              <div><strong>Visibility:</strong> {deletePlaylistDialog.playlist.visibility}</div>
            </div>

            <div style={{ fontSize: '12px', color: 'var(--text-sub)', lineHeight: 1.5, marginBottom: 16 }}>
              <strong>Impact Warning:</strong> This will permanently remove this playlist from the user's account and clear track associations. Physical audio files on the server are never touched or deleted. This action will be recorded in the security audit log with your admin identity.
            </div>

            <div className="modal-btn-row">
              <button
                type="button"
                className="admin-nav-btn"
                onClick={() => setDeletePlaylistDialog({ open: false, playlist: null, deleting: false, error: null })}
                disabled={deletePlaylistDialog.deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="admin-nav-btn"
                style={{ background: 'var(--red)', color: '#fff', borderColor: 'transparent' }}
                onClick={handleConfirmDeletePlaylist}
                disabled={deletePlaylistDialog.deleting}
                data-testid="btn-confirm-delete-playlist"
              >
                {deletePlaylistDialog.deleting ? 'Deleting…' : 'Delete Playlist'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Playlist Access Control Modal */}
      {accessModal.open && (
        <div
          className="admin-modal-backdrop"
          onClick={() => setAccessModal(m => ({ ...m, open: false }))}
          data-testid="playlist-access-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="access-modal-title"
        >
          <div className="admin-modal" style={{ maxWidth: 540 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 id="access-modal-title" className="modal-title">
                Manage Access: {accessModal.playlist?.title || accessModal.playlist?.name}
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--text-sub)', marginTop: 4 }}>
                View and manage users granted access to this playlist.
              </p>
            </div>

            {accessModal.error && (
              <div style={{ padding: '8px 12px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid var(--red)', borderRadius: 6, color: 'var(--red)', fontSize: '12px', marginBottom: 12 }}>
                {accessModal.error}
              </div>
            )}

            {/* Grant access form */}
            <form onSubmit={handleGrantUserAccess} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <input
                type="text"
                className="admin-input-search"
                style={{ flex: 1 }}
                placeholder="Enter username to grant access…"
                value={accessModal.inputUser || ''}
                onChange={e => setAccessModal(m => ({ ...m, inputUser: e.target.value }))}
                data-testid="input-grant-user"
              />
              <button
                type="submit"
                className="admin-nav-btn primary"
                disabled={!accessModal.inputUser?.trim() || accessModal.saving}
                data-testid="btn-grant-access"
              >
                {accessModal.saving ? 'Granting…' : 'Grant Access'}
              </button>
            </form>

            {/* Access grants list */}
            <div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-dim)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Users with Access Grants
              </div>

              {accessModal.loading ? (
                <div className="loading-state" style={{ padding: 20 }}>
                  <div className="spinner" />
                  <p>Loading access grants…</p>
                </div>
              ) : accessModal.users.length === 0 ? (
                <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-dim)', background: 'var(--surface)', borderRadius: 8, fontSize: '13px' }} data-testid="empty-access-grants">
                  No users have explicit access grants for this playlist.
                </div>
              ) : (
                <div className="admin-table-container">
                  <table className="admin-table" data-testid="access-grants-table">
                    <thead>
                      <tr>
                        <th>Username</th>
                        <th style={{ textAlign: 'right' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accessModal.users.map((u, idx) => {
                        const uName = typeof u === 'string' ? u : (u.username || u.user || `User ${idx}`)
                        return (
                          <tr key={uName} data-testid={`access-user-row-${uName}`}>
                            <td>
                              <span style={{ fontWeight: 600 }}>{uName}</span>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <button
                                type="button"
                                className="admin-action-btn delete"
                                onClick={() => handleRevokeUserAccess(uName)}
                                title={`Revoke access for ${uName}`}
                                aria-label={`Revoke access for ${uName}`}
                                data-testid={`btn-revoke-${uName}`}
                              >
                                <span>Revoke</span>
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="modal-btn-row" style={{ marginTop: 20 }}>
              <button
                type="button"
                className="admin-nav-btn"
                onClick={() => setAccessModal(m => ({ ...m, open: false }))}
                data-testid="btn-close-access-modal"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

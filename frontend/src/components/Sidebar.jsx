function strHue(str) {
  let h = 0; for (const c of str) h = (h*31+c.charCodeAt(0))|0; return Math.abs(h)%360
}
function PlaylistIcon({ name }) {
  const hue = strHue(name); const hue2 = (hue+50)%360
  return (
    <div className="playlist-icon"
      style={{ background:`linear-gradient(135deg,hsl(${hue},55%,22%),hsl(${hue2},60%,18%))`,
        border:`1px solid hsl(${hue},40%,30%)` }}>
      {name.slice(0,2).toUpperCase()}
    </div>
  )
}
const THEME_LABEL = { bluedark:'Blue', dark:'Dark', light:'Light' }

export default function Sidebar({
  playlists, currentPlaylist, onSelect,
  isOpen, username, onLogout,
  theme, onCycleTheme, ThemeIcon,
  deviceCount, onOpenDevices,
}) {
  const names = Object.keys(playlists)
  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-header">
        <div className="brand">
          <div className="brand-icon">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="white">
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
            </svg>
          </div>
          <span className="brand-name">Sangita</span>
        </div>
      </div>

      <div className="sidebar-section-label">Your Library</div>
      <nav className="sidebar-nav">
        {names.length === 0 ? (
          <div style={{ padding:'12px', color:'var(--text-dim)', fontSize:'0.85rem' }}>No playlists found</div>
        ) : names.map(name => (
          <div key={name} className={`playlist-item ${name===currentPlaylist?'active':''}`} onClick={() => onSelect(name)}>
            <PlaylistIcon name={name} />
            <div className="playlist-item-info">
              <div className="playlist-item-name">{name}</div>
              <div className="playlist-item-count">{playlists[name].length} track{playlists[name].length!==1?'s':''}</div>
            </div>
          </div>
        ))}
      </nav>
      <div className="sidebar-footer">
        <div className="sidebar-user-avatar">{(username||'U').slice(0,1).toUpperCase()}</div>
        <span className="sidebar-username">{username||'User'}</span>
        <button className="theme-btn" onClick={onCycleTheme}>
          <ThemeIcon theme={theme} /> {THEME_LABEL[theme]||'Theme'}
        </button>
        <button className="btn-icon" onClick={onLogout} style={{ flexShrink:0 }}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/>
          </svg>
        </button>
      </div>
    </aside>
  )
}
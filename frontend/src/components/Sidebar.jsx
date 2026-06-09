import React from 'react'

function PlaylistIcon({ name }) {
  const lowercaseName = name.toLowerCase()
  if (lowercaseName.includes('chill') || lowercaseName.includes('lofi')) {
    return (
      <div className="playlist-icon" style={{ background: 'linear-gradient(135deg, #a78bfa, #7c3aed)' }}>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="white">
          <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
        </svg>
      </div>
    )
  }
  if (lowercaseName.includes('rock') || lowercaseName.includes('metal') || lowercaseName.includes('workout')) {
    return (
      <div className="playlist-icon" style={{ background: 'linear-gradient(135deg, #f87171, #dc2626)' }}>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="white">
          <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
        </svg>
      </div>
    )
  }
  if (lowercaseName.includes('pop') || lowercaseName.includes('dance') || lowercaseName.includes('electronic')) {
    return (
      <div className="playlist-icon" style={{ background: 'linear-gradient(135deg, #60a5fa, #2563eb)' }}>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="white">
          <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
        </svg>
      </div>
    )
  }
  return (
    <div className="playlist-icon" style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
      <svg viewBox="0 0 24 24" width="16" height="16" fill="white">
        <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
      </svg>
    </div>
  )
}

export default function Sidebar({
  playlists, currentPlaylist, onSelect, isOpen, sidebarCollapsed, onToggleSidebar
}) {
  const names = Object.keys(playlists)
  
  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-header">
        <div className="brand">
          <button
            className="btn-icon sidebar-toggle-btn"
            onClick={onToggleSidebar}
            title={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-sub)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              borderRadius: '50%',
              transition: 'all 0.2s',
              flexShrink: 0
            }}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>
            </svg>
          </button>
          <div className="brand-icon" style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0 }}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="white">
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
            </svg>
          </div>
          <span className="brand-name" style={{ fontSize: '1.2rem' }}>Sangita</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="sidebar-section-label">Your Library</div>
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
    </aside>
  )
}
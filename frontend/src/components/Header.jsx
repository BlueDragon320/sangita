import React, { useState } from 'react'

export default function Header({
  view,
  onSelectView,
  isAdmin,
  searchQuery,
  onSearchChange,
  theme,
  onCycleTheme,
  ThemeIcon,
  username,
  onLogout,
  onOpenDevices,
  deviceCount
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <header className="app-header">
      {/* LEFT: Spacer */}
      <div className="header-left">
      </div>

      {/* CENTER: Search Bar */}
      <div className="header-search">
        <div className="search-input-wrapper">
          <input
            type="text"
            placeholder="Search all playlists..."
            value={searchQuery || ''}
            onChange={e => onSearchChange(e.target.value)}
            className="search-input"
          />
          <svg
            viewBox="0 0 24 24"
            width="14"
            height="14"
            fill="var(--text-dim)"
            className="search-icon"
          >
            <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
          </svg>
          {searchQuery && (
            <button onClick={() => onSearchChange('')} className="search-clear-btn">
              &times;
            </button>
          )}
        </div>
      </div>

      {/* RIGHT: System & User Options */}
      <div className="header-right">
        {/* Device Panel Toggle */}
        <button
          className="header-icon-btn"
          onClick={onOpenDevices}
          title="Connected Devices"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M4 6h18V4H4c-1.1 0-2 .9-2 2v11H0v3h14v-3H4V6zm19 2h-6c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h6c.55 0 1-.45 1-1V9c0-.55-.45-1-1-1zm-1 9h-4v-7h4v7z" />
          </svg>
          {deviceCount > 1 && (
            <span className="device-badge" style={{
              position: 'absolute',
              top: -2,
              right: -2,
              background: 'var(--accent)',
              color: '#000',
              fontSize: '0.65rem',
              fontWeight: 700,
              width: 15,
              height: 15,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {deviceCount}
            </span>
          )}
        </button>

        {/* Theme Toggle */}
        <button
          className="header-icon-btn"
          onClick={onCycleTheme}
          title="Change Theme"
        >
          <ThemeIcon theme={theme} />
        </button>

        {/* User Profile Dropdown Container */}
        <div className="user-profile-container" style={{ position: 'relative' }}>
          <div
            className="user-profile-widget"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}
          >
            <div className="user-avatar">
              {(username || 'U').slice(0, 1).toUpperCase()}
            </div>
            <span className="user-name">{username || 'User'}</span>
            <svg
              viewBox="0 0 24 24"
              width="14"
              height="14"
              fill="var(--text-dim)"
              style={{
                transform: dropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s ease',
                pointerEvents: 'none'
              }}
            >
              <path d="M7 10l5 5 5-5z" />
            </svg>
          </div>

          {dropdownOpen && (
            <>
              <div
                className="dropdown-backdrop"
                onClick={() => setDropdownOpen(false)}
                style={{
                  position: 'fixed',
                  inset: 0,
                  zIndex: 998,
                  background: 'transparent'
                }}
              />
              <div className="profile-dropdown">
                {isAdmin && (
                  <button
                    className="dropdown-item"
                    onClick={() => {
                      setDropdownOpen(false);
                      onSelectView('admin');
                    }}
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                    </svg>
                    Admin Control
                  </button>
                )}
                <button
                  className="dropdown-item logout-item"
                  onClick={() => {
                    setDropdownOpen(false);
                    onLogout();
                  }}
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                    <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/>
                  </svg>
                  Log Out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

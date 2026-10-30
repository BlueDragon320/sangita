import React, { useState } from 'react'
import ThemeSelector from './ThemeSelector.jsx'

function Header({
  view,
  onSelectView,
  isAdmin,
  searchQuery,
  onSearchChange,
  theme,
  setTheme,
  onSelectTheme,
  onCycleTheme,
  ThemeIcon,
  username,
  onLogout,
  onOpenDevices,
  deviceCount,
  onOpenMobileMenu
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <header className="app-header">
      {/* LEFT: Mobile Menu & Home */}
      <div className="header-left" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {onOpenMobileMenu && (
          <button
            className="header-icon-btn header-mobile-menu-btn"
            onClick={onOpenMobileMenu}
            aria-label="Open library navigation"
            title="Open library navigation"
            data-testid="header-mobile-menu-btn"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>
            </svg>
          </button>
        )}
        <button
          className={`header-home-btn ${view === 'home' && !searchQuery ? 'active' : ''}`}
          onClick={() => {
            onSearchChange('');
            onSelectView('home');
          }}
          title="Home Dashboard"
          aria-label="Home Dashboard"
          data-testid="header-home-btn"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
          </svg>
        </button>
      </div>

      {/* CENTER: Search Bar ("serach songs pal") */}
      <div className="header-search">
        <div className="search-input-wrapper">
          <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="var(--text-dim)"
            className="search-icon"
          >
            <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
          </svg>
          <input
            type="text"
            placeholder="Search songs or playlists"
            aria-label="Search songs or playlists"
            value={searchQuery || ''}
            onChange={e => onSearchChange(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Escape') {
                onSearchChange('');
                e.target.blur();
              }
            }}
            className="search-input"
            data-testid="header-search-input"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="search-clear-btn"
              title="Clear search"
              aria-label="Clear search"
              data-testid="header-search-clear"
            >
              &times;
            </button>
          )}
        </div>
      </div>

      {/* RIGHT: Actions, Devices, Theme, User */}
      <div className="header-right">

        {/* Device Panel Toggle */}
        <button
          className="header-icon-btn"
          onClick={onOpenDevices}
          title="Connected Devices"
          data-testid="header-devices-btn"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M4 6h18V4H4c-1.1 0-2 .9-2 2v11H0v3h14v-3H4V6zm19 2h-6c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h6c.55 0 1-.45 1-1V9c0-.55-.45-1-1-1zm-1 9h-4v-7h4v7z" />
          </svg>
          {deviceCount > 1 && (
            <span className="device-badge-counter">
              {deviceCount}
            </span>
          )}
        </button>

        {/* Theme Selection: accessible 3-theme direct selector with fallback */}
        {(setTheme || onSelectTheme) ? (
          <ThemeSelector
            theme={theme}
            onSelectTheme={setTheme || onSelectTheme}
            onCycleTheme={onCycleTheme}
            ThemeIcon={ThemeIcon}
          />
        ) : (
          <button
            className="header-icon-btn"
            onClick={onCycleTheme}
            title="Toggle Theme"
            data-testid="header-theme-btn"
          >
            {ThemeIcon ? <ThemeIcon theme={theme} /> : null}
          </button>
        )}

        {/* User Profile Dropdown Container */}
        <div className="user-profile-container" style={{ position: 'relative' }}>
          <div
            className="user-profile-widget"
            role="button"
            tabIndex={0}
            aria-haspopup="menu"
            aria-expanded={dropdownOpen}
            aria-label="User profile menu"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setDropdownOpen(!dropdownOpen);
              }
            }}
            data-testid="header-user-profile"
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
                <button
                  className="dropdown-item logout-item"
                  onClick={() => {
                    setDropdownOpen(false);
                    onLogout();
                  }}
                  data-testid="dropdown-logout-btn"
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                    <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/>
                  </svg>
                  Sign Out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

export default React.memo(Header)

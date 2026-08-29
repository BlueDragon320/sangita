import React from 'react'

export default function DevicePanel({ devices, myDeviceId, activeDeviceId, onTransfer, onClose }) {
  if (!devices) return null;
  return (
    <>
      <div className="device-panel-backdrop" onClick={onClose} data-testid="device-backdrop" />
      <div className="device-panel" data-testid="device-panel">
        <div className="device-panel-header">
          <div className="device-panel-title">
            <DevicesIcon />
            <span>Connect to a device</span>
          </div>
          <button className="btn-icon device-panel-close" onClick={onClose} title="Close" data-testid="device-close-btn">
            <CloseIcon />
          </button>
        </div>
        <div className="device-panel-list">
          {devices.length === 0 ? (
            <div className="device-panel-empty">No other devices found</div>
          ) : devices.map(device => {
            const isMe = device.deviceId === myDeviceId;
            const isActive = device.deviceId === activeDeviceId;
            return (
              <div key={device.deviceId} className={`device-item ${isActive ? 'device-item-active' : ''}`} data-testid={`device-item-${device.deviceId}`}>
                <div className="device-item-icon">
                  <DeviceTypeIcon type={device.deviceType} />
                </div>
                <div className="device-item-info">
                  <div className="device-item-name-row">
                    <span className="device-item-name" title={device.deviceName}>
                      {device.deviceName}
                    </span>
                    {isMe && <span className="device-badge">THIS DEVICE</span>}
                  </div>
                  <div className="device-item-status">
                    <span className={`device-dot ${isActive ? 'device-dot-active' : ''}`} />
                    {isActive ? 'Active · Playing here' : 'Connected'}
                  </div>
                </div>
                {!isActive && (
                  <button
                    className="device-transfer-btn"
                    onClick={() => { onTransfer(device.deviceId); onClose(); }}
                    data-testid={`transfer-btn-${device.deviceId}`}
                  >
                    SWITCH HERE
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <div className="device-panel-footer">Devices sharing the same account are listed above.</div>
      </div>
    </>
  );
}

function DeviceTypeIcon({ type }) {
  if (type === 'mobile') return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
      <path d="M17 1.01 7 1c-1.1 0-2 .9-2 2v18c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V3c0-1.1-.9-1.99-2-1.99zM17 19H7V5h10v14z"/>
    </svg>
  );
  if (type === 'tablet') return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
      <path d="M21 4H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-2 14H5V6h14v12z"/>
    </svg>
  );
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
      <path d="M21 2H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h7l-2 3v1h8v-1l-2-3h7c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 12H3V4h18v10z"/>
    </svg>
  );
}

function DevicesIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
      <path d="M4 6h18V4H4c-1.1 0-2 .9-2 2v11H0v3h14v-3H4V6zm19 2h-6c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h6c.55 0 1-.45 1-1V9c0-.55-.45-1-1-1zm-1 9h-4v-7h4v7z"/>
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
      <path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
    </svg>
  );
}
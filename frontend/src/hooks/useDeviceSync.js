import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

const SYNC_URL = import.meta.env.VITE_SYNC_URL || (typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:3001` : 'http://localhost:3001');

function getOrCreateDeviceId() {
  let id = localStorage.getItem('sangita_device_id');
  if (!id) {
    id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
    localStorage.setItem('sangita_device_id', id);
  }
  return id;
}

function detectDeviceName() {
  const ua = navigator.userAgent;
  let browser = 'Browser';
  if (ua.includes('Edg/'))                                    browser = 'Edge';
  else if (ua.includes('OPR/'))                               browser = 'Opera';
  else if (ua.includes('Chrome/') && !ua.includes('Chromium/')) browser = 'Chrome';
  else if (ua.includes('Firefox/'))                           browser = 'Firefox';
  else if (ua.includes('Safari/') && !ua.includes('Chrome/')) browser = 'Safari';
  const isMobile = /Mobi|Android/i.test(ua) && !/iPad|Tablet/i.test(ua);
  const isTablet = /iPad|Tablet|PlayBook/i.test(ua);
  const platform = isMobile ? 'Mobile' : isTablet ? 'Tablet' : 'Desktop';
  let os = '';
  if (/Windows/i.test(ua))         os = ' · Windows';
  else if (/Mac OS X/i.test(ua))   os = ' · Mac';
  else if (/Linux/i.test(ua))      os = ' · Linux';
  else if (/Android/i.test(ua))    os = ' · Android';
  else if (/iPhone|iPad/i.test(ua)) os = ' · iOS';
  return `${browser} on ${platform}${os}`;
}

function detectDeviceType() {
  const ua = navigator.userAgent;
  if (/iPad|Tablet|PlayBook/i.test(ua)) return 'tablet';
  if (/Mobi|Android/i.test(ua))         return 'mobile';
  return 'desktop';
}

export function useDeviceSync({ token, audioRef, isPlaying, onRemoteCommand }) {
  const [devices,        setDevices]        = useState([]);
  const [isActiveDevice, setIsActiveDevice] = useState(true);
  const [syncState,      setSyncState]      = useState(null);

  const socketRef      = useRef(null);
  const isActiveRef    = useRef(true);
  const posReportRef   = useRef(null);
  const heartbeatRef   = useRef(null);
  const deviceId       = useRef(getOrCreateDeviceId());
  const onRemoteCmdRef = useRef(onRemoteCommand);

  useEffect(() => { onRemoteCmdRef.current = onRemoteCommand; }, [onRemoteCommand]);
  useEffect(() => { isActiveRef.current    = isActiveDevice;  }, [isActiveDevice]);

  useEffect(() => {
    if (!token) return;
    const socket = io(SYNC_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('REGISTER_DEVICE', {
        deviceId  : deviceId.current,
        deviceName: detectDeviceName(),
        deviceType: detectDeviceType(),
      });
    });
    socket.on('connect_error', (err) => console.warn('[Sync] connect error:', err.message));
    socket.on('DEVICE_LIST_UPDATED', ({ devices: list }) => setDevices(list || []));
    socket.on('PLAYBACK_STATE_CHANGED', (state) => {
      setSyncState(state);
      const amActive = state.activeDeviceId === deviceId.current;
      setIsActiveDevice(amActive);
      if (!amActive && audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause();
      }
    });
    socket.on('REMOTE_COMMAND', (command) => {
      if (isActiveRef.current && onRemoteCmdRef.current) onRemoteCmdRef.current(command);
    });

    heartbeatRef.current = setInterval(() => {
      socket.emit('HEARTBEAT', { deviceId: deviceId.current });
    }, 25_000);

    return () => {
      clearInterval(heartbeatRef.current);
      clearInterval(posReportRef.current);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token]); // eslint-disable-line

  useEffect(() => {
    clearInterval(posReportRef.current);
    if (!isActiveDevice || !isPlaying || !socketRef.current) return;
    posReportRef.current = setInterval(() => {
      if (!socketRef.current || !audioRef.current) return;
      socketRef.current.emit('POSITION_REPORT', {
        positionMs: Math.floor(audioRef.current.currentTime * 1000),
        durationMs: isFinite(audioRef.current.duration) ? Math.floor(audioRef.current.duration * 1000) : 0,
      });
    }, 5_000);
    return () => clearInterval(posReportRef.current);
  }, [isActiveDevice, isPlaying]); // eslint-disable-line

  const broadcastState   = useCallback((state) => {
    if (socketRef.current && isActiveRef.current)
      socketRef.current.emit('PLAYBACK_STATE_CHANGED', state);
  }, []);
  const transferPlayback = useCallback((targetDeviceId) => {
    if (targetDeviceId === deviceId.current && audioRef.current && audioRef.current.paused) {
      const p = audioRef.current.play();
      if (p !== undefined) p.catch(() => {});
    }
    if (socketRef.current) {
      socketRef.current.emit('TRANSFER_PLAYBACK', { targetDeviceId });
      setSyncState(prev => {
        if (!prev) return prev;
        const newState = { ...prev, activeDeviceId: targetDeviceId, updatedAt: Date.now() };
        setIsActiveDevice(targetDeviceId === deviceId.current);
        return newState;
      });
    }
  }, [audioRef]);
  const sendRemoteControl = useCallback((command) => {
    if (socketRef.current) socketRef.current.emit('REMOTE_CONTROL', command);
  }, [audioRef]);
  const claimActiveDevice = useCallback(() => {
    transferPlayback(deviceId.current);
  }, [transferPlayback]);
  const getMyDeviceId = useCallback(() => deviceId.current, []);

  return {
    devices, isActiveDevice, syncState, setSyncState,
    broadcastState, transferPlayback, sendRemoteControl,
    claimActiveDevice, getMyDeviceId,
  };
}
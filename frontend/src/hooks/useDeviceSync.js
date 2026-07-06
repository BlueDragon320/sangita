import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

const SYNC_URL = import.meta.env.VITE_SYNC_URL || '/';

function getOrCreateDeviceId() {
  let id = sessionStorage.getItem('sangita_device_id');
  if (!id) {
    id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
    sessionStorage.setItem('sangita_device_id', id);
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
    const handleCmd = (command) => {
      if (isActiveRef.current && onRemoteCmdRef.current) onRemoteCmdRef.current(command);
    };
    socket.on('REMOTE_COMMAND', handleCmd);
    socket.on('REMOTE_CONTROL', handleCmd);

    heartbeatRef.current = setInterval(() => {
      socket.emit('HEARTBEAT', { deviceId: deviceId.current });
    }, 25_000);

    return () => {
      clearInterval(heartbeatRef.current);
      clearInterval(posReportRef.current);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token]); 

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
  }, [isActiveDevice, isPlaying]); 

  const broadcastState   = useCallback((state) => {
    if (socketRef.current && isActiveRef.current)
      socketRef.current.emit('PLAYBACK_STATE_CHANGED', state);
  }, []);
  const transferPlayback = useCallback((targetDeviceId) => {
    console.log('[transferPlayback] target:', targetDeviceId, 'myId:', deviceId.current);
    setIsActiveDevice(targetDeviceId === deviceId.current);
    
    // Warm up/unlock the audio element with a user gesture
    if (targetDeviceId === deviceId.current && audioRef.current) {
      const origMuted = audioRef.current.muted;
      audioRef.current.muted = true;
      const p = audioRef.current.play();
      if (p !== undefined) {
        p.then(() => {
          audioRef.current.pause();
          audioRef.current.muted = origMuted;
        }).catch((err) => {
          console.log('[transferPlayback] Gesture unlock catch:', err.message);
          audioRef.current.muted = origMuted;
        });
      } else {
        audioRef.current.muted = origMuted;
      }
    }

    if (socketRef.current) {
      socketRef.current.emit('TRANSFER_PLAYBACK', { targetDeviceId });
      setSyncState(prev => {
        const base = prev || {
          activeDeviceId: targetDeviceId,
          trackId: null,
          positionMs: 0,
          durationMs: 0,
          isPlaying: false,
          volume: 0.8,
          isLoop: false,
          isShuffle: false,
        };
        return { ...base, activeDeviceId: targetDeviceId, updatedAt: Date.now() };
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

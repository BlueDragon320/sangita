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

export function useDeviceSync({ token, audioRef, isPlaying, onRemoteCommand, getTrackId }) {
  const [devices,        setDevices]        = useState([]);
  const [isActiveDevice, setIsActiveDevice] = useState(true);
  const [syncState,      setSyncState]      = useState(null);

  const [isConnecting,   setIsConnecting]   = useState(Boolean(token));
  const [isConnected,    setIsConnected]    = useState(false);
  const [connectError,   setConnectError]   = useState(null);
  const [transferStatus, setTransferStatus] = useState('idle'); // 'idle' | 'transferring' | 'failed'

  const socketRef          = useRef(null);
  const isActiveRef        = useRef(true);
  const syncStateRef       = useRef(null);
  const posReportRef       = useRef(null);
  const heartbeatRef       = useRef(null);
  const transferTimeoutRef = useRef(null);
  const pendingTransferRef = useRef(null);
  const lastTargetRef      = useRef(null);
  const deviceId           = useRef(getOrCreateDeviceId());
  const onRemoteCmdRef     = useRef(onRemoteCommand);
  const getTrackIdRef      = useRef(getTrackId);
  getTrackIdRef.current    = getTrackId;

  useEffect(() => { onRemoteCmdRef.current = onRemoteCommand; }, [onRemoteCommand]);
  useEffect(() => { isActiveRef.current    = isActiveDevice;  }, [isActiveDevice]);
  useEffect(() => { syncStateRef.current   = syncState;       }, [syncState]);

  useEffect(() => {
    if (!token) {
      setIsConnecting(false);
      setIsConnected(false);
      setConnectError(null);
      return;
    }
    setIsConnecting(true);
    setConnectError(null);

    const socket = io(SYNC_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnecting(false);
      setIsConnected(true);
      setConnectError(null);
      socket.emit('REGISTER_DEVICE', {
        deviceId  : deviceId.current,
        deviceName: detectDeviceName(),
        deviceType: detectDeviceType(),
      });
    });
    socket.on('connect_error', (err) => {
      console.warn('[Sync] connect error:', err.message);
      setIsConnecting(false);
      setIsConnected(false);
      setConnectError(err?.message || 'Connection error');
    });
    socket.on('disconnect', () => {
      setIsConnected(false);
      setIsConnecting(false);
    });
    socket.on('DEVICE_LIST_UPDATED', ({ devices: list }) => {
      const curList = list || [];
      setDevices(curList);
      setSyncState(prev => {
        if (!prev) return prev;
        const activeOnline = prev.activeDeviceId && curList.some(d => d.deviceId === prev.activeDeviceId);
        if (!activeOnline && curList.length > 0 && curList[0].deviceId === deviceId.current) {
          setIsActiveDevice(true);
          return { ...prev, activeDeviceId: deviceId.current, updatedAt: Date.now() };
        }
        return prev;
      });
    });
    socket.on('PLAYBACK_STATE_CHANGED', (state) => {
      // Check if this confirms an in-flight transfer
      if (pendingTransferRef.current && (state?.activeDeviceId === pendingTransferRef.current.targetDeviceId || state?.isTransferHandoff)) {
        if (transferTimeoutRef.current) {
          clearTimeout(transferTimeoutRef.current);
          transferTimeoutRef.current = null;
        }
        pendingTransferRef.current = null;
        setTransferStatus('idle');
      }

      // The server also sends the authoritative handoff to the requester.
      // Ordinary echoes can be ignored, but skipping this one loses the song
      // or leaves the sender displaying stale playback information.
      if (state?.originDeviceId === deviceId.current && !state?.isTransferHandoff) return;
      setSyncState(state);
      const amActive = !state?.activeDeviceId || state.activeDeviceId === deviceId.current;
      setIsActiveDevice(amActive);
      isActiveRef.current = amActive;
      if (!amActive && audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause();
      }
    });
    socket.on('POSITION_SYNC', (state) => {
      if (state.originDeviceId === deviceId.current) return;
      if (!isActiveRef.current) {
        setSyncState(prev => prev ? { ...prev, ...state, isTransferHandoff: false } : state);
      }
    });
    const handleCmd = (command) => {
      if (command?.targetDeviceId && command.targetDeviceId !== deviceId.current) return;
      if (onRemoteCmdRef.current) onRemoteCmdRef.current(command);
    };
    socket.on('REMOTE_COMMAND', handleCmd);
    socket.on('REMOTE_CONTROL', handleCmd);

    heartbeatRef.current = setInterval(() => {
      socket.emit('HEARTBEAT', { deviceId: deviceId.current });
    }, 25_000);

    return () => {
      if (transferTimeoutRef.current) {
        clearTimeout(transferTimeoutRef.current);
        transferTimeoutRef.current = null;
      }
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
        trackId: getTrackIdRef.current?.(),
        isPlaying: !audioRef.current.paused && !audioRef.current.ended && audioRef.current.readyState >= 3,
        isBuffering: !audioRef.current.paused && audioRef.current.readyState < 3,
        positionMs: Math.floor(audioRef.current.currentTime * 1000),
        durationMs: isFinite(audioRef.current.duration) ? Math.floor(audioRef.current.duration * 1000) : 0,
      });
    }, 1_000);
    return () => clearInterval(posReportRef.current);
  }, [isActiveDevice, isPlaying]); 

  const broadcastState   = useCallback((state) => {
    if (socketRef.current && (isActiveRef.current || state.forceClaim))
      socketRef.current.emit('PLAYBACK_STATE_CHANGED', {
        ...state,
        originDeviceId: deviceId.current,
      });
  }, []);
  const transferPlayback = useCallback((targetDeviceId, targetTrackId) => {
    console.log('[transferPlayback] target:', targetDeviceId, 'myId:', deviceId.current, 'trackId:', targetTrackId);
    lastTargetRef.current = targetDeviceId;

    // Save rollback snapshot
    const wasActive = isActiveRef.current;
    const previousSyncState = syncStateRef.current;

    if (transferTimeoutRef.current) {
      clearTimeout(transferTimeoutRef.current);
      transferTimeoutRef.current = null;
    }

    pendingTransferRef.current = {
      targetDeviceId,
      rollbackState: {
        wasActive,
        previousSyncState,
      },
    };
    setTransferStatus('transferring');

    const isBecomingActive = targetDeviceId === deviceId.current;
    setIsActiveDevice(isBecomingActive);
    isActiveRef.current = isBecomingActive;

    // Extract exact current playback position if this device was active
    let currentPosMs = undefined;
    let currentDurMs = undefined;
    if (audioRef.current && wasActive) {
      if (!isNaN(audioRef.current.currentTime) && audioRef.current.currentTime >= 0) {
        currentPosMs = Math.floor(audioRef.current.currentTime * 1000);
      }
      if (isFinite(audioRef.current.duration) && audioRef.current.duration > 0) {
        currentDurMs = Math.floor(audioRef.current.duration * 1000);
      }
    }

    const currentTrackId = targetTrackId || (wasActive ? getTrackIdRef.current?.() : syncStateRef.current?.trackId);

    if (socketRef.current) {
      socketRef.current.emit('TRANSFER_PLAYBACK', {
        targetDeviceId,
        positionMs: currentPosMs,
        durationMs: currentDurMs,
        trackId: currentTrackId,
      });
      setSyncState(prev => {
        const base = prev || {
          activeDeviceId: targetDeviceId,
          trackId: currentTrackId || null,
          positionMs: currentPosMs ?? 0,
          durationMs: currentDurMs ?? 0,
          isPlaying: false,
          volume: 0.8,
          isLoop: false,
          isShuffle: false,
        };
        const updatedPos = currentPosMs !== undefined ? currentPosMs : base.positionMs;
        return { ...base, activeDeviceId: targetDeviceId,
          trackId: currentTrackId || base.trackId,
          positionMs: updatedPos, durationMs: currentDurMs ?? base.durationMs,
          isPlaying: wasActive && audioRef.current ? !audioRef.current.paused && !audioRef.current.ended : base.isPlaying,
          updatedAt: Date.now() };
      });
    }

    // 6-second transfer timeout that rolls back optimistic state if confirmation is not received
    transferTimeoutRef.current = setTimeout(() => {
      if (pendingTransferRef.current) {
        const { rollbackState } = pendingTransferRef.current;
        setIsActiveDevice(rollbackState.wasActive);
        isActiveRef.current = rollbackState.wasActive;
        setSyncState(rollbackState.previousSyncState);
        setTransferStatus('failed');
        pendingTransferRef.current = null;
      }
      transferTimeoutRef.current = null;
    }, 6000);
  }, [audioRef]);

  const sendRemoteControl = useCallback((command) => {
    if (socketRef.current) {
      socketRef.current.emit('REMOTE_CONTROL', {
        ...command,
        originDeviceId: deviceId.current,
      });
    }
  }, [audioRef]);
  const claimActiveDevice = useCallback((explicitTrackId) => {
    transferPlayback(deviceId.current, explicitTrackId);
  }, [transferPlayback]);
  const retryTransfer = useCallback(() => {
    if (lastTargetRef.current) {
      transferPlayback(lastTargetRef.current);
    }
  }, [transferPlayback]);
  const getMyDeviceId = useCallback(() => deviceId.current, []);

  return {
    devices, isActiveDevice, setIsActiveDevice, syncState, setSyncState,
    broadcastState, transferPlayback, sendRemoteControl,
    claimActiveDevice, getMyDeviceId,
    isConnecting, isConnected, connectError,
    transferStatus, retryTransfer,
  };
}

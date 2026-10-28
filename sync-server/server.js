'use strict';

const express         = require('express');
const { createServer } = require('http');
const { Server }      = require('socket.io');
const Redis           = require('ioredis');
const crypto          = require('crypto');
const fs              = require('fs');
const path            = require('path');

function getSecretKey() {
  if (process.env.SECRET_KEY && process.env.SECRET_KEY !== 'change-this-secret') {
    return process.env.SECRET_KEY;
  }
  const candidatePaths = [
    path.join(__dirname, 'data', '.secret_key'),
    path.join(__dirname, '..', 'data', '.secret_key'),
    path.join(__dirname, '..', 'backend', 'data', '.secret_key'),
  ];
  for (const p of candidatePaths) {
    try {
      if (fs.existsSync(p)) {
        const val = fs.readFileSync(p, 'utf8').trim();
        if (val.length >= 32) return val;
      }
    } catch (_) {}
  }
  return null;
}

const REDIS_URL   = process.env.REDIS_URL   || 'redis://localhost:6379';
const PORT        = Number(process.env.SYNC_PORT || 3001);
const DEVICE_TTL  = 120;  // seconds — refreshed by HEARTBEAT every 25s
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

const app        = express();
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

const httpServer = createServer(app);
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

const io = new Server(httpServer, {
  cors: { origin: CORS_ORIGIN, methods: ['GET', 'POST'] },
});

class MemoryRedis {
  constructor() {
    this.store = new Map();
    this.ttls = new Map();
  }

  async set(key, value) {
    this.store.set(key, value);
    if (this.ttls.has(key)) {
      clearTimeout(this.ttls.get(key));
      this.ttls.delete(key);
    }
  }

  async setex(key, ttl, value) {
    this.store.set(key, value);
    if (this.ttls.has(key)) {
      clearTimeout(this.ttls.get(key));
    }
    const timer = setTimeout(() => {
      this.store.delete(key);
      this.ttls.delete(key);
    }, ttl * 1000);
    if (timer.unref) timer.unref();
    this.ttls.set(key, timer);
  }

  async get(key) {
    return this.store.get(key) || null;
  }

  async del(key) {
    this.store.delete(key);
    if (this.ttls.has(key)) {
      clearTimeout(this.ttls.get(key));
      this.ttls.delete(key);
    }
  }

  async sadd(key, member) {
    let set = this.store.get(key);
    if (!(set instanceof Set)) {
      set = new Set();
      this.store.set(key, set);
    }
    set.add(member);
  }

  async srem(key, member) {
    const set = this.store.get(key);
    if (set instanceof Set) {
      set.delete(member);
    }
  }

  async smembers(key) {
    const set = this.store.get(key);
    if (set instanceof Set) {
      return Array.from(set);
    }
    return [];
  }
}

class RedisClientWrapper {
  constructor(url) {
    this.isMock = false;
    this.mock = new MemoryRedis();
    this.client = new Redis(url, {
      lazyConnect: true,
      connectTimeout: 2000,
      maxRetriesPerRequest: 1,
      retryStrategy(times) {
        return null; // Stop retrying immediately so fallback triggers
      }
    });
    this.client.on('error', (err) => {
      if (!this.isMock) {
        console.error('[Redis] error:', err.message);
      }
    });
  }

  async init() {
    try {
      await this.client.connect();
      console.log('[Redis] connected');
    } catch (err) {
      console.warn('[Redis] Connection failed, falling back to MemoryRedis. Error:', err.message);
      this.isMock = true;
      try {
        this.client.disconnect();
      } catch (e) {}
    }
  }

  get active() {
    return this.isMock ? this.mock : this.client;
  }

  async set(key, value) { return this.active.set(key, value); }
  async setex(key, ttl, value) { return this.active.setex(key, ttl, value); }
  async get(key) { return this.active.get(key); }
  async del(key) { return this.active.del(key); }
  async sadd(key, member) { return this.active.sadd(key, member); }
  async srem(key, member) { return this.active.srem(key, member); }
  async smembers(key) { return this.active.smembers(key); }
}

const redis = new RedisClientWrapper(REDIS_URL);
redis.init();

const K = {
  device    : (uid, did) => `sangita:device:${uid}:${did}`,
  deviceSet : (uid)      => `sangita:devices:${uid}`,
  state     : (uid)      => `sangita:state:${uid}`,
};

function verifyToken(token) {
  if (!token) return null;
  try {
    const lastDot = token.lastIndexOf('.');
    if (lastDot < 0) return null;
    const b64      = token.substring(0, lastDot);
    const sig      = token.substring(lastDot + 1);
    const secret = getSecretKey();
    if (!secret) return null;
    const expected = crypto.createHmac('sha256', secret).update(b64).digest('hex');
    if (sig.length !== expected.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'))) return null;
    const decoded = Buffer.from(b64, 'base64url').toString('utf8');
    const payload = JSON.parse(decoded);
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload.u || null;
  } catch { return null; }
}

async function saveDevice(userId, deviceData) {
  const key = K.device(userId, deviceData.deviceId);
  await redis.setex(key, DEVICE_TTL, JSON.stringify(deviceData));
  await redis.sadd(K.deviceSet(userId), deviceData.deviceId);
}

async function removeDevice(userId, deviceId) {
  await redis.del(K.device(userId, deviceId));
  await redis.srem(K.deviceSet(userId), deviceId);
}

async function getDevices(userId) {
  const ids = await redis.smembers(K.deviceSet(userId));
  if (!ids || ids.length === 0) return [];
  const results = await Promise.all(ids.map(id => redis.get(K.device(userId, id))));
  const devices = [];
  const expiredIds = [];
  for (let i = 0; i < ids.length; i++) {
    const raw = results[i];
    if (raw) {
      try {
        devices.push(JSON.parse(raw));
      } catch {
        expiredIds.push(ids[i]);
      }
    } else {
      expiredIds.push(ids[i]);
    }
  }
  if (expiredIds.length > 0) {
    await Promise.all(expiredIds.map(id => redis.srem(K.deviceSet(userId), id)));
  }
  return devices;
}

// ============================================================================
// PURE IN-MEMORY RAM PLAYBACK SESSION & DEVICE REGISTRY
// High performance (<0.1ms), zero disk lag, automatic purge on user disconnect
// ============================================================================
const inMemorySessions = new Map(); // userId -> session object
const inMemoryDevices  = new Map(); // userId -> Map<deviceId, deviceData>

function getRamSession(userId) {
  return inMemorySessions.get(userId) || null;
}

function setRamSession(userId, session) {
  inMemorySessions.set(userId, session);
}

function getDeviceList(userId) {
  const userDevs = inMemoryDevices.get(userId);
  if (!userDevs) return [];
  return Array.from(userDevs.values());
}

function deleteRamSessionIfEmpty(userId) {
  const userDevs = inMemoryDevices.get(userId);
  if (!userDevs || userDevs.size === 0) {
    inMemorySessions.delete(userId);
    inMemoryDevices.delete(userId);
    console.log(`[RAM GC] All devices offline for user=${userId}. Purged session from RAM.`);
  }
}

io.use((socket, next) => {
  const token  = socket.handshake.auth?.token || socket.handshake.query?.token;
  const userId = verifyToken(token);
  if (!userId) return next(new Error('Unauthorized'));
  socket.userId = userId;
  next();
});

io.on('connection', (socket) => {
  const { userId } = socket;
  const userRoom   = `user:${userId}`;
  socket.join(userRoom);
  console.log(`[Connect] user=${userId} socket=${socket.id}`);

  socket.on('REGISTER_DEVICE', ({ deviceId, deviceName, deviceType }) => {
    if (!deviceId) return;
    socket.deviceId = deviceId;

    if (!inMemoryDevices.has(userId)) {
      inMemoryDevices.set(userId, new Map());
    }
    inMemoryDevices.get(userId).set(deviceId, {
      deviceId,
      deviceName : deviceName || 'Unknown Device',
      deviceType : deviceType || 'desktop',
      socketId   : socket.id,
      connectedAt: Date.now(),
      lastSeen   : Date.now(),
    });

    const devices = getDeviceList(userId);
    io.to(userRoom).emit('DEVICE_LIST_UPDATED', { devices });

    let session = getRamSession(userId);
    if (!session) {
      session = {
        activeDeviceId: deviceId,
        trackId: '',
        positionMs: 0,
        durationMs: 0,
        isPlaying: false,
        isBuffering: false,
        volume: 0.8,
        isLoop: false,
        isShuffle: false,
        originDeviceId: deviceId,
        updatedAt: Date.now(),
      };
      setRamSession(userId, session);
      io.to(userRoom).emit('PLAYBACK_STATE_CHANGED', session);
    } else {
      const activeOnline = session.activeDeviceId && devices.some(d => d.deviceId === session.activeDeviceId);
      if (!session.activeDeviceId || !activeOnline) {
        session.activeDeviceId = deviceId;
        session.updatedAt = Date.now();
        setRamSession(userId, session);
        io.to(userRoom).emit('PLAYBACK_STATE_CHANGED', session);
      } else {
        // Send current running session snapshot immediately to the connecting device
        socket.emit('PLAYBACK_STATE_CHANGED', session);
      }
    }
    console.log(`[Register RAM] user=${userId} device=${deviceId} name="${deviceName}" active=${session.activeDeviceId}`);
  });

  socket.on('HEARTBEAT', ({ deviceId, deviceName, deviceType }) => {
    if (!deviceId) return;
    const userDevs = inMemoryDevices.get(userId);
    if (userDevs && userDevs.has(deviceId)) {
      const dev = userDevs.get(deviceId);
      dev.lastSeen = Date.now();
      dev.socketId = socket.id;
    } else if (userDevs) {
      userDevs.set(deviceId, {
        deviceId,
        deviceName: deviceName || 'Connected Device',
        deviceType: deviceType || 'desktop',
        socketId: socket.id,
        connectedAt: Date.now(),
        lastSeen: Date.now(),
      });
    }
  });

  socket.on('TRANSFER_PLAYBACK', ({ targetDeviceId, playImmediately = true, positionMs, durationMs }) => {
    const { userId, deviceId } = socket;
    if (!userId || !targetDeviceId) return;

    const currentSession = getRamSession(userId) || {};

    let extrapolatedPositionMs = Number(positionMs !== undefined ? positionMs : (currentSession.positionMs || 0));
    if (positionMs === undefined && currentSession.isPlaying && currentSession.updatedAt) {
      const elapsed = Date.now() - Number(currentSession.updatedAt);
      extrapolatedPositionMs = Math.min(
        Number(currentSession.durationMs || Infinity),
        extrapolatedPositionMs + Math.max(0, elapsed)
      );
    }

    const handoffState = {
      ...currentSession,
      positionMs: extrapolatedPositionMs,
      durationMs: Number(durationMs !== undefined ? durationMs : (currentSession.durationMs || 0)),
      activeDeviceId: targetDeviceId,
      isPlaying: Boolean(playImmediately),
      isBuffering: false,
      originDeviceId: deviceId,
      isTransferHandoff: true,
      updatedAt: Date.now(),
    };

    setRamSession(userId, handoffState);

    // Broadcast handoff state to entire room (target begins playback, sender pauses)
    io.to(userRoom).emit('PLAYBACK_STATE_CHANGED', handoffState);
    const devices = getDeviceList(userId);
    io.to(userRoom).emit('DEVICE_LIST_UPDATED', { devices });
    console.log(`[Transfer RAM] user=${userId} → device=${targetDeviceId} pos=${handoffState.positionMs}ms`);
  });

  socket.on('PLAYBACK_STATE_CHANGED', (state) => {
    const { userId, deviceId } = socket;
    if (!userId || !deviceId) return;

    let currentSession = getRamSession(userId);
    if (!currentSession) {
      currentSession = {
        activeDeviceId: deviceId,
        trackId: '',
        positionMs: 0,
        durationMs: 0,
        isPlaying: false,
        isBuffering: false,
        volume: 0.8,
        isLoop: false,
        isShuffle: false,
        originDeviceId: deviceId,
        updatedAt: Date.now(),
      };
    }

    if (
      currentSession.activeDeviceId &&
      currentSession.activeDeviceId !== deviceId &&
      !state.forceClaim
    ) {
      return; // Passive device cannot directly overwrite active state
    }

    const updatedSession = {
      ...currentSession,
      ...state,
      trackId: state.trackId !== undefined ? state.trackId : currentSession.trackId,
      positionMs: Number(state.positionMs ?? currentSession.positionMs ?? 0),
      durationMs: Number(state.durationMs ?? currentSession.durationMs ?? 0),
      isPlaying: Boolean(state.isPlaying && !state.isBuffering),
      isBuffering: Boolean(state.isBuffering),
      activeDeviceId: state.activeDeviceId || currentSession.activeDeviceId || deviceId,
      originDeviceId: deviceId,
      isTransferHandoff: false,
      updatedAt: Date.now(),
    };

    setRamSession(userId, updatedSession);

    // Instantly propagate state update to other devices in room
    socket.to(userRoom).emit('PLAYBACK_STATE_CHANGED', updatedSession);
  });

  socket.on('POSITION_REPORT', ({ positionMs, durationMs }) => {
    const session = getRamSession(userId);
    if (!session || session.activeDeviceId !== socket.deviceId) return;

    session.positionMs = Number(positionMs || 0);
    if (durationMs !== undefined) session.durationMs = Number(durationMs || 0);
    session.updatedAt  = Date.now();

    // Replicate live timestamp to all passive devices so scrubbers stay in sync
    socket.to(userRoom).emit('POSITION_SYNC', {
      positionMs: session.positionMs,
      durationMs: session.durationMs,
      updatedAt: session.updatedAt,
      originDeviceId: socket.deviceId,
    });
  });

  socket.on('REMOTE_CONTROL', ({ action, payload, targetDeviceId }) => {
    const { userId, deviceId } = socket;
    if (!userId) return;

    const session = getRamSession(userId);
    const resolvedTargetId = targetDeviceId || session?.activeDeviceId;

    if (!resolvedTargetId || resolvedTargetId === deviceId) return;

    const commandObj = {
      action,
      payload: payload || {},
      targetDeviceId: resolvedTargetId,
      originDeviceId: deviceId,
      timestamp: Date.now(),
    };

    const userDevs = inMemoryDevices.get(userId);
    const targetDev = userDevs?.get(resolvedTargetId);
    if (targetDev && targetDev.socketId) {
      io.to(targetDev.socketId).emit('REMOTE_COMMAND', commandObj);
    } else {
      // Fallback for a device that has not registered its socket yet.
      socket.to(userRoom).emit('REMOTE_COMMAND', commandObj);
    }
  });

  socket.on('disconnect', (reason) => {
    const { deviceId } = socket;
    console.log(`[Disconnect] user=${userId} device=${deviceId} reason=${reason}`);
    if (!deviceId) return;

    const userDevs = inMemoryDevices.get(userId);
    if (userDevs) {
      userDevs.delete(deviceId);
    }

    const devices = getDeviceList(userId);
    io.to(userRoom).emit('DEVICE_LIST_UPDATED', { devices });

    if (devices.length === 0) {
      // Automatic memory cleanup: all user devices went offline
      deleteRamSessionIfEmpty(userId);
    } else {
      const session = getRamSession(userId);
      if (session && session.activeDeviceId === deviceId) {
        // Fall back active control to the next available online device, paused
        session.activeDeviceId = devices[0].deviceId;
        session.isPlaying = false;
        session.updatedAt = Date.now();
        setRamSession(userId, session);
        io.to(userRoom).emit('PLAYBACK_STATE_CHANGED', session);
      }
    }
  });
});

httpServer.listen(PORT, () => console.log(`[Sangita Sync] In-Memory RAM Sync Server listening on :${PORT}`));
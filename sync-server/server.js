'use strict';

const express         = require('express');
const { createServer } = require('http');
const { Server }      = require('socket.io');
const Redis           = require('ioredis');
const crypto          = require('crypto');

const SECRET_KEY  = process.env.SECRET_KEY  || 'change-this-secret';
const REDIS_URL   = process.env.REDIS_URL   || 'redis://localhost:6379';
const PORT        = Number(process.env.SYNC_PORT || 3001);
const DEVICE_TTL  = 30;   // seconds — refreshed by HEARTBEAT every 25s
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

const app        = express();
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
    const expected = crypto.createHmac('sha256', SECRET_KEY).update(b64).digest('hex');
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
  const devices = [];
  for (const id of ids) {
    const raw = await redis.get(K.device(userId, id));
    if (raw) { devices.push(JSON.parse(raw)); }
    else      { await redis.srem(K.deviceSet(userId), id); } // TTL expired
  }
  return devices;
}

async function getState(userId) {
  const raw = await redis.get(K.state(userId));
  return raw ? JSON.parse(raw) : null;
}

async function saveState(userId, state) {
  await redis.set(K.state(userId), JSON.stringify(state));
}

io.use((socket, next) => {
  const token  = socket.handshake.auth?.token || socket.handshake.query?.token;
  const userId = verifyToken(token);
  if (!userId) return next(new Error('Unauthorized'));
  socket.userId = userId;
  next();
});

io.on('connection', async (socket) => {
  const { userId } = socket;
  const userRoom   = `user:${userId}`;
  socket.join(userRoom);
  console.log(`[Connect] user=${userId} socket=${socket.id}`);

  socket.on('REGISTER_DEVICE', async ({ deviceId, deviceName, deviceType }) => {
    if (!deviceId) return;
    socket.deviceId = deviceId;
    const deviceData = {
      deviceId,
      deviceName : deviceName || 'Unknown Device',
      deviceType : deviceType || 'desktop',
      socketId   : socket.id,
      connectedAt: Date.now(),
    };
    await saveDevice(userId, deviceData);
    const devices = await getDevices(userId);
    io.to(userRoom).emit('DEVICE_LIST_UPDATED', { devices });
    const state = await getState(userId);
    if (state) {
      if (!state.activeDeviceId) {
        state.activeDeviceId = deviceId;
        state.updatedAt = Date.now();
        await saveState(userId, state);
        io.to(userRoom).emit('PLAYBACK_STATE_CHANGED', state);
      } else {
        socket.emit('PLAYBACK_STATE_CHANGED', state);
      }
    }
    console.log(`[Register] user=${userId} device=${deviceId} name="${deviceName}"`);
  });

  socket.on('HEARTBEAT', async ({ deviceId }) => {
    if (!deviceId) return;
    const raw = await redis.get(K.device(userId, deviceId));
    if (raw) {
      const data = JSON.parse(raw);
      data.socketId = socket.id;
      await redis.setex(K.device(userId, deviceId), DEVICE_TTL, JSON.stringify(data));
    }
  });

  socket.on('TRANSFER_PLAYBACK', async ({ targetDeviceId }) => {
    if (!targetDeviceId) return;
    let state = await getState(userId) || {
      activeDeviceId: null, trackId: null,
      positionMs: 0, durationMs: 0, isPlaying: false, volume: 0.8, updatedAt: Date.now(),
    };
    if (state.isPlaying && state.updatedAt) {
      state.positionMs = Math.max(0, state.positionMs + (Date.now() - state.updatedAt));
    }
    state.activeDeviceId = targetDeviceId;
    state.updatedAt      = Date.now();
    await saveState(userId, state);
    io.to(userRoom).emit('PLAYBACK_STATE_CHANGED', state);
    const devices = await getDevices(userId);
    io.to(userRoom).emit('DEVICE_LIST_UPDATED', { devices });
    console.log(`[Transfer] user=${userId} → device=${targetDeviceId} pos=${state.positionMs}ms`);
  });

  socket.on('PLAYBACK_STATE_CHANGED', async (data) => {
    const state = { ...data, updatedAt: Date.now() };
    await saveState(userId, state);
    socket.to(userRoom).emit('PLAYBACK_STATE_CHANGED', state); // relay to others
  });

  socket.on('POSITION_REPORT', async ({ positionMs, durationMs }) => {
    const state = await getState(userId);
    if (!state || state.activeDeviceId !== socket.deviceId) return;
    state.positionMs = positionMs;
    if (durationMs !== undefined) state.durationMs = durationMs;
    state.updatedAt  = Date.now();
    await saveState(userId, state); // server-side correction, no broadcast
  });

  socket.on('REMOTE_CONTROL', async (command) => {
    const state = await getState(userId);
    if (!state?.activeDeviceId || state.activeDeviceId === socket.deviceId) return;
    const raw = await redis.get(K.device(userId, state.activeDeviceId));
    if (!raw) return;
    const activeDevice = JSON.parse(raw);
    io.to(activeDevice.socketId).emit('REMOTE_COMMAND', command);
  });

  socket.on('disconnect', async (reason) => {
    const { deviceId } = socket;
    console.log(`[Disconnect] user=${userId} device=${deviceId} reason=${reason}`);
    if (!deviceId) return;
    await removeDevice(userId, deviceId);
    const state = await getState(userId);
    if (state?.activeDeviceId === deviceId) {
      const remaining = await getDevices(userId);
      if (remaining.length > 0) {
        if (state.isPlaying && state.updatedAt) {
          state.positionMs = Math.max(0, state.positionMs + (Date.now() - state.updatedAt));
        }
        state.activeDeviceId = remaining[0].deviceId;
        state.updatedAt      = Date.now();
        await saveState(userId, state);
        io.to(userRoom).emit('PLAYBACK_STATE_CHANGED', state);
        console.log(`[AutoTransfer] user=${userId} → device=${state.activeDeviceId}`);
      } else {
        state.isPlaying      = false;
        state.activeDeviceId = null;
        state.updatedAt      = Date.now();
        await saveState(userId, state);
      }
    }
    const devices = await getDevices(userId);
    io.to(userRoom).emit('DEVICE_LIST_UPDATED', { devices });
  });
});

httpServer.listen(PORT, () => console.log(`[Sangita Sync] listening on :${PORT}`));
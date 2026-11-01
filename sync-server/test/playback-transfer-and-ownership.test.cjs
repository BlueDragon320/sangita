'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const net = require('node:net');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { io } = require('../../frontend/node_modules/socket.io-client');

function tokenFor(user, secret) {
  const payload = Buffer.from(
    JSON.stringify({ u: user, exp: Math.floor(Date.now() / 1000) + 300 })
  ).toString('base64url');
  return `${payload}.${crypto.createHmac('sha256', secret).update(payload).digest('hex')}`;
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}

function onceEvent(socket, event, predicate = () => true, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`Timed out waiting for ${event}`));
    }, timeoutMs);
    const handler = (value) => {
      if (predicate(value)) {
        clearTimeout(timer);
        socket.off(event, handler);
        resolve(value);
      }
    };
    socket.on(event, handler);
  });
}

async function startServer(port, secret) {
  const server = spawn(process.execPath, ['server.js'], {
    cwd: path.resolve(__dirname, '..'),
    env: {
      ...process.env,
      SYNC_PORT: String(port),
      SECRET_KEY: secret,
      REDIS_URL: 'redis://127.0.0.1:1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  await new Promise((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => reject(new Error('Sync server did not start in time')), 10000);
    server.stdout.on('data', (chunk) => {
      output += chunk;
      if (output.includes('listening on')) {
        clearTimeout(timer);
        resolve();
      }
    });
    server.once('exit', (code) => reject(new Error(`Sync server exited early with code ${code}`)));
  });

  return server;
}

function connectSocket(port, secret, user) {
  return new Promise((resolve, reject) => {
    const socket = io(`http://127.0.0.1:${port}`, {
      auth: { token: tokenFor(user, secret) },
      transports: ['websocket'],
      reconnection: false,
    });
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', reject);
  });
}

// -----------------------------------------------------------------------------
// Test 1: Seamless Playback Transfer (Web <-> Android)
// -----------------------------------------------------------------------------
test('Seamless playback transfer: Web to Android and Android to Web with exact state and ownership', async () => {
  const port = await freePort();
  const secret = 'transfer-ownership-test-secret';
  const server = await startServer(port, secret);
  const sockets = [];

  try {
    const web = await connectSocket(port, secret, 'alice');
    sockets.push(web);
    const webRegistered = onceEvent(web, 'DEVICE_LIST_UPDATED', (v) =>
      v.devices.some((d) => d.deviceId === 'web-player')
    );
    web.emit('REGISTER_DEVICE', {
      deviceId: 'web-player',
      deviceName: 'Sangita Web Chrome',
      deviceType: 'desktop',
    });
    await webRegistered;

    const android = await connectSocket(port, secret, 'alice');
    sockets.push(android);
    const bothRegistered = onceEvent(android, 'DEVICE_LIST_UPDATED', (v) => v.devices.length === 2);
    android.emit('REGISTER_DEVICE', {
      deviceId: 'android-phone',
      deviceName: 'Pixel 8 Pro',
      deviceType: 'mobile',
    });
    await bothRegistered;

    // Web starts playback of a track
    const webPlaybackStarted = onceEvent(android, 'PLAYBACK_STATE_CHANGED', (s) => s.isPlaying === true);
    web.emit('PLAYBACK_STATE_CHANGED', {
      trackId: 'Bollywood/Chaiyya Chaiyya.flac',
      positionMs: 42000,
      durationMs: 390000,
      isPlaying: true,
      isBuffering: false,
      volume: 0.85,
    });
    const initialPlayback = await webPlaybackStarted;
    assert.equal(initialPlayback.trackId, 'Bollywood/Chaiyya Chaiyya.flac');
    assert.equal(initialPlayback.activeDeviceId, 'web-player');
    assert.equal(initialPlayback.positionMs, 42000);
    assert.equal(initialPlayback.isPlaying, true);

    // 1. Web to Android handoff (playing transfer)
    const handoffToAndroidWeb = onceEvent(web, 'PLAYBACK_STATE_CHANGED', (s) => s.isTransferHandoff);
    const handoffToAndroidPhone = onceEvent(android, 'PLAYBACK_STATE_CHANGED', (s) => s.isTransferHandoff);

    web.emit('TRANSFER_PLAYBACK', {
      targetDeviceId: 'android-phone',
      playImmediately: true,
      positionMs: 42000,
      durationMs: 390000,
      trackId: 'Bollywood/Chaiyya Chaiyya.flac',
    });

    const webHandoff = await handoffToAndroidWeb;
    const phoneHandoff = await handoffToAndroidPhone;

    for (const h of [webHandoff, phoneHandoff]) {
      assert.equal(h.activeDeviceId, 'android-phone', 'Active device ownership transferred to Android');
      assert.equal(h.originDeviceId, 'web-player', 'Origin device was web-player');
      assert.equal(h.trackId, 'Bollywood/Chaiyya Chaiyya.flac', 'Track identity preserved');
      assert.equal(h.positionMs, 42000, 'Exact position preserved');
      assert.equal(h.durationMs, 390000, 'Duration preserved');
      assert.equal(h.isPlaying, true, 'Handoff playing state is true');
      assert.equal(h.isTransferHandoff, true, 'isTransferHandoff flag is true');
    }

    // Android is now active device: reports position advances
    const posSyncOnWeb = onceEvent(web, 'POSITION_SYNC');
    android.emit('POSITION_REPORT', {
      trackId: 'Bollywood/Chaiyya Chaiyya.flac',
      positionMs: 44000,
      durationMs: 390000,
      isPlaying: true,
      isBuffering: false,
    });
    const syncedPos = await posSyncOnWeb;
    assert.equal(syncedPos.positionMs, 44000);
    assert.equal(syncedPos.activeDeviceId, 'android-phone');
    assert.equal(syncedPos.isTransferHandoff, false);

    // Former active device (web) position reports must be ignored by server
    let webReportLeaked = false;
    android.on('POSITION_SYNC', (s) => {
      if (s.positionMs === 999999) webReportLeaked = true;
    });
    web.emit('POSITION_REPORT', {
      trackId: 'Bollywood/Chaiyya Chaiyya.flac',
      positionMs: 999999,
      durationMs: 390000,
    });
    await new Promise((r) => setTimeout(r, 150));
    assert.equal(webReportLeaked, false, 'Inactive web player position report must be discarded');

    // 2. Android to Web handoff with paused state (paused handoff)
    // Android pauses playback first
    const androidPaused = onceEvent(web, 'PLAYBACK_STATE_CHANGED', (s) => s.isPlaying === false);
    android.emit('PLAYBACK_STATE_CHANGED', {
      trackId: 'Indie/O Sanam.mp3',
      positionMs: 78000,
      durationMs: 250000,
      isPlaying: false,
      isBuffering: false,
    });
    await androidPaused;

    // Android transfers paused state to web
    const returnToWebHandoff = onceEvent(web, 'PLAYBACK_STATE_CHANGED', (s) => s.isTransferHandoff);
    const returnToPhoneHandoff = onceEvent(android, 'PLAYBACK_STATE_CHANGED', (s) => s.isTransferHandoff);

    android.emit('TRANSFER_PLAYBACK', {
      targetDeviceId: 'web-player',
      playImmediately: false,
      positionMs: 78000,
      durationMs: 250000,
      trackId: 'Indie/O Sanam.mp3',
    });

    const returnedWeb = await returnToWebHandoff;
    const returnedPhone = await returnToPhoneHandoff;

    for (const ret of [returnedWeb, returnedPhone]) {
      assert.equal(ret.activeDeviceId, 'web-player', 'Active device ownership returned to web');
      assert.equal(ret.originDeviceId, 'android-phone');
      assert.equal(ret.trackId, 'Indie/O Sanam.mp3', 'Track identity preserved across handoff');
      assert.equal(ret.positionMs, 78000, 'Position preserved');
      assert.equal(ret.durationMs, 250000);
      assert.equal(ret.isPlaying, false, 'Paused state preserved during handoff');
      assert.equal(ret.isTransferHandoff, true);
    }
  } finally {
    sockets.forEach((s) => s.disconnect());
    server.kill();
  }
});

// -----------------------------------------------------------------------------
// Test 2: Remote Control Command Dispatch (SEEK_TO, TOGGLE_PLAY, SKIP_NEXT)
// -----------------------------------------------------------------------------
test('Remote control command dispatch: SEEK_TO, TOGGLE_PLAY, SKIP_NEXT delivered only to active device', async () => {
  const port = await freePort();
  const secret = 'remote-control-test-secret';
  const server = await startServer(port, secret);
  const sockets = [];

  try {
    // web-player: Active device
    const web = await connectSocket(port, secret, 'alice');
    sockets.push(web);
    web.emit('REGISTER_DEVICE', {
      deviceId: 'web-player',
      deviceName: 'Web Speaker',
      deviceType: 'desktop',
    });
    await onceEvent(web, 'DEVICE_LIST_UPDATED', (v) => v.devices.some((d) => d.deviceId === 'web-player'));

    // android-phone: Passive controller
    const android = await connectSocket(port, secret, 'alice');
    sockets.push(android);
    android.emit('REGISTER_DEVICE', {
      deviceId: 'android-phone',
      deviceName: 'Pixel Controller',
      deviceType: 'mobile',
    });
    await onceEvent(android, 'DEVICE_LIST_UPDATED', (v) => v.devices.length === 2);

    // tablet-device: Second passive controller
    const tablet = await connectSocket(port, secret, 'alice');
    sockets.push(tablet);
    tablet.emit('REGISTER_DEVICE', {
      deviceId: 'tablet-device',
      deviceName: 'iPad Controller',
      deviceType: 'tablet',
    });
    await onceEvent(tablet, 'DEVICE_LIST_UPDATED', (v) => v.devices.length === 3);

    // Establish web-player as active playing device
    const activeConfirmed = onceEvent(android, 'PLAYBACK_STATE_CHANGED', (s) => s.activeDeviceId === 'web-player');
    web.emit('PLAYBACK_STATE_CHANGED', {
      trackId: 'Pop/Track1.mp3',
      positionMs: 10000,
      durationMs: 200000,
      isPlaying: true,
      isBuffering: false,
    });
    await activeConfirmed;

    // Monitor passive devices for leaked commands
    let leakedToAndroid = 0;
    let leakedToTablet = 0;
    android.on('REMOTE_COMMAND', () => { leakedToAndroid++; });
    tablet.on('REMOTE_COMMAND', () => { leakedToTablet++; });

    // 1. Dispatch SEEK_TO
    const seekCmdPromise = onceEvent(web, 'REMOTE_COMMAND', (c) => c.action === 'SEEK_TO');
    android.emit('REMOTE_CONTROL', {
      action: 'SEEK_TO',
      payload: { positionMs: 75000 },
      // targetDeviceId omitted: must resolve automatically to activeDeviceId (web-player)
    });
    const seekCmd = await seekCmdPromise;
    assert.equal(seekCmd.action, 'SEEK_TO');
    assert.equal(seekCmd.targetDeviceId, 'web-player');
    assert.equal(seekCmd.originDeviceId, 'android-phone');
    assert.equal(seekCmd.payload.positionMs, 75000);

    // 2. Dispatch TOGGLE_PLAY
    const toggleCmdPromise = onceEvent(web, 'REMOTE_COMMAND', (c) => c.action === 'TOGGLE_PLAY');
    android.emit('REMOTE_CONTROL', {
      action: 'TOGGLE_PLAY',
      payload: {},
    });
    const toggleCmd = await toggleCmdPromise;
    assert.equal(toggleCmd.action, 'TOGGLE_PLAY');
    assert.equal(toggleCmd.targetDeviceId, 'web-player');
    assert.equal(toggleCmd.originDeviceId, 'android-phone');

    // 3. Dispatch SKIP_NEXT
    const skipCmdPromise = onceEvent(web, 'REMOTE_COMMAND', (c) => c.action === 'SKIP_NEXT');
    tablet.emit('REMOTE_CONTROL', {
      action: 'SKIP_NEXT',
      payload: {},
    });
    const skipCmd = await skipCmdPromise;
    assert.equal(skipCmd.action, 'SKIP_NEXT');
    assert.equal(skipCmd.targetDeviceId, 'web-player');
    assert.equal(skipCmd.originDeviceId, 'tablet-device');

    // Wait to ensure no queued commands leaked to passive controllers
    await new Promise((r) => setTimeout(r, 200));
    assert.equal(leakedToAndroid, 0, 'Passive Android controller must not receive REMOTE_COMMAND');
    assert.equal(leakedToTablet, 0, 'Passive Tablet controller must not receive REMOTE_COMMAND');

    // Active device sending remote control targeting itself must be safely ignored
    let selfCommandReceived = false;
    web.on('REMOTE_COMMAND', (c) => {
      if (c.originDeviceId === 'web-player') selfCommandReceived = true;
    });
    web.emit('REMOTE_CONTROL', {
      action: 'TOGGLE_PLAY',
      payload: {},
      targetDeviceId: 'web-player',
    });
    await new Promise((r) => setTimeout(r, 150));
    assert.equal(selfCommandReceived, false, 'Self-targeted remote command must be ignored');
  } finally {
    sockets.forEach((s) => s.disconnect());
    server.kill();
  }
});

// -----------------------------------------------------------------------------
// Test 3: Rapid Seeking Stress (High-Frequency Position Reports)
// -----------------------------------------------------------------------------
test('Rapid seeking stress: high-frequency position reports do not desynchronize session state', async () => {
  const port = await freePort();
  const secret = 'rapid-seek-stress-secret';
  const server = await startServer(port, secret);
  const sockets = [];

  try {
    const activePlayer = await connectSocket(port, secret, 'alice');
    sockets.push(activePlayer);
    activePlayer.emit('REGISTER_DEVICE', {
      deviceId: 'active-player',
      deviceName: 'Active Player',
      deviceType: 'desktop',
    });
    await onceEvent(activePlayer, 'DEVICE_LIST_UPDATED', (v) =>
      v.devices.some((d) => d.deviceId === 'active-player')
    );

    const passiveController = await connectSocket(port, secret, 'alice');
    sockets.push(passiveController);
    passiveController.emit('REGISTER_DEVICE', {
      deviceId: 'passive-controller',
      deviceName: 'Passive Controller',
      deviceType: 'mobile',
    });
    await onceEvent(passiveController, 'DEVICE_LIST_UPDATED', (v) => v.devices.length === 2);

    // Initial playback setup
    const readyPromise = onceEvent(passiveController, 'PLAYBACK_STATE_CHANGED', (s) => s.isPlaying);
    activePlayer.emit('PLAYBACK_STATE_CHANGED', {
      trackId: 'Stress/HighFrequency.mp3',
      positionMs: 1000,
      durationMs: 300000,
      isPlaying: true,
      isBuffering: false,
    });
    await readyPromise;

    // Track all POSITION_SYNC events on the passive controller
    const receivedPositions = [];
    let rogueReportAccepted = false;
    passiveController.on('POSITION_SYNC', (s) => {
      receivedPositions.push(s.positionMs);
      if (s.trackId === 'Rogue/Hijack.mp3' || s.positionMs === 999999) {
        rogueReportAccepted = true;
      }
    });

    // Active player emits 50 high-frequency position reports simulating rapid slider scrubbing
    const reportCount = 50;
    const finalExpectedPos = reportCount * 1000; // 50000 ms

    for (let i = 1; i <= reportCount; i++) {
      activePlayer.emit('POSITION_REPORT', {
        trackId: 'Stress/HighFrequency.mp3',
        positionMs: i * 1000,
        durationMs: 300000,
        isPlaying: true,
        isBuffering: false,
      });

      // Concurrently emit rogue reports from passive controller trying to corrupt or overwrite state
      if (i % 5 === 0) {
        passiveController.emit('POSITION_REPORT', {
          trackId: 'Rogue/Hijack.mp3',
          positionMs: 999999,
          durationMs: 300000,
        });
      }
    }

    // Wait for the final position sync to arrive at the passive controller
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timed out waiting for final position')), 5000);
      const check = setInterval(() => {
        if (receivedPositions.includes(finalExpectedPos)) {
          clearTimeout(timer);
          clearInterval(check);
          resolve();
        }
      }, 20);
    });

    // Verify session integrity
    assert.equal(rogueReportAccepted, false, 'Rogue reports from passive controller must never be synced');
    assert.equal(
      receivedPositions[receivedPositions.length - 1],
      finalExpectedPos,
      'Last received position must match final active report'
    );

    // Verify a subsequent remote command can still be delivered seamlessly without desync
    const pingCmdPromise = onceEvent(activePlayer, 'REMOTE_COMMAND');
    passiveController.emit('REMOTE_CONTROL', {
      action: 'SEEK_TO',
      payload: { positionMs: 25000 },
    });
    const cmd = await pingCmdPromise;
    assert.equal(cmd.payload.positionMs, 25000);
  } finally {
    sockets.forEach((s) => s.disconnect());
    server.kill();
  }
});

// -----------------------------------------------------------------------------
// Test 4: Graceful Reconnect (Passive controller reconnects without playback disruption)
// -----------------------------------------------------------------------------
test('Graceful reconnect: passive controller reconnects, receives session snapshot without interrupting playing device', async () => {
  const port = await freePort();
  const secret = 'graceful-reconnect-secret';
  const server = await startServer(port, secret);
  const sockets = [];

  try {
    const webPlayer = await connectSocket(port, secret, 'alice');
    sockets.push(webPlayer);
    webPlayer.emit('REGISTER_DEVICE', {
      deviceId: 'web-player',
      deviceName: 'Living Room Web',
      deviceType: 'desktop',
    });
    await onceEvent(webPlayer, 'DEVICE_LIST_UPDATED', (v) =>
      v.devices.some((d) => d.deviceId === 'web-player')
    );

    // Start playback on web player
    webPlayer.emit('PLAYBACK_STATE_CHANGED', {
      trackId: 'Jazz/TakeFive.mp3',
      positionMs: 20000,
      durationMs: 320000,
      isPlaying: true,
      isBuffering: false,
    });

    // Connect phone controller
    const phoneController = await connectSocket(port, secret, 'alice');
    sockets.push(phoneController);
    phoneController.emit('REGISTER_DEVICE', {
      deviceId: 'phone-controller',
      deviceName: 'Pixel Phone',
      deviceType: 'mobile',
    });
    const initialSnapshot = await onceEvent(phoneController, 'PLAYBACK_STATE_CHANGED');
    assert.equal(initialSnapshot.trackId, 'Jazz/TakeFive.mp3');
    assert.equal(initialSnapshot.isPlaying, true);
    assert.equal(initialSnapshot.activeDeviceId, 'web-player');

    // Monitor web player for any spurious interruption or pause
    let webInterrupted = false;
    webPlayer.on('PLAYBACK_STATE_CHANGED', (s) => {
      if (s.isPlaying === false || s.activeDeviceId !== 'web-player') {
        webInterrupted = true;
      }
    });

    // Phone disconnects abruptly
    phoneController.disconnect();
    await onceEvent(webPlayer, 'DEVICE_LIST_UPDATED', (v) => v.devices.length === 1);
    assert.equal(webInterrupted, false, 'Web playback must not be interrupted when passive controller disconnects');

    // Web player advances playback while phone is offline
    webPlayer.emit('POSITION_REPORT', {
      trackId: 'Jazz/TakeFive.mp3',
      positionMs: 35000,
      durationMs: 320000,
      isPlaying: true,
      isBuffering: false,
    });

    // Passive phone controller reconnects on a new socket with same deviceId
    const reconnectedPhone = await connectSocket(port, secret, 'alice');
    sockets.push(reconnectedPhone);

    const reconnectedSnapshotPromise = onceEvent(
      reconnectedPhone,
      'PLAYBACK_STATE_CHANGED',
      (s) => s.trackId === 'Jazz/TakeFive.mp3'
    );
    reconnectedPhone.emit('REGISTER_DEVICE', {
      deviceId: 'phone-controller',
      deviceName: 'Pixel Phone Reconnected',
      deviceType: 'mobile',
    });

    const reconnectedSnapshot = await reconnectedSnapshotPromise;
    assert.equal(reconnectedSnapshot.trackId, 'Jazz/TakeFive.mp3');
    assert.equal(reconnectedSnapshot.activeDeviceId, 'web-player');
    assert.equal(reconnectedSnapshot.isPlaying, true);
    assert.equal(reconnectedSnapshot.positionMs, 35000, 'Reconnected controller receives latest position snapshot');

    // Ensure web player was never interrupted throughout the reconnect sequence
    await new Promise((r) => setTimeout(r, 200));
    assert.equal(webInterrupted, false, 'Web playback remained completely uninterrupted');
  } finally {
    sockets.forEach((s) => s.disconnect());
    server.kill();
  }
});

// -----------------------------------------------------------------------------
// Test 5: Multi-User Room Isolation
// -----------------------------------------------------------------------------
test('Multi-user room isolation: events emitted by user_1 are strictly invisible to user_2', async () => {
  const port = await freePort();
  const secret = 'room-isolation-secret';
  const server = await startServer(port, secret);
  const sockets = [];

  try {
    // User 1 devices
    const u1Web = await connectSocket(port, secret, 'user_1');
    sockets.push(u1Web);
    u1Web.emit('REGISTER_DEVICE', {
      deviceId: 'u1-web',
      deviceName: 'User 1 Web',
      deviceType: 'desktop',
    });
    await onceEvent(u1Web, 'DEVICE_LIST_UPDATED', (v) => v.devices.some((d) => d.deviceId === 'u1-web'));

    const u1Phone = await connectSocket(port, secret, 'user_1');
    sockets.push(u1Phone);
    u1Phone.emit('REGISTER_DEVICE', {
      deviceId: 'u1-phone',
      deviceName: 'User 1 Phone',
      deviceType: 'mobile',
    });
    await onceEvent(u1Phone, 'DEVICE_LIST_UPDATED', (v) => v.devices.length === 2);

    // User 2 devices
    const u2Web = await connectSocket(port, secret, 'user_2');
    sockets.push(u2Web);
    u2Web.emit('REGISTER_DEVICE', {
      deviceId: 'u2-web',
      deviceName: 'User 2 Web',
      deviceType: 'desktop',
    });
    await onceEvent(u2Web, 'DEVICE_LIST_UPDATED', (v) => v.devices.some((d) => d.deviceId === 'u2-web'));

    const u2Phone = await connectSocket(port, secret, 'user_2');
    sockets.push(u2Phone);
    const u2PhoneRegistered = onceEvent(u2Phone, 'DEVICE_LIST_UPDATED', (v) => v.devices.length === 2);
    const u2PhoneSnapshot = onceEvent(u2Phone, 'PLAYBACK_STATE_CHANGED');
    u2Phone.emit('REGISTER_DEVICE', {
      deviceId: 'u2-phone',
      deviceName: 'User 2 Phone',
      deviceType: 'mobile',
    });
    await u2PhoneRegistered;
    await u2PhoneSnapshot;

    // Setup leak detectors on User 2's devices
    let u2LeakCount = 0;
    const countLeak = (device, evt, data) => {
      u2LeakCount++;
    };

    ['DEVICE_LIST_UPDATED', 'PLAYBACK_STATE_CHANGED', 'POSITION_SYNC', 'REMOTE_COMMAND'].forEach((evt) => {
      u2Web.on(evt, (d) => countLeak('u2Web', evt, d));
      u2Phone.on(evt, (d) => countLeak('u2Phone', evt, d));
    });

    // User 1 performs full spectrum of playback operations
    u1Web.emit('PLAYBACK_STATE_CHANGED', {
      trackId: 'User1/SecretAlbum/Song.mp3',
      positionMs: 15000,
      durationMs: 240000,
      isPlaying: true,
      isBuffering: false,
    });
    await onceEvent(u1Phone, 'PLAYBACK_STATE_CHANGED', (s) => s.trackId === 'User1/SecretAlbum/Song.mp3');

    u1Web.emit('POSITION_REPORT', {
      trackId: 'User1/SecretAlbum/Song.mp3',
      positionMs: 16000,
      durationMs: 240000,
      isPlaying: true,
    });
    await onceEvent(u1Phone, 'POSITION_SYNC', (s) => s.positionMs === 16000);

    u1Phone.emit('REMOTE_CONTROL', {
      action: 'SEEK_TO',
      payload: { positionMs: 50000 },
      targetDeviceId: 'u1-web',
    });
    await onceEvent(u1Web, 'REMOTE_COMMAND', (c) => c.action === 'SEEK_TO');

    u1Phone.emit('REMOTE_CONTROL', {
      action: 'TOGGLE_PLAY',
      payload: {},
    });
    await onceEvent(u1Web, 'REMOTE_COMMAND', (c) => c.action === 'TOGGLE_PLAY');

    u1Phone.emit('REMOTE_CONTROL', {
      action: 'SKIP_NEXT',
      payload: {},
    });
    await onceEvent(u1Web, 'REMOTE_COMMAND', (c) => c.action === 'SKIP_NEXT');

    u1Web.emit('TRANSFER_PLAYBACK', {
      targetDeviceId: 'u1-phone',
      playImmediately: true,
      positionMs: 50000,
      trackId: 'User1/SecretAlbum/Song.mp3',
    });
    await onceEvent(u1Phone, 'PLAYBACK_STATE_CHANGED', (s) => s.isTransferHandoff);

    // Allow time for any leaky packet propagation
    await new Promise((r) => setTimeout(r, 250));
    assert.equal(u2LeakCount, 0, 'Zero events from user_1 must leak to user_2 devices');

    // Confirm User 2 has independent session state
    let u1LeakCount = 0;
    ['DEVICE_LIST_UPDATED', 'PLAYBACK_STATE_CHANGED', 'POSITION_SYNC', 'REMOTE_COMMAND'].forEach((evt) => {
      u1Web.on(evt, () => u1LeakCount++);
      u1Phone.on(evt, () => u1LeakCount++);
    });

    u2Web.emit('PLAYBACK_STATE_CHANGED', {
      trackId: 'User2/DifferentSong.wav',
      positionMs: 5000,
      durationMs: 180000,
      isPlaying: true,
    });
    const u2State = await onceEvent(u2Phone, 'PLAYBACK_STATE_CHANGED', (s) => s.trackId === 'User2/DifferentSong.wav');
    assert.equal(u2State.trackId, 'User2/DifferentSong.wav');
    assert.equal(u2State.activeDeviceId, 'u2-web');

    await new Promise((r) => setTimeout(r, 250));
    assert.equal(u1LeakCount, 0, 'Zero events from user_2 must leak to user_1 devices');
  } finally {
    sockets.forEach((s) => s.disconnect());
    server.kill();
  }
});

// -----------------------------------------------------------------------------
// Test 6: Active Device Disconnect Fallback & Simultaneous Controllers
// -----------------------------------------------------------------------------
test('Active device sleep/disconnect fallback to next available device and simultaneous controllers', async () => {
  const port = await freePort();
  const secret = 'fallback-sleep-secret';
  const server = await startServer(port, secret);
  const sockets = [];

  try {
    const web = await connectSocket(port, secret, 'alice');
    sockets.push(web);
    web.emit('REGISTER_DEVICE', {
      deviceId: 'web-active',
      deviceName: 'Desktop Player',
      deviceType: 'desktop',
    });
    await onceEvent(web, 'DEVICE_LIST_UPDATED', (v) => v.devices.some((d) => d.deviceId === 'web-active'));

    const phone1 = await connectSocket(port, secret, 'alice');
    sockets.push(phone1);
    phone1.emit('REGISTER_DEVICE', {
      deviceId: 'phone-1',
      deviceName: 'Phone Controller 1',
      deviceType: 'mobile',
    });
    await onceEvent(phone1, 'DEVICE_LIST_UPDATED', (v) => v.devices.length === 2);

    const phone2 = await connectSocket(port, secret, 'alice');
    sockets.push(phone2);
    phone2.emit('REGISTER_DEVICE', {
      deviceId: 'phone-2',
      deviceName: 'Phone Controller 2',
      deviceType: 'mobile',
    });
    await onceEvent(phone2, 'DEVICE_LIST_UPDATED', (v) => v.devices.length === 3);

    // Web starts active playback
    web.emit('PLAYBACK_STATE_CHANGED', {
      trackId: 'Soul/StandByMe.mp3',
      positionMs: 12000,
      durationMs: 180000,
      isPlaying: true,
    });
    await onceEvent(phone1, 'PLAYBACK_STATE_CHANGED', (s) => s.isPlaying);

    // Simultaneous commands from phone1 and phone2 delivered cleanly to web
    const cmd1Promise = onceEvent(web, 'REMOTE_COMMAND', (c) => c.action === 'SEEK_TO');
    phone1.emit('REMOTE_CONTROL', { action: 'SEEK_TO', payload: { positionMs: 30000 } });
    const cmd1 = await cmd1Promise;
    assert.equal(cmd1.payload.positionMs, 30000);
    assert.equal(cmd1.originDeviceId, 'phone-1');

    const cmd2Promise = onceEvent(web, 'REMOTE_COMMAND', (c) => c.action === 'TOGGLE_PLAY');
    phone2.emit('REMOTE_CONTROL', { action: 'TOGGLE_PLAY', payload: {} });
    const cmd2 = await cmd2Promise;
    assert.equal(cmd2.action, 'TOGGLE_PLAY');
    assert.equal(cmd2.originDeviceId, 'phone-2');

    // Simulate active device sleep / disconnect
    const fallbackPromise1 = onceEvent(phone1, 'PLAYBACK_STATE_CHANGED', (s) => s.activeDeviceId === 'phone-1');
    const fallbackPromise2 = onceEvent(phone2, 'PLAYBACK_STATE_CHANGED', (s) => s.activeDeviceId === 'phone-1');

    web.disconnect();

    const fallbackState1 = await fallbackPromise1;
    const fallbackState2 = await fallbackPromise2;

    assert.equal(fallbackState1.activeDeviceId, 'phone-1', 'Active control must fallback to next online device');
    assert.equal(fallbackState1.isPlaying, false, 'Playback must be paused on fallback');
    assert.equal(fallbackState2.activeDeviceId, 'phone-1');
    assert.equal(fallbackState2.isPlaying, false);

    // phone-1 can now report playback as the new active device
    const newPosPromise = onceEvent(phone2, 'POSITION_SYNC');
    phone1.emit('POSITION_REPORT', {
      trackId: 'Soul/StandByMe.mp3',
      positionMs: 35000,
      durationMs: 180000,
      isPlaying: true,
    });
    const phone2Received = await newPosPromise;
    assert.equal(phone2Received.activeDeviceId, 'phone-1');
    assert.equal(phone2Received.positionMs, 35000);
  } finally {
    sockets.forEach((s) => s.disconnect());
    server.kill();
  }
});

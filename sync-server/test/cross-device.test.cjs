const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const net = require('node:net');
const { spawn } = require('node:child_process');
// This integration test exercises the same Socket.IO client used by the web app.
const { io } = require('../../frontend/node_modules/socket.io-client');

function tokenFor(user, secret) {
  const payload = Buffer.from(JSON.stringify({ u: user, exp: Math.floor(Date.now() / 1000) + 60 })).toString('base64url');
  return `${payload}.${crypto.createHmac('sha256', secret).update(payload).digest('hex')}`;
}
function onceEvent(socket, event, predicate = () => true) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { socket.off(event, handler); reject(new Error(`Timed out waiting for ${event}`)); }, 5000);
    const handler = value => { if (predicate(value)) { clearTimeout(timer); socket.off(event, handler); resolve(value); } };
    socket.on(event, handler);
  });
}
function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => { const port = server.address().port; server.close(() => resolve(port)); });
  });
}

test('web and Android devices receive position and a remote command once, isolated by user', async () => {
  const port = await freePort();
  const secret = 'test-only-secret-for-device-sync';
  const server = spawn(process.execPath, ['server.js'], {
    cwd: require('node:path').resolve(__dirname, '..'),
    env: { ...process.env, SYNC_PORT: String(port), SECRET_KEY: secret, REDIS_URL: 'redis://127.0.0.1:1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const sockets = [];
  try {
    await new Promise((resolve, reject) => {
      let output = '';
      const timer = setTimeout(() => reject(new Error('Sync server did not start')), 10000);
      server.stdout.on('data', chunk => { output += chunk; if (output.includes('listening on')) { clearTimeout(timer); resolve(); } });
      server.once('exit', code => reject(new Error(`Sync server exited: ${code}`)));
    });
    const connect = async user => {
      const socket = io(`http://127.0.0.1:${port}`, { auth: { token: tokenFor(user, secret) }, transports: ['websocket'], reconnection: false });
      sockets.push(socket);
      await new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('connect_error', reject); });
      return socket;
    };
    const desktop = await connect('alice');
    const firstRegistered = onceEvent(desktop, 'DEVICE_LIST_UPDATED', v => v.devices.some(d => d.deviceId === 'desktop'));
    desktop.emit('REGISTER_DEVICE', { deviceId: 'desktop', deviceName: 'Web', deviceType: 'desktop' });
    await firstRegistered;
    const mobile = await connect('alice');
    const bothRegistered = onceEvent(mobile, 'DEVICE_LIST_UPDATED', v => v.devices.length === 2);
    mobile.emit('REGISTER_DEVICE', { deviceId: 'phone', deviceName: 'Android', deviceType: 'mobile' });
    await bothRegistered;
    const other = await connect('bob');
    const otherRegistered = onceEvent(other, 'DEVICE_LIST_UPDATED', v => v.devices.length === 1);
    other.emit('REGISTER_DEVICE', { deviceId: 'other', deviceName: 'Other', deviceType: 'mobile' });
    await otherRegistered;
    let commands = 0, leaked = 0;
    desktop.on('REMOTE_COMMAND', () => { commands++; });
    other.on('REMOTE_COMMAND', () => { leaked++; });
    const command = onceEvent(desktop, 'REMOTE_COMMAND');
    mobile.emit('REMOTE_CONTROL', { action: 'seek', payload: { positionMs: 120000 }, targetDeviceId: 'desktop' });
    assert.equal((await command).payload.positionMs, 120000);
    const position = onceEvent(mobile, 'POSITION_SYNC');
    desktop.emit('POSITION_REPORT', { positionMs: 120000, durationMs: 240000 });
    assert.equal((await position).positionMs, 120000);
    await new Promise(resolve => setTimeout(resolve, 250));
    assert.equal(commands, 1);
    assert.equal(leaked, 0);

    const firstTrack = onceEvent(mobile, 'PLAYBACK_STATE_CHANGED', state => state.trackId === 'First/old.mp3');
    desktop.emit('PLAYBACK_STATE_CHANGED', {
      trackId: 'First/old.mp3', positionMs: 0, durationMs: 300000,
      isPlaying: true, isBuffering: false,
    });
    await firstTrack;

    // A real player report must repair a missed track-change event in RAM and
    // carry identity together with the new song's clock and transport state.
    const nextTrack = onceEvent(mobile, 'POSITION_SYNC', state => state.trackId === 'Second/new.mp3');
    desktop.emit('POSITION_REPORT', {
      trackId: 'Second/new.mp3', positionMs: 5000, durationMs: 180000,
      isPlaying: true, isBuffering: false,
    });
    const snapshot = await nextTrack;
    assert.equal(snapshot.trackId, 'Second/new.mp3');
    assert.equal(snapshot.activeDeviceId, 'desktop');
    assert.equal(snapshot.positionMs, 5000);
    assert.equal(snapshot.durationMs, 180000);
    assert.equal(snapshot.isPlaying, true);
    assert.equal(snapshot.isBuffering, false);

    // A phone requesting playback must receive this same authoritative song,
    // rather than the previous song cached in its own player.
    const handoff = onceEvent(mobile, 'PLAYBACK_STATE_CHANGED', state => state.isTransferHandoff && state.activeDeviceId === 'phone');
    mobile.emit('TRANSFER_PLAYBACK', { targetDeviceId: 'phone' });
    const transferred = await handoff;
    assert.equal(transferred.trackId, 'Second/new.mp3');
    assert.equal(transferred.originDeviceId, 'phone');

    // The old speaker cannot overwrite the new active phone's identity.
    desktop.emit('POSITION_REPORT', { trackId: 'First/old.mp3', positionMs: 99999 });
    const phonePosition = onceEvent(desktop, 'POSITION_SYNC');
    mobile.emit('POSITION_REPORT', {
      trackId: 'Second/new.mp3', positionMs: 9000, durationMs: 180000,
      isPlaying: true, isBuffering: false,
    });
    assert.equal((await phonePosition).trackId, 'Second/new.mp3');
  } finally {
    sockets.forEach(socket => socket.disconnect());
    server.kill();
  }
});

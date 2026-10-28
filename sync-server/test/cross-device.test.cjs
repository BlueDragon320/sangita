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
  } finally {
    sockets.forEach(socket => socket.disconnect());
    server.kill();
  }
});

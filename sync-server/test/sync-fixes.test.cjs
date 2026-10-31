const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const net = require('node:net');
const { spawn } = require('node:child_process');
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

test('S1 & S3: Stale disconnect guard and volume normalization', async () => {
  const port = await freePort();
  const secret = 'test-secret-for-s1-s3';
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
      server.stdout.on('data', chunk => {
        output += chunk;
        if (output.includes('listening on')) {
          clearTimeout(timer);
          resolve();
        }
      });
      server.once('exit', code => reject(new Error(`Sync server exited: ${code}`)));
    });

    const connect = async (user) => {
      const socket = io(`http://127.0.0.1:${port}`, {
        auth: { token: tokenFor(user, secret) },
        transports: ['websocket'],
        reconnection: false
      });
      sockets.push(socket);
      await new Promise((resolve, reject) => {
        socket.once('connect', resolve);
        socket.once('connect_error', reject);
      });
      return socket;
    };

    // 1. Test S3: Volume command clamping & normalization
    const controller = await connect('alice');
    const target = await connect('alice');

    target.emit('REGISTER_DEVICE', { deviceId: 'speaker', deviceName: 'Speaker', deviceType: 'desktop' });
    await onceEvent(target, 'DEVICE_LIST_UPDATED', v => v.devices.some(d => d.deviceId === 'speaker'));

    controller.emit('REGISTER_DEVICE', { deviceId: 'phone', deviceName: 'Phone', deviceType: 'mobile' });
    await onceEvent(controller, 'DEVICE_LIST_UPDATED', v => v.devices.length === 2);

    // Test volume > 100 clamped to 100
    const cmd1Promise = onceEvent(target, 'REMOTE_COMMAND', c => c.action === 'volume');
    controller.emit('REMOTE_CONTROL', {
      action: 'volume',
      payload: { volume: 150 },
      targetDeviceId: 'speaker'
    });
    const cmd1 = await cmd1Promise;
    assert.equal(cmd1.payload.volume, 100, 'Volume > 100 must be clamped to 100');

    // Test volume < 0 clamped to 0
    const cmd2Promise = onceEvent(target, 'REMOTE_COMMAND', c => c.action === 'volume');
    controller.emit('REMOTE_CONTROL', {
      action: 'volume',
      payload: { volume: -10 },
      targetDeviceId: 'speaker'
    });
    const cmd2 = await cmd2Promise;
    assert.equal(cmd2.payload.volume, 0, 'Volume < 0 must be clamped to 0');

    // Test volume 0.0 - 1.0 scale preserved
    const cmd3Promise = onceEvent(target, 'REMOTE_COMMAND', c => c.action === 'volume');
    controller.emit('REMOTE_CONTROL', {
      action: 'volume',
      payload: { volume: 0.65 },
      targetDeviceId: 'speaker'
    });
    const cmd3 = await cmd3Promise;
    assert.equal(cmd3.payload.volume, 0.65, 'Float volume 0.65 must be preserved');

    // 2. Test S1: Guard socket.on('disconnect')
    // Simulate reconnection: register same deviceId 'phone' on a second socket connection
    const reconnectedPhone = await connect('alice');
    reconnectedPhone.emit('REGISTER_DEVICE', { deviceId: 'phone', deviceName: 'Phone Reconnected', deviceType: 'mobile' });
    await onceEvent(target, 'DEVICE_LIST_UPDATED', v => v.devices.some(d => d.deviceId === 'phone'));

    // Now disconnect the OLD controller socket
    controller.disconnect();

    // Small delay to let any stale disconnect event process
    await new Promise(r => setTimeout(r, 200));

    // Send a remote command to reconnectedPhone to verify it's the active device socket
    const phoneCmdPromise = onceEvent(reconnectedPhone, 'REMOTE_COMMAND');
    target.emit('REMOTE_CONTROL', {
      action: 'play',
      payload: {},
      targetDeviceId: 'phone'
    });
    const receivedByPhone = await phoneCmdPromise;
    assert.equal(receivedByPhone.targetDeviceId, 'phone');
    assert.equal(receivedByPhone.action, 'play');

  } finally {
    sockets.forEach(s => s.disconnect());
    server.kill();
  }
});

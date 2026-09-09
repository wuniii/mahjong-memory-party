const { io } = require('socket.io-client');
const assert = require('assert');

const URL = process.env.TEST_URL || 'http://localhost:3000';

function makeClient(name) {
  const socket = io(URL, { transports: ['websocket'], reconnection: false });
  let latestState = null;
  socket.on('roomState', (state) => {
    latestState = state;
  });
  return { name, socket, get state() { return latestState; } };
}

function waitForConnect(client) {
  return new Promise((resolve, reject) => {
    client.socket.on('connect', resolve);
    client.socket.on('connect_error', reject);
  });
}

function emitAck(client, event, payload = {}) {
  return new Promise((resolve) => {
    client.socket.emit(event, payload, resolve);
  });
}

function waitFor(condition, label, timeout = 3000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      if (condition()) return resolve();
      if (Date.now() - start > timeout) return reject(new Error(`Timed out waiting for ${label}`));
      setTimeout(tick, 50);
    };
    tick();
  });
}

(async () => {
  const a = makeClient('东东');
  const b = makeClient('南南');
  await Promise.all([waitForConnect(a), waitForConnect(b)]);

  const created = await emitAck(a, 'createRoom', { name: a.name, token: 'token-a', boardSize: 4 });
  assert.equal(created.ok, true, created.message);

  const joined = await emitAck(b, 'joinRoom', { name: b.name, token: 'token-b', roomCode: created.roomCode });
  assert.equal(joined.ok, true, joined.message);

  await waitFor(() => a.state?.players.length === 2 && b.state?.players.length === 2, 'both players in room');

  assert.equal((await emitAck(a, 'toggleReady')).ok, true);
  assert.equal((await emitAck(b, 'toggleReady')).ok, true);
  await waitFor(() => a.state?.canStart === true, 'host can start');

  assert.equal((await emitAck(a, 'startGame')).ok, true);
  await waitFor(() => a.state?.status === 'playing' && a.state?.cards.length === 16, 'game started');

  assert.equal(a.state.currentPlayerId, a.state.selfId);
  assert.equal((await emitAck(a, 'usePower', { type: 'peek' })).ok, true);
  await waitFor(() => a.state?.privateView?.peekUntil, 'peek active');

  a.socket.disconnect();
  b.socket.disconnect();
  console.log('Smoke test passed: create/join/ready/start/power flow works.');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});

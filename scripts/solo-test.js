const { io } = require('socket.io-client');
const assert = require('assert');

const URL = process.env.TEST_URL || 'http://localhost:3000';

function waitForConnect(socket) {
  return new Promise((resolve, reject) => {
    socket.on('connect', resolve);
    socket.on('connect_error', reject);
  });
}

function emitAck(socket, event, payload = {}) {
  return new Promise((resolve) => socket.emit(event, payload, resolve));
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
  const socket = io(URL, { transports: ['websocket'], reconnection: false });
  let state = null;
  socket.on('roomState', (nextState) => {
    state = nextState;
  });

  await waitForConnect(socket);

  const created = await emitAck(socket, 'createRoom', {
    name: '单人测试员',
    token: `solo-${Date.now()}`,
    boardSize: 4,
  });
  assert.equal(created.ok, true, created.message);

  await waitFor(() => state?.players.length === 1, 'solo room state');
  assert.equal(state.canStart, false, 'ready is still required before start');

  const ready = await emitAck(socket, 'toggleReady');
  assert.equal(ready.ok, true, ready.message);
  await waitFor(() => state?.canStart === true, 'solo host can start');

  const started = await emitAck(socket, 'startGame');
  assert.equal(started.ok, true, started.message);
  await waitFor(() => state?.status === 'playing' && state?.cards.length === 16, 'solo game started');
  assert.equal(state.players.length, 1);
  assert.equal(state.currentPlayerId, state.selfId);

  socket.disconnect();
  console.log('Solo test passed: one player can create, ready, and start a game.');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});

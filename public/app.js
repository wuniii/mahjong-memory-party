const socket = io();

const app = document.querySelector('#app');
const toast = document.querySelector('#toast');
const landingTemplate = document.querySelector('#landing-template');
const roomTemplate = document.querySelector('#room-template');

const STORAGE = {
  token: 'mahjong-memory-token',
  name: 'mahjong-memory-name',
  room: 'mahjong-memory-room',
};

const emotes = ['👏', '😆', '😭', '🔥', '🧊', '🍀', '🀄', '🎉'];
const sizeLabels = {
  4: '4 x 4 轻松局',
  6: '6 x 6 热身局',
  8: '8 x 8 标准局',
  10: '10 x 10 挑战局',
  12: '12 x 12 大脑燃烧',
  14: '14 x 14 超大局',
  16: '16 x 16 巨型局',
  18: '18 x 18 终极局',
};

let state = null;
let timerHandle = null;

function getToken() {
  let token = localStorage.getItem(STORAGE.token);
  if (!token) {
    token = crypto.randomUUID();
    localStorage.setItem(STORAGE.token, token);
  }
  return token;
}

function saveSession(roomCode, name) {
  localStorage.setItem(STORAGE.room, roomCode);
  localStorage.setItem(STORAGE.name, name || getName());
}

function getName() {
  return localStorage.getItem(STORAGE.name) || '';
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.remove('hidden');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.add('hidden'), 2300);
}

function callServer(event, payload = {}) {
  return new Promise((resolve) => {
    socket.emit(event, payload, (response = {}) => {
      if (!response.ok) showToast(response.message || '操作失败，请稍后再试。');
      resolve(response);
    });
  });
}

function clearTimer() {
  if (timerHandle) clearInterval(timerHandle);
  timerHandle = null;
}

function renderLanding() {
  clearTimer();
  state = null;
  app.innerHTML = '';
  app.append(landingTemplate.content.cloneNode(true));

  const nameInput = document.querySelector('#nameInput');
  const roomInput = document.querySelector('#roomInput');
  const sizeInput = document.querySelector('#sizeInput');
  const resumeBtn = document.querySelector('#resumeBtn');
  const savedRoom = localStorage.getItem(STORAGE.room);

  nameInput.value = getName();
  if (savedRoom) {
    resumeBtn.textContent = `回到上次房间 ${savedRoom}`;
    resumeBtn.classList.remove('hidden');
  }

  document.querySelector('#createBtn').addEventListener('click', async () => {
    const name = nameInput.value.trim() || '小麻将';
    const response = await callServer('createRoom', {
      name,
      token: getToken(),
      boardSize: Number(sizeInput.value),
    });
    if (response.ok) saveSession(response.roomCode, name);
  });

  document.querySelector('#soloBtn').addEventListener('click', async () => {
    const name = nameInput.value.trim() || '单人测试员';
    const created = await callServer('createRoom', {
      name,
      token: getToken(),
      boardSize: Number(sizeInput.value),
    });
    if (!created.ok) return;
    saveSession(created.roomCode, name);
    const ready = await callServer('toggleReady');
    if (!ready.ok) return;
    await callServer('startGame');
  });

  document.querySelector('#joinBtn').addEventListener('click', async () => {
    const name = nameInput.value.trim() || '小麻将';
    const roomCode = roomInput.value.trim().toUpperCase();
    if (!roomCode) return showToast('请输入房间号。');
    const response = await callServer('joinRoom', { name, roomCode, token: getToken() });
    if (response.ok) saveSession(response.roomCode, name);
  });

  resumeBtn.addEventListener('click', async () => {
    const roomCode = localStorage.getItem(STORAGE.room);
    const name = nameInput.value.trim() || getName() || '小麻将';
    if (!roomCode) return;
    const response = await callServer('joinRoom', { name, roomCode, token: getToken() });
    if (response.ok) saveSession(response.roomCode, name);
  });
}

function currentSelf() {
  return state?.players.find((player) => player.id === state.selfId);
}

function isMyTurn() {
  return state?.currentPlayerId === state?.selfId && state.status === 'playing';
}

function renderRoom(nextState) {
  state = nextState;
  saveSession(state.code, currentSelf()?.name || getName());

  if (!document.querySelector('.room-layout')) {
    app.innerHTML = '';
    app.append(roomTemplate.content.cloneNode(true));
  }

  document.querySelector('#roomCode').textContent = state.code;
  document.querySelector('#gameTitle').textContent = titleText();
  renderTurn();
  renderPlayers();
  renderSettings();
  renderPowers();
  renderMainActions();
  renderBoard();
  renderEmotes();
  renderEvents();
  updateTimerBar();
}

function titleText() {
  if (state.status === 'lobby') return `等待开局 · ${sizeLabels[state.boardSize]}`;
  if (state.status === 'ended') return '本局结束啦';
  return `${state.boardSize} x ${state.boardSize} 麻将记忆战`;
}

function renderTurn() {
  const card = document.querySelector('#turnCard');
  const current = state.players.find((player) => player.id === state.currentPlayerId);
  const selfTurn = isMyTurn();
  card.classList.toggle('active', selfTurn);

  if (state.status === 'lobby') {
    card.innerHTML = '<span class="eyebrow">Lobby</span><p class="turn-name">准备后由房主开始</p>';
  } else if (state.status === 'ended') {
    const winnerScore = Math.max(...state.players.map((player) => player.score));
    const winners = state.players.filter((player) => player.score === winnerScore).map((player) => player.name).join('、');
    card.innerHTML = `<span class="eyebrow">Winner</span><p class="turn-name">${escapeHtml(winners)}</p>`;
  } else {
    card.innerHTML = `<span class="eyebrow">当前回合</span><p class="turn-name">${selfTurn ? '轮到你啦！' : escapeHtml(current?.name || '等待中')}</p>`;
  }
}

function renderPlayers() {
  const players = document.querySelector('#players');
  players.innerHTML = state.players.map((player, index) => {
    const tags = [
      player.host ? '房主' : '',
      player.connected ? '在线' : '掉线',
      state.status === 'lobby' ? (player.ready ? '已准备' : '未准备') : '',
      state.currentPlayerId === player.id ? '行动中' : '',
    ].filter(Boolean).join(' · ');
    return `
      <article class="player-card">
        <div class="avatar">${['🀄', '🍡', '🧋', '🎋'][index] || '🀇'}</div>
        <div class="player-meta">
          <strong>${escapeHtml(player.name)}${player.id === state.selfId ? '（你）' : ''}</strong>
          <small>${tags}</small>
        </div>
        <div class="score-badge">${player.score}</div>
      </article>
    `;
  }).join('');
}

function renderSettings() {
  const settings = document.querySelector('#settingsCard');
  const self = currentSelf();
  const isHost = self?.id === state.hostId;

  if (state.status !== 'lobby') {
    settings.innerHTML = `<strong>本局设置</strong><span>${sizeLabels[state.boardSize]}</span>`;
    return;
  }

  const options = Object.entries(sizeLabels).map(([value, label]) => (
    `<option value="${value}" ${Number(value) === state.boardSize ? 'selected' : ''}>${label}</option>`
  )).join('');

  settings.innerHTML = `
    <strong>开局设置</strong>
    <label>棋盘大小
      <select id="roomSizeSelect" ${isHost ? '' : 'disabled'}>${options}</select>
    </label>
    <button id="readyBtn" class="${self?.ready ? 'text-btn' : 'primary-btn'}">${self?.ready ? '取消准备' : '我准备好了'}</button>
  `;

  document.querySelector('#readyBtn').addEventListener('click', () => callServer('toggleReady'));
  const select = document.querySelector('#roomSizeSelect');
  select.addEventListener('change', () => callServer('updateSettings', { boardSize: Number(select.value) }));
}

function renderPowers() {
  const powerCard = document.querySelector('#powerCard');
  const self = currentSelf();
  const powers = self?.powers || { peek: 0, hint: 0, freeze: 0 };
  const disabled = !isMyTurn() || state.pendingMismatch;

  powerCard.innerHTML = `
    <strong>道具</strong>
    <div class="power-grid">
      <button class="power-btn" data-power="peek" ${disabled || !powers.peek ? 'disabled' : ''}>
        <strong>🧁</strong><span>透视</span><small>看 2 张 · ${powers.peek}</small>
      </button>
      <button class="power-btn" data-power="hint" ${disabled || !powers.hint ? 'disabled' : ''}>
        <strong>🍀</strong><span>提示</span><small>高亮线索 · ${powers.hint}</small>
      </button>
      <button class="power-btn" data-power="freeze" ${disabled || !powers.freeze || state.freezeNext ? 'disabled' : ''}>
        <strong>🧊</strong><span>冻结</span><small>跳过下家 · ${powers.freeze}</small>
      </button>
    </div>
  `;

  powerCard.querySelectorAll('[data-power]').forEach((button) => {
    button.addEventListener('click', () => callServer('usePower', { type: button.dataset.power }));
  });
}

function renderMainActions() {
  const actions = document.querySelector('#mainActions');
  const self = currentSelf();
  const isHost = self?.id === state.hostId;
  const buttons = [];

  if (state.status === 'lobby') {
    buttons.push(`<button id="startBtn" class="primary-btn" ${state.canStart ? '' : 'disabled'}>开始游戏</button>`);
  }

  if (state.status === 'ended') {
    buttons.push(`<button id="restartBtn" class="primary-btn" ${isHost ? '' : 'disabled'}>再来一局</button>`);
  }

  buttons.push('<button id="leaveBtn" class="text-btn">离开房间</button>');
  actions.innerHTML = buttons.join('');

  const startBtn = document.querySelector('#startBtn');
  if (startBtn) startBtn.addEventListener('click', () => callServer('startGame'));

  const restartBtn = document.querySelector('#restartBtn');
  if (restartBtn) restartBtn.addEventListener('click', () => callServer('restartGame'));

  document.querySelector('#leaveBtn').addEventListener('click', async () => {
    await callServer('leaveRoom');
    localStorage.removeItem(STORAGE.room);
    renderLanding();
  });

  document.querySelector('#copyCodeBtn').onclick = async () => {
    try {
      await navigator.clipboard.writeText(state.code);
      showToast('房间号已复制。');
    } catch {
      showToast(`房间号：${state.code}`);
    }
  };
}

function renderBoard() {
  const board = document.querySelector('#board');
  board.style.setProperty('--size', state.boardSize);

  if (state.status === 'lobby') {
    board.innerHTML = `
      <div style="grid-column: 1 / -1; padding: 50px 20px; text-align: center; color: #8a6a4e;">
        <h2>等朋友准备好就开局</h2>
        <p>房主可选择棋盘大小，所有人点准备后开始。</p>
      </div>
    `;
    return;
  }

  if (!state.cards.length) {
    board.innerHTML = '';
    return;
  }

  board.innerHTML = state.cards.map((card) => {
    const disabled = !isMyTurn() || state.pendingMismatch || card.revealed || card.matched || state.status !== 'playing';
    return `
      <button class="card ${card.revealed ? 'revealed' : ''} ${card.matched ? 'matched' : ''} ${card.hint ? 'hint' : ''} face-${card.color ?? 0}" data-index="${card.index}" ${disabled ? 'disabled' : ''} aria-label="第 ${card.index + 1} 张牌">
        <span class="card-inner">
          <span class="card-back"></span>
          <span class="card-face">
            <span class="card-symbol"><b>${card.tile || ''}</b><span>${card.charm || ''}</span></span>
          </span>
        </span>
      </button>
    `;
  }).join('');

  board.querySelectorAll('.card:not(:disabled)').forEach((button) => {
    button.addEventListener('click', () => callServer('flipCard', { index: Number(button.dataset.index) }));
  });
}

function renderEmotes() {
  const buttons = document.querySelector('#emoteButtons');
  const feed = document.querySelector('#emoteFeed');

  buttons.innerHTML = emotes.map((emoji) => `<button data-emoji="${emoji}">${emoji}</button>`).join('');
  buttons.querySelectorAll('button').forEach((button) => {
    button.addEventListener('click', () => callServer('sendEmote', { emoji: button.dataset.emoji }));
  });

  feed.innerHTML = state.emotes.map((item) => `<span>${escapeHtml(item.name)}：${item.emoji}</span>`).join('');
}

function renderEvents() {
  const log = document.querySelector('#eventLog');
  log.innerHTML = state.events.map((event) => `<span>${escapeHtml(event)}</span>`).join('');
}

function updateTimerBar() {
  const timerBar = document.querySelector('#timerBar');
  const timerFill = timerBar?.querySelector('span');
  clearTimer();

  if (!state.pendingMismatch || !state.mismatchEndsAt) {
    timerBar?.classList.add('hidden');
    return;
  }

  timerBar.classList.remove('hidden');
  const endAt = state.mismatchEndsAt;
  const startedAt = endAt - 5000;

  const tick = () => {
    const now = Date.now();
    const ratio = Math.max(0, Math.min(1, (endAt - now) / (endAt - startedAt)));
    timerFill.style.setProperty('--timer', `${ratio * 100}%`);
    if (ratio <= 0) clearTimer();
  };

  tick();
  timerHandle = setInterval(tick, 120);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

socket.on('connect', async () => {
  const roomCode = localStorage.getItem(STORAGE.room);
  const name = getName() || '小麻将';
  if (roomCode) {
    const response = await callServer('joinRoom', { roomCode, name, token: getToken() });
    if (!response.ok) renderLanding();
  } else {
    renderLanding();
  }
});

socket.on('roomState', renderRoom);
socket.on('disconnect', () => showToast('连接断开，正在等待重连。'));

renderLanding();


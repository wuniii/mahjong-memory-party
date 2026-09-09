const crypto = require('crypto');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
});

const PORT = process.env.PORT || 3000;
const MAX_PLAYERS = 4;
const ROOM_TTL_MS = 1000 * 60 * 60 * 2;
const VALID_BOARD_SIZES = [4, 6, 8, 10, 12, 14, 16, 18];

app.get('/healthz', (_req, res) => {
  res.json({
    ok: true,
    rooms: rooms.size,
    uptime: Math.round(process.uptime()),
  });
});

app.use(express.static('public'));

const rooms = new Map();
const socketIndex = new Map();

function uid() {
  return crypto.randomUUID();
}

function cleanName(value) {
  const name = String(value || '').trim().slice(0, 16);
  return name || `玩家${Math.floor(Math.random() * 90 + 10)}`;
}

function cleanRoomCode(value) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}

function normalizeBoardSize(value) {
  const size = Number(value);
  return VALID_BOARD_SIZES.includes(size) ? size : 4;
}

function createRoomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let attempts = 0; attempts < 200; attempts += 1) {
    let code = '';
    for (let i = 0; i < 4; i += 1) code += alphabet[Math.floor(Math.random() * alphabet.length)];
    if (!rooms.has(code)) return code;
  }
  return crypto.randomBytes(3).toString('hex').toUpperCase();
}

function makePlayer({ name, token, socketId, host = false }) {
  return {
    id: uid(),
    token: token || uid(),
    socketId,
    name: cleanName(name),
    connected: true,
    host,
    ready: false,
    score: 0,
    powers: { peek: 1, hint: 1, freeze: 1 },
  };
}

function makeRoom({ hostPlayer, boardSize }) {
  const code = createRoomCode();
  return {
    code,
    hostId: hostPlayer.id,
    status: 'lobby',
    boardSize: normalizeBoardSize(boardSize),
    players: [hostPlayer],
    cards: [],
    flipped: [],
    turnIndex: 0,
    pendingMismatch: false,
    mismatchEndsAt: null,
    mismatchTimer: null,
    privateViews: {},
    freezeNext: false,
    round: 1,
    emotes: [],
    events: ['房间已创建，邀请朋友加入吧。'],
    updatedAt: Date.now(),
  };
}

function mahjongFaces(count) {
  const tileAssets = [
    ['Man1.svg', '一万'], ['Man2.svg', '二万'], ['Man3.svg', '三万'], ['Man4.svg', '四万'], ['Man5.svg', '五万'], ['Man6.svg', '六万'], ['Man7.svg', '七万'], ['Man8.svg', '八万'], ['Man9.svg', '九万'],
    ['Pin1.svg', '一筒'], ['Pin2.svg', '二筒'], ['Pin3.svg', '三筒'], ['Pin4.svg', '四筒'], ['Pin5.svg', '五筒'], ['Pin6.svg', '六筒'], ['Pin7.svg', '七筒'], ['Pin8.svg', '八筒'], ['Pin9.svg', '九筒'],
    ['Sou1.svg', '一索'], ['Sou2.svg', '二索'], ['Sou3.svg', '三索'], ['Sou4.svg', '四索'], ['Sou5.svg', '五索'], ['Sou6.svg', '六索'], ['Sou7.svg', '七索'], ['Sou8.svg', '八索'], ['Sou9.svg', '九索'],
    ['Ton.svg', '东风'], ['Nan.svg', '南风'], ['Shaa.svg', '西风'], ['Pei.svg', '北风'], ['Haku.svg', '白板'], ['Hatsu.svg', '发财'], ['Chun.svg', '红中'],
  ];
  const badges = ['糖', '桃', '星', '云', '竹', '茶', '月', '团', '喜', '福', '花', '铃'];
  const faces = [];
  for (let i = 0; i < count; i += 1) {
    const [asset, label] = tileAssets[i % tileAssets.length];
    const badgeRound = Math.floor(i / tileAssets.length);
    faces.push({
      asset,
      label,
      badge: badges[badgeRound % badges.length] + (Math.floor(badgeRound / badges.length) || ''),
      color: i % 8,
    });
  }
  return faces;
}
function shuffle(items) {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function buildDeck(size) {
  const pairs = (size * size) / 2;
  const faces = mahjongFaces(pairs);
  const deck = [];
  faces.forEach((face, pairId) => {
    deck.push({ pairId, ...face, matched: false });
    deck.push({ pairId, ...face, matched: false });
  });
  return shuffle(deck);
}

function addEvent(room, text) {
  room.events.unshift(text);
  room.events = room.events.slice(0, 8);
  room.updatedAt = Date.now();
}

function getPlayer(room, playerId) {
  return room.players.find((player) => player.id === playerId);
}

function getPlayerBySocket(socketId) {
  const entry = socketIndex.get(socketId);
  if (!entry) return null;
  const room = rooms.get(entry.roomCode);
  if (!room) return null;
  const player = getPlayer(room, entry.playerId);
  if (!player) return null;
  return { room, player };
}

function connectedPlayers(room) {
  return room.players.filter((player) => player.connected);
}

function currentPlayer(room) {
  return room.players[room.turnIndex] || null;
}

function findNextConnectedIndex(room, fromIndex) {
  if (!room.players.length) return -1;
  for (let step = 1; step <= room.players.length; step += 1) {
    const index = (fromIndex + step) % room.players.length;
    if (room.players[index].connected) return index;
  }
  return -1;
}

function advanceTurn(room) {
  if (!connectedPlayers(room).length) return;

  if (room.freezeNext) {
    const skippedIndex = findNextConnectedIndex(room, room.turnIndex);
    if (skippedIndex !== -1) {
      const skipped = room.players[skippedIndex];
      addEvent(room, `${skipped.name} 被冻住啦，跳过一次行动。`);
      room.turnIndex = skippedIndex;
    }
    room.freezeNext = false;
  }

  const nextIndex = findNextConnectedIndex(room, room.turnIndex);
  if (nextIndex !== -1) room.turnIndex = nextIndex;
}

function resetRound(room) {
  if (room.mismatchTimer) clearTimeout(room.mismatchTimer);
  room.players.forEach((player) => {
    player.ready = false;
    player.score = 0;
    player.powers = { peek: 1, hint: 1, freeze: 1 };
  });
  room.cards = buildDeck(room.boardSize);
  room.flipped = [];
  room.turnIndex = Math.max(0, room.players.findIndex((player) => player.connected));
  room.pendingMismatch = false;
  room.mismatchEndsAt = null;
  room.mismatchTimer = null;
  room.privateViews = {};
  room.freezeNext = false;
  room.status = 'playing';
  room.round += 1;
  addEvent(room, `新一局开始：${room.boardSize} x ${room.boardSize}。`);
}

function finishGameIfNeeded(room) {
  if (!room.cards.length) return false;
  if (room.cards.every((card) => card.matched)) {
    room.status = 'ended';
    room.pendingMismatch = false;
    room.mismatchEndsAt = null;
    if (room.mismatchTimer) clearTimeout(room.mismatchTimer);
    const best = Math.max(...room.players.map((player) => player.score));
    const winners = room.players.filter((player) => player.score === best).map((player) => player.name).join('、');
    addEvent(room, `游戏结束！${winners} 获胜。`);
    return true;
  }
  return false;
}

function activePrivateView(room, playerId) {
  const view = room.privateViews[playerId] || {};
  const now = Date.now();
  return {
    peekIndexes: view.peekUntil > now ? view.peekIndexes || [] : [],
    hintIndex: view.hintUntil > now ? view.hintIndex : null,
    peekUntil: view.peekUntil > now ? view.peekUntil : null,
    hintUntil: view.hintUntil > now ? view.hintUntil : null,
  };
}

function serializeRoom(room, viewerId) {
  const viewer = getPlayer(room, viewerId);
  const privateView = activePrivateView(room, viewerId);
  const peekSet = new Set(privateView.peekIndexes);
  const revealedSet = new Set(room.flipped);
  const current = currentPlayer(room);

  return {
    code: room.code,
    status: room.status,
    boardSize: room.boardSize,
    hostId: room.hostId,
    selfId: viewerId,
    round: room.round,
    currentPlayerId: current ? current.id : null,
    pendingMismatch: room.pendingMismatch,
    mismatchEndsAt: room.mismatchEndsAt,
    freezeNext: room.freezeNext,
    players: room.players.map((player) => ({
      id: player.id,
      name: player.name,
      connected: player.connected,
      host: player.id === room.hostId,
      ready: player.ready,
      score: player.score,
      powers: player.id === viewerId ? player.powers : undefined,
    })),
    cards: room.cards.map((card, index) => {
      const visible = card.matched || revealedSet.has(index) || peekSet.has(index);
      return {
        index,
        matched: card.matched,
        revealed: visible,
        hint: privateView.hintIndex === index,
        asset: visible ? card.asset : null,
        label: visible ? card.label : null,
        badge: visible ? card.badge : null,
        color: visible ? card.color : null,
      };
    }),
    emotes: room.emotes,
    events: room.events,
    privateView: {
      peekUntil: privateView.peekUntil,
      hintUntil: privateView.hintUntil,
    },
    canStart: room.status === 'lobby' && viewer?.id === room.hostId && connectedPlayers(room).length >= 1 && room.players.every((player) => player.ready || !player.connected),
  };
}

function emitRoom(room) {
  room.updatedAt = Date.now();
  room.players.forEach((player) => {
    if (player.connected && player.socketId) {
      io.to(player.socketId).emit('roomState', serializeRoom(room, player.id));
    }
  });
}

function ackError(ack, message) {
  if (typeof ack === 'function') ack({ ok: false, message });
}

function ackOk(ack, data = {}) {
  if (typeof ack === 'function') ack({ ok: true, ...data });
}

function attachSocket(socket, room, player) {
  player.socketId = socket.id;
  player.connected = true;
  socket.join(room.code);
  socketIndex.set(socket.id, { roomCode: room.code, playerId: player.id });
}

function removePlayerFromLobby(room, player) {
  room.players = room.players.filter((item) => item.id !== player.id);
  if (!room.players.length) {
    rooms.delete(room.code);
    return;
  }
  if (room.hostId === player.id) {
    room.hostId = room.players[0].id;
    addEvent(room, `${room.players[0].name} 成为新房主。`);
  }
}

io.on('connection', (socket) => {
  socket.on('createRoom', (data = {}, ack) => {
    const player = makePlayer({ name: data.name, token: data.token, socketId: socket.id, host: true });
    const room = makeRoom({ hostPlayer: player, boardSize: data.boardSize });
    rooms.set(room.code, room);
    attachSocket(socket, room, player);
    ackOk(ack, { roomCode: room.code, token: player.token, playerId: player.id });
    emitRoom(room);
  });

  socket.on('joinRoom', (data = {}, ack) => {
    const roomCode = cleanRoomCode(data.roomCode);
    const room = rooms.get(roomCode);
    if (!room) return ackError(ack, '没有找到这个房间。');

    const existing = room.players.find((player) => player.token === data.token);
    if (existing) {
      attachSocket(socket, room, existing);
      existing.name = cleanName(data.name || existing.name);
      addEvent(room, `${existing.name} 已重新连上。`);
      ackOk(ack, { roomCode: room.code, token: existing.token, playerId: existing.id, reconnected: true });
      emitRoom(room);
      return;
    }

    if (room.status !== 'lobby') return ackError(ack, '游戏已经开始，只能原玩家重连。');
    if (room.players.length >= MAX_PLAYERS) return ackError(ack, '房间已满。');

    const player = makePlayer({ name: data.name, token: data.token, socketId: socket.id });
    room.players.push(player);
    attachSocket(socket, room, player);
    addEvent(room, `${player.name} 加入房间。`);
    ackOk(ack, { roomCode: room.code, token: player.token, playerId: player.id });
    emitRoom(room);
  });

  socket.on('updateSettings', (data = {}, ack) => {
    const entry = getPlayerBySocket(socket.id);
    if (!entry) return ackError(ack, '你还不在房间里。');
    const { room, player } = entry;
    if (room.hostId !== player.id) return ackError(ack, '只有房主可以改设置。');
    if (room.status !== 'lobby') return ackError(ack, '游戏开始后不能改设置。');
    room.boardSize = normalizeBoardSize(data.boardSize);
    addEvent(room, `房主选择了 ${room.boardSize} x ${room.boardSize}。`);
    ackOk(ack);
    emitRoom(room);
  });

  socket.on('toggleReady', (_data, ack) => {
    const entry = getPlayerBySocket(socket.id);
    if (!entry) return ackError(ack, '你还不在房间里。');
    const { room, player } = entry;
    if (room.status !== 'lobby') return ackError(ack, '当前不能准备。');
    player.ready = !player.ready;
    addEvent(room, `${player.name} ${player.ready ? '准备好了' : '取消准备'}。`);
    ackOk(ack);
    emitRoom(room);
  });

  socket.on('startGame', (_data, ack) => {
    const entry = getPlayerBySocket(socket.id);
    if (!entry) return ackError(ack, '你还不在房间里。');
    const { room, player } = entry;
    if (room.hostId !== player.id) return ackError(ack, '只有房主可以开始。');
    if (connectedPlayers(room).length < 1) return ackError(ack, '至少需要 1 名玩家。');
    if (!room.players.every((item) => item.ready || !item.connected)) return ackError(ack, '还有玩家没准备。');
    resetRound(room);
    ackOk(ack);
    emitRoom(room);
  });

  socket.on('flipCard', (data = {}, ack) => {
    const entry = getPlayerBySocket(socket.id);
    if (!entry) return ackError(ack, '你还不在房间里。');
    const { room, player } = entry;
    const index = Number(data.index);
    if (room.status !== 'playing') return ackError(ack, '游戏还没开始。');
    if (room.pendingMismatch) return ackError(ack, '请等翻错的牌自动盖回去。');
    if (currentPlayer(room)?.id !== player.id) return ackError(ack, '还没轮到你。');
    if (!Number.isInteger(index) || index < 0 || index >= room.cards.length) return ackError(ack, '这张牌不存在。');
    if (room.flipped.includes(index) || room.cards[index].matched) return ackError(ack, '这张牌已经翻开了。');
    if (room.flipped.length >= 2) return ackError(ack, '每回合只能翻两张。');

    room.flipped.push(index);
    addEvent(room, `${player.name} 翻开了一张牌。`);

    if (room.flipped.length === 2) {
      const [firstIndex, secondIndex] = room.flipped;
      const first = room.cards[firstIndex];
      const second = room.cards[secondIndex];
      if (first.pairId === second.pairId) {
        first.matched = true;
        second.matched = true;
        player.score += 1;
        room.flipped = [];
        addEvent(room, `${player.name} 配对成功，继续行动！`);
        finishGameIfNeeded(room);
      } else {
        room.pendingMismatch = true;
        room.mismatchEndsAt = Date.now() + 5000;
        addEvent(room, '没有配对成功，5 秒后盖回去。');
        room.mismatchTimer = setTimeout(() => {
          room.flipped = [];
          room.pendingMismatch = false;
          room.mismatchEndsAt = null;
          room.mismatchTimer = null;
          advanceTurn(room);
          emitRoom(room);
        }, 5000);
      }
    }

    ackOk(ack);
    emitRoom(room);
  });

  socket.on('usePower', (data = {}, ack) => {
    const entry = getPlayerBySocket(socket.id);
    if (!entry) return ackError(ack, '你还不在房间里。');
    const { room, player } = entry;
    const type = String(data.type || '');
    if (room.status !== 'playing') return ackError(ack, '游戏还没开始。');
    if (currentPlayer(room)?.id !== player.id) return ackError(ack, '只有当前玩家能使用道具。');
    if (room.pendingMismatch) return ackError(ack, '请等翻错的牌自动盖回去。');
    if (!player.powers[type]) return ackError(ack, '这个道具已经用完了。');

    const hiddenIndexes = room.cards
      .map((card, index) => ({ card, index }))
      .filter(({ card, index }) => !card.matched && !room.flipped.includes(index));

    if (type === 'peek') {
      if (!hiddenIndexes.length) return ackError(ack, '没有可透视的牌了。');
      const indexes = shuffle(hiddenIndexes.map((item) => item.index)).slice(0, 2);
      room.privateViews[player.id] = { ...(room.privateViews[player.id] || {}), peekIndexes: indexes, peekUntil: Date.now() + 3000 };
      player.powers.peek -= 1;
      addEvent(room, `${player.name} 使用了透视。`);
      setTimeout(() => emitRoom(room), 3100);
    } else if (type === 'hint') {
      if (!hiddenIndexes.length) return ackError(ack, '没有可提示的牌了。');
      let hintIndex = null;
      if (room.flipped.length === 1) {
        const targetPair = room.cards[room.flipped[0]].pairId;
        const mate = hiddenIndexes.find((item) => item.card.pairId === targetPair);
        if (mate) hintIndex = mate.index;
      }
      if (hintIndex === null) hintIndex = hiddenIndexes[Math.floor(Math.random() * hiddenIndexes.length)].index;
      room.privateViews[player.id] = { ...(room.privateViews[player.id] || {}), hintIndex, hintUntil: Date.now() + 5000 };
      player.powers.hint -= 1;
      addEvent(room, `${player.name} 使用了提示。`);
      setTimeout(() => emitRoom(room), 5100);
    } else if (type === 'freeze') {
      if (room.freezeNext) return ackError(ack, '已经有一个冻结效果在等待生效。');
      room.freezeNext = true;
      player.powers.freeze -= 1;
      addEvent(room, `${player.name} 放出冰冰符，下一位玩家会跳过一次。`);
    } else {
      return ackError(ack, '未知道具。');
    }

    ackOk(ack);
    emitRoom(room);
  });

  socket.on('sendEmote', (data = {}, ack) => {
    const entry = getPlayerBySocket(socket.id);
    if (!entry) return ackError(ack, '你还不在房间里。');
    const { room, player } = entry;
    const allowed = ['👏', '😆', '😭', '🔥', '🧊', '🍀', '🀄', '🎉'];
    const emoji = allowed.includes(data.emoji) ? data.emoji : '👏';
    room.emotes.unshift({ id: uid(), playerId: player.id, name: player.name, emoji, ts: Date.now() });
    room.emotes = room.emotes.slice(0, 12);
    room.updatedAt = Date.now();
    ackOk(ack);
    emitRoom(room);
  });

  socket.on('restartGame', (_data, ack) => {
    const entry = getPlayerBySocket(socket.id);
    if (!entry) return ackError(ack, '你还不在房间里。');
    const { room, player } = entry;
    if (room.status !== 'ended') return ackError(ack, '游戏还没有结束。');
    if (room.hostId !== player.id) return ackError(ack, '只有房主可以再来一局。');
    resetRound(room);
    ackOk(ack);
    emitRoom(room);
  });

  socket.on('leaveRoom', (_data, ack) => {
    const entry = getPlayerBySocket(socket.id);
    if (!entry) return ackError(ack, '你还不在房间里。');
    const { room, player } = entry;
    socket.leave(room.code);
    socketIndex.delete(socket.id);
    if (room.status === 'lobby' || room.status === 'ended') {
      addEvent(room, `${player.name} 离开房间。`);
      removePlayerFromLobby(room, player);
      if (rooms.has(room.code)) emitRoom(room);
    } else {
      player.connected = false;
      addEvent(room, `${player.name} 暂时掉线，可重连回来。`);
      if (currentPlayer(room)?.id === player.id && !room.pendingMismatch) advanceTurn(room);
      emitRoom(room);
    }
    ackOk(ack);
  });

  socket.on('disconnect', () => {
    const entry = getPlayerBySocket(socket.id);
    if (!entry) return;
    const { room, player } = entry;
    socketIndex.delete(socket.id);
    player.connected = false;
    player.socketId = null;
    addEvent(room, `${player.name} 掉线了，可用同一浏览器重连。`);
    if (room.status === 'playing' && currentPlayer(room)?.id === player.id && !room.pendingMismatch) advanceTurn(room);
    emitRoom(room);
  });
});

setInterval(() => {
  const now = Date.now();
  rooms.forEach((room, code) => {
    const nobodyOnline = room.players.every((player) => !player.connected);
    if (nobodyOnline && now - room.updatedAt > ROOM_TTL_MS) {
      if (room.mismatchTimer) clearTimeout(room.mismatchTimer);
      rooms.delete(code);
    }
  });
}, 1000 * 60 * 10);

server.listen(PORT, () => {
  console.log(`Mahjong Memory Party is running at http://localhost:${PORT}`);
});

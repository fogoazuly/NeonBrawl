import { createMultiplayerState } from './state.js';

// Room lifecycle owns peers, data connections and retry timers. Rendering and
// gameplay remain behind callbacks; the existing wire messages are unchanged.
export function createRoomLifecycle({ mp, maxPlayers, createPeer, getPeerConfig,
  transport, identity, players, ui, isDifficulty, beforeLeave = () => {},
  now = () => performance.now(), random = Math.random,
  setTimer = setTimeout, clearTimer = clearTimeout }) {
  let generation = 0;
  const timers = new Set();
  const connections = new Set();
  const reservedSlots = new Map();

  function listen(target, event, callback) {
    const session = generation;
    target.on(event, (...args) => {
      if (session === generation) callback(...args);
    });
  }
  function later(callback, delay) {
    const session = generation;
    const timer = setTimer(() => {
      timers.delete(timer);
      if (session === generation) callback();
    }, delay);
    timers.add(timer);
    return timer;
  }
  function cancelTimer(timer) { clearTimer(timer); timers.delete(timer); }
  function close(connection) { try { connection.close(); } catch {} }

  function resetSession() {
    // Invalidate callbacks BEFORE destroy/close can emit more events.
    generation++;
    for (const timer of timers) clearTimer(timer);
    timers.clear(); reservedSlots.clear();
    mp.intentionalDisconnect = true;
    for (const connection of new Set([...connections, ...mp.conns.values()])) close(connection);
    connections.clear();
    try { mp.peer?.destroy(); } catch {}
    for (const id of Object.keys(mp.remotePlayers)) players.remove(+id);
    const hostDifficulty = mp.hostDifficulty;
    Object.assign(mp, createMultiplayerState(), { hostDifficulty });
    ui.reconnect('');
    return generation;
  }

  function notifyRoomExit() {
    if (!mp.connected) return;
    try {
      if (mp.isHost) transport.broadcastMP({ type: 'HOST_LEFT' });
      else transport.sendToHost({ type: 'PEER_LEAVE', id: mp.myId });
    } catch {}
  }
  function leaveRoom(status = 'Left room', notify = true) {
    beforeLeave(status);
    if (notify) notifyRoomExit();
    resetSession();
    ui.clearInput(); ui.status(status); ui.refresh();
  }
  function failJoin() { leaveRoom('Cannot connect - check code', false); }

  function applyJoinedMessage(msg, mode) {
    mp.myId = msg.id; mp.isHost = false; mp.soloMode = false;
    mp.connected = true; mp.lastHostSeen = now();
    if (msg.roomCode) mp.roomCode = msg.roomCode;
    mp.names = { ...(msg.names || {}), [msg.id]: identity.name() };
    mp.userIds = { ...(msg.userIds || {}), [msg.id]: identity.userId() };
    if (isDifficulty(msg.difficulty)) mp.hostDifficulty = msg.difficulty;
    for (const id of Object.keys(mp.names)) {
      if (+id !== mp.myId) players.build(+id, mp.names[id]);
    }
    if (mode === 'reconnect') {
      ui.status(`P${msg.id + 1} — Reconnected`);
    } else {
      ui.status(`P${msg.id + 1} — ${msg.count}/${maxPlayers} — waiting for host...`);
      ui.refresh(); players.broadcastName(mp.myId);
    }
  }

  function acceptGuest(conn) {
    let pid = -1;
    for (let id = 1; id < maxPlayers; id++) {
      if (!reservedSlots.has(id) && !mp.conns.has(id) && !mp.remotePlayers[id]) { pid = id; break; }
    }
    if (pid === -1) { close(conn); return; }
    // Reserve before open so simultaneous guests cannot receive the same slot.
    reservedSlots.set(pid, conn); connections.add(conn);
    mp.nextId = Math.max(mp.nextId, pid + 1);
    listen(conn, 'open', () => {
      if (reservedSlots.get(pid) !== conn) return;
      const name = identity.cleanName(conn.metadata?.name, pid);
      mp.names[pid] = name; mp.conns.set(pid, conn);
      if (conn.metadata?.userId) mp.userIds[pid] = conn.metadata.userId;
      conn.send(JSON.stringify({ type: 'JOINED', id: pid, hostId: 0, count: mp.conns.size + 1,
        roomCode: mp.roomCode, names: mp.names, userIds: mp.userIds, difficulty: mp.hostDifficulty }));
      for (const [id] of mp.conns) {
        if (id !== pid) conn.send(JSON.stringify({ type: 'PLAYER_JOIN', id, count: mp.conns.size + 1,
          name: identity.displayName(id), userId: mp.userIds[id] || null }));
      }
      conn.send(JSON.stringify({ type: 'PLAYER_JOIN', id: 0, count: mp.conns.size + 1,
        name: identity.displayName(0), userId: mp.userIds[0] || null }));
      transport.broadcastMP(JSON.stringify({ type: 'PLAYER_JOIN', id: pid, count: mp.conns.size + 1,
        name, userId: mp.userIds[pid] || null }), pid);
      players.build(pid, name);
      if (mp.remotePlayers[pid]) mp.remotePlayers[pid].lastSeen = now();
      if (mp.isHost && !mp.contribStats[pid]) mp.contribStats[pid] = players.blankContribution();
      ui.status(`${mp.conns.size + 1}/${maxPlayers} players`); ui.refresh();
    });
    listen(conn, 'data', raw => {
      if (mp.conns.get(pid) !== conn) return;
      try { players.handleMessage(JSON.parse(raw.toString()), pid); } catch {}
    });
    const departed = () => {
      if (reservedSlots.get(pid) === conn) reservedSlots.delete(pid);
      connections.delete(conn);
      if (mp.conns.get(pid) === conn) {
        mp.conns.delete(pid);
        players.disconnected(pid, 'left');
      }
    };
    listen(conn, 'close', departed);
    listen(conn, 'error', () => { departed(); close(conn); });
  }

  async function hostGame() {
    const session = resetSession();
    const code = random().toString(36).slice(2, 8).toUpperCase();
    mp.roomCode = code; mp.names = { 0: identity.name() };
    ui.status('Creating room...'); ui.refresh();
    try {
      const config = await getPeerConfig();
      if (session !== generation) return;
      mp.peer = createPeer('neonbrawl-' + code, config);
      listen(mp.peer, 'error', error => leaveRoom('Error: ' + error.message, false));
      listen(mp.peer, 'open', () => {
        mp.connected = true; mp.myId = 0; mp.isHost = true; mp.soloMode = false; mp.nextId = 1;
        ui.status(`You are HOST — share code: ${code}`); ui.refresh();
      });
      listen(mp.peer, 'connection', acceptGuest);
    } catch (error) {
      if (session === generation) leaveRoom('Error: ' + error.message, false);
    }
  }

  function connectToHost(mode) {
    const conn = mp.peer.connect('neonbrawl-' + mp.roomCode, {
      reliable: true, metadata: { name: identity.name(), userId: identity.userId() },
    });
    connections.add(conn);
    let joined = false, timeout;
    const disconnected = () => {
      ui.reconnect(''); ui.disconnected('Host disconnected');
    };
    if (mode === 'reconnect') {
      // An open channel alone is not enough: wait for the host's JOINED reply.
      timeout = later(() => { if (!joined) disconnected(); }, 5000);
    }
    listen(conn, 'open', () => { mp.conns.set(0, conn); });
    listen(conn, 'data', raw => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'JOINED') {
          if (!msg.roomCode) msg.roomCode = mp.roomCode;
          joined = true;
          if (timeout) cancelTimer(timeout);
          applyJoinedMessage(msg, mode); ui.reconnect('');
        } else players.handleMessage(msg, 0);
      } catch {}
    });
    listen(conn, 'error', () => { if (mode === 'reconnect') disconnected(); else failJoin(); });
    listen(conn, 'close', () => {
      connections.delete(conn);
      if (mp.intentionalDisconnect) return;
      if (mp.conns.has(0) && mp.conns.get(0) !== conn) return;
      if (mode === 'reconnect' || !mp.peer || !mp.roomCode) { disconnected(); return; }
      ui.reconnect('CONNECTION LOST — RECONNECTING...');
      try { connectToHost('reconnect'); } catch { disconnected(); }
    });
    return conn;
  }

  async function joinGame(code, opts = {}) {
    const retries = Number.isFinite(opts.retries) ? opts.retries : 0;
    const retryDelay = Number.isFinite(opts.retryDelay) ? opts.retryDelay : 1100;
    const session = resetSession();
    mp.roomCode = code.toUpperCase();
    ui.status('Connecting...'); ui.refresh();
    try {
      const config = await getPeerConfig();
      if (session !== generation) return;
      mp.peer = createPeer(config);
      listen(mp.peer, 'error', error => {
        const transient = ['peer-unavailable', 'network', 'disconnected', 'server-error', 'socket-error'].includes(error?.type);
        if (transient && retries > 0 && !mp.connected) {
          resetSession();
          ui.status(`Connecting... (retry ${4 - retries}/3)`);
          later(() => joinGame(code, { retries: retries - 1, retryDelay }), retryDelay);
        } else if (mp.connected) ui.disconnected('Host disconnected');
        else failJoin();
      });
      listen(mp.peer, 'open', () => {
        try { connectToHost('initial'); } catch { failJoin(); }
      });
    } catch {
      if (session === generation) failJoin();
    }
  }

  return { hostGame, joinGame, leaveRoom, notifyRoomExit };
}

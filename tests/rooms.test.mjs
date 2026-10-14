import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createMultiplayerState } from '../local/multiplayer/state.js';
import { createTransport } from '../local/multiplayer/transport.js';
import { createRoomLifecycle } from '../local/multiplayer/rooms.js';

class Connection extends EventEmitter {
  constructor(name = 'Guest') { super(); this.open = false; this.metadata = { name }; this.sent = []; this.closed = false; }
  send(value) { this.sent.push(JSON.parse(value)); }
  start() { this.open = true; this.emit('open'); }
  close() { if (this.closed) return; this.closed = true; this.open = false; this.emit('close'); }
}
class Peer extends EventEmitter {
  constructor(args) { super(); this.args = args; this.connections = []; this.destroyed = false; }
  connect(id, options) { const conn = new Connection(); conn.destination = id; conn.options = options; this.connections.push(conn); return conn; }
  destroy() { this.destroyed = true; for (const conn of this.connections) conn.close(); }
}
function fixture(getPeerConfig = async () => ({ path: '/peerjs' })) {
  const mp = createMultiplayerState(), peers = [], timers = new Map(), messages = [], statuses = [], departures = [];
  let nextTimer = 0, rooms;
  const transport = createTransport(mp, { getPeerConfig });
  rooms = createRoomLifecycle({
    mp, maxPlayers: 6, getPeerConfig, transport, random: () => .456789, now: () => 1234,
    createPeer(...args) { const peer = new Peer(args); peers.push(peer); return peer; },
    setTimer(fn, delay) { const id = ++nextTimer; timers.set(id, { fn, delay }); return id; },
    clearTimer: id => timers.delete(id),
    identity: { name: () => 'Local', userId: () => null, cleanName: name => name, displayName: id => mp.names[id] || 'Local' },
    players: {
      build(id, name) { mp.remotePlayers[id] = { name }; }, remove(id) { delete mp.remotePlayers[id]; },
      disconnected(id) { departures.push(id); delete mp.remotePlayers[id]; delete mp.names[id]; },
      handleMessage(msg, id) { messages.push([msg, id]); }, blankContribution: () => ({ damage: 0 }), broadcastName() {},
    },
    ui: { status: value => statuses.push(value), refresh() {}, reconnect() {}, clearInput() {},
      disconnected: status => rooms.leaveRoom(status) },
    isDifficulty: value => ['easy', 'hard'].includes(value),
  });
  async function runTimers() {
    for (const [id, { fn }] of [...timers]) { if (timers.delete(id)) fn(); }
    await Promise.resolve();
  }
  return { rooms, mp, peers, timers, runTimers, messages, statuses, departures };
}
function joined(conn, id = 1) {
  conn.emit('data', JSON.stringify({ type: 'JOINED', id, count: 2, names: { 0: 'Host' }, difficulty: 'easy', roomCode: 'ABC123' }));
}
async function guest(f) {
  await f.rooms.joinGame('abc123');
  const peer = f.peers.at(-1); peer.emit('open');
  const conn = peer.connections.at(-1); conn.start(); joined(conn);
  return { peer, conn };
}

test('host reserva slots simultâneos, respeita limite e reutiliza vaga livre', async () => {
  const f = fixture(); await f.rooms.hostGame(); f.peers[0].emit('open');
  const guests = Array.from({ length: 6 }, () => new Connection());
  for (const conn of guests) f.peers[0].emit('connection', conn);
  assert.equal(guests[5].closed, true);
  for (const conn of guests.slice(0, 5)) conn.start();
  assert.deepEqual(guests.slice(0, 5).map(conn => conn.sent[0].id), [1, 2, 3, 4, 5]);
  assert.equal(f.mp.conns.size, 5);
  assert.equal(guests[0].sent[0].type, 'JOINED');
  assert.equal(guests[0].sent[0].difficulty, 'hard');
  guests[1].close();
  const replacement = new Connection('Replacement'); f.peers[0].emit('connection', replacement);
  guests[1].emit('error', new Error('late error')); guests[1].emit('open');
  replacement.start();
  assert.equal(replacement.sent[0].id, 2);
  assert.equal(f.mp.conns.get(2), replacement);
  assert.deepEqual(f.departures, [2]);
});

test('host sai, notifica convidados e reinicia o estado sem dados da sala antiga', async () => {
  const f = fixture(); await f.rooms.hostGame(); f.peers[0].emit('open');
  const conn = new Connection(); f.peers[0].emit('connection', conn); conn.start();
  f.mp.gunReady[1] = 'pistol'; f.mp.userIds[1] = 'old-user'; f.mp.contribStats[1] = { damage: 100 };
  f.rooms.leaveRoom();
  assert.equal(conn.sent.at(-1).type, 'HOST_LEFT');
  assert.equal(f.peers[0].destroyed, true); assert.equal(conn.closed, true);
  assert.equal(f.mp.connected, false); assert.equal(f.mp.soloMode, true);
  assert.deepEqual(f.mp.userIds, {}); assert.deepEqual(f.mp.contribStats, {}); assert.deepEqual(f.mp.gunReady, {});
  assert.equal(f.mp.conns.size, 0);
  await f.rooms.hostGame(); f.peers[1].emit('open');
  f.peers[0].emit('error', new Error('old peer'));
  assert.equal(f.mp.peer, f.peers[1]); assert.equal(f.mp.connected, true);
});

test('convidado entra, despacha mensagens e avisa ao sair', async () => {
  const f = fixture(); const { conn } = await guest(f);
  assert.equal(f.mp.myId, 1); assert.equal(f.mp.isHost, false); assert.equal(f.mp.hostDifficulty, 'easy');
  assert.equal(conn.destination, 'neonbrawl-ABC123');
  conn.emit('data', '{bad json'); conn.emit('data', '{"type":"GAME_START"}');
  assert.deepEqual(f.messages, [[{ type: 'GAME_START' }, 0]]);
  f.rooms.leaveRoom();
  assert.deepEqual(conn.sent.at(-1), { type: 'PEER_LEAVE', id: 1 });
  assert.equal(f.timers.size, 0);
});

test('sair durante configuração pendente impede criar um peer atrasado', async () => {
  let resolve;
  const f = fixture(() => new Promise(done => { resolve = done; }));
  const pending = f.rooms.hostGame();
  f.rooms.leaveRoom(); resolve({}); await pending;
  assert.equal(f.peers.length, 0); assert.equal(f.mp.roomCode, null);
});

test('retry é executado e cancelado ao sair ou criar outra sala', async () => {
  const f = fixture(); await f.rooms.joinGame('ABC123', { retries: 3 });
  f.peers[0].emit('error', { type: 'peer-unavailable' });
  assert.equal(f.peers[0].destroyed, true); assert.equal(f.timers.size, 1);
  await f.runTimers();
  assert.equal(f.peers.length, 2);
  f.peers[1].emit('error', { type: 'network' });
  f.rooms.leaveRoom(); await f.runTimers();
  assert.equal(f.peers.length, 2);
  await f.rooms.joinGame('ABC123', { retries: 3 });
  f.peers[2].emit('error', { type: 'network' });
  await f.rooms.hostGame(); await f.runTimers();
  assert.equal(f.peers.length, 4); assert.equal(f.mp.peer, f.peers[3]);
});

test('falha definitiva limpa o peer e permite nova entrada', async () => {
  const f = fixture(); await f.rooms.joinGame('ABC123');
  f.peers[0].emit('error', { type: 'peer-unavailable' });
  assert.equal(f.peers[0].destroyed, true); assert.equal(f.mp.peer, null);
  assert.equal(f.statuses.at(-1), 'Cannot connect - check code');
  await guest(f); assert.equal(f.mp.connected, true);
});

test('reconexão exige JOINED e cancela timeout após confirmação', async () => {
  const f = fixture(); const { peer, conn } = await guest(f);
  conn.close();
  const retry = peer.connections.at(-1); assert.notEqual(retry, conn);
  retry.start(); assert.equal(f.timers.size, 1);
  joined(retry); assert.equal(f.timers.size, 0);
  assert.equal(f.mp.conns.get(0), retry); assert.equal(f.mp.connected, true);
  retry.close(); assert.equal(f.mp.connected, false); assert.equal(peer.destroyed, true);
});

test('timeout de reconexão fecha canal pendente; sair cancela timeout', async () => {
  const f = fixture(); const { peer, conn } = await guest(f);
  conn.close(); const retry = peer.connections.at(-1); retry.start();
  await f.runTimers();
  assert.equal(f.mp.connected, false); assert.equal(retry.closed, true);
  const next = await guest(f); next.conn.close();
  f.rooms.leaveRoom(); await f.runTimers();
  assert.equal(f.statuses.at(-1), 'Left room'); assert.equal(f.timers.size, 0);
});

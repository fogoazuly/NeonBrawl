import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { createCollisionSystem } from '../local/combat/collision.js';
import { createDamageSystem } from '../local/combat/damage.js';
import { createMultiplayerState } from '../local/multiplayer/state.js';
import { createTransport } from '../local/multiplayer/transport.js';

const baseline = await readFile('backup/game.before-systems.js', 'utf8');
const section = (start, end) => baseline.slice(baseline.indexOf(start), baseline.indexOf(end, baseline.indexOf(start)));
const plain = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));

test('colisões preservam limites, obstáculos dinâmicos e ricochetes', () => {
  const obstacleBoxes = [];
  const system = createCollisionSystem({ arenaWidth: 13, arenaHeight: 13, obstacleBoxes });
  assert.equal(system.isBlockedAt(0, 0, .5), false);
  assert.equal(system.isBlockedAt(13, 0, .5), true);
  obstacleBoxes.push({ x: 3, z: 0, hw: 1, hd: 1 });
  assert.equal(system.isBlockedAt(3, 0, .5), true);
  assert.equal(system.firstObstacleHitDistance(0, 0, 1, 0, 10), 2);
  const segments = system.reflectedRaySegments(0, 0, 1, 0, 8, 1);
  assert.equal(segments.length, 2);
  assert.equal(segments[1].dx, -1);
  obstacleBoxes.length = 0;
  assert.equal(system.firstObstacleHitDistance(0, 0, 1, 0, 10), 10);
});

test('colisões e desvios correspondem ao código anterior em 300 cenários', () => {
  const obstacleBoxes = [{ x: 2, z: 1, hw: 1, hd: 2 }, { x: -4, z: -3, hw: 2, hd: .5 }];
  const next = createCollisionSystem({ arenaWidth: 13, arenaHeight: 13, obstacleBoxes });
  const old = vm.createContext({ ARENA_W: 13, ARENA_H: 13, obstacleBoxes });
  vm.runInContext(section('function boxOverlap(', '// ── Bullet pool'), old);
  for (let i = 0; i < 300; i++) {
    const x = (i * 17 % 300) / 10 - 15, z = (i * 37 % 280) / 10 - 14;
    const dx = Math.cos(i), dz = Math.sin(i), r = .2 + (i % 5) * .2;
    for (const [name, args] of [
      ['isBlockedAt', [x, z, r]], ['firstSolidHitInfo', [x, z, dx, dz, 20, .1]],
      ['reflectedRaySegments', [x, z, dx, dz, 20, 3, .1]],
      ['openSteer', [{ x, z }, dx, dz, r, .4]],
      ['chooseDetourDirection', [{ x, z }, dx, dz, r, .4]],
    ]) assert.deepEqual(plain(next[name](...args)), plain(old[name](...args)), `${name} scenario ${i}`);
    const a = { x, z }, b = { x, z };
    next.projectToNearestOpen(a, r); old.projectToNearestOpen(b, r);
    assert.deepEqual(a, b);
  }
});

function damageFixture() {
  const old = vm.createContext({
    playerSkills: {}, player: { pos: { x: 0, z: 3 } }, phaseVulnMap: new Map(), _critChanceBonus: 0,
    PERM_CRIT_CHANCE: [0, .1, .33], CRIT_LUCK_BONUS: [0, .075, .15], PERM_BOSS_DMG_MULT: [1, 1.1, 1.3],
    permLevel: () => 0, relicDamageMult: () => 1, skillFxThrottle: () => true, isMobile: false,
    burst() {}, flashLight() {}, dmgNum() {}, Math: Object.create(Math),
  });
  old.Math.random = () => .99;
  vm.runInContext(section('function rollCrit(', 'function dashCooldown('), old);
  const system = createDamageSystem({
    permLevel: name => old.permLevel(name), relicDamageMult: () => old.relicDamageMult(),
    getSkills: () => old.playerSkills, getPlayer: () => old.player,
    getPhaseVulnerability: () => old.phaseVulnMap, getCritBonus: () => old._critChanceBonus,
    onExecute() {}, random: () => old.Math.random(),
    PERM_CRIT_CHANCE: old.PERM_CRIT_CHANCE, CRIT_LUCK_BONUS: old.CRIT_LUCK_BONUS, PERM_BOSS_DMG_MULT: old.PERM_BOSS_DMG_MULT,
  });
  return { old, system };
}

test('dano preserva críticos, execução, bosses, blindagem e vulnerabilidade', () => {
  const { old, system } = damageFixture();
  for (let i = 0; i < 160; i++) {
    const enemy = { type: ['chaser', 'boss', 'tank', 'shooter'][i % 4], hp: [20, 25, 75, 100][i % 4], maxHp: 100,
      poolIdx: 1, pos: { x: 0, z: 0 }, mesh: { rotation: { y: i % 3 ? 0 : Math.PI } } };
    old.playerSkills = { hollowPoint: i % 6, critLuck: i % 3 };
    old.Math.random = () => i % 2 ? .01 : .99;
    old._critChanceBonus = i % 7 ? 0 : .5;
    old.phaseVulnMap = new Map([[1, { t: i % 3, mult: .2 }]]);
    // Equivalence applies when owner and host have the same Hollow Point level;
    // differing builds are covered by the ownership regression below.
    const source = i % 5 ? { crit: i % 3, critLuck: 1, relicDmg: 1.2, bossHunter: 2, executionRounds: i % 2, hollowPoint:i % 6 } : null;
    const a = structuredClone(enemy), b = structuredClone(enemy);
    assert.equal(system.playerDamageAmount(a, 30, source), old.playerDamageAmount(b, 30, source), `scenario ${i}`);
    assert.equal(a._lastCrit, b._lastCrit);
  }
});

test('dano consulta o estado atual depois de reiniciar a build', () => {
  const { old, system } = damageFixture();
  const enemy = { type: 'chaser', hp: 100, maxHp: 100, poolIdx: 1 };
  assert.equal(system.playerDamageAmount(enemy, 100), 100);
  old.playerSkills = { hollowPoint: 1 };
  assert.equal(system.playerDamageAmount(enemy, 100), 135);
  old.playerSkills = {};
  assert.equal(system.playerDamageAmount(enemy, 100), 100);
  old._critChanceBonus = 1;
  old.Math.random = () => .94;
  assert.equal(system.rollCrit(), true);
  old.Math.random = () => .96;
  assert.equal(system.rollCrit(), false);
});

test('Hollow Point pertence ao autor do disparo, sem herdar a build do anfitrião', () => {
  const {old,system}=damageFixture();
  const enemy={type:'chaser',hp:100,maxHp:100,poolIdx:1};
  old.playerSkills={hollowPoint:5};
  assert.equal(system.playerDamageAmount(enemy,100),195);
  assert.equal(system.playerDamageAmount(enemy,100,{hollowPoint:0}),100);
  assert.equal(system.playerDamageAmount(enemy,100,{hollowPoint:1}),135);
  assert.equal(system.playerDamageAmount(enemy,100,{}),100);
  old.playerSkills={};
  assert.equal(system.playerDamageAmount(enemy,100,{hollowPoint:5}),195);
  enemy.hp=70;
  assert.equal(system.playerDamageAmount(enemy,100,{hollowPoint:5}),100);
});

test('multiplayer isola sessões e transmite mesmo com conexão obsoleta', async () => {
  const a = createMultiplayerState(), b = createMultiplayerState();
  const received = [];
  a.conns.set(0, { open: true, send: value => received.push(['host', value]) });
  a.conns.set(1, { open: true, send() { throw new Error('closed during send'); } });
  a.conns.set(2, { open: true, send: value => received.push(['guest', value]) });
  a.conns.set(3, { open: false, send() { assert.fail('closed connection'); } });
  a.buffReady[0] = true;
  assert.equal(b.conns.size, 0); assert.deepEqual(b.buffReady, {});
  const transport = createTransport(a, { getPeerConfig: async () => ({ path: '/peerjs' }) });
  transport.broadcastMP({ type: 'PING' }, 0);
  assert.deepEqual(received, [['guest', '{"type":"PING"}']]);
  transport.sendToHost('{"type":"READY"}');
  assert.deepEqual(received[1], ['host', '{"type":"READY"}']);
  a.conns = new Map();
  transport.broadcastMP({ type: 'PING' }); transport.sendToHost({ type: 'PING' });
  assert.equal(received.length, 2);
  assert.deepEqual(await transport.getPeerConfig(), { path: '/peerjs' });
});

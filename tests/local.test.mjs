import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

test('servidor fornece jogo e bibliotecas locais sem expor fontes privadas', async t => {
  const child = spawn(process.execPath, ['server.mjs'], { env: { ...process.env, PORT: '0', HOST: '127.0.0.1' }, stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(() => child.kill());
  const base = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Servidor não iniciou')), 10000);
    child.once('error', reject);
    child.stderr.on('data', chunk => { clearTimeout(timer); reject(new Error(String(chunk))); });
    child.stdout.once('data', chunk => { clearTimeout(timer); resolve(String(chunk).trim().replace('NeonBrawl: ', '')); });
  });
  assert.deepEqual(await (await fetch(base + '/health')).json(), { status: 'ok' });
  const html = await (await fetch(base)).text();
  assert.match(html, /\/vendor\/three\/build\/three.module.js/);
  assert.doesNotMatch(html, /<script[^>]+src="(?:https?:|\/\/)/);
  const config = await (await fetch(base + '/runtime-config.js')).text();
  assert.match(config, /"iceServers":\[\]/);
  for (const route of ['/vendor/peerjs.min.js', '/vendor/three/build/three.module.js', '/local/services.js', '/local/game.js', '/local/game.css', '/local/backup-ui.js', '/local/save-codec.js', '/local/progress-backup.js', '/peerjs/peerjs/id']) {
    assert.equal((await fetch(base + route)).status, 200, route);
  }
  for (const route of ['/vendor/supabase.js', '/local/auth.js', '/local/auth.css']) {
    assert.equal((await fetch(base + route)).status, 200, route);
  }
  for (const route of ['/.env', '/.env.example', '/auth-config.mjs', '/server.mjs', '/package.json', '/backup/NeonBrawl.original.html', '/.tools/npm.tgz']) {
    assert.equal((await fetch(base + route)).status, 404, route);
  }
});

test('adaptador usa origem da página, HTTPS e ranking persistente', async () => {
  const storage = new Map();
  const context = vm.createContext({
    window: { addEventListener() {}, NEONBRAWL_CONFIG: { peerPath: '/peerjs', iceServers: [] } },
    location: { hostname: 'example.test', port: '', protocol: 'https:' },
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
  });
  const source = await readFile('local/services.js', 'utf8');
  vm.runInContext(source, context);
  for(let i=0;i<12;i++)context.window.NeonBrawlDiagnostics.record('test',{line:i});
  const logs=JSON.parse(storage.get('nbRuntimeDiagnostics'));
  assert.equal(logs.length,10);
  assert.equal(logs[0].line,2);
  const config = await context.window.NeonBrawlServices.getPeerConfig();
  assert.equal(config.host, 'example.test');
  assert.equal(config.port, 443);
  assert.equal(config.secure, true);
  assert.equal(config.path, '/peerjs');
  assert.equal(context.window.PixoSupabase.getState().enabled, false);
  context.window.PixoLeaderboard.submit('neonbrawl', 'score_easy', 10, { wave: 1, members: [] });
  context.window.PixoLeaderboard.submit('neonbrawl', 'score_hard', 30, { wave: 2, members: [] });
  vm.runInContext(source, context);
  context.window.PixoLeaderboard.submit('neonbrawl', 'score_easy', 20, { wave: 2, members: [] });
  assert.deepEqual(JSON.parse(storage.get('nbLocalScores')).map(row => row.score), [30, 20, 10]);
});

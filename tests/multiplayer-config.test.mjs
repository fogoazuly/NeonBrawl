import test from 'node:test';
import assert from 'node:assert/strict';
import { publicMultiplayerConfig } from '../multiplayer-config.mjs';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

test('Pages multiplayer stays disabled until a server is configured', () => {
  assert.equal(publicMultiplayerConfig({}).multiplayer, false);
});
test('external signaling uses TLS and public STUN without permanent credentials', () => {
  const config = publicMultiplayerConfig({ PEER_SERVER_URL: 'https://rooms.example.test' });
  assert.deepEqual(config.peerServer, { host: 'rooms.example.test', port: 443, secure: true });
  assert.equal(config.peerPath, '/peerjs');
  assert.equal(config.multiplayer, true);
  assert.equal(JSON.stringify(config).includes('credential'), false);
});
test('reject insecure or credential-bearing signaling URLs', () => {
  for (const value of ['http://rooms.test', 'https://user:secret@rooms.test', 'https://rooms.test/path', 'https://rooms.test/?token=secret']) {
    assert.throws(() => publicMultiplayerConfig({ PEER_SERVER_URL: value }));
  }
});

test('remote adapter waits for wakeup and reports server failure', async () => {
  let ok = true;
  let requested;
  const context = vm.createContext({
    window: { addEventListener() {}, NEONBRAWL_CONFIG: publicMultiplayerConfig({ PEER_SERVER_URL: 'https://rooms.example.test' }) },
    localStorage: { getItem: () => null }, AbortSignal,
    fetch: async (url, options) => { requested = { url, options }; return { ok }; }
  });
  vm.runInContext(await readFile('local/services.js', 'utf8'), context);
  assert.equal((await context.window.NeonBrawlServices.getPeerConfig()).host, 'rooms.example.test');
  assert.equal(requested.url, 'https://rooms.example.test:443/peerjs/peerjs/id');
  assert.equal(requested.options.credentials, 'omit');
  ok = false;
  await assert.rejects(context.window.NeonBrawlServices.getPeerConfig(), /indisponível/);
});

test('online adapter requires login and uses authenticated TURN response', async () => {
  let session = null, status = 200;
  let servers = [{ urls: 'turn:relay.test:443', username: 'temporary', credential: 'relay-secret' }];
  const calls = [];
  const context = vm.createContext({
    window: {
      addEventListener() {},
      NEONBRAWL_CONFIG: publicMultiplayerConfig({ PEER_SERVER_URL: 'https://rooms.example.test', TURN_ENABLED: '1' }),
      NeonBrawlAuth: { getClient: () => ({ auth: { getSession: async () => ({ data: { session } }) } }) }
    },
    localStorage: { getItem: () => null }, AbortSignal,
    fetch: async (url, options) => {
      calls.push({ url, options });
      if (url.endsWith('/id')) return { ok: true };
      return { ok: status === 200, status, json: async () => ({ iceServers: servers }) };
    }
  });
  vm.runInContext(await readFile('local/services.js', 'utf8'), context);
  const getConfig = context.window.NeonBrawlServices.getPeerConfig;
  await assert.rejects(getConfig(), /Entre na sua conta/);
  assert.equal(calls.length, 1);
  session = { access_token: 'test-session' };
  assert.equal((await getConfig()).config.iceServers, servers);
  assert.equal(calls.at(-1).url, 'https://rooms.example.test/api/ice');
  assert.equal(calls.at(-1).options.headers.Authorization, 'Bearer test-session');
  assert.equal(calls.at(-1).options.credentials, 'omit');
  status = 401;
  await assert.rejects(getConfig(), /Entre novamente/);
  status = 503;
  await assert.rejects(getConfig(), /indisponível/);
  status = 200; servers = [];
  await assert.rejects(getConfig(), /inválida/);
});

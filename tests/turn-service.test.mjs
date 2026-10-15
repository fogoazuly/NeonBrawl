import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { installTurnService } from '../turn-service.mjs';

test('Metered broker keeps API key server-side and rejects invalid provider responses', async t => {
  let calls = 0, time = 0;
  let payload = [{ urls: 'turns:global.relay.metered.ca:443?transport=tcp', username: 'relay-user', credential: 'relay-password', apiKey: 'must-not-leak' }];
  const app = express();
  installTurnService(app, {
    auth: {}, env: { TURN_PROVIDER: 'metered', METERED_DOMAIN: 'neonbrawl.metered.live', METERED_API_KEY: 'secret&value' },
    now: () => time,
    verifyUser: async token => token === 'valid' ? { id: 'user1' } : null,
    fetchImpl: async (url, options) => {
      calls++;
      const parsed = new URL(url);
      assert.equal(parsed.origin, 'https://neonbrawl.metered.live');
      assert.equal(parsed.searchParams.get('apiKey'), 'secret&value');
      assert.equal(options.redirect, 'error');
      return { ok: true, json: async () => payload };
    }
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => server.close());
  const request = token => fetch(`http://127.0.0.1:${server.address().port}/api/ice`, {
    method: 'POST', headers: { Origin: 'https://fogoazuly.github.io', Authorization: `Bearer ${token}` }
  });
  assert.equal((await request('invalid')).status, 401);
  assert.equal(calls, 0);
  const response = await request('valid');
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { iceServers: [{ urls: ['turns:global.relay.metered.ca:443?transport=tcp'], username: 'relay-user', credential: 'relay-password' }] });
  await request('valid');
  assert.equal(calls, 1);
  time = 600001;
  payload = [{ urls: 'https://invalid.test' }];
  assert.equal((await request('valid')).status, 503);
  payload = { error: 'secret provider detail' };
  assert.equal((await request('valid')).status, 503);
});

test('Metered domain cannot redirect the API key to another host', async t => {
  const app = express();
  installTurnService(app, {
    auth: {}, env: { TURN_PROVIDER: 'metered', METERED_DOMAIN: 'attacker.test/path', METERED_API_KEY: 'secret' },
    verifyUser: async () => { throw new Error('Must not authenticate without configuration'); },
    fetchImpl: async () => { throw new Error('Must not send key'); }
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => server.close());
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/ice`, {
    method: 'POST', headers: { Origin: 'https://fogoazuly.github.io', Authorization: 'Bearer valid' }
  });
  assert.equal(response.status, 503);
});

test('TURN broker authenticates, isolates credentials, caches and fails closed', async t => {
  const app = express();
  let calls = 0, valid = true, time = 0;
  installTurnService(app, {
    auth: {}, env: { TURN_KEY_ID: 'test', TURN_KEY_API_TOKEN: 'permanent-secret' },
    now: () => time,
    verifyUser: async token => token === 'valid' ? { id: 'user1' } : null,
    fetchImpl: async (_url, options) => {
      calls++;
      assert.equal(options.headers.Authorization, 'Bearer permanent-secret');
      assert.equal(JSON.parse(options.body).ttl, 86400);
      return { ok: valid, json: async () => ({ iceServers: [{ urls: ['turn:relay.test:3478', 'turn:relay.test:53'], username: 'temporary-user', credential: 'temporary-secret' }] }) };
    }
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => server.close());
  const url = `http://127.0.0.1:${server.address().port}/api/ice`;
  const request = (token, origin = 'https://fogoazuly.github.io', method = 'POST') => fetch(url, { method, headers: { Origin: origin, ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
  assert.equal((await request(null)).status, 401);
  assert.equal((await request('forged')).status, 401);
  assert.equal((await request('valid', 'https://other.test')).status, 403);
  assert.equal((await request(null, undefined, 'OPTIONS')).status, 204);
  const response = await request('valid');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const body = await response.text();
  assert.ok(body.includes('temporary-secret'));
  assert.ok(!body.includes('permanent-secret'));
  assert.ok(!body.includes(':53'));
  await request('valid');
  assert.equal(calls, 1);
  time = 600001; valid = false;
  assert.equal((await request('valid')).status, 503);
  valid = true;
  assert.equal((await request('valid')).status, 200);
  for (let i = 0; i < 120; i++) await request('forged');
  assert.equal((await request('valid')).status, 429);
});

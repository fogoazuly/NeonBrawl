import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { installTurnService } from '../turn-service.mjs';

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

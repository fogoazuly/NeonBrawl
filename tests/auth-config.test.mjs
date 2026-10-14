import test from 'node:test';
import assert from 'node:assert/strict';
import { publicAuthConfig } from '../auth-config.mjs';

test('auth desativada sem configuração; somente dados públicos são exportados', () => {
  assert.equal(publicAuthConfig({}), null);
  assert.deepEqual(publicAuthConfig({ SUPABASE_URL: 'https://example.supabase.co/', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test', SUPABASE_SERVICE_ROLE_KEY: 'never-expose' }),
    { url: 'https://example.supabase.co', publishableKey: 'sb_publishable_test' });
});
test('auth rejeita configuração parcial, URL insegura e chaves privilegiadas', () => {
  assert.throws(() => publicAuthConfig({ SUPABASE_URL: 'https://example.supabase.co' }));
  for (const key of ['sb_secret_private', `header.${Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url')}.signature`]) {
    assert.throws(() => publicAuthConfig({ SUPABASE_URL: 'https://example.supabase.co', SUPABASE_PUBLISHABLE_KEY: key }));
  }
  for (const url of ['http://example.supabase.co', 'https://user:pass@example.supabase.co', 'https://example.supabase.co/path']) {
    assert.throws(() => publicAuthConfig({ SUPABASE_URL: url, SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test' }));
  }
});

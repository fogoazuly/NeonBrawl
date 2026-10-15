import { createClient } from '@supabase/supabase-js';

// Single-instance beta broker. Never returns the provider's permanent API token.
export function installTurnService(app, { auth, env = process.env, fetchImpl = fetch, verifyUser, now = Date.now }) {
  const origin = env.FRONTEND_ORIGIN || 'https://fogoazuly.github.io';
  const enabled = Boolean(auth && env.TURN_KEY_ID && env.TURN_KEY_API_TOKEN);
  const boundedFetch = (url, options = {}) => fetchImpl(url, { ...options, signal: AbortSignal.timeout(15000) });
  const client = enabled && !verifyUser ? createClient(auth.url, auth.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: boundedFetch }
  }) : null;
  const verify = verifyUser || (async token => {
    const { data, error } = await client.auth.getUser(token);
    return error ? null : data.user;
  });
  const cache = new Map();
  let windowStart = now(), requests = 0;
  app.all('/api/ice', async (req, res) => {
    res.set('Cache-Control', 'no-store').vary('Origin');
    if (req.headers.origin !== origin) return res.status(403).json({ error: 'Origem não permitida.' });
    res.set('Access-Control-Allow-Origin', origin);
    if (req.method === 'OPTIONS') {
      res.set('Access-Control-Allow-Methods', 'POST').set('Access-Control-Allow-Headers', 'Authorization');
      return res.sendStatus(204);
    }
    if (req.method !== 'POST') return res.sendStatus(405);
    if (!enabled) return res.status(503).json({ error: 'TURN ainda não configurado.' });
    if (now() - windowStart >= 60000) { windowStart = now(); requests = 0; }
    if (++requests > 120) return res.status(429).set('Retry-After', '60').json({ error: 'Aguarde um minuto e tente novamente.' });
    const match = /^Bearer (\S{1,8192})$/.exec(req.headers.authorization || '');
    if (!match) return res.status(401).json({ error: 'Entre na sua conta para jogar online.' });
    try {
      const user = await verify(match[1]);
      if (!user?.id || user.is_anonymous) return res.status(401).json({ error: 'Entre novamente na sua conta.' });
      for (const [id, entry] of cache) if (entry.until <= now()) cache.delete(id);
      let entry = cache.get(user.id);
      if (!entry) {
        if (cache.size >= 500) return res.status(429).json({ error: 'Servidor ocupado. Tente mais tarde.' });
        entry = { until: now() + 600000 };
        entry.promise = (async () => {
          const response = await boundedFetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(env.TURN_KEY_ID)}/credentials/generate-ice-servers`, {
            method: 'POST', headers: { Authorization: `Bearer ${env.TURN_KEY_API_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ ttl: 86400 })
          });
          if (!response.ok) throw new Error('Provider unavailable');
          const data = await response.json();
          if (!Array.isArray(data.iceServers)) throw new Error('Invalid ICE response');
          const iceServers = data.iceServers.map(server => ({
            urls: (Array.isArray(server.urls) ? server.urls : [server.urls]).filter(url => typeof url === 'string' && /^(stun|turn|turns):/.test(url) && !/:53(?:\?|$)/.test(url)),
            ...(typeof server.username === 'string' ? { username: server.username } : {}),
            ...(typeof server.credential === 'string' ? { credential: server.credential } : {})
          })).filter(server => server.urls.length);
          if (!iceServers.some(server => server.credential && server.urls.some(url => /^turns?:/.test(url)))) throw new Error('Missing relay');
          return { iceServers };
        })();
        cache.set(user.id, entry);
        entry.promise.catch(() => { if (cache.get(user.id) === entry) cache.delete(user.id); });
      }
      res.json(await entry.promise);
    } catch {
      res.status(503).json({ error: 'Não foi possível preparar a conexão online. Tente novamente.' });
    }
  });
}

// Only these two public settings may cross the server/browser boundary.
export function publicAuthConfig(env) {
  const url = (env.SUPABASE_URL || '').trim();
  const publishableKey = (env.SUPABASE_PUBLISHABLE_KEY || '').trim();
  if (!url && !publishableKey) return null;
  if (!url || !publishableKey) throw new Error('Configure SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY juntas no .env.');
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/') {
    throw new Error('SUPABASE_URL deve ser a URL HTTPS do projeto, sem caminhos ou credenciais.');
  }
  let isAnon = false;
  try { isAnon = JSON.parse(Buffer.from(publishableKey.split('.')[1], 'base64url').toString()).role === 'anon'; } catch {}
  if (!publishableKey.startsWith('sb_publishable_') && !isAnon) {
    throw new Error('Use somente a chave publishable (ou anon). Chaves secret/service_role não podem ir para o navegador.');
  }
  return { url: parsed.origin, publishableKey };
}

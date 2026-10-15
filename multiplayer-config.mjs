// Only public connection settings belong in the static Pages build.
export function publicMultiplayerConfig(env = {}) {
  if (!env.PEER_SERVER_URL?.trim()) return { multiplayer: false, iceServers: [] };
  const url = new URL(env.PEER_SERVER_URL.trim());
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('PEER_SERVER_URL deve ser uma origem HTTPS, sem caminho, senha ou parâmetros.');
  }
  return {
    multiplayer: true,
    peerServer: { host: url.hostname, port: Number(url.port) || 443, secure: true },
    peerPath: '/peerjs',
    iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' }]
  };
}

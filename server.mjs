import express from 'express';
import { ExpressPeerServer } from 'peer';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { publicAuthConfig } from './auth-config.mjs';
import { installTurnService } from './turn-service.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
if (existsSync(path.join(root, '.env'))) loadEnvFile(path.join(root, '.env'));
const auth = publicAuthConfig(process.env);
const app = express();
const server = createServer(app);
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '127.0.0.1';
const iceServers = JSON.parse(process.env.ICE_SERVERS_JSON || '[]');
if (!Array.isArray(iceServers)) throw new Error('ICE_SERVERS_JSON deve ser uma lista JSON.');

app.disable('x-powered-by');
installTurnService(app, { auth });
app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.get('/runtime-config.js', (_req, res) => {
  res.type('js').set('Cache-Control', 'no-store').send(
    `window.NEONBRAWL_CONFIG = ${JSON.stringify({ peerPath: '/peerjs', iceServers, auth, assets: { cardIcons: false, music: false, samples: false } })};`
  );
});
app.use('/peerjs', ExpressPeerServer(server, { path: '/', proxied: process.env.TRUST_PROXY === '1', allow_discovery: false }));
app.get(['/', '/NeonBrawl.html'], (_req, res) => res.sendFile(path.join(root, 'NeonBrawl.html')));
app.use('/local', express.static(path.join(root, 'local')));
app.use('/vendor/three', express.static(path.join(root, 'node_modules/three')));
app.get('/vendor/peerjs.min.js', (_req, res) => res.sendFile(path.join(root, 'node_modules/peerjs/dist/peerjs.min.js')));
app.get('/vendor/supabase.js', (_req, res) => res.sendFile(path.join(root, 'node_modules/@supabase/supabase-js/dist/umd/supabase.js')));
// Only explicitly public directories are served; backups and server sources remain private.
app.use('/assets', express.static(path.join(root, 'assets')));
app.use('/sound', express.static(path.join(root, 'sound')));
server.listen(port, host, () => console.log(`NeonBrawl: http://${host}:${server.address().port}`));

import { cp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { publicAuthConfig } from '../auth-config.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
if (existsSync(path.join(root, '.env'))) loadEnvFile(path.join(root, '.env'));
const auth = publicAuthConfig(process.env);
const out = path.join(root, 'dist');
// Fixed, dedicated generated directory; never copy the workspace or .env to Pages.
if (path.resolve(out) !== path.resolve(root, 'dist')) throw new Error('Invalid output directory');
await rm(out, { recursive: true, force: true });
await mkdir(path.join(out, 'vendor'), { recursive: true });
const html = (await readFile(path.join(root, 'NeonBrawl.html'), 'utf8'))
  .replaceAll('"/local/', '"./local/')
  .replaceAll('"/vendor/', '"./vendor/')
  .replaceAll('"/runtime-config.js"', '"./runtime-config.js"');
await writeFile(path.join(out, 'index.html'), html);
await cp(path.join(root, 'local'), path.join(out, 'local'), { recursive: true });
await cp(path.join(root, 'node_modules/three/build'), path.join(out, 'vendor/three/build'), { recursive: true });
await cp(path.join(root, 'node_modules/three/examples/jsm'), path.join(out, 'vendor/three/examples/jsm'), { recursive: true });
await cp(path.join(root, 'node_modules/peerjs/dist/peerjs.min.js'), path.join(out, 'vendor/peerjs.min.js'));
await cp(path.join(root, 'node_modules/@supabase/supabase-js/dist/umd/supabase.js'), path.join(out, 'vendor/supabase.js'));
await writeFile(path.join(out, '.nojekyll'), '');
await writeFile(path.join(out, 'runtime-config.js'), `window.NEONBRAWL_CONFIG = ${JSON.stringify({
  auth, multiplayer: false, iceServers: [], assets: { cardIcons: false, music: false, samples: false }
})};\n`);
console.log(`Build Pages: ${out} (login ${auth ? 'configurado' : 'desativado — configure as variáveis Supabase'})`);

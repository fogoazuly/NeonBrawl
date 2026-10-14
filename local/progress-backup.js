import { encodeSave } from './save-codec.js';

export const MAX_BACKUP_BYTES = 256 * 1024;
export const PREVIOUS_SAVE_KEY = 'nbProgressBeforeImport';
const fail = () => { throw new Error('Arquivo de progresso inválido ou incompatível com esta versão.'); };
function record(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail();
  return value;
}
function keys(value, allowed) {
  record(value);
  if (Object.keys(value).some(key => !allowed.includes(key))) fail();
}
function integer(value, max = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || value < 0 || value > max) fail();
}
export function validateProgress(progress, schema) {
  keys(progress, ['gold', 'gunKeys', 'freeGunKeyGranted', 'gunLockResetId', 'upgrades', 'weapons', 'guns', 'resetId']);
  integer(progress.gold); integer(progress.gunKeys);
  if (progress.resetId !== schema.resetId || progress.gunLockResetId !== schema.gunLockResetId || progress.freeGunKeyGranted !== true) fail();
  keys(progress.upgrades, Object.keys(schema.upgrades));
  for (const [id, max] of Object.entries(schema.upgrades)) integer(progress.upgrades[id], max);
  for (const field of ['weapons', 'guns']) {
    keys(progress[field], schema[field]);
    if (Object.values(progress[field]).some(value => typeof value !== 'boolean')) fail();
  }
  if (progress.weapons.katana !== true || progress.guns.pistol !== true || progress.guns.shotgun !== true) fail();
  return structuredClone(progress);
}
export function createBackup(progress, schema) {
  return { game: 'neonbrawl', version: 1, createdAt: new Date().toISOString(), progress: validateProgress(progress, schema) };
}
export function parseBackup(text, schema) {
  if (new TextEncoder().encode(text).length > MAX_BACKUP_BYTES) throw new Error('Arquivo muito grande. O limite é 256 KB.');
  let backup;
  try { backup = JSON.parse(text); } catch { fail(); }
  keys(backup, ['game', 'version', 'createdAt', 'progress']);
  if (backup.game !== 'neonbrawl' || backup.version !== 1 || typeof backup.createdAt !== 'string' || !Number.isFinite(Date.parse(backup.createdAt))) fail();
  return validateProgress(backup.progress, schema);
}
// Save a recovery copy before replacement. A storage/quota failure aborts import.
export function replaceProgress(storage, progress, currentProgress, schema) {
  const next = encodeSave(validateProgress(progress, schema));
  const previous = encodeSave(validateProgress(currentProgress, schema));
  storage.setItem(PREVIOUS_SAVE_KEY, previous);
  storage.setItem('_nbpd', next);
}

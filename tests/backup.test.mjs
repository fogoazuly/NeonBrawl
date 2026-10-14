import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { encodeSave, decodeSave } from '../local/save-codec.js';
import { createBackup, parseBackup, replaceProgress, PREVIOUS_SAVE_KEY } from '../local/progress-backup.js';

const schema = { resetId: 'test-reset', gunLockResetId: 'test-guns', upgrades: { dmg: 10, revive: 3 }, guns: ['pistol', 'shotgun', 'smg'], weapons: ['katana', 'dagger'] };
const progress = { gold: 250, gunKeys: 2, freeGunKeyGranted: true, gunLockResetId: schema.gunLockResetId, resetId: schema.resetId,
  upgrades: { dmg: 2, revive: 1 }, guns: { pistol: true, shotgun: true, smg: true }, weapons: { katana: true, dagger: true } };

test('codec lê e escreve exatamente o formato do HTML original', async () => {
  const original = await readFile('backup/NeonBrawl.original.html', 'utf8');
  const legacyCode = original.match(/function _savePD\(\)\{[\s\S]*?(?=\r?\n_loadPD\(\);)/)[0];
  const context = vm.createContext({ btoa, atob, persistData: structuredClone(progress), _SK: 'Nx9!Br@wL_k3$v7q',
    _scheduleCloudSync() {}, localStorage: { setItem(_key, raw) { context.raw = raw; }, getItem() { return context.raw; } } });
  vm.runInContext(legacyCode + '\n_savePD();', context);
  assert.equal(encodeSave(progress), context.raw);
  assert.deepEqual(decodeSave(context.raw), progress);
  context.raw = encodeSave({ ...progress, gold: 100 });
  vm.runInContext('_loadPD();', context);
  assert.equal(context.persistData.gold, 100);
  assert.throws(() => decodeSave('invalid-save'));
});

test('exportação e importação preservam ouro, níveis e desbloqueios', () => {
  const backup = createBackup(progress, schema);
  assert.deepEqual(parseBackup(JSON.stringify(backup), schema), progress);
  backup.progress.gold = 0;
  assert.equal(progress.gold, 250);
});

test('rejeita JSON inválido, versões incompatíveis e valores inválidos', () => {
  const mutate = fn => { const backup = createBackup(progress, schema); fn(backup); return JSON.stringify(backup); };
  const invalid = [
    '', 'null', '[]', '{', ' '.repeat(256 * 1024 + 1),
    mutate(b => b.version = 99), mutate(b => b.game = 'other'), mutate(b => b.createdAt = 'bad date'),
    mutate(b => b.progress.gold = -1), mutate(b => b.progress.gold = '100'), mutate(b => b.progress.gold = 1.2),
    mutate(b => b.progress.gold = Number.MAX_SAFE_INTEGER + 1), mutate(b => b.progress.upgrades.dmg = 11),
    mutate(b => delete b.progress.upgrades.revive), mutate(b => b.progress.guns.pistol = false),
    mutate(b => b.progress.weapons.katana = 'true'), mutate(b => b.progress.guns.unknown = true),
    mutate(b => b.progress.resetId = 'old'), mutate(b => b.progress.freeGunKeyGranted = false),
    mutate(b => b.progress.upgrades = []), mutate(b => Object.defineProperty(b.progress, '__proto__', { value: {}, enumerable: true })),
  ];
  for (const text of invalid) assert.throws(() => parseBackup(text, schema));
});

test('substituição preserva cópia anterior e permite desfazer', () => {
  const values = new Map([['_nbpd', encodeSave(progress)]]);
  const storage = { setItem: (key, value) => values.set(key, value) };
  const next = { ...progress, gold: 15 };
  replaceProgress(storage, next, progress, schema);
  assert.deepEqual(decodeSave(values.get('_nbpd')), next);
  const previous = decodeSave(values.get(PREVIOUS_SAVE_KEY));
  assert.deepEqual(previous, progress);
  replaceProgress(storage, previous, next, schema);
  assert.deepEqual(decodeSave(values.get('_nbpd')), progress);
});

test('erro de validação ou armazenamento não altera o progresso atual', () => {
  for (const failureKey of [PREVIOUS_SAVE_KEY, '_nbpd']) {
    const values = new Map([['_nbpd', encodeSave(progress)]]);
    const storage = { setItem(key, value) { if (key === failureKey) throw new Error('QuotaExceeded'); values.set(key, value); } };
    assert.throws(() => replaceProgress(storage, { ...progress, gold: 0 }, progress, schema));
    assert.deepEqual(decodeSave(values.get('_nbpd')), progress);
  }
  let writes = 0;
  assert.throws(() => replaceProgress({ setItem() { writes++; } }, { ...progress, gold: -1 }, progress, schema));
  assert.equal(writes, 0);
});

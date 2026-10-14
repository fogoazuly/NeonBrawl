import { AccountSave, progressAPI } from './account-save.js';
import { validateProgress, createBackup } from './progress-backup.js';
import { encodeSave } from './save-codec.js';

export function setupCloudProgress({ schema, getProgress, setProgress, canSwitch, defaults }) {
  const auth = window.NeonBrawlAuth;
  const validate = value => validateProgress(value, schema);
  const ownerKey = 'nbProgressOwner';
  const guestKey = 'nbGuestProgress';
  let owner = localStorage.getItem(ownerKey) || 'guest';
  if (!localStorage.getItem(guestKey)) localStorage.setItem(guestKey, JSON.stringify(owner === 'guest' ? validate(getProgress()) : defaults));
  let account = null, active = false, changing = false, releaseLock = null, timer = null;
  let desired, retryAt = 0;
  const panel = document.createElement('section');
  panel.id = 'nbCloudProgress';
  panel.innerHTML = `<p id="nbCloudStatus" role="status" aria-live="polite"></p>
    <div id="nbCloudConflict" hidden>
      <p id="nbCloudCompare"></p>
      <button id="nbCloudLocal" type="button">Usar progresso deste navegador</button>
      <button id="nbCloudRemote" type="button">Usar progresso da conta</button>
      <button id="nbCloudBackup" type="button">Baixar cópia deste navegador</button>
    </div><button id="nbCloudRetry" type="button">Sincronizar agora</button>`;
  document.getElementById('nbAuthGuest').before(panel);
  const statusLine = document.createElement('p');
  statusLine.id = 'nbCloudMenuStatus';
  statusLine.style.cssText = 'font:12px system-ui;color:#a8bdc8;text-align:center;max-width:360px;margin:4px auto';
  document.getElementById('nbAccountBtn').after(statusLine);
  const find = id => document.getElementById(id);
  const labels = {
    guest: 'Visitante: progresso salvo neste navegador.',
    loading: 'Carregando o progresso da conta…', saved: 'Progresso salvo na conta.',
    pending: 'Progresso salvo neste navegador; envio pendente.', saving: 'Salvando progresso na conta…',
    offline: 'Sem sincronização: sua cópia local está preservada. Tentaremos novamente.',
    conflict: 'Há versões diferentes do progresso. Volte ao menu e escolha qual usar em Minha conta.',
    deferred: 'Volte ao menu e saia da sala para carregar o progresso da outra conta.',
    locked: 'Esta conta está aberta em outra aba. Feche a outra aba para continuar.',
    error: 'Não foi possível carregar o progresso. Sua cópia local está preservada. Tente sincronizar novamente.'
  };
  function show(state) {
    find('nbCloudStatus').textContent = statusLine.textContent = labels[state];
    find('nbCloudConflict').hidden = !account?.conflict;
    if (account?.conflict) {
      const summary = p => `${p.gold} ouro, ${p.gunKeys} chaves, ${Object.values(p.upgrades).reduce((a,b)=>a+b,0)} níveis de melhorias`;
      find('nbCloudCompare').textContent = `Navegador: ${summary(account.record.progress)}. Conta: ${summary(account.conflict.progress)}. Os valores não serão somados.`;
    }
  }
  function apply(progress) {
    const next = validate(progress);
    setProgress(next);
    localStorage.setItem('_nbpd', encodeSave(next));
    localStorage.setItem(ownerKey, owner);
  }
  async function lock(id) {
    if (!navigator.locks) throw Error('Browser requires Web Locks');
    return new Promise((resolve, reject) => {
      navigator.locks.request(`neonbrawl-progress:${id}`, { ifAvailable: true }, async held => {
        if (!held) { resolve(null); return; }
        await new Promise(done => resolve(done));
      }).catch(reject);
    });
  }
  function schedule() {
    if (timer) return;
    timer = setTimeout(() => { timer = null; void flush(); }, 1200);
  }
  async function flush() {
    if (!active || changing || !account || desired !== owner || auth.getState().user?.id !== owner) return;
    await account.flush();
    if (account.state === 'pending') schedule();
  }
  async function reconcile(force = false) {
    if (desired === undefined || changing || (!force && Date.now() < retryAt)) return;
    if (active && desired === owner) { if (force) await flush(); return; }
    if (!canSwitch()) { show('deferred'); return; }
    changing = true; active = false; show('loading');
    const target = desired;
    try {
      // Finish any already-running write before changing the account binding.
      if (account?.inflight) await account.inflight;
      account = null; releaseLock?.(); releaseLock = null;
      if (target === 'guest') {
        owner = target; apply(JSON.parse(localStorage.getItem(guestKey)));
        active = true; show('guest'); return;
      }
      releaseLock = await lock(target);
      if (!releaseLock) { retryAt = Date.now()+3000; show('locked'); return; }
      if (desired !== target) return;
      const first = !localStorage.getItem('nbProgressFirstAccount');
      const initial = first ? JSON.parse(localStorage.getItem(guestKey)) : defaults;
      const next = new AccountSave({ userId: target, storage: localStorage,
        api: progressAPI(auth.getClient()), validate,
        onStatus: state => { if (account === next && desired === target) show(state); } });
      const progress = await next.load(initial);
      if (desired !== target) return;
      owner = target; account = next;
      localStorage.setItem('nbProgressFirstAccount', localStorage.getItem('nbProgressFirstAccount') || target);
      apply(progress); active = true; show(next.state); schedule();
    } catch { retryAt = Date.now()+15000; show('error'); }
    finally { changing = false; if (!active) { releaseLock?.(); releaseLock = null; } }
  }
  const api = window.NeonBrawlProgress = {
    ready: () => active && !changing && desired === owner && !account?.conflict,
    save(progress) {
      // During an account change the running game still belongs to its old owner.
      if (!active) return;
      if (owner === 'guest') localStorage.setItem(guestKey, JSON.stringify(validate(progress)));
      else { account.save(progress); if (desired === owner) schedule(); }
    },
    flush,
    state: () => ({ owner, ready: api.ready(), status: account?.state || 'guest' })
  };
  function choose(choice) {
    if (!canSwitch() || !account?.conflict || desired !== owner) { show('deferred'); return; }
    try {
      localStorage.setItem(`nbConflictBackup:${owner}`, JSON.stringify({ local: account.record, cloud: account.conflict }));
      apply(account.resolve(choice)); schedule();
    } catch { show('error'); }
  }
  find('nbCloudLocal').onclick = () => choose('local');
  find('nbCloudRemote').onclick = () => choose('cloud');
  find('nbCloudBackup').onclick = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(createBackup(account.record.progress, schema), null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = 'neonbrawl-copia-local.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  find('nbCloudRetry').onclick = async () => {
    await flush();
    if (active && account && desired === owner && canSwitch() && !account.record.pending && !account.conflict) {
      location.reload(); return;
    }
    retryAt = 0; void reconcile(true);
  };
  document.addEventListener('click', event => {
    if (!event.target.closest?.('#playBtn,#restartBtn,#nbDiffGrid button,#nbBtnMP,#hostBtn,#joinBtn,#upgradeBtn,#goUpgradeBtn,#nbBackupBtn')) return;
    if (!api.ready()) { event.preventDefault(); event.stopImmediatePropagation(); document.getElementById('nbAccountBtn').click(); }
  }, true);
  auth.onChange(state => {
    if (!state.ready) return;
    desired = state.user?.id || 'guest';
    // Never enter the SDK from inside its synchronous auth-lock callback.
    setTimeout(() => void reconcile(), 0);
  });
  show('loading');
  setInterval(() => void reconcile(), 1000);
  setInterval(() => void flush(), 15000);
  addEventListener('online', () => { retryAt=0; void reconcile(true); });
  addEventListener('pagehide', () => void flush());
}

// Authentication only. Game progress remains local and is never replaced on account changes.
const config = window.NEONBRAWL_CONFIG?.auth;
const accountButton = document.getElementById('nbAccountBtn');
const panel = document.createElement('dialog');
panel.id = 'nbAuthDialog';
panel.setAttribute('aria-labelledby', 'nbAuthTitle');
panel.innerHTML = `
  <button id="nbAuthClose" type="button" aria-label="Fechar">✕</button>
  <h2 id="nbAuthTitle">Sua conta</h2>
  <p id="nbAuthIdentity"></p>
  <p class="nb-auth-note">Seu progresso continua salvo neste navegador. Entrar ou sair não transfere nem apaga seu progresso.</p>
  <form id="nbAuthForm">
    <label id="nbAuthEmailLabel">E-mail<input id="nbAuthEmail" type="email" autocomplete="email" maxlength="254" required></label>
    <label id="nbAuthPasswordLabel">Senha<input id="nbAuthPassword" type="password" autocomplete="current-password" required></label>
    <label id="nbAuthConfirmLabel" hidden>Confirmar senha<input id="nbAuthConfirm" type="password" autocomplete="new-password"></label>
    <button id="nbAuthSubmit" type="submit">Entrar</button>
  </form>
  <button id="nbAuthGoogle" type="button">Continuar com Google</button>
  <div class="nb-auth-links">
    <button id="nbAuthToggle" type="button">Criar conta</button>
    <button id="nbAuthForgot" type="button">Esqueci minha senha</button>
  </div>
  <button id="nbAuthSignOut" type="button" hidden>Sair da conta neste navegador</button>
  <p id="nbAuthMessage" role="status" aria-live="polite"></p>
  <button id="nbAuthGuest" type="button">Continuar jogando</button>`;
document.body.append(panel);
const el = id => document.getElementById(`nbAuth${id}`);
let client = null;
let user = null;
let ready = !config;
let busy = false;
let mode = 'login';
let recovery = false;
const listeners = new Set();
const getState = () => ({ ready, enabled: !!client, user });
window.NeonBrawlAuth = {
  getState,
  onChange(fn) { listeners.add(fn); fn(getState()); return () => listeners.delete(fn); }
};
function message(text, error = false) {
  el('Message').textContent = text;
  el('Message').classList.toggle('error', error);
}
function notify() {
  accountButton.textContent = user ? 'MINHA CONTA' : 'ENTRAR / CRIAR CONTA';
  for (const fn of listeners) fn(getState());
  render();
}
function render() {
  const signedIn = !!user && !recovery;
  const unavailable = !client || !ready;
  el('Title').textContent = signedIn ? 'Minha conta' : ({ login: 'Entrar', signup: 'Criar conta', forgot: 'Recuperar senha', reset: 'Definir nova senha' })[mode];
  el('Identity').textContent = signedIn ? (user.email || 'Conta conectada') : '';
  el('Form').hidden = signedIn || unavailable;
  el('Google').hidden = signedIn || unavailable || mode === 'reset' || mode === 'forgot';
  el('Toggle').hidden = signedIn || unavailable || mode === 'reset';
  el('Forgot').hidden = signedIn || unavailable || mode !== 'login';
  el('SignOut').hidden = !signedIn;
  el('EmailLabel').hidden = mode === 'reset';
  el('Email').required = mode !== 'reset';
  el('PasswordLabel').hidden = mode === 'forgot';
  el('Password').required = mode !== 'forgot';
  el('Password').minLength = mode === 'login' ? 1 : 8;
  el('Password').autocomplete = mode === 'login' ? 'current-password' : 'new-password';
  el('ConfirmLabel').hidden = !['signup', 'reset'].includes(mode);
  el('Confirm').required = ['signup', 'reset'].includes(mode);
  el('Submit').textContent = ({ login: 'Entrar', signup: 'Criar conta', forgot: 'Enviar link de recuperação', reset: 'Salvar nova senha' })[mode];
  el('Toggle').textContent = mode === 'login' ? 'Criar conta' : 'Voltar para entrar';
  panel.querySelectorAll('input, button').forEach(control => {
    control.disabled = busy && !['nbAuthClose', 'nbAuthGuest'].includes(control.id);
  });
  panel.setAttribute('aria-busy', String(busy));
}
function clearPasswords() { el('Password').value = ''; el('Confirm').value = ''; }
function switchMode(next) { mode = next; clearPasswords(); message(''); render(); }
function open() {
  if (!panel.open) panel.showModal();
  render();
  if (!config) message('O login ainda não está disponível. Você pode continuar jogando como visitante.');
  else if (!client) message('Não foi possível iniciar o login. Recarregue a página para tentar novamente.', true);
  else if (!ready) message('Conectando à sua conta…');
}
accountButton.onclick = open;
el('Close').onclick = el('Guest').onclick = () => panel.close();
panel.addEventListener('close', clearPasswords);
el('Toggle').onclick = () => switchMode(mode === 'login' ? 'signup' : 'login');
el('Forgot').onclick = () => switchMode('forgot');
// Keep keyboard controls in the game from seeing keystrokes typed into the account form.
for (const type of ['keydown', 'keyup', 'pointerdown', 'pointerup', 'touchstart', 'touchend']) {
  panel.addEventListener(type, event => event.stopPropagation());
}
// Preserve project subdirectories such as /NeonBrawl/ on GitHub Pages.
const redirectTo = () => new URL('./', location.href).href;
function errorText(error) {
  const known = {
    invalid_credentials: 'E-mail ou senha incorretos.',
    email_not_confirmed: 'Confirme seu e-mail pelo link enviado antes de entrar.',
    user_already_exists: 'Não foi possível criar esta conta. Tente entrar ou recuperar a senha.',
    weak_password: 'Use uma senha mais forte, com pelo menos 8 caracteres.',
    same_password: 'Escolha uma senha diferente da anterior.',
    over_email_send_rate_limit: 'Muitos e-mails solicitados. Aguarde alguns minutos e tente novamente.',
    over_request_rate_limit: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
    provider_disabled: 'O login com Google ainda não está disponível.',
    signup_disabled: 'O cadastro está temporariamente indisponível.',
    otp_expired: 'Este link expirou ou já foi usado. Solicite um novo.',
    validation_failed: 'Confira o e-mail e a senha e tente novamente.'
  };
  return known[error?.code] || 'Não foi possível concluir. Confira sua conexão e tente novamente.';
}
async function perform(action) {
  if (!client || busy || !ready) return;
  busy = true; message('Aguarde…'); render();
  try { await action(); }
  catch (error) { message(errorText(error), true); }
  finally { busy = false; clearPasswords(); render(); }
}
function checked(result) { if (result.error) throw result.error; return result.data; }
el('Form').onsubmit = event => {
  event.preventDefault();
  if (!el('Form').reportValidity()) return;
  const password = el('Password').value;
  const email = el('Email').value.trim();
  if (['signup', 'reset'].includes(mode) && password !== el('Confirm').value) {
    message('As senhas não coincidem.', true); return;
  }
  const submittedMode = mode;
  void perform(async () => {
    if (submittedMode === 'login') {
      checked(await client.auth.signInWithPassword({ email, password }));
      message('Você entrou na sua conta.');
    } else if (submittedMode === 'signup') {
      const data = checked(await client.auth.signUp({ email, password, options: { emailRedirectTo: redirectTo() } }));
      message(data.session ? 'Conta criada. Você já está conectado.' : 'Se o cadastro estiver disponível para este e-mail, você receberá um link de confirmação. Confira também o spam.');
    } else if (submittedMode === 'forgot') {
      checked(await client.auth.resetPasswordForEmail(email, { redirectTo: redirectTo() }));
      message('Se houver uma conta para esse e-mail, você receberá um link de recuperação. Abra o link neste navegador.');
    } else if (submittedMode === 'reset') {
      checked(await client.auth.updateUser({ password }));
      recovery = false; mode = 'login';
      message('Senha atualizada. Você pode continuar jogando.');
    }
  });
};
el('Google').onclick = () => void perform(async () => {
  checked(await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirectTo() } }));
});
el('SignOut').onclick = () => void perform(async () => {
  checked(await client.auth.signOut({ scope: 'local' }));
  recovery = false; mode = 'login';
  message('Você saiu da conta. Seu progresso local foi mantido.');
});

async function initialize() {
  if (!config) { notify(); return; }
  try {
    client = window.supabase.createClient(config.url, config.publishableKey, {
      auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'neonbrawl-auth' }
    });
    // Synchronous subscriber: never await another Auth call while its lock is held.
    client.auth.onAuthStateChange((event, session) => {
      user = session?.user || null;
      if (event === 'PASSWORD_RECOVERY') { recovery = true; mode = 'reset'; }
      if (event === 'SIGNED_OUT') { recovery = false; mode = 'login'; }
      notify();
      if (event === 'PASSWORD_RECOVERY') open();
    });
    checked(await client.auth.initialize());
    if (new URL(location.href).searchParams.has('code')) throw new Error('Callback sem verificador local.');
    const data = checked(await client.auth.getSession());
    user = data.session?.user || null;
    ready = true;
    notify();
    if (panel.open && !recovery) message('');
    const callback = new URL(location.href);
    const hash = new URLSearchParams(callback.hash.slice(1));
    if (callback.searchParams.has('error') || hash.has('error')) {
      callback.searchParams.delete('error'); callback.searchParams.delete('error_code'); callback.searchParams.delete('error_description');
      callback.hash = '';
      history.replaceState(null, '', callback);
      open(); message('O login foi cancelado ou o link expirou. Tente novamente ou solicite um novo link.', true);
    }
  } catch {
    const failedUrl = new URL(location.href);
    for (const key of ['code', 'error', 'error_code', 'error_description']) failedUrl.searchParams.delete(key);
    if (/access_token|refresh_token|error/.test(failedUrl.hash)) failedUrl.hash = '';
    history.replaceState(null, '', failedUrl);
    ready = true; notify();
    open(); message('Não foi possível recuperar sua sessão. Tente entrar novamente; se usou um link, solicite outro e abra neste navegador.', true);
  }
}
void initialize();

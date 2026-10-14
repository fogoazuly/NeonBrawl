// Real Supabase browser SDK against a simulated Auth API. No real accounts/emails.
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { launch, instrument, startSolo } = require('./browser-harness.cjs');
const fs = require('node:fs/promises');

(async () => {
  const server = spawn(process.execPath, ['server.mjs'], { env: { ...process.env, PORT: '0', HOST: '127.0.0.1', SUPABASE_URL: '', SUPABASE_PUBLISHABLE_KEY: '' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let browser;
  try {
    const base = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error('Server timeout')), 10000);
      server.once('error', reject);
      server.stderr.once('data', data => { clearTimeout(timer); reject(Error(String(data))); });
      server.stdout.once('data', data => { clearTimeout(timer); resolve(String(data).trim().replace('NeonBrawl: ', '')); });
    });
    browser = await launch();
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await instrument(context);
    const page = await context.newPage();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(base);
    await page.locator('#nbAccountBtn').click();
    assert.match(await page.locator('#nbAuthMessage').innerText(), /ainda não está disponível/);
    await page.locator('#nbAuthGuest').click();
    await startSolo(page);
    console.log('PASS visitor can start a run without Supabase');

    await context.route('**/runtime-config.js', route => route.fulfill({ contentType: 'text/javascript', body: `window.NEONBRAWL_CONFIG={peerPath:'/peerjs',iceServers:[],assets:{cardIcons:false,music:false,samples:false},auth:{url:'https://auth.example.test',publishableKey:'sb_publishable_test'}};` }));
    const requests = [];
    const user = { id: '00000000-0000-4000-8000-000000000001', email: 'pilot@example.test', aud: 'authenticated', role: 'authenticated', app_metadata: { provider: 'email' }, user_metadata: {}, created_at: new Date().toISOString() };
    const jwt = [ { alg: 'HS256', typ: 'JWT' }, { sub: user.id, exp: Math.floor(Date.now()/1000)+3600 } ].map(value => Buffer.from(JSON.stringify(value)).toString('base64url')).join('.') + '.c2ln';
    const session = { access_token: jwt, refresh_token: 'test-refresh', expires_in: 3600, token_type: 'bearer', user };
    await context.route('https://auth.example.test/**', async route => {
      const req = route.request(); const url = new URL(req.url());
      const body = req.postDataJSON(); requests.push({ url: req.url(), method: req.method(), body });
      let result = {}; let status = 200;
      if (url.pathname.endsWith('/token')) {
        if (body.password === 'wrong-password') { status = 400; result = { code: 'invalid_credentials', msg: 'Invalid login credentials' }; }
        else result = session;
      } else if (url.pathname.endsWith('/user')) { if(body?.data) user.user_metadata={...user.user_metadata,...body.data}; result = user; }
      else if (url.pathname.endsWith('/signup')) result = user;
      else if (url.pathname.endsWith('/logout')) status = 204;
      else if (url.pathname.endsWith('/authorize')) {
        await route.fulfill({ contentType: 'text/html', body: '<p>Simulated OAuth endpoint</p>' }); return;
      }
      await route.fulfill({ status, contentType: 'application/json', headers: { 'x-supabase-api-version': '2024-01-01', 'access-control-expose-headers': 'x-supabase-api-version' }, body: status === 204 ? '' : JSON.stringify(result) });
    });
    await page.goto(base);
    await page.waitForFunction(() => window.NeonBrawlAuth?.getState().ready);
    const saveBefore = await page.evaluate(() => localStorage.getItem('_nbpd'));
    await page.locator('#nbAccountBtn').click();
    await page.locator('#nbAuthEmail').fill(user.email);
    await page.locator('#nbAuthPassword').fill('wrong-password');
    await page.locator('#nbAuthSubmit').click();
    await page.waitForFunction(() => document.querySelector('#nbAuthDialog').getAttribute('aria-busy') === 'false');
    assert.match(await page.locator('#nbAuthMessage').innerText(), /incorretos/);
    await page.locator('#nbAuthPassword').fill('valid-password');
    await page.locator('#nbAuthSubmit').click();
    await page.waitForFunction(() => window.NeonBrawlAuth.getState().user?.email === 'pilot@example.test');
    assert.equal(await page.locator('#nbAuthIdentity').innerText(), user.email);
    await page.locator('#nbAuthName').fill('<invalid>');
    await page.locator('#nbAuthNameForm button').click();
    assert.match(await page.locator('#nbAuthMessage').innerText(), /Use de 2 a 14/);
    await page.locator('#nbAuthName').fill('Piloto Azul');
    await page.locator('#nbAuthNameForm button').click();
    await page.waitForFunction(() => window.PixoPlayerCard.localName(0) === 'Piloto Azul');
    assert(requests.some(req => req.method === 'PUT' && req.body.data?.display_name === 'Piloto Azul'));
    await page.screenshot({path:'test-results/player-name.png'});
    await page.reload();
    await page.waitForFunction(() => window.NeonBrawlAuth?.getState().user?.email === 'pilot@example.test');
    assert.equal(await page.evaluate(() => window.PixoSupabase.getState().enabled), false);
    assert.equal(await page.evaluate(() => window.PixoPlayerCard.localName(0)), 'Piloto Azul');
    await page.locator('#nbAccountBtn').click();
    await page.locator('#nbAuthSignOut').click();
    await page.waitForFunction(() => !window.NeonBrawlAuth.getState().user);
    assert.equal(await page.evaluate(() => localStorage.getItem('_nbpd')), saveBefore);
    console.log('PASS login errors, successful login, session reload, logout, local progress preservation');

    await page.locator('#nbAuthToggle').click();
    await page.locator('#nbAuthEmail').fill(user.email);
    await page.locator('#nbAuthPassword').fill('new-password');
    await page.locator('#nbAuthConfirm').fill('different-password');
    await page.locator('#nbAuthSubmit').click();
    assert.match(await page.locator('#nbAuthMessage').innerText(), /não coincidem/);
    await page.locator('#nbAuthConfirm').fill('new-password');
    await page.locator('#nbAuthSubmit').click();
    await page.waitForFunction(() => document.querySelector('#nbAuthMessage').textContent.includes('confirmação'));
    assert(requests.some(req => req.url.includes('/signup') && req.body.email === user.email));
    await page.locator('#nbAuthToggle').click();
    await page.locator('#nbAuthForgot').click();
    await page.locator('#nbAuthSubmit').click();
    await page.waitForFunction(() => document.querySelector('#nbAuthMessage').textContent.includes('Se houver'));
    assert(requests.some(req => req.url.includes('/recover') && req.body.code_challenge));
    await page.evaluate(() => localStorage.setItem('neonbrawl-auth-code-verifier', JSON.stringify('test-verifier/recovery')));
    await page.goto(base + '/?code=recovery-code');
    await page.locator('#nbAuthPassword').waitFor({ state: 'visible' });
    await page.waitForFunction(() => document.querySelector('#nbAuthTitle').textContent === 'Definir nova senha');
    await page.locator('#nbAuthPassword').fill('updated-password');
    await page.locator('#nbAuthConfirm').fill('updated-password');
    await page.locator('#nbAuthSubmit').click();
    await page.waitForFunction(() => document.querySelector('#nbAuthMessage').textContent.includes('Senha atualizada'));
    assert(requests.some(req => req.method === 'PUT' && req.body.password === 'updated-password'));
    assert(!page.url().includes('code='));
    await page.locator('#nbAuthSignOut').click();
    await page.waitForFunction(() => !window.NeonBrawlAuth.getState().user);
    console.log('PASS signup confirmation, mismatched passwords, recovery request, PKCE callback and password update');

    await page.locator('#nbAuthGoogle').click();
    await page.waitForURL('https://auth.example.test/**');
    const oauthUrl = new URL(page.url());
    assert.equal(oauthUrl.searchParams.get('provider'), 'google');
    const returnUrl = new URL(oauthUrl.searchParams.get('redirect_to'));
    assert.equal(returnUrl.origin + returnUrl.pathname, base + '/');
    assert(oauthUrl.searchParams.get('code_challenge'));
    returnUrl.searchParams.set('code', 'google-callback');
    await page.goto(returnUrl.href);
    await page.waitForFunction(() => window.NeonBrawlAuth?.getState().ready && window.NeonBrawlAuth.getState().user);
    assert(!page.url().includes('code='));
    await page.locator('#nbAccountBtn').click();
    await page.locator('#nbAuthSignOut').click();
    await page.waitForFunction(() => !window.NeonBrawlAuth.getState().user);
    await page.goto(base + '/?error=access_denied&error_description=cancelled');
    await page.locator('#nbAuthDialog').waitFor({ state: 'visible' });
    assert.match(await page.locator('#nbAuthMessage').innerText(), /Não foi possível|cancelado/);
    assert(!page.url().includes('error='));
    await page.locator('#nbAuthGuest').click();
    await page.evaluate(() => {
      for (const key of Object.keys(localStorage)) if (key.startsWith('neonbrawl-auth')) localStorage.removeItem(key);
    });
    await page.goto(base + '/?code=expired-or-other-browser');
    await page.locator('#nbAuthDialog').waitFor({ state: 'visible' });
    assert.match(await page.locator('#nbAuthMessage').innerText(), /Não foi possível/);
    console.log('PASS Google OAuth redirect with PKCE, cancellation and invalid callback');
    await page.locator('#nbAuthGuest').click();
    await page.goto(base);
    await page.waitForFunction(() => window.NeonBrawlAuth?.getState().ready);
    await page.locator('#nbAccountBtn').click();
    await fs.mkdir('test-results', { recursive: true });
    await page.screenshot({ path: 'test-results/auth-desktop.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    const bounds = await page.locator('#nbAuthDialog').boundingBox();
    assert(bounds.x >= 0 && bounds.x + bounds.width <= 390 && bounds.height <= 844);
    await page.screenshot({ path: 'test-results/auth-mobile.png' });
    assert.equal(await page.evaluate(() => localStorage.getItem('_nbpd')), saveBefore);
    assert(!requests.some(req => req.url.includes('/rest/') || req.url.includes('/functions/')));
    assert.deepEqual(errors, []);
    console.log('PASS mobile layout, no legacy economy requests and no JavaScript errors');
  } finally { await browser?.close(); server.kill(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

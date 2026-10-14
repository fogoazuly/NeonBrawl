const assert = require('node:assert/strict');
const express = require('express');
const fs = require('node:fs/promises');
const { launch, instrument, startSolo } = require('./browser-harness.cjs');
(async () => {
  const app = express(); app.use('/NeonBrawl', express.static('dist'));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  let browser;
  try {
    const base = `http://127.0.0.1:${server.address().port}/NeonBrawl/`;
    browser = await launch();
    const context = await browser.newContext(); await instrument(context);
    const page = await context.newPage();
    const errors = [], failures = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('response', r => { if (r.status() >= 400) failures.push(r.url()); });
    assert.equal(await fs.readFile('dist/local/game.js','utf8'), await fs.readFile('local/game.js','utf8'));
    await page.goto(base + '?join=BADROOM');
    await page.locator('#nbBtnMP').click();
    assert.match(await page.locator('#nbLocalDialog').innerText(), /Multiplayer em preparação/);
    await page.locator('#nbLocalDialog button').click();
    await startSolo(page);
    assert.equal(await page.evaluate(() => gameTest.state().wave), 1);
    await page.evaluate(() => gameTest.quit());
    await context.route('**/runtime-config.js', route => route.fulfill({contentType:'text/javascript', body:`window.NEONBRAWL_CONFIG={multiplayer:false,iceServers:[],assets:{cardIcons:false,music:false,samples:false},auth:{url:'https://auth.example.test',publishableKey:'sb_publishable_test'}};`}));
    await context.route('https://auth.example.test/**', route => route.fulfill({contentType:'text/html',body:'OAuth test'}));
    await page.goto(base);
    await page.waitForFunction(() => window.NeonBrawlAuth?.getState().ready);
    await page.locator('#nbAccountBtn').click();
    await page.locator('#nbAuthGoogle').click();
    await page.waitForURL('https://auth.example.test/**');
    const redirect = new URL(new URL(page.url()).searchParams.get('redirect_to'));
    assert.equal(redirect.origin + redirect.pathname, base);
    assert.deepEqual(errors, []); assert.deepEqual(failures, []);
    for (const privateFile of ['.env','server.mjs','package.json','backup/NeonBrawl.original.html']) {
      assert.equal((await fetch(base + privateFile)).status, 404);
    }
    console.log('PASS Pages subdirectory: resources, solo wave 1, multiplayer notice, ignored invite, OAuth redirect, private files excluded');
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => {console.error(error);process.exitCode=1;});

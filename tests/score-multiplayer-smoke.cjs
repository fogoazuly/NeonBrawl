const assert = require('node:assert/strict');
const { launch, instrument } = require('./browser-harness.cjs');
(async () => {
  const browser = await launch();
  try {
    const contexts = await Promise.all([browser.newContext(), browser.newContext()]);
    for (const context of contexts) await instrument(context);
    const host = await contexts[0].newPage(), guest = await contexts[1].newPage();
    const errors = [];
    for (const page of [host, guest]) page.on('pageerror', error => errors.push(error.message));
    async function start() {
      await host.goto('http://127.0.0.1:3000'); await host.locator('#nbBtnMP').click(); await host.locator('#hostBtn').click();
      await host.waitForFunction(() => document.querySelector('#mpStatus').textContent.includes('You are HOST'));
      const code = await host.locator('#roomCodeDisplay').innerText();
      await guest.goto('http://127.0.0.1:3000/?join=' + code);
      await guest.waitForFunction(() => document.querySelector('#mpStatus').textContent.includes('2/6'));
      await host.locator('#hostBtn').click();
      for (const selector of ['#gunCards button', '#meleeCards button', '#buffCards .buff-card']) {
        for (const page of [host, guest]) { await page.locator(selector).first().waitFor({state:'visible'}); await page.locator(selector).first().click({force:true}); }
      }
      await guest.waitForFunction(() => window.gameTest?.state().wave === 1);
      const score = await host.evaluate(() => gameTest.earnScore());
      await guest.waitForFunction(score => gameTest.state().score >= score, score);
      return score;
    }
    const rows = page => page.evaluate(() => JSON.parse(localStorage.getItem('nbLocalScores') || '[]'));
    let score = await start();
    await guest.evaluate(() => gameTest.quit());
    assert.equal((await rows(guest)).length, 1); assert.ok((await rows(guest))[0].score >= score);
    assert.equal((await rows(guest))[0].meta.party, 2);
    assert.equal(await host.evaluate(() => gameTest.state().state), 'playing');
    await host.evaluate(() => gameTest.quit());
    assert.equal((await rows(host)).length, 1);
    console.log('Guest voluntary exit + continuing host: PASS');
    score = await start();
    await host.evaluate(() => gameTest.quit());
    await guest.waitForFunction(() => gameTest.state().state === 'menu');
    assert.equal((await rows(host)).length, 2); assert.equal((await rows(guest)).length, 2);
    assert.ok((await rows(guest)).some(row => row.score >= score));
    await guest.reload(); await guest.waitForFunction(() => !!window.gameTest);
    assert.equal((await rows(guest)).length, 2);
    console.log('Host voluntary exit + guest disconnect saved once: PASS');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

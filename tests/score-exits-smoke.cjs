const assert = require('node:assert/strict');
const { launch, instrument, startSolo } = require('./browser-harness.cjs');
(async () => {
  const browser = await launch();
  try {
    const context = await browser.newContext(); await instrument(context);
    const errors = []; context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
    let page = await context.newPage();
    await page.goto('http://127.0.0.1:3000');
    await page.waitForFunction(() => !!window.gameTest);
    const rows = () => page.evaluate(() => JSON.parse(localStorage.getItem('nbLocalScores') || '[]'));
    for (const exit of ['pause-menu', 'death', 'reload', 'close', 'disconnect']) {
      const before = (await rows()).length;
      await startSolo(page);
      const score = await page.evaluate(() => gameTest.earnScore()); assert.ok(score > 0);
      if (exit === 'pause-menu') {
        await page.keyboard.press('Escape'); await page.locator('#nbPauseMenuBtn').click();
      } else if (exit === 'death') {
        await page.evaluate(() => gameTest.death()); await page.locator('#goMenuBtn').click();
      } else if (exit === 'reload') { await page.reload(); }
      else if (exit === 'close') { await page.close(); page = await context.newPage(); await page.goto('http://127.0.0.1:3000'); }
      else { await page.evaluate(() => gameTest.disconnect()); }
      await page.waitForFunction(() => !!window.gameTest);
      const after = await rows(); assert.equal(after.length, before + 1, exit);
      assert.ok(after.some(row => row.score >= score), exit);
      await page.reload(); await page.waitForFunction(() => !!window.gameTest);
      assert.equal((await rows()).length, before + 1, exit + ': no duplicate on reload');
      console.log('Score exit', exit, 'PASS');
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

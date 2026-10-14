const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
let playwright;
try { playwright = require('playwright'); }
catch { playwright = require(process.env.PLAYWRIGHT_MODULE || path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }

(async () => {
  const browser = await playwright.chromium.launch({
    ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: 'chrome' }),
    headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  try {
    const context = await browser.newContext();
    await context.addInitScript(() => { try { localStorage.setItem('nbGfxTier', 'potato'); } catch {} });
    const errors = [];
    context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
    const host = await context.newPage(), guest = await context.newPage();
    for (const page of [host, guest]) {
      await page.goto('http://127.0.0.1:3000');
      await page.waitForFunction(() => typeof window.nbMenuScreen === 'function');
      await page.locator('#nbBtnMP').click();
    }
    async function createRoom() {
      await host.locator('#hostBtn').click();
      await host.waitForFunction(() => document.querySelector('#mpStatus').textContent.includes('You are HOST'));
      return host.locator('#roomCodeDisplay').innerText();
    }
    async function enter(code) {
      await guest.locator('#joinChoiceBtn').click();
      await guest.locator('#roomInput').fill(code);
      await guest.locator('#joinBtn').click();
    }
    async function twoPlayers() {
      await host.waitForFunction(() => document.querySelectorAll('#roomRoster .room-player:not(.empty)').length === 2);
      await guest.waitForFunction(() => document.querySelectorAll('#roomRoster .room-player:not(.empty)').length === 2);
    }
    const code = await createRoom();
    await enter('BAD123');
    await guest.waitForFunction(() => document.querySelector('#mpStatus').textContent.includes('Cannot connect'));
    await enter(code); await twoPlayers();
    for (let i = 0; i < 2; i++) {
      await guest.locator('#leaveRoomBtn').click();
      await host.waitForFunction(() => document.querySelectorAll('#roomRoster .room-player:not(.empty)').length === 1);
      await enter(code); await twoPlayers();
      assert.equal(await guest.locator('#roomRoster .room-player:not(.empty)').last().locator('.room-player-role').innerText(), 'P2');
    }
    await host.locator('#leaveRoomBtn').click();
    await guest.waitForFunction(() => document.querySelector('#mpStatus').textContent === 'Host disconnected');
    await guest.waitForFunction(() => document.querySelector('#roomCodeDisplay').textContent === '');
    const nextCode = await createRoom();
    await enter(nextCode); await twoPlayers();
    // Capture the next test peer only, to close its data channel and exercise
    // real WebRTC reconnection without exposing debug hooks in production.
    await guest.locator('#leaveRoomBtn').click();
    await host.waitForFunction(() => document.querySelectorAll('#roomRoster .room-player:not(.empty)').length === 1);
    await guest.evaluate(() => {
      const OriginalPeer = window.Peer;
      window.Peer = class extends OriginalPeer {
        constructor(...args) { super(...args); window.testPeer = this; }
        connect(...args) {
          const conn = super.connect(...args);
          conn.on('data', raw => {
            try { if (JSON.parse(raw.toString()).type === 'JOINED') window.testJoinedCount = (window.testJoinedCount || 0) + 1; } catch {}
          });
          return conn;
        }
      };
    });
    await enter(nextCode); await twoPlayers();
    await guest.evaluate(() => {
      const conn = Object.values(window.testPeer.connections).flat().find(conn => conn.open);
      if (!conn) throw new Error('No live data channel');
      window.joinedBeforeDrop = window.testJoinedCount;
      conn.close();
    });
    await guest.waitForFunction(() => window.testJoinedCount > window.joinedBeforeDrop, null, { timeout: 20000 }).catch(async error => {
      console.error('Reconnect diagnostics', await guest.locator('#mpStatus').textContent(), await host.locator('#mpPanel').innerText(),
        await guest.evaluate(() => ({ destroyed: testPeer.destroyed, connections: Object.values(testPeer.connections).flat().map(c => ({ open: c.open, peer: c.peer })) })));
      throw error;
    });
    await twoPlayers();
    await guest.locator('#leaveRoomBtn').click();
    await host.locator('#leaveRoomBtn').click();
    assert.deepEqual(errors, []);
    console.log('Rooms: invalid code, guest leave/rejoin, slot reuse, host leave, new room and real reconnection: PASS');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

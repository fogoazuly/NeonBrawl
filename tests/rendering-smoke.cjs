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
    const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/render-test', route => route.fulfill({ contentType: 'text/html', body: `
      <script type="importmap">{"imports":{"three":"/vendor/three/build/three.module.js","three/addons/":"/vendor/three/examples/jsm/"}}</script>
      <canvas id="testCanvas"></canvas>` }));
    await page.goto('http://127.0.0.1:3000/render-test');
    for (const bloom of [false, true]) {
      await page.setViewportSize({ width: 800, height: 600 });
      const initial = await page.evaluate(async bloom => {
        const { createSceneView } = await import('/local/rendering/scene.js');
        window.testView = createSceneView({ canvas: document.getElementById('testCanvas'), arenaHeight: 13,
          isMobile: !bloom, realIsMobile: false, pixelRatio: 1, bloom, orbLighting: bloom });
        testView.render();
        return { aspect: testView.camera.aspect, orbs: !!testView.orbLights, width: testCanvas.width, height: testCanvas.height };
      }, bloom);
      assert.deepEqual(initial, { aspect: 800 / 600, orbs: bloom, width: 800, height: 600 });
      await page.setViewportSize({ width: 960, height: 540 });
      await page.waitForFunction(() => document.getElementById('testCanvas').width === 960);
      const resized = await page.evaluate(() => {
        testView.render();
        const result = { aspect: testView.camera.aspect, width: testCanvas.width, height: testCanvas.height };
        testView.dispose();
        return result;
      });
      assert.deepEqual(resized, { aspect: 960 / 540, width: 960, height: 540 });
      // Disposed views must no longer react to window resize events.
      await page.setViewportSize({ width: 640, height: 480 });
      await page.evaluate(() => window.dispatchEvent(new Event('resize')));
      assert.equal(await page.evaluate(() => testView.camera.aspect), 960 / 540);
    }
    assert.deepEqual(errors, []);
    console.log('Rendering: bloom on/off, camera aspect, canvas resize and disposal: PASS');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

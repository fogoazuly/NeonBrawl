const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs/promises');
let playwright;
try { playwright = require('playwright'); }
catch { playwright = require(process.env.PLAYWRIGHT_MODULE || path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }

const hooks = `
// Injected into the response by the test runner only; never shipped to players.
window.gameTest = {
  inventory: () => ({ guns: Object.keys(GUNS), melee: Object.keys(MELEE_WEAPONS),
    skills: Object.keys(SKILL_DEFS), relics: Object.keys(RELIC_DEFS), bosses: BOSS_NAMES,
    enemies: Object.keys(ETYPES), difficulties: Object.keys(DIFFICULTY) }),
  state: () => ({ state:gState, score, wave:waveNum, hp:player.hp, maxHp:player.maxHp, ammo:player.ammo,
    gold:persistData.gold, crystals:runCrystals, kills:killCount, paused:nbPaused, connected:mp.connected,
    skills:{...playerSkills}, picks:{...playerSkillPicks}, relics:{...playerRelics} }),
  earnScore() { spawnEnemy('chaser', -8, -8); killEnemy(enemies.length-1); return score; },
  death: () => gameOver(),
  quit: () => nbQuitToMenu(),
  disconnect: () => returnToMenuAfterDisconnect('Test disconnection'),
};
`;
async function launch() {
  return playwright.chromium.launch({ ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel:'chrome' }),
    headless:true, args:['--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
}
async function instrument(context, extra = '') {
  await context.addInitScript(() => { try { localStorage.setItem('nbGfxTier', 'potato'); } catch {} });
  const source = await fs.readFile('local/game.js', 'utf8');
  await context.route('**/local/game.js', route => route.fulfill({ contentType:'text/javascript', body:source + hooks + extra }));
}
async function startSolo(page) {
  await page.locator('#playBtn').click();
  await page.locator('#nbDiffGrid button').first().click();
  await page.locator('#gunCards button').first().click({force:true});
  await page.locator('#meleeCards button').first().click({force:true});
  await page.locator('#buffCards .buff-card').first().waitFor({state:'visible'});
  await page.locator('#buffCards .buff-card').first().click({force:true});
  await page.waitForFunction(() => window.gameTest.state().wave === 1);
}
async function startCoop(host,...guests){
  await host.goto('http://127.0.0.1:3000');await host.locator('#nbBtnMP').click();await host.locator('#hostBtn').click();
  await host.waitForFunction(()=>document.querySelector('#mpStatus').textContent.includes('You are HOST'));
  const code=await host.locator('#roomCodeDisplay').innerText();
  for(const [i,guest] of guests.entries()){
    await guest.goto('http://127.0.0.1:3000/?join='+code);
    await guest.waitForFunction(n=>document.querySelector('#mpStatus').textContent.includes(n+'/6'),i+2);
  }
  await host.locator('#hostBtn').click();
  for(const selector of ['#gunCards button','#meleeCards button','#buffCards .buff-card'])
    for(const page of [host,...guests]){await page.locator(selector).first().waitFor({state:'visible'});await page.locator(selector).first().click({force:true});}
  for(const page of [host,...guests])await page.waitForFunction(()=>gameTest.state().wave===1);
}
module.exports = { launch, instrument, startSolo, startCoop };

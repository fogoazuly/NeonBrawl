const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { launch, instrument } = require('./browser-harness.cjs');
const hooks = `
gameTest.catalogCase = (kind, id) => {
  initGame();
  hideGunSelect(); hideMeleeSelect();
  gState='playing'; waveNum=1; waveSpawned=true; waveClear=false;
  player.invincible=1000;
  for(const type of ['chaser','tank','shooter']) spawnEnemy(type, 4, 4);
  let levels=0;
  if(kind==='skills') {
    levels=skillMaxLevel(id);
    for(let level=0;level<levels+1;level++) applySkill(id);
    if(playerSkillPicks[id]!==levels) throw new Error('Skill cap: '+id);
    if(playerSkills[id]!==5) throw new Error('Skill effective level: '+id+' '+playerSkills[id]);
  } else if(kind==='relics') {
    levels=3;
    for(let level=0;level<4;level++) applyRelic(id);
    if(relicLevel(id)!==3) throw new Error('Relic cap: '+id);
  }
  for(let tick=0;tick<120;tick++) update(1/60);
  for(const value of [player.hp,player.maxHp,player.pos.x,player.pos.z,playerStats.attackDmg,score])
    if(!Number.isFinite(value)) throw new Error('Non-finite state: '+kind+'/'+id);
  for(const enemy of enemies) if(!Number.isFinite(enemy.hp)||!Number.isFinite(enemy.pos.x)||!Number.isFinite(enemy.pos.z))
    throw new Error('Non-finite enemy: '+kind+'/'+id);
  return {kind,id,levels,hp:player.hp,maxHp:player.maxHp,score};
};
`;
(async () => {
  const browser = await launch();
  const report = { scope:'Catalog initialization, level caps and two seconds of controlled simulation per entry. Does not prove every effect or synergy.', cases:[], failures:[] };
  try {
    const context = await browser.newContext(); await instrument(context, hooks);
    const page = await context.newPage();
    page.on('pageerror', error => report.failures.push({ asynchronous: error.message }));
    await page.goto('http://127.0.0.1:3000'); await page.waitForFunction(() => !!window.gameTest);
    report.inventory = await page.evaluate(() => gameTest.inventory());
    console.log('Inventory', Object.fromEntries(Object.entries(report.inventory).map(([key, list]) => [key,list.length])));
    for (const kind of ['skills','relics']) {
      for (const id of report.inventory[kind]) {
        try { report.cases.push(await page.evaluate(({kind,id}) => gameTest.catalogCase(kind,id), {kind,id})); }
        catch(error) { report.failures.push({kind,id,error:error.message}); console.log('FAIL',kind,id,error.message); }
      }
      console.log(kind, 'catalog complete');
    }
    await page.waitForTimeout(1200);
    assert.deepEqual(report.failures, []);
    console.log('Catalog smoke PASS', report.cases.length);
  } finally {
    await fs.mkdir('test-results', {recursive:true});
    await fs.writeFile('test-results/catalog.json', JSON.stringify(report,null,2));
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode=1; });

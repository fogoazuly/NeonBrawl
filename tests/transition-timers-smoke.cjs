const assert=require('node:assert/strict');
const {launch,instrument}=require('./browser-harness.cjs');
const hooks=`
const testRealUpdate=update;
function transitionFixture(){
  mp.soloMode=true;initGame();hideGunSelect();hideMeleeSelect();gState='playing';
  player.invincible=10000;update=()=>{};
}
gameTest.transition=(kind,restart,leave=true)=>{
  transitionFixture();
  if(kind==='intro')nextWave();
  else {
    waveNum=5;waveSpawned=true;waveTransition=false;waveClear=false;
    waveEvent=null;disposeMiniObjective();_waveSpawnQueue.length=0;
    for(const e of enemies)releaseEnemySlot(e);enemies.length=0;
    _bossClearPending=true;testRealUpdate(0);
  }
  if(leave){nbQuitToMenu();if(restart)transitionFixture();}
};
gameTest.tickSpawns=()=>tickWaveSpawnQueue(.1);
gameTest.transitionStatus=()=>({state:gState,spawned:waveSpawned,queued:_waveSpawnQueue.length,enemies:enemies.length,summary:document.getElementById('bossRunSummary').classList.contains('show')});
`;
(async()=>{
  const browser=await launch(),errors=[],failures=[];
  try{
    const c=await browser.newContext();await instrument(c,hooks);const page=await c.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:3000');await page.waitForFunction(()=>!!window.gameTest);
    for(const kind of ['intro','boss'])for(const restart of [false,true]){
      await page.evaluate(t=>gameTest.transition(t.kind,t.restart),{kind,restart});
      await page.waitForTimeout(2100);
      const actual=await page.evaluate(()=>gameTest.transitionStatus());
      if(actual.state!==(restart?'playing':'menu')||actual.summary||(restart&&(actual.spawned||actual.enemies)))failures.push({kind,restart,actual});
      else console.log('PASS canceled transition',kind,restart?'new run':'menu');
    }
    await page.evaluate(()=>gameTest.transition('intro',false,false));
    await page.waitForFunction(()=>gameTest.transitionStatus().queued>0);
    await page.evaluate(()=>gameTest.tickSpawns());
    assert.ok((await page.evaluate(()=>gameTest.transitionStatus())).enemies>0);
    console.log('PASS normal intro spawns enemies');
    await page.evaluate(()=>gameTest.transition('boss',false,false));
    await page.locator('.boss-summary-close').waitFor({state:'visible'});
    await page.locator('.boss-summary-close').click();
    await page.locator('#buffCards .buff-card').first().waitFor({state:'visible'});
    console.log('PASS boss summary continues to reward cards');
    await page.evaluate(()=>gameTest.transition('boss',false,false));
    await page.locator('.boss-summary-close').waitFor({state:'visible'});
    await page.evaluate(()=>gameTest.quit());
    assert.equal((await page.evaluate(()=>gameTest.transitionStatus())).summary,false);
    console.log('PASS exit closes an already open boss summary');
    assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

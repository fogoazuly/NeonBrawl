const assert=require('node:assert/strict');
const {launch,instrument}=require('./browser-harness.cjs');
const hooks=`
const challengeUpdate=update;
function challengeFixture(sub){
  mp.soloMode=true;initGame();hideGunSelect();hideMeleeSelect();update=()=>{};gState='playing';
  waveNum=1;waveSpawned=true;waveTransition=false;waveClear=false;waveFightTime=0;
  waveEvent=sub?{type:'challenge',sub}:null;obstacleBoxes.length=0;mapHazards.length=0;buildNavBlocked();
  player.pos.set(0,0,7);player.invincible=10000;
}
gameTest.challengeMotion=(sub,type)=>{
  challengeFixture(sub);spawnEnemy(type,0,-5);const e=enemies[enemies.length-1];
  e.spawnAnim=0;e.fireCd=10;e.stuckCheck=10;const x=e.pos.x,z=e.pos.z;
  challengeUpdate(1/60);
  return {distance:Math.hypot(e.pos.x-x,e.pos.z-z),cooldown:10-e.fireCd};
};
gameTest.rangedRoster=()=>{
  challengeFixture(null);const issues=[];
  for(let w=1;w<=80;w++){
    waveEvent=null;const total=getWaveConfig(w).reduce((a,[,n])=>a+n,0);
    waveEvent={type:'challenge',sub:'rangedHell'};const roster=getWaveConfig(w);
    if(roster.reduce((a,[,n])=>a+n,0)!==total||roster.some(([t,n])=>!['shooter','sniper'].includes(t)||n<=0))issues.push(w);
  }return issues;
};
gameTest.eliteRoster=()=>{
  challengeFixture('eliteSurge');const result=[];
  for(const type of Object.keys(ETYPES).filter(t=>t!=='boss')){
    spawnEnemy(type,8,8);const e=enemies[enemies.length-1];result.push({type,elite:e.elite});releaseEnemySlot(e);enemies.pop();
  }return result;
};
gameTest.fog=()=>{
  challengeFixture(null);const base=scene.fog.density;
  waveEvent={type:'challenge',sub:'fogOfWar'};tickStatusMaps(.01);
  const active={density:scene.fog.density,on:document.getElementById('fogVignette').classList.contains('on')};
  waveClear=true;tickStatusMaps(.01);
  return {base,active,restored:scene.fog.density,on:document.getElementById('fogVignette').classList.contains('on')};
};
`;
(async()=>{
  const browser=await launch(),errors=[];
  try{
    const c=await browser.newContext();await instrument(c,hooks);const page=await c.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:3000');await page.waitForFunction(()=>!!window.gameTest);
    const normal=await page.evaluate(()=>gameTest.challengeMotion(null,'chaser'));
    const fast=await page.evaluate(()=>gameTest.challengeMotion('speedDemon','chaser'));
    assert.ok(normal.distance>0);assert.ok(Math.abs(fast.distance/normal.distance-2)<.001);console.log('PASS speed demon 2x movement');
    for(const type of ['shooter','sniper']){
      const base=await page.evaluate(t=>gameTest.challengeMotion(null,t),type),boost=await page.evaluate(t=>gameTest.challengeMotion('rangedHell',t),type);
      assert.ok(base.cooldown>0);assert.ok(Math.abs(boost.cooldown/base.cooldown-1.5)<.001);console.log('PASS ranged cadence',type);
    }
    assert.deepEqual(await page.evaluate(()=>gameTest.rangedRoster()),[]);console.log('PASS ranged roster budget waves 1–80');
    const elites=await page.evaluate(()=>gameTest.eliteRoster());assert.equal(elites.length,14);assert.ok(elites.every(e=>e.elite==='elite'));console.log('PASS 14 elite enemy types');
    const fog=await page.evaluate(()=>gameTest.fog());assert.ok(fog.active.density>fog.base&&fog.active.on);assert.equal(fog.restored,fog.base);assert.equal(fog.on,false);console.log('PASS fog and wave-clear restoration');
    assert.deepEqual(errors,[]);
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

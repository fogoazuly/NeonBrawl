const assert=require('node:assert/strict');
const {launch,instrument}=require('./browser-harness.cjs');
const hooks=`
const controlUpdate=update;
function controlFixture(){
  mp.soloMode=true;initGame();hideGunSelect();hideMeleeSelect();update=()=>{};
  gState='playing';waveNum=1;waveSpawned=true;waveTransition=false;waveClear=false;waveFightTime=0;
  waveEvent=null;obstacleBoxes.length=0;mapHazards.length=0;buildNavBlocked();
  player.pos.set(0,0,7);player.invincible=10000;
}
gameTest.controlDurations=()=>{
  const results=[];
  for(const type of Object.keys(ETYPES).filter(t=>t!=='boss'))for(const [tier,expected] of [[null,2],['elite',1.24],['champion',.8]]){
    controlFixture();spawnEnemy(type,0,-5);const e=enemies[enemies.length-1];e.elite=tier;e.stagger=0;
    applyEnemySlow(e,2);addEnemyStagger(e,2);applyEnemySlow(e,.1);addEnemyStagger(e,.1);
    results.push({type,tier,expected,slow:slowMap.get(e.poolIdx),stagger:e.stagger});
  }
  for(let i=0;i<BOSS_NAMES.length;i++){
    controlFixture();waveNum=(i+1)*5;spawnBoss(waveNum);const e=enemies[enemies.length-1];e.stagger=0;
    applyEnemySlow(e,2);addEnemyStagger(e,2);
    results.push({type:BOSS_NAMES[i],tier:'boss',expected:.9,slow:slowMap.get(e.poolIdx),stagger:e.stagger});
  }
  return results;
};
gameTest.controlMotion=({type,effect})=>{
  controlFixture();spawnEnemy(type,0,-5);const e=enemies[enemies.length-1];
  e.elite=null;e.spawnAnim=0;e.stuckCheck=10;e.fireCd=100;e.stagger=0;
  if(effect==='slow')applyEnemySlow(e,2);
  if(effect==='stagger')addEnemyStagger(e,2);
  const x=e.pos.x,z=e.pos.z;controlUpdate(1/60);
  const distance=Math.hypot(e.pos.x-x,e.pos.z-z);
  if(effect==='slow')tickStatusMaps(3);else if(effect==='stagger')e.stagger=0;
  const px=e.pos.x,pz=e.pos.z;controlUpdate(1/60);
  return {distance,recovered:Math.hypot(e.pos.x-px,e.pos.z-pz)};
};
`;
(async()=>{
  const browser=await launch(),errors=[];
  try{
    const c=await browser.newContext();await instrument(c,hooks);const p=await c.newPage();
    p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:3000');await p.waitForFunction(()=>!!window.gameTest);
    const durations=await p.evaluate(()=>gameTest.controlDurations());
    assert.deepEqual(durations.filter(r=>Math.abs(r.slow-r.expected)>1e-8||Math.abs(r.stagger-r.expected)>1e-8),[]);
    console.log('PASS control durations and resistance',durations.length);
    for(const type of ['chaser','tank','shieldBearer','splitterling','berserker']){
      const baseline=await p.evaluate(a=>gameTest.controlMotion(a),{type,effect:'none'});assert.ok(baseline.distance>0);
      const slowed=await p.evaluate(a=>gameTest.controlMotion(a),{type,effect:'slow'});
      const staggered=await p.evaluate(a=>gameTest.controlMotion(a),{type,effect:'stagger'});
      assert.ok(Math.abs(slowed.distance/baseline.distance-.35)<1e-6,JSON.stringify({type,baseline,slowed}));
      assert.ok(Math.abs(slowed.recovered/baseline.distance-1)<1e-6);
      assert.ok(staggered.distance<1e-8,JSON.stringify({type,staggered}));assert.ok(staggered.recovered>0);
      console.log('PASS movement slow, stagger and recovery',type);
    }
    assert.deepEqual(errors,[]);
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

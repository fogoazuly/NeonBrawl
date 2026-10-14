const assert=require('node:assert/strict');
const {launch,instrument}=require('./browser-harness.cjs');
const hooks=`
const bountyTestUpdate=update;
gameTest.bounty=(sub,action)=>{
  mp.soloMode=true;initGame();hideGunSelect();hideMeleeSelect();update=()=>{};gState='playing';
  waveNum=1;waveSpawned=true;waveTransition=false;waveClear=false;waveFightTime=0;
  waveEvent={type:'bounty',sub};resetWaveEventTracking();
  player.invincible=0;player.barrierActive=false;player.hp=100;player.overhealShield=0;
  if(action==='damage')hurtPlayer(10);
  if(action==='earlyDamage'){waveSpawned=false;hurtPlayer(10);}
  if(action==='introDamage'){waveSpawned=false;waveTransition=true;hurtPlayer(10);}
  if(action==='shield'){player.overhealShield=20;hurtPlayer(10);}
  if(action==='partialShield'){player.overhealShield=5;hurtPlayer(10);}
  if(action==='barrier'){player.barrierActive=true;hurtPlayer(10);}
  if(action==='down')downPlayer();
  if(action==='fast')waveFightTime=59.999;
  if(action==='boundary')waveFightTime=60;
  if(action==='slow')waveFightTime=60.001;
  if(action==='spawningClock'){
    waveSpawned=false;_waveSpawnQueue=[{type:'chaser',sx:10,sz:10}];_waveSpawnTimer=-100;
    spawnEnemy('tank',10,10);bountyTestUpdate(.25);
  }
  if(action==='grace'){waveFightTime=1.5;noteWaveEventGunFire();}
  if(action==='fire'){waveFightTime=1.501;noteWaveEventGunFire();}
  evaluateBountyTick();claimWaveEventReward();claimWaveEventReward();
  return {failed:!!waveEvent.failed,epic:!!_eventEpicReward,picks:_eventBonusPicksLeft,damage:_waveEventDamageTaken,time:waveFightTime};
};
`;
(async()=>{
  const browser=await launch(),errors=[],failures=[];
  try{
    const c=await browser.newContext();await instrument(c,hooks);const page=await c.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:3000');await page.waitForFunction(()=>!!window.gameTest);
    const cases=[['noDamage','none',false],['noDamage','damage',true],['noDamage','earlyDamage',true],['noDamage','introDamage',false],['noDamage','shield',false],['noDamage','partialShield',true],['noDamage','barrier',false],['noDeaths','none',false],['noDeaths','down',true],['fastClear','fast',false],['fastClear','boundary',true],['fastClear','slow',true],['noBullet','grace',false],['noBullet','fire',true]];
    for(const [sub,action,failed] of cases){
      const result=await page.evaluate(t=>gameTest.bounty(...t),[sub,action]);
      const expected={failed,epic:!failed&&sub==='noDamage',picks:!failed&&sub!=='noDamage'?1:0};
      try{assert.deepEqual({failed:result.failed,epic:result.epic,picks:result.picks},expected);if(action==='partialShield')assert.equal(result.damage,5);console.log('PASS',sub,action);}
      catch{failures.push({sub,action,result,expected});}
    }
    assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);
    const clock=await page.evaluate(()=>gameTest.bounty('fastClear','spawningClock'));
    assert.equal(clock.time,.25,'Fight timer must run while enemies are still spawning');
    console.log('PASS fastClear clock while spawning');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

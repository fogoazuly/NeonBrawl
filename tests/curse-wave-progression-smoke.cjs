const assert=require('node:assert/strict');
const {launch,instrument}=require('./browser-harness.cjs');
const hooks=`
const curseTestUpdate=update;
gameTest.curseProgression=(client=false)=>{
  mp.soloMode=true;initGame();hideGunSelect();hideMeleeSelect();update=()=>{};
  playerStats.baseMaxHp=100;recalcPlayerMaxHp(false);player.hp=100;player.invincible=10000;
  if(client){mp.soloMode=false;mp.isHost=false;mp.connected=true;}
  applyCurseHp(.5,5);const result=[];
  for(let w=7;w<=11;w++){
    gState='playing';waveNum=w;waveSpawned=true;waveClear=false;waveTransition=false;waveEvent=null;
    disposeMiniObjective();_waveSpawnQueue.length=0;for(const e of enemies)releaseEnemySlot(e);enemies.length=0;
    _bossClearPending=w%5===0;
    if(client&&_bossClearPending)waveClear=true; // HOST_STATE arrived before the client's frame.
    curseTestUpdate(0);
    if(w%5!==0)completeWaveExitTransition();
    const duration=player._curseHpWaves;
    curseTestUpdate(0);
    result.push({wave:w,duration,max:playerStats.maxHp,stable:duration===player._curseHpWaves});
  }
  return result;
};
`;
(async()=>{
  const browser=await launch(),errors=[];
  try{
    const c=await browser.newContext();await instrument(c,hooks);const page=await c.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:3000');await page.waitForFunction(()=>!!window.gameTest);
    for(const client of [false,true]){
      const result=await page.evaluate(client=>gameTest.curseProgression(client),client);console.log({client,result});
      assert.deepEqual(result,Array.from({length:5},(_,i)=>({wave:7+i,duration:4-i,max:i===4?100:50,stable:true})));
    }
    assert.deepEqual(errors,[]);
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

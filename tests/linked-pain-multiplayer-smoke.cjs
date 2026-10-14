const assert=require('node:assert/strict');
const {launch,instrument,startCoop}=require('./browser-harness.cjs');
const hooks=`
gameTest.preparePain=level=>{
  // Hold simulation still to isolate the real HURT transport from enemy attacks.
  update=()=>{};
  for(const k of Object.keys(playerSkills))delete playerSkills[k];clearSummons();resetRelics();
  waveEvent=null;playerStats.baseMaxHp=1000;recalcPlayerMaxHp(false);
  player.hp=1000;player.invincible=10000;player.barrierActive=false;
  player.pos.set(mp.myId*4-4,0,-10);
  for(let i=0;i<level;i++)applyRelic('linkedPain');
  if(mp.isHost){for(const e of enemies)releaseEnemySlot(e);enemies.length=0;_waveSpawnQueue.length=0;spawnEnemy('tank',12,12);enemies[0].spd=0;}
  sendPlayerState();
};
gameTest.painReady=levels=>Object.entries(mp.remotePlayers).every(([id,p])=>(p.relics?.linkedPain||0)===levels[+id])&&Object.keys(mp.remotePlayers).length===2;
gameTest.armPain=()=>{player.invincible=0;};
gameTest.takePain=()=>hurtPlayer(100);
`;
(async()=>{
  const browser=await launch(),errors=[];
  try{
    const pages=[];
    for(let i=0;i<3;i++){
      const c=await browser.newContext();await instrument(c,hooks);const p=await c.newPage();
      p.setDefaultTimeout(20000);p.on('pageerror',e=>errors.push(e.message));pages.push(p);
    }
    await startCoop(...pages);
    for(const owner of [0,1,2])for(let level=1;level<=3;level++){
      const levels=pages.map((_,i)=>i===owner?level:0);
      for(let i=0;i<3;i++)await pages[i].evaluate(l=>gameTest.preparePain(l),levels[i]);
      for(const p of pages)await p.waitForFunction(l=>gameTest.painReady(l),levels);
      for(const p of pages)await p.evaluate(()=>gameTest.armPain());
      await pages[owner].evaluate(()=>gameTest.takePain());
      // Poll the complete party: a missing guest-to-guest message must fail.
      const share=[0,15,25,40][level];
      const expected=pages.map((_,i)=>i===owner?900:1000-share);
      let actual;
      for(let attempt=0;attempt<30;attempt++){
        actual=await Promise.all(pages.map(p=>p.evaluate(()=>gameTest.state().hp)));
        if(actual.every((hp,i)=>hp===expected[i]))break;
        await new Promise(resolve=>setTimeout(resolve,100));
      }
      assert.deepEqual(actual,expected,'owner '+owner+' level '+level);
      console.log('PASS Linked Pain owner',owner,'level',level);
    }
    assert.deepEqual(errors,[]);
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

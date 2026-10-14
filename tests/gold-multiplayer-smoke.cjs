const assert=require('node:assert/strict');
const {launch,instrument,startCoop}=require('./browser-harness.cjs');
const hooks=`
gameTest.goldSetup=level=>{
  persistData.upgrades.treasure=level;player.invincible=10000;
  Object.keys(playerSkills).forEach(k=>delete playerSkills[k]);clearSummons();
  if(mp.isHost){for(const e of enemies)releaseEnemySlot(e);enemies.length=0;_waveSpawnQueue.length=0;spawnEnemy('tank',12,12);enemies[0].spd=0;}
  return persistData.gold;
};
gameTest.goldDrop=(totem=false)=>{
  const previous=GOLD_DROP_TABLE.chaser;
  try{_activeTotemMod=totem?'ironSkin':null;GOLD_DROP_TABLE.chaser={chance:1,min:100,max:100};spawnEnemy('chaser',8,8);killEnemy(enemies.length-1);}
  finally{GOLD_DROP_TABLE.chaser=previous;_activeTotemMod=null;}
};
gameTest.gold=()=>persistData.gold;
`;
(async()=>{
  const browser=await launch(),failures=[];
  try{
    const contexts=await Promise.all([browser.newContext(),browser.newContext()]);for(const c of contexts)await instrument(c,hooks);
    const host=await contexts[0].newPage(),guest=await contexts[1].newPage();
    for(const p of [host,guest]){p.setDefaultTimeout(20000);p.on('pageerror',e=>failures.push(e.message));}
    await startCoop(host,guest);
    for(const [hostLevel,guestLevel,totem] of [[0,0,false],[0,10,false],[10,0,false],[4,7,false],[0,10,true],[4,7,true]]){
      const hostBefore=await host.evaluate(l=>gameTest.goldSetup(l),hostLevel);
      const guestBefore=await guest.evaluate(l=>gameTest.goldSetup(l),guestLevel);
      await host.evaluate(totem=>gameTest.goldDrop(totem),totem);await guest.waitForFunction(before=>gameTest.gold()>before,guestBefore);
      const actual=[await host.evaluate(()=>gameTest.gold())-hostBefore,await guest.evaluate(()=>gameTest.gold())-guestBefore];
      const expected=[100+6*hostLevel,100+6*guestLevel].map(n=>Math.round(n*(totem?1.5:1)));
      try{assert.deepEqual(actual,expected);console.log('PASS personal gold bonuses',hostLevel,guestLevel);}
      catch(e){failures.push({hostLevel,guestLevel,actual,expected});console.log('FAIL',hostLevel,guestLevel,actual,expected);}
    }
    for(const p of [host,guest]){
      const gold=await p.evaluate(()=>gameTest.gold());await p.reload();await p.waitForFunction(()=>!!window.gameTest);
      assert.equal(await p.evaluate(()=>gameTest.gold()),gold);
    }
    assert.deepEqual(failures,[]);console.log('PASS gold persists on both clients');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

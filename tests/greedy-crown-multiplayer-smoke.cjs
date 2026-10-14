const assert=require('node:assert/strict');
const {launch,instrument,startCoop}=require('./browser-harness.cjs');
const hooks=`
gameTest.crownSetup=level=>{
  update=()=>{};resetRelics();clearSummons();
  for(const k of Object.keys(playerSkills))delete playerSkills[k];
  for(const b of [...healBags])_disposeHealBag(b);
  for(const d of [...buffDrops])_disposeBuffDrop(d);
  for(const k of Object.keys(activeBuffs))delete activeBuffs[k];
  persistData.upgrades.treasure=0;playerStats.baseMaxHp=1000;recalcPlayerMaxHp(false);
  player.hp=500;player.invincible=10000;player.pos.set(0,0,0);
  for(let i=0;i<level;i++)applyRelic('greedyCrown');sendPlayerState();
};
gameTest.crownReady=level=>Object.values(mp.remotePlayers).some(p=>(p.relics?.greedyCrown||0)===level&&p.hp===500);
gameTest.crownDrops=()=>{spawnHealBag(0,0,.2);spawnBuffDrop(0,0,'dmg');};
gameTest.crownPick=()=>{updateHealBags(.01);updateBuffDrops(.01);return {hp:player.hp,buff:!!activeBuffs.dmg};};
gameTest.crownStatus=()=>({gold:persistData.gold,bags:healBags.length,buffs:buffDrops.length});
gameTest.crownGoldDelivered=()=>mp.remotePlayers[0]?.hp===499;
gameTest.crownGold=()=>{
  const previous=GOLD_DROP_TABLE.chaser;
  try{GOLD_DROP_TABLE.chaser={chance:1,min:100,max:100};spawnEnemy('chaser',8,8);killEnemy(enemies.length-1);}
  finally{GOLD_DROP_TABLE.chaser=previous;}
  // State follows GOLD_DROP over the same ordered channel, including when gold is blocked.
  player.hp=499;sendPlayerState();
};
`;
(async()=>{
  const browser=await launch(),errors=[],failures=[];
  try{
    const pages=[];
    for(let i=0;i<2;i++){const c=await browser.newContext();await instrument(c,hooks);const p=await c.newPage();p.setDefaultTimeout(20000);p.on('pageerror',e=>errors.push(e.message));pages.push(p);}
    const [host,guest]=pages;await startCoop(host,guest);
    for(const owner of [0,1])for(let level=0;level<=3;level++){
      for(let i=0;i<2;i++)await pages[i].evaluate(l=>gameTest.crownSetup(l),i===owner?level:0);
      for(let i=0;i<2;i++)await pages[i].waitForFunction(l=>gameTest.crownReady(l),i!==owner?level:0);
      await host.evaluate(()=>gameTest.crownDrops());
      await guest.waitForFunction(()=>{const s=gameTest.crownStatus();return s.bags===1&&s.buffs===1;});
      const other=pages[1-owner];
      assert.deepEqual(await other.evaluate(()=>gameTest.crownPick()),{hp:level?500:700,buff:level<2});
      // Wait for the pickup message to remove only the allowed objects from the holder.
      await pages[owner].waitForFunction(l=>{const s=gameTest.crownStatus();return s.bags===(l?1:0)&&s.buffs===(l>=2?1:0);},level);
      assert.deepEqual(await pages[owner].evaluate(()=>gameTest.crownPick()),{hp:level?700:500,buff:level>=2});
      const before=await Promise.all(pages.map(p=>p.evaluate(()=>gameTest.crownStatus())));
      await host.evaluate(()=>gameTest.crownGold());await guest.waitForFunction(()=>gameTest.crownGoldDelivered());
      const after=await Promise.all(pages.map(p=>p.evaluate(()=>gameTest.crownStatus())));
      const actual=after.map((s,i)=>s.gold-before[i].gold),expected=pages.map((_,i)=>level===3&&i!==owner?0:100);
      if(JSON.stringify(actual)!==JSON.stringify(expected))failures.push({owner,level,actual,expected});
      else console.log('PASS Greedy Crown owner',owner,'level',level);
    }
    assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

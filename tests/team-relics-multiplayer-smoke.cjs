const assert=require('node:assert/strict');
const {launch,instrument,startCoop}=require('./browser-harness.cjs');
const hooks=`
gameTest.teamRelic=(id,level)=>{
  for(const k of Object.keys(playerSkills))delete playerSkills[k];clearSummons();resetRelics();
  persistData.upgrades.crit=0;persistData.upgrades.speed=0;
  playerStats.baseMaxHp=1000;recalcPlayerMaxHp(false);player.hp=1000;player.invincible=10000;player.barrierActive=false;
  player.pos.set(0,0,0);obstacleBoxes.length=0;
  for(let i=0;i<level;i++)applyRelic(id);
  if(mp.isHost){for(const e of enemies)releaseEnemySlot(e);enemies.length=0;_waveSpawnQueue.length=0;spawnEnemy('tank',12,12);enemies[0].spd=0;}
  sendPlayerState();
};
gameTest.remoteRelic=(id,level)=>Object.values(mp.remotePlayers).some(p=>(p.relics?.[id]||0)===level);
gameTest.teamEffect=id=>{
  if(id==='hasteAura'){
    player.pos.set(0,0,0);keys[NB_KEYBINDS.right]=true;
    for(let i=0;i<6;i++)update(1/60);delete keys[NB_KEYBINDS.right];return player.pos.x;
  }
  if(id==='heavyBoots'){player.dashCd=0;player.dashT=0;startDash();return player.dashCd;}
  if(id==='envy')return playerDamageAmount({type:'chaser',hp:1000,maxHp:1000},100);
  if(id==='brittleBones'){
    player.invincible=0;const hp=player.hp;hurtPlayer(20);player.invincible=10000;return hp-player.hp;
  }
  if(id==='boneTribute')return getWaveConfig(1).map(([type,n])=>[type,n]);
};
gameTest.remoteCount=()=>Object.keys(mp.remotePlayers).length;
`;
(async()=>{
  const browser=await launch(),errors=[];
  try{
    const contexts=await Promise.all([browser.newContext(),browser.newContext()]);for(const c of contexts)await instrument(c,hooks);
    const host=await contexts[0].newPage(),guest=await contexts[1].newPage();
    for(const p of [host,guest]){p.setDefaultTimeout(20000);p.on('pageerror',e=>errors.push(e.message));}
    await startCoop(host,guest);
    const effects={hasteAura:[1,1.2,1.3,1.45],heavyBoots:[1,1.5,2,2.5],envy:[1,.7,.5,.25],brittleBones:[1,1.2,1.3,1.5],boneTribute:[1,1.25,1.5,1.8]};
    for(const [id,mults] of Object.entries(effects)){
      let baseline;
      for(let level=0;level<=3;level++){
        await host.evaluate(()=>gameTest.teamRelic(null,0));await guest.evaluate(t=>gameTest.teamRelic(t.id,t.level),{id,level});
        await host.waitForFunction(t=>gameTest.remoteRelic(t.id,t.level),{id,level});
        const actual=await host.evaluate(id=>gameTest.teamEffect(id),id);
        if(level===0)baseline=actual;
        if(id==='boneTribute')assert.deepEqual(actual,baseline.map(([type,n])=>[type,Math.max(1,Math.round(n*mults[level]))]));
        else assert.ok(Math.abs(actual-baseline*mults[level])<.001,id+' level '+level+': '+actual);
        if(id==='envy')assert.equal(await guest.evaluate(id=>gameTest.teamEffect(id),id),100,'Envy holder remains unaffected');
      }
      console.log('PASS remote relic levels',id);
    }
    await guest.evaluate(()=>{gameTest.teamRelic('heavyBoots',3);});
    await host.waitForFunction(()=>gameTest.remoteRelic('heavyBoots',3));
    const cursed=await host.evaluate(()=>gameTest.teamEffect('heavyBoots'));
    await guest.evaluate(()=>gameTest.quit());await host.waitForFunction(()=>gameTest.remoteCount()===0);
    assert.ok(Math.abs(await host.evaluate(()=>gameTest.teamEffect('heavyBoots'))-cursed/2.5)<.001);
    assert.deepEqual(errors,[]);console.log('PASS relic effect removed when holder leaves');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

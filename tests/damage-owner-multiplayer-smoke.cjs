const assert=require('node:assert/strict');
const {launch,instrument,startCoop}=require('./browser-harness.cjs');
const hooks=`
gameTest.configureDamage=(glass,hollow)=>{
  Object.keys(playerSkills).forEach(k=>delete playerSkills[k]);Object.keys(playerSkillPicks).forEach(k=>delete playerSkillPicks[k]);
  clearSummons();resetRelics();playerStats.baseMaxHp=100;playerStats.attackDmg=100;
  persistData.upgrades.crit=0;persistData.upgrades.bossHunter=0;
  recalcPlayerMaxHp(false);if(glass)applyRelic('glassReactor');
  if(hollow)applySkill('hollowPoint');
  player.hp=playerStats.maxHp;player.invincible=10000;mouse.down=false;player.gun='pistol';player.pos.set(0,0,0);
  obstacleBoxes.length=0;
  for(const b of bulletPool)if(b.active)releaseBullet(b);
  if(mp.isHost){
    for(const e of enemies)releaseEnemySlot(e);enemies.length=0;_waveSpawnQueue.length=0;
    spawnEnemy('chaser',0,3);const e=enemies[0];e.hp=e.maxHp=10000;e.spd=0;e.spawnAnim=0;rebuildEnemyGrid();
  }
  sendPlayerState();
};
gameTest.ownerShot=(special)=>{
  if(special)applySpecialGunFire(GUNS.laser,0,1,0,1,100,mp.myId,false,true);
  else{fireBullet({x:0,z:1},_scratchDir.set(0,0,1),true,100);sendFireMP(0,1,0,1,100);}
};
gameTest.targetDamage=()=>10000-enemies[0].hp;
`;
(async()=>{
  const browser=await launch(),failures=[];
  try{
    const contexts=await Promise.all([browser.newContext(),browser.newContext()]);for(const c of contexts)await instrument(c,hooks);
    const host=await contexts[0].newPage(),guest=await contexts[1].newPage();
    for(const p of [host,guest]){p.setDefaultTimeout(20000);p.on('pageerror',e=>failures.push(e.message));}
    await startCoop(host,guest);
    for(const special of [false,true])for(const test of [
      {name:'host glass',host:[true,false],guest:[false,false],owner:'host',expected:150},
      {name:'guest glass',host:[false,false],guest:[true,false],owner:'guest',expected:150},
      {name:'guest hollow',host:[false,false],guest:[false,true],owner:'guest',expected:135},
      {name:'host hollow must not affect guest',host:[false,true],guest:[false,false],owner:'guest',expected:100},
    ]){
      await host.evaluate(a=>gameTest.configureDamage(...a),test.host);await guest.evaluate(a=>gameTest.configureDamage(...a),test.guest);
      await (test.owner==='host'?host:guest).evaluate(special=>gameTest.ownerShot(special),special);
      await host.waitForFunction(()=>gameTest.targetDamage()>0);
      const damage=await host.evaluate(()=>gameTest.targetDamage());
      try{assert.equal(damage,test.expected);console.log('PASS',special?'beam':'bullet',test.name);}
      catch(e){failures.push({special,name:test.name,damage,expected:test.expected});console.log('FAIL',special,test.name,damage,test.expected);}
    }
    assert.deepEqual(failures,[]);
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

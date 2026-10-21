const assert=require('node:assert/strict');
const {launch,instrument,startCoop}=require('./browser-harness.cjs');
const hooks=`
gameTest.akSetup=()=>{
 initGame();hideGunSelect();hideMeleeSelect();gState='playing';nbPaused=true;mp.soloMode=true;mp.isHost=true;
 for(const e of enemies)e.dead=true;for(const b of bulletPool)if(b.active)releaseBullet(b);obstacleBoxes.length=0;
 waveTransition=false;waveClear=false;waveSpawned=false;_waveSpawnQueue.length=0;mouse.down=false;
 player.pos.set(0,0,0);player.gun='ak47';player.ammo=currentMagSize();player.reloadT=0;player.invincible=10000;
};
gameTest.akCards=()=>{
 const ids=['ak47Control','ak47Momentum','ak47Tactical'];const eligible=ids.every(skillEligible);
 for(const id of ids)for(let n=0;n<6;n++)applySkill(id);
 const picks=ids.map(skillPickLevel);player.gun='pistol';const excluded=ids.every(id=>!skillEligible(id));player.gun='ak47';
 return {eligible,picks,excluded};
};
gameTest.akShot=(ramp=0,spread=0)=>{
 for(const b of bulletPool)if(b.active)releaseBullet(b);
 ak47Rhythm.reset();for(let i=0;i<ramp;i++)ak47Rhythm.shot(3);
 playerSkills.spread=spread;player.ammo=20;player.reloadT=0;player.fireCd=0;
 mouse.world.set(8,0,0);mouse.hasWorld=true;mouse.down=true;update(.016);mouse.down=false;
 return bulletPool.filter(b=>b.active&&b.isPlayer).map(b=>b.dmg);
};
gameTest.akReload=()=>{
 spawnEnemy('chaser',6,6);const e=enemies[enemies.length-1];e._lastHitOwner=mp.myId;killEnemy(e);
 const base=currentReloadTime();player.ammo=1;player.reloadT=0;nbPaused=false;startManualReload();nbPaused=true;
 const boosted=player.reloadDur;player.reloadT=0;player.ammo=1;nbPaused=false;startManualReload();nbPaused=true;
 return {base,boosted,second:player.reloadDur};
};
gameTest.akStorm=()=>{
 const eligible=skillEligible('ak47Ascension');applySkill('ak47Ascension');applySkill('ak47Ascension');
 steelStorm.reset();for(let i=0;i<40;i++)steelStorm.shot();
 const damage=gameTest.akShot(10,5);updateSteelStormHud();
 return {eligible,picks:skillPickLevel('ak47Ascension'),rarity:SKILL_RARITY.ak47Ascension,damage,
 pierce:bulletPool.filter(b=>b.active&&b.isPlayer).map(b=>b.pierce),rounds:steelStorm.rounds,charge:steelStorm.charge,hud:steelStormHud.textContent};
};
const akRealUpdate=update;
gameTest.akNetPrepare=()=>{nbPaused=true;update=()=>{};resetGameplayInput();};
gameTest.akNetGuest=()=>{
 player.gun='ak47';for(let n=0;n<3;n++){applySkill('ak47Tactical');applySkill('ak47Momentum');}sendPlayerState();return mp.myId;
};
gameTest.akNetReady=id=>mp.remotePlayers[id]?.gun==='ak47'&&!!mp.remotePlayers[id]?.skills?.ak47Tactical;
gameTest.akNetKill=id=>{
 spawnEnemy('chaser',6,6);const e=enemies[enemies.length-1];e._lastHitOwner=id;killEnemy(e);return ak47Rhythm.reloadWindow;
};
gameTest.akWindow=()=>ak47Rhythm.reloadWindow;
gameTest.akNetFire=()=>{
 ak47Rhythm.reset();for(let i=0;i<10;i++)ak47Rhythm.shot(3);
 applySkill('ak47Ascension');steelStorm.reset();for(let i=0;i<40;i++)steelStorm.shot();playerSkills.spread=5;
 player.ammo=10;player.reloadT=0;player.fireCd=0;mouse.world.set(player.pos.x,0,player.pos.z-8);mouse.hasWorld=true;mouse.down=true;
 akRealUpdate(.016);mouse.down=false;
 return bulletPool.filter(b=>b.active&&b.isPlayer&&b.ownerId===mp.myId).map(b=>({dmg:b.dmg,pierce:b.pierce}));
};
gameTest.akRemoteBullets=id=>bulletPool.filter(b=>b.active&&b.isPlayer&&b.ownerId===id).map(b=>({dmg:b.dmg,pierce:b.pierce}));
`;
(async()=>{
 const browser=await launch(),errors=[];try{
  const c=await browser.newContext();await instrument(c,hooks);const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:3000');await p.waitForFunction(()=>!!window.gameTest);
  await p.evaluate(()=>gameTest.akSetup());
  assert.deepEqual(await p.evaluate(()=>gameTest.akCards()),{eligible:true,picks:[4,3,3],excluded:true});
  const base=await p.evaluate(()=>gameTest.akShot(0,5));const ramp=await p.evaluate(()=>gameTest.akShot(10,5));
  assert.equal(ramp.length,6);assert.ok(ramp.every((d,i)=>d>=base[i]*1.35&&d<=base[i]*1.45));
  const reload=await p.evaluate(()=>gameTest.akReload());
  assert.ok(Math.abs(reload.boosted/reload.base-.6)<1e-8);assert.equal(reload.second,reload.base);
  const storm=await p.evaluate(()=>gameTest.akStorm());
  assert.equal(storm.eligible,true);assert.equal(storm.picks,1);assert.equal(storm.rarity,'divine');
  assert.equal(storm.rounds,11);assert.equal(storm.charge,0);assert.equal(storm.damage.length,6);
  assert.ok(storm.damage.every((d,i)=>Math.abs(d-ramp[i]*2)<=1));assert.ok(storm.pierce.every(n=>n===2));
  assert.match(storm.hud,/11 empowered shots/);
  await p.screenshot({path:'test-results/ak47-steel-storm.png'});
  await c.close();
  const hc=await browser.newContext(),gc=await browser.newContext();await instrument(hc,hooks);await instrument(gc,hooks);
  const host=await hc.newPage(),guest=await gc.newPage();for(const p of [host,guest])p.on('pageerror',e=>errors.push(e.message));
  await startCoop(host,guest);for(const p of [host,guest])await p.evaluate(()=>gameTest.akNetPrepare());
  const id=await guest.evaluate(()=>gameTest.akNetGuest());await host.waitForFunction(id=>gameTest.akNetReady(id),id);
  assert.equal(await host.evaluate(id=>gameTest.akNetKill(id),id),0);
  await guest.waitForFunction(()=>gameTest.akWindow()>0);
  const shots=await guest.evaluate(()=>gameTest.akNetFire());assert.ok(shots.length>0);
  await host.waitForFunction(id=>gameTest.akRemoteBullets(id).length>0,id);
  assert.deepEqual(await host.evaluate(id=>gameTest.akRemoteBullets(id),id),shots);
  assert.deepEqual(errors,[]);console.log('PASS AK47: exclusive cards/caps, ramp plus extra shots, consumed reload bonus, guest kill credit and transmitted damage.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

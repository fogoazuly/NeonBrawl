const assert=require('node:assert/strict');
const {launch,instrument,startCoop}=require('./browser-harness.cjs');
const hooks=`
gameTest.setupJudgment=()=>{
 initGame();hideGunSelect();hideMeleeSelect();gState='playing';nbPaused=true;mp.soloMode=true;mp.isHost=true;
 obstacleBoxes.length=0;for(const e of enemies)e.dead=true;
 for(const b of bulletPool)if(b.active)releaseBullet(b);
 player.gun='pistol';player.pos.set(-10,0,-10);player.invincible=1000;mouse.down=false;
 waveSpawned=true;waveClear=false;waveTransition=false;_waveSpawnQueue.length=0;
 spawnEnemy('tank',2,0);const e=enemies[enemies.length-1];e.hp=e.maxHp=100000;e.spd=0;e.spawnAnim=0;
 applySkill('pistolAscension');
};
gameTest.judgmentHit=(special=false,primary=true)=>{
 const b=fireBullet({x:1.7,z:0},new THREE.Vector3(1,0,0),true,100,4,false,null,mp.myId,'pistol',{pistolShot:true,pistolPrimary:primary,pistolJudgment:special});b.spd=0;
 update(.016);update(.016);const result={hits:pistolJudgment.hits,dmg:b.dmg};releaseBullet(b);return result;
};
gameTest.judgmentReady=()=>{for(let i=pistolJudgment.hits;i<30;i++)gameTest.judgmentHit();updatePistolJudgmentHud();return pistolJudgment.ready;};
gameTest.judgmentReload=()=>{player.reloadT=.001;mouse.down=false;update(.016);return pistolJudgment.rounds;};
gameTest.judgmentFire=()=>{
 applySkill('spread');applySkill('spread');applySkill('pistolLastWord');
 for(const b of bulletPool)if(b.active)releaseBullet(b);
 player.ammo=1;player.fireCd=0;player.reloadT=0;mouse.world.x=12;mouse.world.z=-10;mouse.down=true;
 update(.016);mouse.down=false;
 return {rounds:pistolJudgment.rounds,shots:bulletPool.filter(b=>b.active&&b.isPlayer).map(b=>({dmg:b.dmg,pierce:b.pierce,charge:b.judgmentCharge}))};
};
gameTest.judgmentInfinite=()=>{gameTest.setupJudgment();applyRelic('infiniteMag');gameTest.judgmentReady();nbPaused=false;};
gameTest.judgmentPause=()=>{nbPaused=true;updatePistolJudgmentHud();};
gameTest.judgmentCards=()=>{
 gameTest.setupJudgment();for(let i=0;i<3;i++)applySkill('pistolAscension');
 const cap=skillPickLevel('pistolAscension');player.gun='shotgun';
 const excluded=!skillEligible('pistolAscension');player.gun='pistol';return {cap,excluded};
};
gameTest.judgmentView=()=>{_currentOffering=['pistolAscension'];_offeringPicked.clear();showBuffSelect('skill');};
gameTest.judgmentNetPrepare=()=>{nbPaused=true;update=()=>{};resetGameplayInput();for(const b of bulletPool)if(b.active)releaseBullet(b);pistolJudgment.reset();player.gun='pistol';applySkill('pistolAscension');};
gameTest.judgmentNetShoot=(special)=>sendFireMP(0,0,1,0,100,0,{pistolShot:true,pistolPrimary:true,pistolJudgment:special});
gameTest.judgmentRemote=()=>bulletPool.filter(b=>b.active&&b.ownerId!==mp.myId&&b.isPlayer).map(b=>({dmg:b.dmg,pierce:b.pierce,charge:b.judgmentCharge}));
gameTest.judgmentConfirm=()=>{for(const b of bulletPool)if(b.active&&b.ownerId!==mp.myId){registerJudgmentHit(b);registerJudgmentHit(b);}};
gameTest.judgmentState=()=>({hits:pistolJudgment.hits,rounds:pistolJudgment.rounds});
`;
(async()=>{
 const browser=await launch(),errors=[];
 try{
  const context=await browser.newContext();await instrument(context,hooks);const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:3000');await page.waitForFunction(()=>!!window.gameTest);
  await page.evaluate(()=>gameTest.setupJudgment());
  assert.deepEqual(await page.evaluate(()=>gameTest.judgmentCards()),{cap:1,excluded:true});
  assert.equal((await page.evaluate(()=>gameTest.judgmentHit())).hits,1);
  assert.equal((await page.evaluate(()=>gameTest.judgmentHit(false,false))).hits,1);
  assert.equal((await page.evaluate(()=>gameTest.judgmentHit(true))).hits,1);
  assert.equal(await page.evaluate(()=>gameTest.judgmentReady()),true);
  assert.equal(await page.evaluate(()=>gameTest.judgmentReload()),15);
  const fire=await page.evaluate(()=>gameTest.judgmentFire());assert.equal(fire.rounds,14);assert.equal(fire.shots.length,3);assert.ok(fire.shots.every(b=>b.pierce===4&&!b.charge));assert.equal(fire.shots[0].dmg,80);
  assert.equal(await page.evaluate(()=>gameTest.judgmentReload()),0);
  await page.evaluate(()=>gameTest.judgmentInfinite());
  await page.locator('#pistolJudgmentHud').click();
  await page.waitForFunction(()=>gameTest.judgmentState().rounds===15);
  await page.evaluate(()=>gameTest.judgmentPause());await page.screenshot({path:'test-results/pistol-ascension-hud.png'});
  await page.evaluate(()=>gameTest.judgmentView());await page.waitForTimeout(2200);await page.screenshot({path:'test-results/pistol-ascension-card.png'});
  await page.evaluate(()=>gameTest.setupJudgment());assert.deepEqual(await page.evaluate(()=>gameTest.judgmentState()),{hits:0,rounds:0});
  await context.close();
  const hc=await browser.newContext(),gc=await browser.newContext();await instrument(hc,hooks);await instrument(gc,hooks);
  const host=await hc.newPage(),guest=await gc.newPage();for(const p of [host,guest])p.on('pageerror',e=>errors.push(e.message));await startCoop(host,guest);
  for(const p of [host,guest])await p.evaluate(()=>gameTest.judgmentNetPrepare());
  await guest.evaluate(()=>gameTest.judgmentNetShoot(false));await host.waitForFunction(()=>gameTest.judgmentRemote().length===1);
  await host.evaluate(()=>gameTest.judgmentConfirm());await guest.waitForFunction(()=>gameTest.judgmentState().hits===1);
  await guest.evaluate(()=>gameTest.judgmentNetShoot(true));await host.waitForFunction(()=>gameTest.judgmentRemote().length===2);
  const shots=await host.evaluate(()=>gameTest.judgmentRemote());assert.ok(shots.some(b=>b.dmg===200&&b.pierce===3&&!b.charge));
  await host.evaluate(()=>gameTest.judgmentConfirm());assert.equal((await guest.evaluate(()=>gameTest.judgmentState())).hits,1);
  assert.deepEqual(errors,[]);console.log('PASS judgment: real hits, primary-only charge, reload, spread/Last Word, infinite ammo UI, reset and co-op feedback/damage');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

const assert=require('node:assert/strict');
const fs=require('node:fs');
const {launch,instrument,startCoop}=require('./browser-harness.cjs');
// Reuse the shotgun combat fixtures so both suites exercise the same setup.
const base=fs.readFileSync('tests/shotgun-smoke.cjs','utf8').split('const hooks=`')[1].split('\n`;')[0];
const hooks=base+`
gameTest.ruptureSetup=()=>{gameTest.shotgunFixture();applySkill('shotgunAscension');};
gameTest.ruptureHits=(id,far=false,special=false)=>{
 for(let n=0;n<12;n++){
  const b=fireBullet({x:1.7,z:0},new THREE.Vector3(1,0,0),true,1,0,false,null,mp.myId,'shotgun',{shotgunSalvo:id,rupture:special});b.spd=0;if(far)b.fallOX=-8;
 }update(.016);return ruptureCharge.hits;
};
gameTest.ruptureFire=()=>{
 for(let n=0;n<4;n++)applySkill('shotgunRain');applySkill('spread');applySkill('spread');
 player.ammo=8;player.fireCd=0;player.reloadT=0;mouse.world.x=12;mouse.world.z=-10;mouse.down=true;
 update(.016);mouse.down=false;updateRuptureHud();
 return {hits:ruptureCharge.hits,waves:shockwaves.filter(s=>s.mesh.geometry===_ruptureWaveGeo).length,shots:bulletPool.filter(b=>b.active&&b.isPlayer).length,charging:bulletPool.some(b=>b.active&&b.ruptureCharging)};
};
gameTest.ruptureCone=(wall=false,visual=false)=>{
 gameTest.ruptureSetup();for(const e of enemies)e.dead=true;
 const targets=[];for(const [x,z]of [[5,0],[-2,0],[3,6],[15,0]]){spawnEnemy('chaser',x,z);const e=enemies[enemies.length-1];e.hp=e.maxHp=10000;targets.push(e);}
 if(wall)obstacleBoxes.push({x:3,z:0,hw:.2,hd:2});
 fireRupture(0,0,1,0,144,mp.myId,localAttackModifiers(),visual);
 return targets.map(e=>10000-e.hp);
};
gameTest.ruptureView=()=>{_currentOffering=['shotgunAscension'];_offeringPicked.clear();showBuffSelect('skill');};
gameTest.ruptureState=()=>ruptureCharge.hits;
gameTest.ruptureSnapshot=()=>{for(const o of obstacleObjects)o.visible=false;update(.12);updateRuptureHud();};
gameTest.ruptureCards=()=>{
 gameTest.ruptureSetup();for(let i=0;i<4;i++)applySkill('shotgunAscension');
 const cap=skillPickLevel('shotgunAscension');player.gun='pistol';
 const excluded=!skillEligible('shotgunAscension');player.gun='shotgun';return {cap,excluded};
};
gameTest.ruptureNetPrepare=()=>{gameTest.shotgunNetPrepare();applySkill('shotgunAscension');ruptureCharge.reset();};
gameTest.ruptureNetShoot=()=>{for(let i=0;i<12;i++)sendFireMP(1.7,0,1,0,1,0,{shotgunSalvo:'charge'});};
gameTest.ruptureNetWave=()=>sendToHost({type:'RUPTURE',id:mp.myId,x:0,z:0,dx:1,dz:0,dmg:144,perm:localAttackModifiers()});
gameTest.ruptureNetTarget=()=>{for(const e of enemies)e.dead=true;spawnEnemy('chaser',5,0);const e=enemies[enemies.length-1];e.hp=e.maxHp=10000;return e.hp;};
gameTest.ruptureNetDamage=()=>10000-enemies[enemies.length-1].hp;
`;
(async()=>{
 const browser=await launch(),errors=[];
 try{
  const context=await browser.newContext();await instrument(context,hooks);const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:3000');await page.waitForFunction(()=>!!window.gameTest);
  await page.evaluate(()=>gameTest.ruptureSetup());
  assert.deepEqual(await page.evaluate(()=>gameTest.ruptureCards()),{cap:1,excluded:true});
  assert.equal(await page.evaluate(()=>gameTest.ruptureHits('far',true)),0);
  assert.equal(await page.evaluate(()=>gameTest.ruptureHits('special',false,true)),0);
  for(let i=0;i<8;i++)assert.equal(await page.evaluate(i=>gameTest.ruptureHits('hit'+i),i),i+1);
  assert.deepEqual(await page.evaluate(()=>gameTest.ruptureFire()),{hits:0,waves:1,shots:22,charging:false});
  await page.evaluate(()=>gameTest.ruptureSnapshot());await page.screenshot({path:'test-results/rupture-wave.png'});
  assert.deepEqual(await page.evaluate(()=>gameTest.ruptureCone()),[144,0,0,0]);
  assert.deepEqual(await page.evaluate(()=>gameTest.ruptureCone(true)),[0,0,0,0]);
  assert.deepEqual(await page.evaluate(()=>gameTest.ruptureCone(false,true)),[0,0,0,0]);
  await page.evaluate(()=>gameTest.ruptureView());await page.waitForTimeout(2200);await page.screenshot({path:'test-results/rupture-card.png'});await context.close();
  const hc=await browser.newContext(),gc=await browser.newContext();await instrument(hc,hooks);await instrument(gc,hooks);const host=await hc.newPage(),guest=await gc.newPage();
  for(const p of [host,guest])p.on('pageerror',e=>errors.push(e.message));await startCoop(host,guest);for(const p of [host,guest])await p.evaluate(()=>gameTest.ruptureNetPrepare());
  await guest.evaluate(()=>gameTest.ruptureNetShoot());await host.waitForFunction(()=>gameTest.shotgunNetState().length===12);
  await host.evaluate(()=>gameTest.shotgunNetHit());await guest.waitForFunction(()=>gameTest.ruptureState()===1);
  await host.evaluate(()=>gameTest.ruptureNetTarget());await guest.evaluate(()=>gameTest.ruptureNetWave());await host.waitForFunction(()=>gameTest.ruptureNetDamage()===144);
  assert.equal(await host.evaluate(()=>gameTest.ruptureState()),0);
  assert.deepEqual(errors,[]);console.log('PASS Rupture: charge per blast, empowered spread, cone, walls, visual-only safety, co-op charge and wave damage');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

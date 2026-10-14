const assert=require('node:assert/strict');
const {launch,instrument,startCoop}=require('./browser-harness.cjs');
const hooks=`
gameTest.ascFixture=()=>{
  initGame();hideGunSelect();hideMeleeSelect();document.getElementById('buffSelect').style.display='none';
  mp.soloMode=true;gState='playing';nbPaused=true;waveNum=1;waveSpawned=true;waveClear=false;waveTransition=false;
  obstacleBoxes.length=0;_waveSpawnQueue.length=0;
  player.gun='gravity';player.pos.set(0,0,0);player.hp=player.maxHp=100;player.invincible=10000;
  player.ammo=3;player.fireCd=0;player.reloadT=0;mouse.hasWorld=true;mouse.world.set(0,0,4);
  spawnEnemy('tank',-10,-10);const e=enemies[enemies.length-1];e.hp=e.maxHp=100000;e.spd=0;e.spawnAnim=0;
  applySkill('gravityAscension');
};
gameTest.ascCenterTest=(visual=false)=>{
 gameTest.ascFixture();const e=enemies.find(e=>!e.dead);e.pos.set(-12,0,0);e.type='boss';
 obstacleBoxes.push({x:6,z:0,hw:2,hd:10},{x:-6,z:0,hw:2,hd:10});
 const b=fireBullet({x:12,z:0},new THREE.Vector3(1,0,0),true,100,0,visual,null,mp.myId,'gravity',{gravityCharge:1});
 tickGravityBullet(b,.1);
 const transit={x:b.pos.x,enemyX:e.pos.x,life:b.life};
 for(let i=0;i<140;i++)tickGravityBullet(b,.02);
 return {transit,x:b.pos.x,z:b.pos.z,enemyX:e.pos.x,life:b.life,active:b.active};
};
gameTest.ascSpread=n=>{playerSkills.spread=n;};
gameTest.ascHold=seconds=>{for(let t=0;t<seconds-1e-8;t+=.05)updateGravityAscension(Math.min(.05,seconds-t),true);return gameTest.ascState();};
gameTest.ascRelease=()=>{updateGravityAscension(.01,false);return gameTest.ascState();};
gameTest.ascState=()=>({charge:player.gravityCharge,exhaustion:player.gravityExhaustion,ammo:player.ammo,reload:currentReloadTime(),bullets:bulletPool.filter(b=>b.active&&b.bulletKind==='gravity').map(b=>({damage:b.dmg,radius:b.gravityRadius,global:b.gravityGlobal,life:b.life,explode:b.explodeR})),hud:gravityChargeHud?.textContent});
gameTest.ascResetInput=()=>{resetGameplayInput();updateGravityAscension(.01,false);return gameTest.ascState();};
gameTest.ascTick=seconds=>{mouse.down=false;for(let t=0;t<seconds;t+=.05)update(.05);return gameTest.ascState();};
gameTest.ascGlobalDamage=()=>{const e=enemies.find(e=>!e.dead);const before=e.hp;const b=bulletPool.find(b=>b.active&&b.gravityGlobal);while(b.gravityTravelling)tickGravityBullet(b,.05);b.life=.01;tickGravityBullet(b,.02);return before-e.hp;};
gameTest.ascMotion=exhausted=>{player.gravityExhaustion=exhausted?10:0;player.pos.set(0,0,0);keys.ArrowRight=true;update(.1);delete keys.ArrowRight;return player.pos.x;};
gameTest.ascOffers=gun=>{
  player.gun=gun;delete playerSkills.gravityAscension;delete playerSkillPicks.gravityAscension;
  const picks=weightedSkillPick(1000),fallback=weightedSkillPick(1000,{onlyRarity:'absent',fallbackMaxRarity:'divine'});
  const shop=[];for(let i=0;i<100;i++){rollRunShopCards();shop.push(...runShopCards);}
  const random=Math.random;Math.random=()=>0;let boss;try{boss=getBossSkillChoices();}finally{Math.random=random;}
  return {picks,fallback,shop,boss,max:skillMaxLevel('gravityAscension'),order:RARITY_ORDER.divine,weight:RARITY_INFO.divine.weight,legendaryWeight:RARITY_INFO.legendary.weight};
};
gameTest.ascUpgrades=()=>{
  gameTest.ascFixture();const cfg=GUNS.gravity;
  for(let i=0;i<4;i++)applySkill('eventHorizon');for(let i=0;i<3;i++){applySkill('persistentSingularity');applySkill('unstableCollapse');}
  const b=fireBullet({x:0,z:0},new THREE.Vector3(0,0,1),true,100,0,false,null,mp.myId,'gravity');b.spd=0;
  const radius=b.gravityRadius,life=b.life;
  for(let i=0;i<6;i++){spawnEnemy('tank',1+i*.1,0);const e=enemies[enemies.length-1];e.hp=e.maxHp=100000;}
  b.life=.01;tickGravityBullet(b,.02);
  return {radius,life,damage:b.dmg,descs:[skillDesc('eventHorizon',4),skillDesc('unstableCollapse',3),skillDesc('persistentSingularity',3)]};
};
gameTest.ascActualInput=()=>{gameTest.ascFixture();mouse.down=true;for(let i=0;i<120;i++)update(.05);const held=gameTest.ascState();mouse.down=false;update(.05);return {held,released:gameTest.ascState()};};
gameTest.ascCancelCase=kind=>{
  gameTest.ascFixture();gameTest.ascHold(6);
  if(kind==='pause'){nbPaused=false;nbPauseOpen();}
  if(kind==='blur')window.dispatchEvent(new Event('blur'));
  if(kind==='death'){player.dead=true;updateGravityAscension(.05,false);}
  if(kind==='switch'){player.gun='pistol';updateGravityAscension(.05,false);}
  if(kind==='reward')showBuffSelect('skill');
  if(kind==='newRun'){player.gravityExhaustion=10;initGame();}
  return gameTest.ascState();
};
gameTest.ascCardPreview=()=>{gameTest.ascFixture();delete playerSkills.gravityAscension;delete playerSkillPicks.gravityAscension;_currentOffering=['eventHorizon','unstableCollapse','persistentSingularity','gravityAscension'];_offeringPicked.clear();showBuffSelect('skill');};
gameTest.ascHudPreview=()=>{gameTest.ascFixture();gameTest.ascHold(6);updateGravityChargeHud();};
gameTest.ascNetPrepare=()=>{update=()=>{};nbPaused=true;obstacleBoxes.length=0;for(const b of bulletPool)if(b.active)releaseBullet(b);};
gameTest.ascNetFire=()=>{player.gun='gravity';applySkill('gravityAscension');applySkill('eventHorizon');applySkill('persistentSingularity');sendFireMP(0,0,0,1,100,0,{gravityTravel:3,gravityCharge:1});};
gameTest.ascNetState=()=>bulletPool.filter(b=>b.active&&b.bulletKind==='gravity').map(b=>({global:b.gravityGlobal,damage:b.dmg,radius:b.gravityRadius,life:b.life,visual:b.visualOnly}));
`;
(async()=>{
  const browser=await launch(),errors=[];
  try{
    const c=await browser.newContext({viewport:{width:1600,height:1000}});await instrument(c,hooks);const p=await c.newPage();p.on('pageerror',e=>{errors.push(e.message);console.error(e.stack);});
    await p.goto('http://127.0.0.1:3000');await p.waitForFunction(()=>!!window.gameTest);
    await p.evaluate(()=>gameTest.ascFixture());
    const ids=['eventHorizon','unstableCollapse','persistentSingularity','gravityAscension'];
    for(const gun of ['pistol','gravity']){
      const offers=await p.evaluate(g=>gameTest.ascOffers(g),gun);
      for(const pool of ['picks','fallback'])for(const id of ids)assert.equal(offers[pool].includes(id),gun==='gravity');
      if(gun==='pistol')for(const pool of ['shop','boss'])assert.ok(offers[pool].every(id=>!ids.includes(id)));
      else assert.ok(offers.boss.includes('gravityAscension'));
      assert.equal(offers.max,1);assert.equal(offers.order,5);assert.ok(offers.weight<offers.legendaryWeight);
    }
    console.log('PASS exclusivity: mixed, fallback, boss, shop; divine rarity');
    await p.evaluate(()=>gameTest.ascFixture());const held=await p.evaluate(()=>gameTest.ascHold(6));assert.equal(held.bullets.length,0);assert.equal(held.ammo,3);
    const partial=await p.evaluate(()=>gameTest.ascRelease());assert.equal(partial.bullets.length,1);assert.equal(partial.bullets[0].global,false);assert.equal(partial.exhaustion,0);assert.equal(partial.ammo,2);assert.ok(partial.bullets[0].radius>7);
    await p.evaluate(()=>gameTest.ascFixture());await p.evaluate(()=>gameTest.ascHold(11.9));assert.equal((await p.evaluate(()=>gameTest.ascState())).bullets.length,0);
    const full=await p.evaluate(()=>gameTest.ascHold(.15));assert.equal(full.bullets.length,1);assert.equal(full.bullets[0].global,true);assert.equal(full.exhaustion,10);assert.ok(full.bullets[0].damage>partial.bullets[0].damage*3);assert.ok(full.bullets[0].radius>35);assert.ok(full.reload>4);
    const latched=await p.evaluate(()=>gameTest.ascHold(1));assert.equal(latched.bullets.length,1);assert.equal(latched.ammo,2);
    assert.ok(await p.evaluate(()=>gameTest.ascGlobalDamage())>0);
    await p.evaluate(()=>gameTest.ascRelease());const recovered=await p.evaluate(()=>gameTest.ascTick(10.1));assert.equal(recovered.exhaustion,0);assert.equal(recovered.reload,2.8);
    const normalMove=await p.evaluate(()=>gameTest.ascMotion(false)),slowMove=await p.evaluate(()=>gameTest.ascMotion(true));assert.ok(slowMove<normalMove*.7&&slowMove>normalMove*.6);
    await p.evaluate(()=>gameTest.ascFixture());await p.evaluate(()=>gameTest.ascHold(5));const cancelled=await p.evaluate(()=>gameTest.ascResetInput());assert.equal(cancelled.charge,0);assert.equal(cancelled.bullets.length,0);assert.equal(cancelled.exhaustion,0);
    const real=await p.evaluate(()=>gameTest.ascActualInput());assert.equal(real.held.bullets.length,0);assert.equal(real.released.bullets.length,1);assert.equal(real.released.exhaustion,0);
    const upgrades=await p.evaluate(()=>gameTest.ascUpgrades());assert.ok(Math.abs(upgrades.radius-8.1)<.001);assert.ok(Math.abs(upgrades.life-4.2)<.001);assert.equal(upgrades.damage,180);
    for(const kind of ['pause','blur','death','switch','reward','newRun']){const state=await p.evaluate(k=>gameTest.ascCancelCase(k),kind);assert.equal(state.charge,0,kind);assert.equal(state.bullets.length,0,kind);assert.equal(state.exhaustion,0,kind);}
    for(const level of [1,5])for(const seconds of [6,12]){
      await p.evaluate(n=>{gameTest.ascFixture();gameTest.ascSpread(n);},level);
      await p.evaluate(t=>gameTest.ascHold(t),seconds);
      const state=await p.evaluate(()=>gameTest.ascRelease());
      assert.equal(state.bullets.length,1+level);
      assert.equal(state.ammo,2);
      assert.equal(state.exhaustion,seconds===12?10:0);
      assert.ok(state.bullets.every(b=>b.global===(seconds===12)));
      assert.ok(state.bullets.slice(1).every(b=>Math.abs(b.damage/state.bullets[0].damage-.45)<.02));
    }
    for(const visual of [false,true]){
      const state=await p.evaluate(v=>gameTest.ascCenterTest(v),visual);
      assert.ok(state.transit.x>0&&state.transit.x<12);
      assert.equal(state.transit.enemyX,-12);assert.equal(state.transit.life,5);
      assert.equal(state.x,0);assert.equal(state.z,0);assert.ok(state.active);
      assert.ok(state.life>2);
      if(visual)assert.equal(state.enemyX,-12);else assert.ok(Math.abs(state.enemyX)<.1);
    }
    console.log('PASS center travel through walls, deferred lifetime/pull, boss attraction through walls, replica authority');
    console.log('PASS charged spread at levels 1/5, partial/full, single ammo and fatigue');
    console.log('PASS partial/full charge, global damage, no repeat, recovery, movement, cancellation, real update and capped upgrades');
    await p.evaluate(()=>gameTest.ascCardPreview());await p.screenshot({path:'test-results/divine-cards.png',animations:'disabled'});
    await p.evaluate(()=>gameTest.ascHudPreview());await p.screenshot({path:'test-results/divine-charge.png',animations:'disabled'});
    await p.reload();const c2=await browser.newContext();await instrument(c2,hooks);const guest=await c2.newPage();guest.on('pageerror',e=>errors.push(e.message));
    await startCoop(p,guest);for(const page of [p,guest])await page.evaluate(()=>gameTest.ascNetPrepare());
    await guest.evaluate(()=>gameTest.ascNetFire());await p.waitForFunction(()=>gameTest.ascNetState().length===1);
    const hostShot=(await p.evaluate(()=>gameTest.ascNetState()))[0];assert.equal(hostShot.global,true);assert.equal(hostShot.damage,1000);assert.equal(hostShot.life,5.6);assert.equal(hostShot.visual,false);
    await p.evaluate(()=>gameTest.ascNetFire());await guest.waitForFunction(()=>gameTest.ascNetState().length===1);
    const replica=(await guest.evaluate(()=>gameTest.ascNetState()))[0];assert.equal(replica.global,true);assert.equal(replica.visual,true);
    assert.deepEqual(errors,[]);console.log('PASS host/guest divine replication; no browser errors');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

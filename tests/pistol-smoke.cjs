const assert=require('node:assert/strict');
const {launch,instrument,startCoop}=require('./browser-harness.cjs');
const hooks=`
gameTest.pistolFixture=()=>{
 initGame();hideGunSelect();hideMeleeSelect();gState='playing';nbPaused=true;mp.soloMode=true;mp.isHost=true;
 obstacleBoxes.length=0;for(const e of enemies)e.dead=true;
 player.gun='pistol';player.pos.set(-10,0,-10);player.invincible=1000;mouse.down=false;
 for(const b of bulletPool)if(b.active)releaseBullet(b);pistolPrecision.reset();
};
gameTest.pistolCards=()=>{
 gameTest.pistolFixture(); const ids=['pistolRicochet','pistolPrecision','pistolLastWord'];
 const eligible=ids.every(skillEligible);for(const id of ids)for(let i=0;i<6;i++)applySkill(id);
 const picks=ids.map(id=>skillPickLevel(id));player.gun='shotgun';const excluded=ids.every(id=>!skillEligible(id));
 return {eligible,picks,excluded};
};
gameTest.pistolShot=(last=false,style='pistol',extra=false)=>{
 const b=fireBullet({x:0,z:0},new THREE.Vector3(1,0,0),true,100,0,false,null,mp.myId,style,{pistolShot:true,pistolPrimary:!extra,pistolLast:last});
 return {dmg:b.dmg,pierce:b.pierce,bounces:b.bounceLeft,tracked:!!b.pistolShot};
};
gameTest.pistolCombat=()=>{
 gameTest.pistolFixture();applySkill('pistolPrecision');
 waveSpawned=true;waveClear=false;waveTransition=false;_waveSpawnQueue.length=0;
 spawnEnemy('tank',2,0);const e=enemies[enemies.length-1];e.hp=e.maxHp=10000;e.spd=0;e.spawnAnim=0;
 const b=fireBullet({x:1.7,z:0},new THREE.Vector3(1,0,0),true,100,0,false,null,mp.myId,'pistol',{pistolShot:true,pistolPrimary:true});b.spd=0;
 update(.016);const first={hp:e.hp,streak:pistolPrecision.streak(mp.myId)};
 const next=gameTest.pistolShot();const miss=bulletPool.find(b=>b.active&&b.pistolShot);miss.life=.001;update(.016);
 return {first,next,afterMiss:pistolPrecision.streak(mp.myId)};
};
gameTest.pistolLast=()=>{
 gameTest.pistolFixture();applySkill('pistolLastWord');applySkill('pistolRicochet');
 return {normal:gameTest.pistolShot(),last:gameTest.pistolShot(true),bonus:gameTest.pistolShot(true,'pistol',true),other:gameTest.pistolShot(true,'shotgun')};
};
gameTest.pistolTrigger=(infinite=false)=>{
 gameTest.pistolFixture();applySkill('pistolLastWord');applySkill('spread');applySkill('spread');
 if(infinite)applyRelic('infiniteMag');
 waveSpawned=true;waveClear=false;waveTransition=false;_waveSpawnQueue.length=0;
 spawnEnemy('tank',12,12);const e=enemies[enemies.length-1];e.hp=e.maxHp=10000;e.spd=0;
 player.ammo=1;player.fireCd=0;player.reloadT=0;mouse.world.x=12;mouse.world.z=-10;mouse.down=true;
 update(.016);mouse.down=false;
 return {ammo:player.ammo,reloading:player.reloadT>0,shots:bulletPool.filter(b=>b.active&&b.isPlayer).map(b=>({dmg:b.dmg,pierce:b.pierce}))};
};
gameTest.pistolBounce=()=>{
 gameTest.pistolFixture();applySkill('pistolRicochet');
 spawnEnemy('tank',-4,3);const e=enemies[enemies.length-1];
 const b=fireBullet({x:0,z:0},new THREE.Vector3(-1,0,0),true,100,0,false,null,mp.myId,'pistol',{pistolShot:true});
 aimPistolRicochet(b,-1,0);const directed=b.dir.z>0;
 b.dir.set(-1,0,0);obstacleBoxes.push({x:-2,z:1.5,hw:.5,hd:2});aimPistolRicochet(b,-1,0);
 const blocked=b.dir.z===0;releaseBullet(b);
 const next=fireBullet({x:0,z:0},new THREE.Vector3(1,0,0),true,100,0,false,null,mp.myId,'shotgun');
 return {directed,blocked,clean:next.pistolRicochet===0&&!next.pistolShot};
};
gameTest.pistolNetPrepare=()=>{nbPaused=true;update=()=>{};resetGameplayInput();for(const b of bulletPool)if(b.active)releaseBullet(b);player.gun='pistol';for(const id of ['pistolLastWord','pistolRicochet']){delete playerSkills[id];delete playerSkillPicks[id];}};
gameTest.pistolNetShoot=()=>{applySkill('pistolLastWord');applySkill('pistolRicochet');sendFireMP(0,0,1,0,100,0,{pistolShot:true,pistolPrimary:true,pistolLast:true});};
gameTest.pistolNetState=()=>bulletPool.filter(b=>b.active&&b.isPlayer&&b.ownerId!==mp.myId&&b.dmg>=100).map(b=>({dmg:b.dmg,pierce:b.pierce,bounce:b.bounceLeft,owner:b.ownerId,visual:b.visualOnly}));
gameTest.pistolCardsView=()=>{gameTest.pistolFixture();_currentOffering=['pistolRicochet','pistolPrecision','pistolLastWord'];_offeringPicked.clear();showBuffSelect('skill');};
`;
(async()=>{
 const browser=await launch(),errors=[];
 try{
  const context=await browser.newContext();await instrument(context,hooks);const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:3000');await page.waitForFunction(()=>!!window.gameTest);
  assert.deepEqual(await page.evaluate(()=>gameTest.pistolCards()),{eligible:true,picks:[4,3,3],excluded:true});
  const combat=await page.evaluate(()=>gameTest.pistolCombat());assert.ok(combat.first.hp<10000);assert.equal(combat.first.streak,1);assert.equal(combat.next.dmg,104);assert.equal(combat.afterMiss,0);
  const shots=await page.evaluate(()=>gameTest.pistolLast());assert.equal(shots.normal.dmg,100);assert.equal(shots.last.dmg,160);assert.equal(shots.last.pierce,1);assert.equal(shots.bonus.dmg,160);assert.equal(shots.other.dmg,100);assert.equal(shots.other.bounces,0);
  const last=await page.evaluate(()=>gameTest.pistolTrigger());assert.equal(last.ammo,0);assert.equal(last.reloading,true);assert.equal(last.shots.length,3);assert.ok(last.shots.every(b=>b.pierce===1));
  const infinite=await page.evaluate(()=>gameTest.pistolTrigger(true));assert.equal(infinite.ammo,1);assert.equal(infinite.reloading,false);assert.equal(infinite.shots.length,3);assert.ok(infinite.shots.every(b=>b.pierce===0));assert.ok(last.shots[0].dmg>infinite.shots[0].dmg);
  assert.deepEqual(await page.evaluate(()=>gameTest.pistolBounce()),{directed:true,blocked:true,clean:true});
  await page.evaluate(()=>gameTest.pistolCardsView());await page.locator('#buffCards .buff-card').first().waitFor({state:'visible'});await page.waitForTimeout(2200);await page.screenshot({path:'test-results/pistol-cards.png'});
  await context.close();const hostContext=await browser.newContext(),context2=await browser.newContext();await instrument(hostContext,hooks);await instrument(context2,hooks);
  const host=await hostContext.newPage(),guest=await context2.newPage();for(const p of [host,guest])p.on('pageerror',e=>errors.push(e.message));
  await startCoop(host,guest);for(const p of [host,guest])await p.evaluate(()=>gameTest.pistolNetPrepare());
  await guest.evaluate(()=>gameTest.pistolNetShoot());await host.waitForFunction(()=>gameTest.pistolNetState().length===1);
  const remote=(await host.evaluate(()=>gameTest.pistolNetState()))[0];assert.equal(remote.dmg,160);assert.equal(remote.pierce,1);assert.equal(remote.bounce,1);assert.equal(remote.visual,false);
  assert.deepEqual(errors,[]);console.log('PASS pistol exclusive cards, caps, real hit/miss, last round, spread bonus, ricochet walls, pool reuse and guest-to-host modifiers');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

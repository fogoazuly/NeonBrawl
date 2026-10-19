const assert=require('node:assert/strict');
const {launch,instrument,startCoop}=require('./browser-harness.cjs');
const hooks=`
const shotgunTestUpdate=update;
gameTest.shotgunFixture=()=>{
 initGame();hideGunSelect();hideMeleeSelect();gState='playing';nbPaused=true;mp.soloMode=true;mp.isHost=true;
 obstacleBoxes.length=0;for(const e of enemies)e.dead=true;for(const b of bulletPool)if(b.active)releaseBullet(b);
 player.gun='shotgun';player.ammo=currentMagSize();player.pos.set(-10,0,-10);player.invincible=1000;mouse.down=false;
 waveSpawned=true;waveClear=false;waveTransition=false;_waveSpawnQueue.length=0;
 spawnEnemy('tank',2,0);const e=enemies[enemies.length-1];e.hp=e.maxHp=10000;e.spd=0;e.spawnAnim=0;e.stuckCheck=100;return e;
};
gameTest.shotgunCards=()=>{
 gameTest.shotgunFixture();const ids=['shotgunImpact','shotgunRain','shotgunFocus'];const eligible=ids.every(skillEligible);
 for(const id of ids)for(let n=0;n<6;n++)applySkill(id);
 const picks=ids.map(skillPickLevel);player.gun='pistol';return {eligible,picks,excluded:ids.every(id=>!skillEligible(id))};
};
gameTest.shotgunTrigger=(rain=0,spread=0)=>{
 gameTest.shotgunFixture();for(let n=0;n<rain;n++)applySkill('shotgunRain');for(let n=0;n<spread;n++)applySkill('spread');
 player.fireCd=0;player.reloadT=0;mouse.world.x=12;mouse.world.z=-10;mouse.down=true;update(.016);mouse.down=false;
 const shots=bulletPool.filter(b=>b.active&&b.isPlayer),group=shots[0].shotgunSalvo;
 const result={count:shots.length,shared:shots.every(b=>b.shotgunSalvo===group),delayed:shots.filter(b=>b.delay>0).length,ammo:player.ammo,groups:shotgunSalvos.groups.size};
 for(const b of shots)releaseBullet(b);result.cleaned=shotgunSalvos.groups.size===0;return result;
};
gameTest.shotgunHit=(impact=false,far=false,wall=false)=>{
 const e=gameTest.shotgunFixture();applySkill('shotgunFocus');if(impact)applySkill('shotgunImpact');
 if(wall)obstacleBoxes.push({x:2+e.cfg.r+.15,z:0,hw:.1,hd:3});
 for(let n=0;n<2;n++){
  const b=fireBullet({x:1.7,z:0},new THREE.Vector3(1,0,0),true,100,0,false,null,mp.myId,'shotgun',{shotgunSalvo:'test'});b.spd=0;if(far)b.fallOX=-8;
 }
 update(.016);return {damage:10000-e.hp,x:e.pos.x,stagger:e.stagger,groups:shotgunSalvos.groups.size};
};
gameTest.shotgunView=()=>{gameTest.shotgunFixture();_currentOffering=['shotgunImpact','shotgunRain','shotgunFocus'];_offeringPicked.clear();showBuffSelect('skill');};
gameTest.shotgunNetPrepare=()=>{
 nbPaused=true;update=()=>{};resetGameplayInput();for(const b of bulletPool)if(b.active)releaseBullet(b);shotgunSalvos.reset();
 player.gun='shotgun';for(const id of ['shotgunFocus','shotgunImpact']){delete playerSkills[id];delete playerSkillPicks[id];}
};
gameTest.shotgunNetShoot=()=>{applySkill('shotgunFocus');applySkill('shotgunImpact');for(let n=0;n<2;n++)sendFireMP(1.7,0,1,0,100,0,{shotgunSalvo:'guest-blast'});};
gameTest.shotgunNetState=()=>bulletPool.filter(b=>b.active&&b.ownerId!==mp.myId&&b.isPlayer).map(b=>({focus:b.ownerPerm.shotgunFocus,impact:b.ownerPerm.shotgunImpact,falloff:b.falloffEnd,refs:b.shotgunSalvo?.refs}));
gameTest.shotgunNetHit=()=>{
 obstacleBoxes.length=0;for(const e of enemies)e.dead=true;
 spawnEnemy('tank',2,0);const e=enemies[enemies.length-1];e.hp=e.maxHp=10000;e.spd=0;e.spawnAnim=0;e.stuckCheck=100;
 for(const b of bulletPool)if(b.active)b.spd=0;
 shotgunTestUpdate(.016);return {damage:10000-e.hp,x:e.pos.x};
};
`;
(async()=>{
 const browser=await launch(),errors=[];
 try{
  const context=await browser.newContext();await instrument(context,hooks);const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:3000');await page.waitForFunction(()=>!!window.gameTest);
  assert.deepEqual(await page.evaluate(()=>gameTest.shotgunCards()),{eligible:true,picks:[3,4,3],excluded:true});
  assert.deepEqual(await page.evaluate(()=>gameTest.shotgunTrigger()),{count:12,shared:true,delayed:6,ammo:7,groups:1,cleaned:true});
  const rain=await page.evaluate(()=>gameTest.shotgunTrigger(4,2));assert.equal(rain.count,22);assert.equal(rain.delayed,10);assert.equal(rain.shared,true);assert.equal(rain.cleaned,true);
  const focus=await page.evaluate(()=>gameTest.shotgunHit());assert.equal(focus.damage,204);assert.equal(focus.groups,0);
  const impact=await page.evaluate(()=>gameTest.shotgunHit(true));assert.ok(impact.x>2);assert.ok(impact.x<=2.46);assert.ok(impact.stagger>=.1);
  const far=await page.evaluate(()=>gameTest.shotgunHit(true,true));assert.equal(far.x,2);assert.ok(far.damage<focus.damage);
  const wall=await page.evaluate(()=>gameTest.shotgunHit(true,false,true));assert.ok(wall.x<=2.06);
  await page.evaluate(()=>gameTest.shotgunView());await page.waitForTimeout(2200);await page.screenshot({path:'test-results/shotgun-cards.png'});await context.close();
  const hc=await browser.newContext(),gc=await browser.newContext();await instrument(hc,hooks);await instrument(gc,hooks);const host=await hc.newPage(),guest=await gc.newPage();
  for(const p of [host,guest])p.on('pageerror',e=>errors.push(e.message));await startCoop(host,guest);for(const p of [host,guest])await p.evaluate(()=>gameTest.shotgunNetPrepare());
  await guest.evaluate(()=>gameTest.shotgunNetShoot());await host.waitForFunction(()=>gameTest.shotgunNetState().length===2);
  assert.ok((await host.evaluate(()=>gameTest.shotgunNetState())).every(b=>b.focus===1&&b.impact===1&&b.falloff===9&&b.refs===2));
  const remote=await host.evaluate(()=>gameTest.shotgunNetHit());assert.ok(remote.damage>=100);assert.ok(remote.x>2);
  assert.deepEqual(errors,[]);console.log('PASS shotgun cards/caps, pellet fan, spread, damage stacking, close control, wall safety, pool cleanup and co-op');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

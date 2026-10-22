const assert=require('node:assert/strict');
const {launch,instrument,startCoop}=require('./browser-harness.cjs');
const hooks=`
gameTest.fixture=()=>{
 initGame();hideGunSelect();hideMeleeSelect();gState='playing';nbPaused=true;mp.soloMode=true;mp.isHost=true;
 obstacleBoxes.length=0;for(const e of enemies)e.dead=true;for(const b of bulletPool)if(b.active)releaseBullet(b);
 player.gun='grenade';player.ammo=currentMagSize();player.pos.set(-10,0,-10);player.invincible=1000;mouse.down=false;
 waveSpawned=false;waveClear=false;waveTransition=false;_waveSpawnQueue.length=0;
};
gameTest.cards=()=>{gameTest.fixture();const ids=['grenadeRadius','grenadeCore','grenadePrimer'];const eligible=ids.every(skillEligible);for(const id of ids)for(let i=0;i<6;i++)applySkill(id);const picks=ids.map(skillPickLevel);player.gun='rpg';return {eligible,picks,excluded:ids.every(id=>!skillEligible(id))};};
gameTest.shoot=(reload=false)=>{
 gameTest.fixture();for(let i=0;i<3;i++)applySkill('grenadePrimer');for(let i=0;i<4;i++)applySkill('grenadeRadius');playerSkills.spread=5;
 if(reload){player.ammo=0;player.reloadT=.001;update(.016);}
 player.fireCd=0;player.reloadT=0;mouse.world.set(0,0,-10);mouse.down=true;update(.016);mouse.down=false;
 const shots=bulletPool.filter(b=>b.active&&b.isPlayer);for(const b of shots)armPlayerGrenade(b);
 return {damage:shots.map(b=>b.dmg),radius:shots.map(b=>b.explodeR),fuse:shots.map(b=>b.grenadeGroundT),ready:grenadePrimer.ready};
};
gameTest.explosion=(core=0,distance=0,style='grenade')=>{
 gameTest.fixture();for(let i=0;i<core;i++)applySkill('grenadeCore');spawnEnemy('chaser',distance,0);const e=enemies[enemies.length-1];e.hp=e.maxHp=10000;e.spd=0;e.spawnAnim=0;
 const b=fireBullet({x:0,z:0},new THREE.Vector3(1,0,0),true,100,0,false,null,mp.myId,style);explodePlayerBullet(b);return 10000-e.hp;
};
gameTest.physics=()=>{
 gameTest.fixture();const b=fireBullet({x:-1,z:0},new THREE.Vector3(1,0,0),true,100,0,false,null,mp.myId,'grenade',{grenadeQuick:true});
 obstacleBoxes.push({x:0,z:0,hw:.2,hd:3});for(let i=0;i<4;i++)update(.016);const bounced=b.dir.x<0&&b.pos.x<0;
 armPlayerGrenade(b);update(.49);const before=b.active;update(.02);return {bounced,before,after:b.active};
};
gameTest.view=()=>{gameTest.fixture();_currentOffering=['grenadeRadius','grenadeCore','grenadePrimer'];_offeringPicked.clear();showBuffSelect('skill');};
gameTest.netPrepare=()=>{nbPaused=true;update=()=>{};resetGameplayInput();for(const b of bulletPool)if(b.active)releaseBullet(b);player.gun='grenade';};
gameTest.netShoot=()=>{for(let i=0;i<4;i++)applySkill('grenadeRadius');for(let i=0;i<3;i++)applySkill('grenadeCore');sendFireMP(0,0,1,0,100,0,{grenadeTravel:4,grenadeQuick:true});};
gameTest.netState=()=>bulletPool.filter(b=>b.active&&b.ownerId!==mp.myId&&b.isPlayer).map(b=>({radius:b.explodeR,core:b.ownerPerm.grenadeCore,quick:b.grenadeQuick,travel:b.maxRange}));
gameTest.netHit=()=>{obstacleBoxes.length=0;for(const e of enemies)e.dead=true;spawnEnemy('chaser',0,0);const e=enemies[enemies.length-1];e.hp=e.maxHp=10000;const b=bulletPool.find(b=>b.active&&b.ownerId!==mp.myId&&b.isPlayer);armPlayerGrenade(b);explodePlayerBullet(b);return {damage:10000-e.hp,fuse:b.grenadeGroundT};};
`;
(async()=>{const browser=await launch(),errors=[];try{
 const c=await browser.newContext();await instrument(c,hooks);const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:3000');await p.waitForFunction(()=>!!window.gameTest);
 assert.deepEqual(await p.evaluate(()=>gameTest.cards()),{eligible:true,picks:[4,3,3],excluded:true});
 const base=await p.evaluate(()=>gameTest.shoot()),boost=await p.evaluate(()=>gameTest.shoot(true));assert.equal(boost.damage.length,6);assert.equal(boost.ready,false);assert.ok(boost.damage.every((d,i)=>Math.abs(d-base.damage[i]*1.55)<=1));assert.ok(boost.radius.every(r=>Math.abs(r-2.65*1.45)<1e-8));assert.ok(boost.fuse.every(t=>t===.5));assert.ok(base.fuse.every(t=>t===1));
 const normal=await p.evaluate(()=>gameTest.explosion()),core=await p.evaluate(()=>gameTest.explosion(3));assert.ok(Math.abs(core-normal*1.7)<=1);assert.equal(await p.evaluate(()=>gameTest.explosion(3,2)),await p.evaluate(()=>gameTest.explosion(0,2)));assert.equal(await p.evaluate(()=>gameTest.explosion(3,0,'rpg')),await p.evaluate(()=>gameTest.explosion(0,0,'rpg')));
 assert.deepEqual(await p.evaluate(()=>gameTest.physics()),{bounced:true,before:true,after:false});
 await p.evaluate(()=>gameTest.view());await p.waitForTimeout(1500);await p.screenshot({path:'test-results/grenade-cards.png'});await c.close();
 const hc=await browser.newContext(),gc=await browser.newContext();await instrument(hc,hooks);await instrument(gc,hooks);const host=await hc.newPage(),guest=await gc.newPage();for(const p of [host,guest])p.on('pageerror',e=>errors.push(e.message));await startCoop(host,guest);for(const p of [host,guest])await p.evaluate(()=>gameTest.netPrepare());await guest.evaluate(()=>gameTest.netShoot());await host.waitForFunction(()=>gameTest.netState().length===1);
 const remote=(await host.evaluate(()=>gameTest.netState()))[0];assert.ok(Math.abs(remote.radius-2.65*1.45)<1e-8);assert.equal(remote.core,3);assert.equal(remote.quick,true);assert.equal(remote.travel,4);assert.deepEqual(await host.evaluate(()=>gameTest.netHit()),{damage:core,fuse:.5});
 assert.deepEqual(errors,[]);console.log('PASS grenade cards/caps, radius, core damage, RPG isolation, reload/extra fuses and guest explosion.');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});


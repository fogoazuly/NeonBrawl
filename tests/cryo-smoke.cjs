const assert=require('node:assert/strict');
const {launch,instrument,startCoop}=require('./browser-harness.cjs');
const hooks=`
gameTest.fixture=()=>{
 initGame();hideGunSelect();hideMeleeSelect();gState='playing';nbPaused=true;mp.soloMode=true;mp.isHost=true;
 obstacleBoxes.length=0;for(const e of enemies)e.dead=true;for(const b of bulletPool)if(b.active)releaseBullet(b);
 player.gun='cryo';player.ammo=currentMagSize();player.pos.set(-10,0,-10);player.invincible=1000;mouse.down=false;
 waveSpawned=false;waveClear=false;waveTransition=false;_waveSpawnQueue.length=0;
};
gameTest.cards=()=>{gameTest.fixture();const ids=['cryoReach','cryoLingering','cryoBrittle'];const eligible=ids.every(skillEligible);for(const id of ids)for(let i=0;i<6;i++)applySkill(id);const picks=ids.map(skillPickLevel);player.gun='flamethrower';return {eligible,picks,excluded:ids.every(id=>!skillEligible(id))};};
gameTest.target=(x=3,z=0)=>{spawnEnemy('chaser',x,z);const e=enemies[enemies.length-1];e.hp=e.maxHp=10000;e.spd=0;e.spawnAnim=0;e.stuckCheck=100;return e;};
gameTest.fire=(cards=false,distance=3,wall=false,spread=0)=>{
 gameTest.fixture();if(cards)for(const id of ['cryoReach','cryoLingering','cryoBrittle'])for(let i=0;i<4;i++)applySkill(id);
 playerSkills.spread=spread;const e=gameTest.target(distance);if(wall)obstacleBoxes.push({x:1.5,z:0,hw:.3,hd:3});
 const shot=()=>applySpecialGunFire(GUNS.cryo,0,0,1,0,100,mp.myId,false,false);
 shot();const first=10000-e.hp,slow=slowMap.get(e.poolIdx)||0;shot();return {first,second:10000-e.hp-first,slow};
};
gameTest.wide=spread=>{gameTest.fixture();for(let i=0;i<3;i++)applySkill('cryoBrittle');playerSkills.spread=spread;const e=gameTest.target(4,2.5);slowMap.set(e.poolIdx,1);applySpecialGunFire(GUNS.cryo,0,0,1,0,100,mp.myId,false,false);return 10000-e.hp;};
gameTest.expiry=()=>{gameTest.fixture();for(let i=0;i<3;i++)applySkill('cryoLingering');const e=gameTest.target();applySpecialGunFire(GUNS.cryo,0,0,1,0,10,mp.myId,false,false);for(let i=0;i<100;i++)update(.016);return slowMap.get(e.poolIdx)||0;};
gameTest.divine=(boss=false,wall=false)=>{
 gameTest.fixture();const eligible=skillEligible('cryoAscension');applySkill('cryoAscension');applySkill('cryoAscension');for(let i=0;i<3;i++)applySkill('cryoBrittle');
 const e=gameTest.target();if(boss)e.type='boss';slowMap.set(e.poolIdx,.1);if(wall)obstacleBoxes.push({x:1.5,z:0,hw:.3,hd:3});
 applySpecialGunFire(GUNS.cryo,0,0,1,0,100,mp.myId,false,false,null,{absoluteZero:true});
 return {eligible,picks:skillPickLevel('cryoAscension'),damage:10000-e.hp,slow:slowMap.get(e.poolIdx),stagger:e.stagger||0,charge:absoluteZeroCharge.hits};
};
gameTest.charging=()=>{
 gameTest.fixture();applySkill('cryoAscension');const targets=[gameTest.target(2),gameTest.target(3)];
 applySpecialGunFire(GUNS.cryo,0,0,1,0,10,mp.myId,false,false);const first=absoluteZeroCharge.hits;
 applySpecialGunFire(GUNS.cryo,0,0,1,0,10,mp.myId,false,false);return {first,second:absoluteZeroCharge.hits};
};
gameTest.trigger=()=>{
 gameTest.fixture();applySkill('cryoAscension');for(let i=0;i<30;i++)absoluteZeroCharge.hit();
 player.pos.set(0,0,0);const e=gameTest.target(3);player.reloadT=0;player.fireCd=0;mouse.world.set(8,0,0);mouse.down=true;update(.016);mouse.down=false;
 const result={charge:absoluteZeroCharge.hits,damage:10000-e.hp};for(let i=0;i<30;i++)absoluteZeroCharge.hit();updateAbsoluteZeroHud();return result;
};
gameTest.charge=()=>absoluteZeroCharge.hits;
gameTest.view=()=>{gameTest.fixture();_currentOffering=['cryoReach','cryoLingering','cryoBrittle'];_offeringPicked.clear();showBuffSelect('skill');};
gameTest.netPrepare=()=>{for(const k of Object.keys(playerSkills))delete playerSkills[k];for(const k of Object.keys(playerSkillPicks))delete playerSkillPicks[k];nbPaused=true;update=()=>{};resetGameplayInput();for(const e of enemies)e.dead=true;obstacleBoxes.length=0;player.gun='cryo';};
gameTest.netTarget=()=>{const e=gameTest.target(7);slowMap.set(e.poolIdx,1);};
gameTest.netShoot=(absolute=false)=>{applySkill('cryoAscension');for(const id of ['cryoReach','cryoLingering','cryoBrittle'])for(let i=0;i<4;i++)applySkill(id);sendSpecialGunMP(GUNS.cryo,0,0,1,0,100,{absoluteZero:absolute});};
gameTest.netState=()=>{const e=enemies.find(e=>!e.dead);return {damage:10000-e.hp,slow:slowMap.get(e.poolIdx)};};
`;
(async()=>{const browser=await launch(),errors=[];try{
 const c=await browser.newContext();await instrument(c,hooks);const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:3000');await p.waitForFunction(()=>!!window.gameTest);
 assert.deepEqual(await p.evaluate(()=>gameTest.cards()),{eligible:true,picks:[4,3,3],excluded:true});
 const normal=await p.evaluate(()=>gameTest.fire()),boost=await p.evaluate(()=>gameTest.fire(true));assert.equal(boost.first,normal.first);assert.equal(boost.second,150);assert.equal(boost.slow,1.4);assert.equal(normal.slow,.48);
 assert.equal((await p.evaluate(()=>gameTest.fire(false,7))).first,0);assert.equal((await p.evaluate(()=>gameTest.fire(true,7))).first,100);assert.equal((await p.evaluate(()=>gameTest.fire(true,3,true))).first,0);
 assert.equal(await p.evaluate(()=>gameTest.wide(0)),0);assert.equal(await p.evaluate(()=>gameTest.wide(5)),150);assert.equal(await p.evaluate(()=>gameTest.expiry()),0);
 assert.deepEqual(await p.evaluate(()=>gameTest.charging()),{first:0,second:1});
 const divine=await p.evaluate(()=>gameTest.divine());assert.equal(divine.eligible,true);assert.equal(divine.picks,1);assert.equal(divine.damage,600);assert.equal(divine.slow,3);assert.equal(divine.stagger,.8);assert.equal(divine.charge,0);
 const boss=await p.evaluate(()=>gameTest.divine(true));assert.ok(Math.abs(boss.stagger-.36)<1e-8);assert.ok(Math.abs(boss.slow-1.35)<1e-8);
 const blocked=await p.evaluate(()=>gameTest.divine(false,true));assert.equal(blocked.damage,0);assert.equal(blocked.stagger,0);
 const trigger=await p.evaluate(()=>gameTest.trigger());assert.equal(trigger.charge,0);assert.equal(trigger.damage,32);await p.screenshot({path:'test-results/cryo-absolute-zero.png'});
 await p.evaluate(()=>gameTest.view());await p.waitForTimeout(1500);await p.screenshot({path:'test-results/cryo-cards.png'});await c.close();
 const hc=await browser.newContext(),gc=await browser.newContext();await instrument(hc,hooks);await instrument(gc,hooks);const host=await hc.newPage(),guest=await gc.newPage();for(const p of [host,guest])p.on('pageerror',e=>errors.push(e.message));await startCoop(host,guest);for(const p of [host,guest])await p.evaluate(()=>gameTest.netPrepare());await host.evaluate(()=>gameTest.netTarget());await guest.evaluate(()=>gameTest.netShoot());await host.waitForFunction(()=>gameTest.netState().damage>0);assert.deepEqual(await host.evaluate(()=>gameTest.netState()),{damage:150,slow:1.4});await guest.waitForFunction(()=>gameTest.charge()===1);assert.equal(await host.evaluate(()=>gameTest.charge()),0);await guest.evaluate(()=>gameTest.netShoot(true));await host.waitForFunction(()=>gameTest.netState().damage===750);assert.equal((await host.evaluate(()=>gameTest.netState())).slow,3);assert.equal(await guest.evaluate(()=>gameTest.charge()),1);
 assert.deepEqual(errors,[]);console.log('PASS cryo cards/caps, first-hit ordering, range, walls, wide cone synergy, slow expiry and guest modifiers.');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

const assert=require('node:assert/strict');
const {launch,instrument,startCoop}=require('./browser-harness.cjs');
const hooks=`
const burstTestUpdate=update;
gameTest.fixture=()=>{
 initGame();hideGunSelect();hideMeleeSelect();gState='playing';nbPaused=true;mp.soloMode=true;mp.isHost=true;
 obstacleBoxes.length=0;for(const e of enemies)e.dead=true;for(const b of bulletPool)if(b.active)releaseBullet(b);
 player.gun='burst';player.ammo=currentMagSize();player.pos.set(-10,0,-10);player.invincible=1000;mouse.down=false;
 waveSpawned=true;waveClear=false;waveTransition=false;_waveSpawnQueue.length=0;
};
gameTest.cards=()=>{gameTest.fixture();const ids=['burstControl','burstConvergence','burstOpening'];const eligible=ids.every(skillEligible);for(const id of ids)for(let i=0;i<6;i++)applySkill(id);const picks=ids.map(skillPickLevel);player.gun='pistol';return {eligible,picks,excluded:ids.every(id=>!skillEligible(id))};};
gameTest.shoot=(reload=false)=>{
 gameTest.fixture();for(let i=0;i<3;i++)applySkill('burstOpening');playerSkills.spread=5;
 if(reload){player.ammo=0;player.reloadT=.001;update(.016);}
 player.fireCd=0;player.reloadT=0;mouse.world.set(12,0,-10);mouse.down=true;update(.016);mouse.down=false;
 const shots=bulletPool.filter(b=>b.active&&b.isPlayer);const result={damage:shots.map(b=>b.dmg),primary:shots.filter(b=>b.burstSalvo).length,ready:burstOpening.ready,ammo:player.ammo};
 for(const b of shots)releaseBullet(b);result.cleaned=burstSalvos.groups.size===0;return result;
};
gameTest.hit=(divine=false,empowered=false)=>{
 gameTest.fixture();applySkill('burstConvergence');if(divine)applySkill('burstAscension');spawnEnemy('chaser',2,0);const e=enemies[enemies.length-1];e.hp=e.maxHp=10000;e.spd=0;e.spawnAnim=0;e.stuckCheck=100;
 for(let i=0;i<3;i++){const b=fireBullet({x:1.7,z:0},new THREE.Vector3(1,0,0),true,100,0,false,null,mp.myId,'burst',{burstSalvo:'test',burstIndex:i,triad:empowered});b.spd=0;}
 update(.016);return {damage:10000-e.hp,groups:burstSalvos.groups.size,charge:celestialTriad.hits};
};
gameTest.triadShot=()=>{
 gameTest.fixture();const eligible=skillEligible('burstAscension');applySkill('burstAscension');applySkill('burstAscension');
 for(let i=0;i<6;i++)celestialTriad.hit();playerSkills.spread=5;player.fireCd=0;player.reloadT=0;mouse.world.set(12,0,-10);mouse.down=true;update(.016);mouse.down=false;
 const shots=bulletPool.filter(b=>b.active&&b.isPlayer);const result={eligible,picks:skillPickLevel('burstAscension'),rarity:SKILL_RARITY.burstAscension,damage:shots.map(b=>b.dmg),pierce:shots.map(b=>b.pierce),charging:shots.some(b=>b.triadCharging),charge:celestialTriad.hits};
 for(let i=0;i<6;i++)celestialTriad.hit();updateTriadHud();return result;
};
gameTest.charge=()=>celestialTriad.hits;
gameTest.view=()=>{gameTest.fixture();_currentOffering=['burstControl','burstConvergence','burstOpening'];_offeringPicked.clear();showBuffSelect('skill');};
gameTest.netPrepare=()=>{nbPaused=true;update=()=>{};resetGameplayInput();for(const b of bulletPool)if(b.active)releaseBullet(b);burstSalvos.reset();player.gun='burst';};
gameTest.netShoot=()=>{applySkill('burstConvergence');applySkill('burstAscension');for(let i=0;i<3;i++)sendFireMP(1.7,0,1,0,100,0,{burstSalvo:'guest-burst',burstIndex:i});};
gameTest.netState=()=>bulletPool.filter(b=>b.active&&b.ownerId!==mp.myId&&b.isPlayer).map(b=>({rank:b.ownerPerm.burstConvergence,index:b.burstIndex,refs:b.burstSalvo?.refs}));
gameTest.netHit=()=>{obstacleBoxes.length=0;for(const e of enemies)e.dead=true;spawnEnemy('chaser',2,0);const e=enemies[enemies.length-1];e.hp=e.maxHp=10000;e.spd=0;e.spawnAnim=0;e.stuckCheck=100;for(const b of bulletPool)if(b.active)b.spd=0;burstTestUpdate(.016);return 10000-e.hp;};
`;
(async()=>{const browser=await launch(),errors=[];try{
 const c=await browser.newContext();await instrument(c,hooks);const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:3000');await p.waitForFunction(()=>!!window.gameTest);
 assert.deepEqual(await p.evaluate(()=>gameTest.cards()),{eligible:true,picks:[4,3,3],excluded:true});
 const base=await p.evaluate(()=>gameTest.shoot()),boost=await p.evaluate(()=>gameTest.shoot(true));
 assert.equal(base.damage.length,8);assert.equal(boost.primary,3);assert.equal(boost.ready,false);assert.equal(boost.ammo,15);assert.equal(boost.cleaned,true);
 assert.ok(boost.damage.every((d,i)=>Math.abs(d-base.damage[i]*1.55)<=1));
 assert.deepEqual(await p.evaluate(()=>gameTest.hit()),{damage:350,groups:0,charge:0});
 assert.equal((await p.evaluate(()=>gameTest.hit(true))).charge,1);
 assert.equal((await p.evaluate(()=>gameTest.hit(true,true))).charge,0);
 const triad=await p.evaluate(()=>gameTest.triadShot());assert.equal(triad.eligible,true);assert.equal(triad.picks,1);assert.equal(triad.rarity,'divine');assert.equal(triad.charge,0);assert.equal(triad.charging,false);assert.equal(triad.damage.length,8);assert.ok(triad.pierce.every(n=>n===3));assert.ok(triad.damage.every((d,i)=>Math.abs(d-base.damage[i]*3)<=1));
 await p.screenshot({path:'test-results/burst-triad.png'});
 await p.evaluate(()=>gameTest.view());await p.waitForTimeout(1500);await p.screenshot({path:'test-results/burst-cards.png'});await c.close();
 const hc=await browser.newContext(),gc=await browser.newContext();await instrument(hc,hooks);await instrument(gc,hooks);const host=await hc.newPage(),guest=await gc.newPage();for(const p of [host,guest])p.on('pageerror',e=>errors.push(e.message));
 await startCoop(host,guest);for(const p of [host,guest])await p.evaluate(()=>gameTest.netPrepare());await guest.evaluate(()=>gameTest.netShoot());await host.waitForFunction(()=>gameTest.netState().length===3);
 const state=await host.evaluate(()=>gameTest.netState());assert.deepEqual(state.map(b=>b.index),[0,1,2]);assert.ok(state.every(b=>b.rank===1&&b.refs===3));assert.equal(await host.evaluate(()=>gameTest.netHit()),350);await guest.waitForFunction(()=>gameTest.charge()===1);assert.equal(await host.evaluate(()=>gameTest.charge()),0);
 assert.deepEqual(errors,[]);console.log('PASS Burst Rifle: cards, reload damage with extra shots, triple impact, pool cleanup and guest-owned hits.');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});


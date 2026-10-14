const assert=require('node:assert/strict');
const {launch,instrument,startCoop}=require('./browser-harness.cjs');
const hooks=`
gameTest.gravityFixture=()=>{
  initGame();hideGunSelect();hideMeleeSelect();gState='playing';nbPaused=true;
  obstacleBoxes.length=0;for(const e of enemies)e.dead=true;
  for(const b of bulletPool)if(b.active)releaseBullet(b);
  player.pos.set(-8,0,-8);player.invincible=1000;
};
gameTest.gravityProbe=(kind)=>{
  gameTest.gravityFixture();mp.soloMode=true;
  spawnEnemy('tank',2,0);const e=enemies[enemies.length-1];e.hp=e.maxHp=10000;
  if(kind==='boss')e.type='boss';
  if(kind==='wall')obstacleBoxes.push({x:1,z:0,hw:.2,hd:3});
  const b=fireBullet({x:0,z:0},new THREE.Vector3(0,0,1),true,100,0,kind==='replica',null,mp.myId,'gravity');
  b.spd=0;
  if(kind==='guest'){mp.soloMode=false;mp.isHost=false;}
  tickGravityBullet(b,.1);const moved=2-e.pos.x;
  if(kind==='wall')obstacleBoxes.length=0;
  e.pos.set(1,0,0);b.life=.01;tickGravityBullet(b,.02);
  const result={moved,hp:e.hp,active:b.active,ring:b.gravityRing.visible};
  const next=fireBullet({x:0,z:0},new THREE.Vector3(0,0,1),true,10,0,false,null,mp.myId,'pistol');
  result.reused=next===b;result.clean=next.bulletKind==='bullet'&&!next.gravityRing.visible;
  mp.soloMode=true;return result;
};
gameTest.gravityHell=(type,global=false,wall=false)=>{
 gameTest.gravityFixture();mp.soloMode=true;nbDifficulty='hell';waveNum=40;waveSpawned=true;waveClear=false;waveTransition=false;_waveSpawnQueue.length=0;
 player.pos.set(12,0,0);player.hp=player.maxHp=10000;player.gun='gravity';mouse.down=false;
 spawnEnemy(type,4.4,0);const e=enemies[enemies.length-1];e.hp=10000;e.maxHp=100000;e.spawnAnim=0;e.dashActive=60;e.spd*=2;
 if(global)applySkill('gravityAscension');
 if(wall)obstacleBoxes.push({x:2,z:0,hw:.5,hd:8});
 const b=fireBullet({x:0,z:0},new THREE.Vector3(0,0,1),true,1,0,false,null,mp.myId,'gravity',{gravityCharge:global?1:0});b.spd=0;b.life=60;
 const initial=e.pos.length(),speed=e.spd;
 const history=[];for(let i=0;i<60;i++){update(.02);if(i<6)history.push({x:e.pos.x,z:e.pos.z,source:!!e.gravitySource,fields:activeGravityFields.length,r:b.gravityRadius,active:b.active});}
 const end=e.pos.length(),controlled=!!e.gravitySource;
 releaseBullet(b);update(.02);const released=!e.gravitySource;
 nbDifficulty='hard';return {initial,end,speed,controlled,released,history};
};
gameTest.gravityWall=()=>{
  gameTest.gravityFixture();mp.soloMode=true;
  obstacleBoxes.push({x:0,z:2,hw:3,hd:.3});
  const b=fireBullet({x:0,z:0},new THREE.Vector3(0,0,1),true,100,0,false,null,mp.myId,'gravity');
  tickGravityBullet(b,1);
  return {z:b.pos.z,speed:b.spd,blocked:isBlockedAt(b.pos.x,b.pos.z,b.hitR)};
};
gameTest.gravityNetPrepare=()=>{nbPaused=true;update=()=>{};obstacleBoxes.length=0;for(const b of bulletPool)if(b.active)releaseBullet(b);};
gameTest.gravityNetShoot=()=>{player.gun='gravity';sendFireMP(0,0,0,1,100,0,{gravityTravel:2});};
gameTest.gravityNetState=()=>bulletPool.filter(b=>b.active&&b.bulletKind==='gravity').map(b=>({visual:b.visualOnly,owner:b.ownerId,range:b.maxRange}));
gameTest.unlockGravity=()=>{persistData.guns.gravity=true;};
gameTest.gravityScreenshot=()=>{
  const b=bulletPool.find(b=>b.active&&b.bulletKind==='gravity');if(!b)return false;
  nbPaused=true;return true;
};
`;
(async()=>{
  const browser=await launch(),errors=[];
  try{
    const c=await browser.newContext({viewport:{width:1280,height:800}});await instrument(c,hooks);
    const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:3000');await p.waitForFunction(()=>!!window.gameTest);
    const results={};for(const kind of ['normal','boss','wall','replica','guest'])results[kind]=await p.evaluate(k=>gameTest.gravityProbe(k),kind);
    assert.ok(results.normal.moved>0);assert.ok(results.boss.moved>0&&results.boss.moved<results.normal.moved*.25);
    for(const k of ['wall','replica','guest'])assert.equal(results[k].moved,0);
    for(const k of ['normal','boss','wall'])assert.ok(results[k].hp<10000);
    for(const k of ['replica','guest'])assert.equal(results[k].hp,10000);
    for(const r of Object.values(results)){assert.equal(r.active,false);assert.equal(r.ring,false);assert.ok(r.reused&&r.clean);}
    for(const type of ['speeder','dasher','berserker'])for(const global of [false,true]){
      const r=await p.evaluate(({type,global})=>gameTest.gravityHell(type,global,global),{type,global});
      assert.ok(r.end<r.initial-1,JSON.stringify({type,global,...r}));assert.ok(r.controlled);assert.ok(r.released);
    }
    const shielded=await p.evaluate(()=>gameTest.gravityHell('speeder',false,true));assert.equal(shielded.controlled,false);
    console.log('PASS real Hell wave 40 updates: speeders, dashes, rage, global walls, release and local wall shielding');
    const wall=await p.evaluate(()=>gameTest.gravityWall());assert.ok(wall.z<1.4);assert.equal(wall.speed,0);assert.equal(wall.blocked,false);
    console.log('PASS pull, boss resistance, wall blocking, authority, explosion, pool reuse',JSON.stringify(results));
    await p.reload();await p.evaluate(()=>gameTest.unlockGravity());
    await p.locator('#playBtn').click();await p.locator('#nbDiffGrid button').first().click();
    await p.locator('#gunCards button').filter({hasText:'GRAVITY CANNON'}).click();
    await p.locator('#meleeCards button').first().click({force:true});await p.locator('#buffCards .buff-card').first().waitFor({state:'visible'});await p.locator('#buffCards .buff-card').first().click({force:true});
    await p.waitForFunction(()=>gameTest.state().wave===1);
    await p.mouse.move(640,310);await p.mouse.down();await p.waitForTimeout(750);await p.mouse.up();
    assert.ok(await p.evaluate(()=>gameTest.gravityScreenshot()));
    await p.screenshot({path:'test-results/gravity-cannon.png'});
    await p.reload();
    const c2=await browser.newContext();await instrument(c2,hooks);const guest=await c2.newPage();guest.on('pageerror',e=>errors.push(e.message));
    await startCoop(p,guest);for(const page of [p,guest])await page.evaluate(()=>gameTest.gravityNetPrepare());
    await guest.evaluate(()=>gameTest.gravityNetShoot());await p.waitForFunction(()=>gameTest.gravityNetState().length===1);
    assert.equal((await p.evaluate(()=>gameTest.gravityNetState()))[0].visual,false);
    assert.equal((await p.evaluate(()=>gameTest.gravityNetState()))[0].range,2);
    await p.evaluate(()=>gameTest.gravityNetShoot());await guest.waitForFunction(()=>gameTest.gravityNetState().length===1);
    assert.equal((await guest.evaluate(()=>gameTest.gravityNetState()))[0].visual,true);
    assert.deepEqual(errors,[]);console.log('PASS real host/guest FIRE relay and no browser errors');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

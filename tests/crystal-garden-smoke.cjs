const assert=require('node:assert/strict');
const {launch,instrument,startCoop}=require('./browser-harness.cjs');
const hooks=`
gameTest.gardenMap=()=>changeMapLayout(ARENA_PRESETS.findIndex(p=>p.id==='enc_crystal_garden'));
gameTest.gardenSetup=()=>{
 initGame();hideGunSelect();hideMeleeSelect();gState='playing';nbPaused=true;mp.soloMode=true;mp.isHost=true;
 for(const e of enemies)e.dead=true;for(const b of bulletPool)if(b.active)releaseBullet(b);
 waveSpawned=false;waveClear=false;waveTransition=false;_waveSpawnQueue.length=0;mouse.down=false;
 gameTest.gardenMap();player.pos.set(0,0,0);player.invincible=1000;
 spawnEnemy('tank',10,10);const e=enemies[enemies.length-1];e.spd=0;e.spawnAnim=0;e.stuckCheck=100;
};
gameTest.gardenState=()=>({count:obstacleBoxes.filter(o=>o.crystal).length,blocked:isBlockedAt(-4.5,-5,.4)});
gameTest.gardenPaths=()=>{
 for(let z=-12;z<=12;z+=.25)if(isBlockedAt(0,z,.4))return false;
 const start=nearestWalkableNavIndex(0,0),seen=new Set([start]),queue=[start];
 for(let at=0;at<queue.length;at++){
  const idx=queue[at],gx=idx%GNAV_W,gz=Math.floor(idx/GNAV_W);
  for(const [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1]])if(_navCanStep(gx,gz,dx,dz)){
   const next=_ni(gx+dx,gz+dz);if(!seen.has(next)){seen.add(next);queue.push(next);}
  }
 }
 return seen.size===Array.from(_navBlk).filter(v=>!v).length;
};
gameTest.gardenShoot=()=>{
 const o=obstacleBoxes.find(o=>o.crystal);let disposed=false;
 o.mesh.geometry.addEventListener('dispose',()=>disposed=true);
 fireBullet({x:o.x-o.hw-.1,z:o.z},new THREE.Vector3(1,0,0),true,250,0,false,{},mp.myId,'pistol');
 for(let i=0;i<8;i++)update(.016);
 return {gone:!!o._gone,disposed,blocked:isBlockedAt(o.x,o.z,.4)};
};
gameTest.gardenObjectives=()=>{
 setupMiniObjective(8,'overload');return miniObjective.overload.terminals.every(t=>objectiveSpotIsFree(t.x,t.z));
};
gameTest.gardenNetPrepare=()=>{nbPaused=true;update=()=>{};resetGameplayInput();};
gameTest.gardenNetSend=()=>{gameTest.gardenMap();sendHostState();};
gameTest.gardenNetBreak=()=>{damageObstacle(obstacleBoxes.find(o=>o.crystal),200);};
`;
(async()=>{
 const browser=await launch(),errors=[];
 try{
  const context=await browser.newContext();await instrument(context,hooks);
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:3000');await page.waitForFunction(()=>!!window.gameTest);
  await page.evaluate(()=>gameTest.gardenSetup());
  assert.deepEqual(await page.evaluate(()=>gameTest.gardenState()),{count:6,blocked:true});
  assert.equal(await page.evaluate(()=>gameTest.gardenPaths()),true);
  await page.waitForTimeout(2200);await page.screenshot({path:'test-results/crystal-garden.png'});
  assert.deepEqual(await page.evaluate(()=>gameTest.gardenShoot()),{gone:true,disposed:true,blocked:false});
  assert.equal(await page.evaluate(()=>gameTest.gardenPaths()),true);
  assert.equal(await page.evaluate(()=>gameTest.gardenObjectives()),true);
  await page.evaluate(()=>gameTest.gardenMap());
  assert.equal((await page.evaluate(()=>gameTest.gardenState())).count,6);
  await context.close();
  const hc=await browser.newContext(),gc=await browser.newContext();
  await instrument(hc,hooks);await instrument(gc,hooks);
  const host=await hc.newPage(),guest=await gc.newPage();
  for(const p of [host,guest])p.on('pageerror',e=>errors.push(e.message));
  await startCoop(host,guest);
  for(const p of [host,guest])await p.evaluate(()=>gameTest.gardenNetPrepare());
  await host.evaluate(()=>gameTest.gardenNetSend());
  await guest.waitForFunction(()=>gameTest.gardenState().count===6);
  await host.evaluate(()=>gameTest.gardenNetBreak());
  await guest.waitForFunction(()=>gameTest.gardenState().count===5);
  assert.deepEqual(await guest.evaluate(()=>gameTest.gardenState()),await host.evaluate(()=>gameTest.gardenState()));
  assert.deepEqual(errors,[]);
  console.log('PASS Crystal Garden: connected navigation, safe objectives, projectile destruction, resource disposal, map reset and host/guest destruction.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

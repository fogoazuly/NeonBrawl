const assert=require('node:assert/strict');
const {launch,instrument,startCoop}=require('./browser-harness.cjs');
const hooks=`
let testRam=null;
gameTest.ramSetup=()=>{
 initGame();hideGunSelect();hideMeleeSelect();gState='playing';nbPaused=true;mp.soloMode=true;mp.isHost=true;
 for(const e of enemies)e.dead=true;for(const b of bulletPool)if(b.active)releaseBullet(b);obstacleBoxes.length=0;
 for(const o of obstacleObjects)o.visible=false;
 waveSpawned=true;waveClear=false;waveTransition=false;_waveSpawnQueue.length=0;mouse.down=false;
 player.pos.set(8,0,0);player.invincible=0;player.hp=player.maxHp=10000;
 spawnEnemy('rammer',0,0);testRam=enemies[enemies.length-1];testRam.spawnAnim=0;testRam.stuckCheck=100;testRam.ram.timer=0;testRam.dmgMult=1;
};
gameTest.ramStep=n=>{for(let i=0;i<n;i++)update(.016);return gameTest.ramState();};
gameTest.ramState=()=>({phase:testRam.ram.phase,x:testRam.pos.x,z:testRam.pos.z,hp:player.hp,hits:testRam.ram.hit.size,warnings:warningZones.length});
gameTest.ramDodge=()=>{player.pos.z=5;};
gameTest.ramWall=()=>obstacleBoxes.push({x:10,z:0,hw:.05,hd:10});
gameTest.ramDamage=()=>playerDamageAmount(testRam,100,{});
gameTest.ramClose=()=>{gameTest.ramSetup();player.pos.x=.5;gameTest.ramStep(1);return Math.hypot(player.pos.x-testRam.pos.x,player.pos.z-testRam.pos.z)>.5;};
gameTest.ramLines=()=>[0,.7,Math.PI/2,-1.2].map(a=>{
 const mesh=spawnWarningLine(0,0,a,12,1.3,0xffbb44,.9);
 const v=new THREE.Vector3(0,1,0).applyEuler(mesh.rotation);
 const result={flat:Math.abs(v.y)<1e-8,aligned:Math.abs(v.x*Math.sin(a)+v.z*Math.cos(a))>0.999};
 _releaseWarningSlot(warningZones.pop());return result;
});
gameTest.ramHell=()=>{setNbDifficulty('hell');gameTest.ramSetup();gameTest.ramStep(1);gameTest.ramDodge();gameTest.ramWall();return gameTest.ramStep(50);};
gameTest.ramBorder=()=>{setNbDifficulty('hard');gameTest.ramSetup();testRam.pos.x=ARENA_W-4;player.pos.x=ARENA_W-1;gameTest.ramStep(1);gameTest.ramDodge();gameTest.ramStep(85);return {crashed:testRam.ram.phase==='crashed',inside:testRam.pos.x<=ARENA_W-testRam.cfg.r};};
gameTest.ramRoster=()=>({early:getWaveConfig(6).some(([id])=>id==='rammer'),seven:getWaveConfig(7).find(([id])=>id==='rammer')[1],late:getWaveConfig(50).find(([id])=>id==='rammer')[1]});
gameTest.ramNetPrepare=()=>{nbPaused=true;update=()=>{};resetGameplayInput();};
gameTest.ramNetSpawn=()=>{
 spawnEnemy('rammer',0,0);testRam=enemies[enemies.length-1];testRam.ram.phase='windup';testRam.ram.dx=1;testRam.ram.dz=0;
 spawnWarningLine(0,0,Math.PI/2,12,1.3,0xffbb44,.9);sendHostState();
};
gameTest.ramNetState=()=>({enemy:enemies.filter(e=>!e.dead&&e.type==='rammer').map(e=>({phase:e.ram?.phase,dx:e.ram?.dx})),warn:warningZones.some(w=>w.kind==='line'&&w.len===12)});
gameTest.ramNetCrash=()=>{testRam.ram.phase='crashed';sendHostState();};
`;
(async()=>{
 const browser=await launch(),errors=[];
 try{
  const context=await browser.newContext();await instrument(context,hooks);const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:3000');await page.waitForFunction(()=>!!window.gameTest);
  assert.ok((await page.evaluate(()=>gameTest.ramLines())).every(x=>x.flat&&x.aligned));
  assert.equal(await page.evaluate(()=>gameTest.ramClose()),true);
  await page.evaluate(()=>gameTest.ramSetup());assert.deepEqual(await page.evaluate(()=>gameTest.ramRoster()),{early:false,seven:1,late:3});
  const start=await page.evaluate(()=>gameTest.ramStep(1));assert.equal(start.phase,'windup');assert.ok(start.warnings>0);assert.equal(start.x,0);
  await page.screenshot({path:'test-results/rammer-warning.png'});
  await page.evaluate(()=>{gameTest.ramDodge();gameTest.ramWall();});
  const warning=await page.evaluate(()=>gameTest.ramStep(50));assert.equal(warning.phase,'windup');assert.equal(warning.x,0);
  const crash=await page.evaluate(()=>gameTest.ramStep(55));assert.equal(crash.phase,'crashed');assert.ok(crash.x<9.31);assert.equal(crash.z,0);assert.equal(crash.hp,10000);
  assert.equal(await page.evaluate(()=>gameTest.ramDamage()),135);await page.screenshot({path:'test-results/rammer-crash.png'});
  await page.evaluate(()=>gameTest.ramSetup());await page.evaluate(()=>gameTest.ramStep(120));const hit=await page.evaluate(()=>gameTest.ramState());assert.equal(hit.hits,1);assert.ok(hit.hp<10000);assert.ok(hit.hp>=9976);
  assert.equal((await page.evaluate(()=>gameTest.ramHell())).phase,'windup');
  assert.equal((await page.evaluate(()=>gameTest.ramStep(50))).phase,'crashed');
  assert.deepEqual(await page.evaluate(()=>gameTest.ramBorder()),{crashed:true,inside:true});
  await context.close();
  const hc=await browser.newContext(),gc=await browser.newContext();await instrument(hc,hooks);await instrument(gc,hooks);const host=await hc.newPage(),guest=await gc.newPage();
  for(const p of [host,guest])p.on('pageerror',e=>errors.push(e.message));await startCoop(host,guest);for(const p of [host,guest])await p.evaluate(()=>gameTest.ramNetPrepare());
  await host.evaluate(()=>gameTest.ramNetSpawn());await guest.waitForFunction(()=>gameTest.ramNetState().enemy.some(e=>e.phase==='windup')&&gameTest.ramNetState().warn);
  assert.equal((await guest.evaluate(()=>gameTest.ramNetState())).enemy[0].dx,1);
  await host.evaluate(()=>gameTest.ramNetCrash());await guest.waitForFunction(()=>gameTest.ramNetState().enemy.some(e=>e.phase==='crashed'));
  assert.deepEqual(errors,[]);console.log('PASS Neon Ram: wave gating, windup, locked direction, wall crash, exposure, one hit per charge and multiplayer model/telegraph/state');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

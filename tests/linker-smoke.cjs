const assert=require('node:assert/strict');
const {launch,instrument,startCoop}=require('./browser-harness.cjs');
const hooks=`
let testLinker,testLinked;
gameTest.linkerSetup=()=>{
 initGame();hideGunSelect();hideMeleeSelect();gState='playing';nbPaused=true;mp.soloMode=true;mp.isHost=true;
 for(const e of enemies)e.dead=true;
 obstacleBoxes.length=0;for(const o of obstacleObjects)o.visible=false;
 waveClear=false;waveTransition=false;mouse.down=false;
 spawnEnemy('linker',0,0);testLinker=enemies[enemies.length-1];
 spawnEnemy('chaser',3,0);testLinked=enemies[enemies.length-1];
 for(const e of [testLinker,testLinked]){e.spawnAnim=0;e.stagger=0;e.spd=0;e.stuckCheck=100;e.mesh.scale.setScalar(1);e.mesh.position.set(e.pos.x,.55,e.pos.z);}
 updateLinkerTargets();updateLinkerVisuals();
};
gameTest.linkerDamage=()=>playerDamageAmount(testLinked,100,{crit:0,critLuck:0});
gameTest.linkerWall=()=>{obstacleBoxes.push({x:1.5,z:0,hw:.1,hd:3});return gameTest.linkerDamage();};
gameTest.linkerKill=()=>{testLinker.dead=true;updateLinkerVisuals();return {damage:gameTest.linkerDamage(),visible:linkerBeams.visible};};
gameTest.linkerRange=()=>{testLinker.pos.x=-10;return gameTest.linkerDamage();};
gameTest.linkerRoster=()=>({early:getWaveConfig(8).some(([t])=>t==='linker'),nine:getWaveConfig(9).find(([t])=>t==='linker')[1],late:getWaveConfig(18).find(([t])=>t==='linker')[1]});
gameTest.linkerVisual=()=>({vertices:linkerBeams.geometry.drawRange.count,visible:linkerBeams.visible});
gameTest.linkerNetPrepare=()=>{nbPaused=true;update=()=>{};resetGameplayInput();};
gameTest.linkerNetSend=()=>{
 obstacleBoxes.length=0;
 spawnEnemy('linker',0,0);testLinker=enemies[enemies.length-1];
 spawnEnemy('chaser',2,0);testLinked=enemies[enemies.length-1];
 for(const e of [testLinker,testLinked]){e.spawnAnim=0;e.stagger=0;}
 updateLinkerTargets();sendHostState();return testLinked.poolIdx;
};
gameTest.linkerNetState=id=>{
 updateLinkerTargets();updateLinkerVisuals();
 const e=enemies.find(e=>e.poolIdx===id);
 return {linked:e?.linkSource?.type==='linker',source:e?.linkSourceId};
};
gameTest.linkerNetKill=()=>{testLinker.dead=true;updateLinkerTargets();sendHostState();};
`;
(async()=>{
 const browser=await launch(),errors=[];
 try{
  const context=await browser.newContext();await instrument(context,hooks);
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:3000');await page.waitForFunction(()=>!!window.gameTest);
  await page.evaluate(()=>gameTest.linkerSetup());
  assert.deepEqual(await page.evaluate(()=>gameTest.linkerRoster()),{early:false,nine:1,late:2});
  assert.equal(await page.evaluate(()=>gameTest.linkerDamage()),70);
  assert.deepEqual(await page.evaluate(()=>gameTest.linkerVisual()),{vertices:6,visible:true});
  await page.waitForTimeout(2200);await page.screenshot({path:'test-results/linker.png'});
  assert.equal(await page.evaluate(()=>gameTest.linkerWall()),100);
  await page.evaluate(()=>gameTest.linkerSetup());
  assert.equal(await page.evaluate(()=>gameTest.linkerRange()),100);
  await page.evaluate(()=>gameTest.linkerSetup());
  assert.deepEqual(await page.evaluate(()=>gameTest.linkerKill()),{damage:100,visible:false});
  await context.close();
  const hc=await browser.newContext(),gc=await browser.newContext();
  await instrument(hc,hooks);await instrument(gc,hooks);
  const host=await hc.newPage(),guest=await gc.newPage();
  for(const p of [host,guest])p.on('pageerror',e=>errors.push(e.message));
  await startCoop(host,guest);
  for(const p of [host,guest])await p.evaluate(()=>gameTest.linkerNetPrepare());
  const id=await host.evaluate(()=>gameTest.linkerNetSend());
  await guest.waitForFunction(id=>gameTest.linkerNetState(id).linked,id);
  await host.evaluate(()=>gameTest.linkerNetKill());
  await guest.waitForFunction(id=>!gameTest.linkerNetState(id).linked,id);
  assert.deepEqual(errors,[]);
  console.log('PASS Linker: roster, protection, wall/range/death break, low-detail visual, host/guest links and removal.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

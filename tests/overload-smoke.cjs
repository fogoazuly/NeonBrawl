const assert=require('node:assert/strict');
const {launch,instrument,startCoop}=require('./browser-harness.cjs');
const hooks=`
gameTest.overloadSetup=()=>{
 initGame();hideGunSelect();hideMeleeSelect();gState='playing';nbPaused=true;mp.soloMode=true;mp.isHost=true;
 for(const e of enemies)e.dead=true;
 waveClear=false;waveTransition=false;mouse.down=false;player.dead=false;player.downed=false;
 setupMiniObjective(8,'overload');
};
gameTest.overloadMaps=()=>ARENA_PRESETS.map((p,i)=>{
 changeMapLayout(i);setupMiniObjective(8,'overload');
 const ts=miniObjective.overload?.terminals;
 return !!ts&&ts.every((t,j)=>objectiveSpotIsFree(t.x,t.z)&&ts.every((u,k)=>k===j||Math.hypot(t.x-u.x,t.z-u.z)>=4));
});
gameTest.overloadStep=(index,dt)=>{
 const t=miniObjective.overload.terminals[index];
 player.pos.set(t.x,0,t.z);updateMiniObjective(dt,0);
 return miniObjectiveSnapshot();
};
gameTest.overloadWait=dt=>{
 player.pos.set(12,0,12);updateMiniObjective(dt,0);
 return {snap:miniObjectiveSnapshot(),blocks:miniObjectiveBlocksWaveClear(),visible:miniObjective.meshes.some(m=>m.visible)};
};
gameTest.overloadVisualOnly=()=>{
 const snap=miniObjectiveSnapshot();applyMiniObjectiveSnapshot(snap);
 updateMiniObjective(30,0);return miniObjectiveSnapshot();
};
gameTest.overloadRolls=()=>{
 const old=Math.random;Math.random=()=>.149;
 const early=rollWaveEvent(7);Math.random=()=>0;
 // Force last entry within the mini category.
 let n=0;Math.random=()=>n++===0?0:.999;
 const late=rollWaveEvent(8);Math.random=old;
 return {early,late};
};
gameTest.overloadNetPrepare=()=>{nbPaused=true;update=()=>{};resetGameplayInput();};
gameTest.overloadNetSend=()=>{
 setupMiniObjective(8,'overload');miniObjective.overload.terminals[0].state='active';
 miniObjective.overload.terminals[0].remaining=12;sendHostState();
};
gameTest.overloadSnap=()=>miniObjectiveSnapshot();
gameTest.overloadNetDone=()=>{completeMiniObjective();sendHostState();};
`;
(async()=>{
 const browser=await launch(),errors=[];
 try{
  const context=await browser.newContext();await instrument(context,hooks);
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:3000');await page.waitForFunction(()=>!!window.gameTest);
  await page.evaluate(()=>gameTest.overloadSetup());
  assert.ok((await page.evaluate(()=>gameTest.overloadMaps())).every(Boolean),'free distinct terminals on every map');
  await page.evaluate(()=>gameTest.overloadSetup());
  const rolls=await page.evaluate(()=>gameTest.overloadRolls());
  assert.notEqual(rolls.early?.sub,'overload');assert.equal(rolls.late.sub,'overload');
  for(let i=0;i<3;i++)await page.evaluate(i=>gameTest.overloadStep(i,2),i);
  const snap=await page.evaluate(()=>gameTest.overloadSnap());
  assert.ok(snap.overload.every(t=>t.state==='active'));
  assert.equal((await page.evaluate(()=>gameTest.overloadWait(10))).blocks,true);
  const done=await page.evaluate(()=>gameTest.overloadWait(8));
  assert.equal(done.snap.complete,true);assert.equal(done.blocks,false);assert.equal(done.visible,false);
  await page.evaluate(()=>gameTest.overloadSetup());await page.evaluate(()=>gameTest.overloadStep(0,2));
  const before=await page.evaluate(()=>gameTest.overloadSnap());
  assert.deepEqual(await page.evaluate(()=>gameTest.overloadVisualOnly()),before);
  await page.waitForTimeout(2200);await page.screenshot({path:'test-results/overload.png'});
  await context.close();
  const hc=await browser.newContext(),gc=await browser.newContext();
  await instrument(hc,hooks);await instrument(gc,hooks);
  const host=await hc.newPage(),guest=await gc.newPage();
  for(const p of [host,guest])p.on('pageerror',e=>errors.push(e.message));
  await startCoop(host,guest);
  for(const p of [host,guest])await p.evaluate(()=>gameTest.overloadNetPrepare());
  await host.evaluate(()=>gameTest.overloadNetSend());
  await guest.waitForFunction(()=>gameTest.overloadSnap().overload?.[0].remaining===12);
  assert.deepEqual(await guest.evaluate(()=>gameTest.overloadSnap()),await host.evaluate(()=>gameTest.overloadSnap()));
  await host.evaluate(()=>gameTest.overloadNetDone());
  await guest.waitForFunction(()=>gameTest.overloadSnap().complete);
  assert.deepEqual(errors,[]);
  console.log('PASS Overload: wall-safe distinct positions on every arena, activation, overlap, completion, guest authority and synchronization.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

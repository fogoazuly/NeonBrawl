const assert=require('node:assert/strict');
const {launch,instrument,startCoop}=require('./browser-harness.cjs');
const hooks=`
gameTest.freeze=()=>{update=()=>{};};
gameTest.moveObjectivePlayer=({x,z,downed=false,dead=false})=>{
  player.pos.set(x,0,z);player.downed=downed;player.dead=dead;player.hp=downed||dead?0:100;
  sendPlayerState();
};
gameTest.remoteObjectivePlayer=()=>{
  const p=Object.values(mp.remotePlayers)[0];return {x:p.pos.x,z:p.pos.z,downed:!!p.downed,dead:!!p.dead};
};
gameTest.prepareCoopObjective=type=>{
  gState='playing';waveNum=3;waveClear=false;waveTransition=false;waveSpawned=true;
  changeMapLayout(ARENA_PRESETS.findIndex(p=>p.name==='L-WING'));setupMiniObjective(3,type);
  if(type==='relays')miniObjective.relays.spawnCd=10000;
  else {miniObjective.cells.enemyCd=10000;miniObjective.cells.spawnCd=0;updateMiniObjective(0,0);}
  sendHostState();return gameTest.coopObjective();
};
gameTest.coopObjective=()=>({snap:miniObjectiveSnapshot(),progress:miniObjective.relays?.progress,blocked:miniObjectiveBlocksWaveClear(),
  visible:miniObjective.meshes.some(m=>m.visible)});
gameTest.stepObjective=dt=>{updateMiniObjective(dt,0);sendHostState();return gameTest.coopObjective();};
`;
(async()=>{
  const browser=await launch(),errors=[];
  try{
    const pages=[];
    for(let i=0;i<2;i++){
      const context=await browser.newContext();await instrument(context,hooks);
      const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));pages.push(page);
    }
    const [host,guest]=pages;await startCoop(host,guest);
    for(const page of pages)await page.evaluate(()=>gameTest.freeze());
    async function move(page,observer,p){
      const expected={downed:false,dead:false,...p};
      await page.evaluate(p=>gameTest.moveObjectivePlayer(p),expected);
      await observer.waitForFunction(p=>JSON.stringify(gameTest.remoteObjectivePlayer())===JSON.stringify(p),
        {x:expected.x,z:expected.z,downed:expected.downed,dead:expected.dead});
    }
    async function sync(result){
      await guest.waitForFunction(s=>JSON.stringify(gameTest.coopObjective().snap)===JSON.stringify(s),result.snap);
    }
    await move(host,guest,{x:0,z:-10});await move(guest,host,{x:0,z:-10});
    let result=await host.evaluate(()=>gameTest.prepareCoopObjective('relays'));await sync(result);
    const target=result.snap.relays.positions[0];
    await move(guest,host,{...target,downed:true});
    result=await host.evaluate(()=>gameTest.stepObjective(.3));assert.equal(result.snap.relays.progress,0);
    await move(guest,host,{...target,dead:true});
    result=await host.evaluate(()=>gameTest.stepObjective(.3));assert.equal(result.snap.relays.progress,0);
    await move(guest,host,target);
    result=await host.evaluate(()=>gameTest.stepObjective(.3));assert.equal(result.snap.relays.progress,.1);
    await move(host,guest,target);
    result=await host.evaluate(()=>gameTest.stepObjective(.3));assert.ok(Math.abs(result.progress-.245)<1e-9);
    await move(host,guest,{x:0,z:-10});await move(guest,host,{x:0,z:-10});
    result=await host.evaluate(()=>gameTest.stepObjective(.25));assert.ok(Math.abs(result.progress-.145)<1e-9);
    console.log('PASS relay: guest participation, downed/dead exclusion, team speed and decay');
    for(let n=0;n<3;n++){
      await move(guest,host,result.snap.relays.positions[n]);
      result=await host.evaluate(()=>gameTest.stepObjective(3));await sync(result);
      assert.equal(result.snap.relays.captured,n+1);
    }
    assert.equal(result.snap.complete,true);assert.equal(result.blocked,false);assert.equal(result.visible,false);
    assert.equal((await guest.evaluate(()=>gameTest.coopObjective())).visible,false);
    console.log('PASS all three relays captured by guest and synchronized');
    await move(guest,host,{x:0,z:-10});
    result=await host.evaluate(()=>gameTest.prepareCoopObjective('cells'));await sync(result);
    const cell={x:result.snap.cells.x,z:result.snap.cells.z};
    for(const state of [{downed:true},{dead:true}]){
      await move(guest,host,{...cell,...state});result=await host.evaluate(()=>gameTest.stepObjective(0));
      assert.equal(result.snap.cells.collected,0);assert.equal(result.snap.cells.active,true);
    }
    for(let n=0;n<10;n++){
      const p={x:result.snap.cells.x,z:result.snap.cells.z};
      await move(guest,host,p);await move(host,guest,p);
      result=await host.evaluate(()=>gameTest.stepObjective(0));await sync(result);
      assert.equal(result.snap.cells.collected,n+1);assert.equal(result.snap.cells.active,false);
      result=await host.evaluate(()=>gameTest.stepObjective(0));assert.equal(result.snap.cells.collected,n+1);
      if(n<9){result=await host.evaluate(()=>gameTest.stepObjective(3));assert.equal(result.snap.cells.active,true);await sync(result);}
    }
    assert.equal(result.snap.complete,true);assert.equal(result.blocked,false);assert.equal(result.visible,false);
    await sync(result);assert.equal((await guest.evaluate(()=>gameTest.coopObjective())).visible,false);
    console.log('PASS ten cells: living players only, simultaneous pickup once, respawn and completion');
    assert.deepEqual(errors,[]);
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

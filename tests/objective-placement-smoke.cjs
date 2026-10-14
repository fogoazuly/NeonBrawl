const assert=require('node:assert/strict');
const {launch,instrument,startCoop}=require('./browser-harness.cjs');
const hooks=`
gameTest.freezePlacement=()=>{update=()=>{};};
gameTest.placementSummary=()=>({map:currentMapLayout,type:miniObjective?.type,
  relays:miniObjective?.relays?.positions||null,
  cell:miniObjective?.cells?.active?[miniObjective.cells.posX,miniObjective.cells.posZ]:null});
function preparePlacement(map,type){
  update=()=>{};gState='playing';waveNum=3;waveClear=false;waveTransition=false;waveSpawned=true;
  player.invincible=10000;changeMapLayout(map);setupMiniObjective(3,type);
}
function spawnTestCell(){
  const c=miniObjective.cells;c.active=false;c.spawnCd=0;c.enemyCd=10000;updateMiniObjective(0,0);
  return {x:c.posX,z:c.posZ};
}
gameTest.checkPlacement=()=>{
  mp.soloMode=true;initGame();hideGunSelect();hideMeleeSelect();const failures=[];let cells=0,relays=0;
  const check=(p,label)=>{
    if(Math.abs(p.x)>ARENA_W-1||Math.abs(p.z)>ARENA_H-1||obstacleBoxes.some(o=>Math.abs(p.x-o.x)<o.hw+1&&Math.abs(p.z-o.z)<o.hd+1))failures.push(label);
  };
  for(let map=0;map<ARENA_PRESETS.length;map++){
    preparePlacement(map,'relays');const r=miniObjective.relays;
    for(let n=0;n<3;n++){
      const p=r.positions[r.index];check(p,ARENA_PRESETS[map].name+' relay '+n);relays++;
      player.pos.set(p.x,0,p.z);r.progress=.999;r.spawnCd=10000;updateMiniObjective(.01,0);
    }
    if(!miniObjective.complete)failures.push('Relays cannot complete '+map);
    preparePlacement(map,'cells');
    for(let n=0;n<30;n++){const p=spawnTestCell();check(p,ARENA_PRESETS[map].name+' cell '+n);cells++;}
    // Force all eight random candidates onto the same point, exercising fallback.
    const random=Math.random;
    try{Math.random=()=>.75;check(spawnTestCell(),ARENA_PRESETS[map].name+' repeated RNG');cells++;}finally{Math.random=random;}
    const c=miniObjective.cells;player.pos.set(c.posX,0,c.posZ);updateMiniObjective(.01,0);
    if(c.collected!==1)failures.push('Cell cannot be collected '+map);
  }
  // Even an impossible map must never place an objective in its wall.
  obstacleBoxes.push({x:0,z:0,hw:100,hd:100});setupMiniObjective(3,'cells');spawnTestCell();
  if(miniObjective.cells.active)failures.push('Cell spawned in fully blocked map');
  return {failures,cells,relays};
};
gameTest.netPlacement=(name,type)=>{
  preparePlacement(ARENA_PRESETS.findIndex(p=>p.name===name),type);
  if(type==='cells')spawnTestCell();sendHostState();return gameTest.placementSummary();
};
`;
(async()=>{
  const browser=await launch(),errors=[];
  try{
    const c=await browser.newContext();await instrument(c,hooks);const host=await c.newPage();host.on('pageerror',e=>errors.push(e.message));
    await host.goto('http://127.0.0.1:3000');await host.waitForFunction(()=>!!window.gameTest);
    const result=await host.evaluate(()=>gameTest.checkPlacement());console.log(result);assert.deepEqual(result.failures,[]);
    const c2=await browser.newContext();await instrument(c2,hooks);const guest=await c2.newPage();guest.on('pageerror',e=>errors.push(e.message));
    await startCoop(host,guest);await guest.evaluate(()=>gameTest.freezePlacement());
    for(const name of ['L-WING','HOURGLASS','DELTA CROSSING'])for(const type of ['relays','cells']){
      const expected=await host.evaluate(t=>gameTest.netPlacement(...t),[name,type]);
      await guest.waitForFunction(s=>JSON.stringify(gameTest.placementSummary())===JSON.stringify(s),expected);
      console.log('PASS synchronized objective',name,type);
    }
    assert.deepEqual(errors,[]);
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

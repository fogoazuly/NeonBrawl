const assert=require('node:assert/strict');
const {launch,instrument}=require('./browser-harness.cjs');
const hooks=`
const placementUpdate=update;
gameTest.summonMap=map=>{
  update=()=>{};mp.soloMode=true;gState='playing';waveNum=14;waveSpawned=true;waveClear=false;waveTransition=false;waveEvent=null;
  changeMapLayout(map);clearMapSpellsAndAllies();player.invincible=10000;
  const failures=[];let direct=0,bursts=0,children=0;
  const clear=()=>{for(const e of enemies){e.dead=true;releaseEnemySlot(e);}enemies.length=0;};
  const check=(e,label)=>{
    const {x,z}=e.pos,r=e.cfg.r;
    if(!Number.isFinite(x)||!Number.isFinite(z)||Math.abs(x)>ARENA_W-r+1e-6||Math.abs(z)>ARENA_H-r+1e-6||
       obstacleBoxes.some(o=>!o.gone&&Math.hypot(Math.max(Math.abs(x-o.x)-o.hw,0),Math.max(Math.abs(z-o.z)-o.hd,0))<r-1e-6))
      failures.push({label,type:e.type,x,z,r});
  };
  // Exercise spawn projection from wall centers and all four outer corners.
  const points=obstacleBoxes.filter(o=>!o.gone).map(o=>[o.x,o.z]);
  for(const x of [-ARENA_W,ARENA_W])for(const z of [-ARENA_H,ARENA_H])points.push([x,z]);
  for(const type of Object.keys(ETYPES).filter(t=>t!=='boss'))for(const [x,z] of points){
    clear();spawnEnemy(type,x,z);if(enemies.length!==1)failures.push({label:'missing direct spawn',type,x,z});
    else check(enemies[0],'direct');direct++;
  }
  // Execute real normal/elite/champion summoning near a wall and arena corner.
  const first=obstacleBoxes.find(o=>!o.gone);
  const sources=[[ARENA_W-1,ARENA_H-1],first?[first.x+first.hw+1,first.z]:[0,0]];
  for(const variant of [null,'elite','champion'])for(const point of sources)for(const randomValue of [0,0.25,0.5,0.75]){
    clear();spawnEnemy('summoner',...point);const e=enemies[0];
    e.elite=variant;e.fireCd=0;e.eliteCd=0;e.elitePulseCd=100;e.spawnAnim=0;e.spd=0;e.stuckCheck=100;
    player.pos.set(e.pos.x-5,0,e.pos.z-5);
    const savedRandom=Math.random,savedSpawn=spawnEnemy;
    // Observe each child immediately at creation, before movement can hide overlap.
    spawnEnemy=(...args)=>{const before=enemies.length;savedSpawn(...args);if(enemies.length>before){check(enemies[enemies.length-1],'at creation');children++;}};
    try{Math.random=()=>randomValue;placementUpdate(0);}finally{Math.random=savedRandom;spawnEnemy=savedSpawn;}
    if(enemies.length!==(variant?5:3))failures.push({label:'burst count',variant,point,randomValue,count:enemies.length});
    for(const child of enemies.slice(1))check(child,'after update');bursts++;
  }
  clear();return {map:ARENA_PRESETS[map].name,direct,bursts,children,failures};
};
gameTest.summonMapCount=()=>ARENA_PRESETS.length;
gameTest.summonBlocked=()=>{
  obstacleBoxes.length=0;obstacleBoxes.push({x:0,z:0,hw:100,hd:100});
  for(const type of Object.keys(ETYPES).filter(t=>t!=='boss'))spawnEnemy(type,0,0);
  return enemies.length;
};
`;
(async()=>{
  const browser=await launch(),errors=[],results=[];
  try{
    const c=await browser.newContext();await instrument(c,hooks);const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));
    await p.goto('http://127.0.0.1:3000');await p.waitForFunction(()=>!!window.gameTest);
    const count=await p.evaluate(()=>gameTest.summonMapCount());
    for(let i=0;i<count;i++){const r=await p.evaluate(m=>gameTest.summonMap(m),i);results.push(r);console.log(JSON.stringify(r));}
    assert.deepEqual(results.flatMap(r=>r.failures.map(f=>({map:r.map,...f}))),[]);assert.deepEqual(errors,[]);
    assert.equal(await p.evaluate(()=>gameTest.summonBlocked()),0,'fully blocked arena must not spawn enemies');
    console.log('TOTAL',JSON.stringify(results.reduce((t,r)=>({direct:t.direct+r.direct,bursts:t.bursts+r.bursts,children:t.children+r.children}),{direct:0,bursts:0,children:0})));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

const assert=require('node:assert/strict');
const {launch,instrument}=require('./browser-harness.cjs');
const hooks=`
gameTest.maps=()=>{
  mp.soloMode=true;initGame();hideGunSelect();update=()=>{};
  const issues=[],tested=[];
  let sharedDisposals=0;
  for(const mat of [_breakMarkMat,_breakMat,_bridgeMat,_rockMat,_coverMat,..._mapObstacleMats])mat.addEventListener('dispose',()=>sharedDisposals++);
  for(let i=0;i<ARENA_PRESETS.length;i++){
    changeMapLayout(i);const p=ARENA_PRESETS[i];
    if(obstacleBoxes.length!==p.blocks.length)issues.push(p.name+': block count');
    if(mapHazards.length!==(p.hazards||[]).length)issues.push(p.name+': hazard count');
    for(const [label,z] of [['entry',ARENA_H-2],['exit',EXIT_Z]]){
      if(obstacleBoxes.some(o=>Math.abs(o.x)<o.hw+.3&&Math.abs(z-o.z)<o.hd+.3))issues.push(p.name+': blocked '+label);
    }
    // Walk a half-unit grid with player clearance, without destroying cover.
    const queue=[[0,ARENA_H-2]],seen=new Set(['0,'+(ARENA_H-2)]);let reachable=false;
    for(let q=0;q<queue.length;q++){
      const [x,z]=queue[q];if(Math.hypot(x,z-EXIT_Z)<.3){reachable=true;break;}
      for(const [dx,dz] of [[.5,0],[-.5,0],[0,.5],[0,-.5]]){
        const nx=x+dx,nz=z+dz,key=nx+','+nz;
        if(seen.has(key)||Math.abs(nx)>ARENA_W-.5||Math.abs(nz)>ARENA_H-.5)continue;
        seen.add(key);
        if(!obstacleBoxes.some(o=>Math.abs(nx-o.x)<o.hw+.3&&Math.abs(nz-o.z)<o.hd+.3))queue.push([nx,nz]);
      }
    }
    if(!reachable)issues.push(p.name+': no entry-to-exit route');
    const geometries=new Map(),materials=new Map(),oldObjects=[...obstacleObjects,...mapDecorObjects,...mapHazardObjects];
    for(const m of oldObjects)m.traverse(o=>{if(o.geometry&&!geometries.has(o.geometry)){geometries.set(o.geometry,0);o.geometry.addEventListener('dispose',()=>geometries.set(o.geometry,geometries.get(o.geometry)+1));}});
    for(const o of obstacleBoxes.filter(o=>o.destructible)){
      const mat=o.mesh.material;materials.set(mat,0);mat.addEventListener('dispose',()=>materials.set(mat,materials.get(mat)+1));
    }
    const breakables=obstacleBoxes.filter(o=>o.destructible);
    for(const [oi,o] of [...obstacleBoxes].entries()){
      // Leave half intact to check disposal on map change as well as destruction.
      if(o.destructible&&oi%2)continue;
      const hp=o.hp;const destroyed=damageObstacle(o,hp);
      if(o.destructible){if(!destroyed||obstacleBoxes.includes(o)||obstacleObjects.includes(o.mesh)||o.mesh.parent)issues.push(p.name+': destruction');}
      else if(destroyed||o.hp!==hp)issues.push(p.name+': solid obstacle damaged');
    }
    changeMapLayout((i+1)%ARENA_PRESETS.length);
    if(oldObjects.some(o=>o.parent))issues.push(p.name+': old object retained');
    const leakedGeo=[...geometries.values()].filter(n=>n!==1).length;
    const leakedMat=[...materials.values()].filter(n=>n!==1).length;
    if(leakedGeo||leakedMat)issues.push(p.name+': disposal geometry='+leakedGeo+' material='+leakedMat);
    tested.push({name:p.name,type:p.type,breakables:breakables.length});
  }
  if(sharedDisposals)issues.push('Shared obstacle materials disposed: '+sharedDisposals);
  let previous=-1;
  for(let wave=1;wave<=80;wave++){
    const index=presetForWave(wave),p=ARENA_PRESETS[index];
    if(wave%5===0){if(p.type!=='boss'||p.boss!==BOSS_NAMES[(wave/5-1)%8])issues.push('boss map wave '+wave);}
    else {if(p.type!=='normal'||(wave>2&&index===previous))issues.push('normal rotation wave '+wave);previous=index;}
  }
  return {tested,issues};
};
`;
(async()=>{
  const browser=await launch(),errors=[];
  try{
    const c=await browser.newContext();await instrument(c,hooks);const page=await c.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:3000');await page.waitForFunction(()=>!!window.gameTest);
    const report=await page.evaluate(()=>gameTest.maps());
    console.log(JSON.stringify(report,null,2));assert.deepEqual(errors,[]);assert.deepEqual(report.issues,[]);
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

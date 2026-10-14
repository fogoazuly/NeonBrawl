const assert=require('node:assert/strict');
const {launch,instrument,startCoop}=require('./browser-harness.cjs');
const hooks=`
const mapTestUpdate=update;
gameTest.freezeMapTest=()=>{update=()=>{};player.invincible=10000;};
gameTest.mapList=()=>ARENA_PRESETS.map((p,i)=>({i,name:p.name}));
gameTest.mapState=()=>({map:currentMapLayout,blocks:obstacleBoxes.map(o=>[o.x,o.z,o.destructible]),hazards:mapHazards.map(h=>[h.x,h.z,h.type||'damage'])});
gameTest.setMap=i=>{changeMapLayout(i);sendHostState();return gameTest.mapState();};
gameTest.breakMap=()=>{for(const o of [...obstacleBoxes])if(o.destructible)damageObstacle(o,o.hp);sendHostState();return gameTest.mapState();};
gameTest.visualWallHit=(visualOnly=true)=>{
  const o=obstacleBoxes.find(o=>o.destructible),before=o.hp;
  for(const b of bulletPool)if(b.active)releaseBullet(b);
  fireBullet({x:o.x,z:o.z},new THREE.Vector3(1,0,0),true,100,0,visualOnly,null,0,'pistol');
  mapTestUpdate(0);
  return {before,after:o.hp};
};
`;
(async()=>{
  const browser=await launch(),errors=[];
  try{
    const pages=[];
    for(let i=0;i<2;i++){const c=await browser.newContext();await instrument(c,hooks);const p=await c.newPage();p.setDefaultTimeout(20000);p.on('pageerror',e=>errors.push(e.message));pages.push(p);}
    const [host,guest]=pages;await startCoop(host,guest);
    for(const p of pages)await p.evaluate(()=>gameTest.freezeMapTest());
    const maps=await host.evaluate(()=>gameTest.mapList());let broken=0;
    for(const map of maps){
      const before=await host.evaluate(i=>gameTest.setMap(i),map.i);
      await guest.waitForFunction(s=>JSON.stringify(gameTest.mapState())===JSON.stringify(s),before);
      const after=await host.evaluate(()=>gameTest.breakMap());
      await guest.waitForFunction(s=>JSON.stringify(gameTest.mapState())===JSON.stringify(s),after);
      broken+=before.blocks.length-after.blocks.length;
      console.log('PASS synchronized map/destruction',map.name);
    }
    // Revisit destroyed maps: both peers must reconstruct their cover.
    for(const map of maps.filter(m=>['WARDEN FORTRESS','DELTA CROSSING','L-WING'].includes(m.name))){
      const expected=await host.evaluate(i=>gameTest.setMap(i),map.i);
      await guest.waitForFunction(s=>JSON.stringify(gameTest.mapState())===JSON.stringify(s),expected);
      assert.ok(expected.blocks.some(b=>b[2]));
    }
    assert.deepEqual(errors,[]);console.log('PASS',maps.length,'maps,',broken,'obstacles, 3 rebuilt maps');
    const wallHit=await guest.evaluate(()=>gameTest.visualWallHit());
    assert.equal(wallHit.after,wallHit.before,'Visual-only guest bullets must not damage terrain');
    console.log('PASS visual-only projectile preserves obstacle HP');
    const realHit=await host.evaluate(()=>gameTest.visualWallHit(false));
    assert.equal(realHit.before-realHit.after,45,'Authoritative projectile must still damage terrain');
    assert.deepEqual(errors,[]);console.log('PASS authoritative projectile damages obstacle');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

const assert=require('node:assert/strict');
const {launch,instrument,startCoop}=require('./browser-harness.cjs');
const hooks=`
const authorityUpdate=update;
gameTest.freezeAuthority=()=>{update=()=>{};player.invincible=10000;};
gameTest.prepareAuthority=()=>{
  gState='playing';waveNum=3;waveClear=false;waveTransition=false;
  setupMiniObjective(3,'spawners');
  for(const s of miniObjective.spawners){s.hp=s.maxHp=10000;s.cd=10000;}
  sendHostState();
};
gameTest.authorityState=()=>({type:miniObjective?.type,hp:miniObjective?.spawners?.[0]?.hp,visual:miniObjective?.visualOnly});
gameTest.hitAuthority=({visualOnly=false,direct=false})=>{
  gState='playing';waveClear=false;waveTransition=false;obstacleBoxes.length=0;
  const s=miniObjective.spawners[0];player.pos.set(s.x,0,s.z);s.armed=true;
  for(const b of bulletPool)if(b.active)releaseBullet(b);
  const before=s.hp;
  if(direct)damageMiniObjectiveAt(s.x,s.z,100);
  else {fireBullet({x:s.x,z:s.z},new THREE.Vector3(1,0,0),true,100,0,visualOnly,null,mp.myId,'pistol');authorityUpdate(0);}
  return {before,after:s.hp};
};
gameTest.publishAuthority=()=>sendHostState();
`;
(async()=>{
  const browser=await launch(),errors=[];
  try{
    const pages=[];
    for(let i=0;i<2;i++){
      const c=await browser.newContext();await instrument(c,hooks);const p=await c.newPage();
      p.on('pageerror',e=>errors.push(e.message));pages.push(p);
    }
    const [host,guest]=pages;await startCoop(host,guest);
    for(const p of pages)await p.evaluate(()=>gameTest.freezeAuthority());
    await host.evaluate(()=>gameTest.prepareAuthority());
    await guest.waitForFunction(()=>gameTest.authorityState().hp===10000);
    assert.equal((await guest.evaluate(()=>gameTest.authorityState())).visual,true);
    for(const [label,page,args] of [
      ['guest visual projectile',guest,{visualOnly:true}],
      ['guest direct effect',guest,{direct:true}],
      ['host visual projectile',host,{visualOnly:true}]
    ]){
      const r=await page.evaluate(a=>gameTest.hitAuthority(a),args);
      assert.equal(r.after,r.before,label+' must not change HP');console.log('PASS',label);
    }
    const r=await host.evaluate(()=>gameTest.hitAuthority({}));assert.equal(r.before-r.after,75);
    await host.evaluate(()=>gameTest.publishAuthority());
    await guest.waitForFunction(hp=>gameTest.authorityState().hp===hp,r.after);
    assert.deepEqual(errors,[]);console.log('PASS authoritative damage synchronized');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

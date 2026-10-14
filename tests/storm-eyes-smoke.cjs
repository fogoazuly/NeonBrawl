const assert=require('node:assert/strict');
const {launch,instrument,startCoop}=require('./browser-harness.cjs');
const hooks=`
gameTest.stormPrepare=()=>{
  update=()=>{};gState='playing';waveNum=3;waveClear=false;waveTransition=false;
  resetRelics();clearSummons();for(const k of Object.keys(playerSkills))delete playerSkills[k];
  player.hp=100;player.dead=false;player.downed=false;player.invincible=0;player.barrierActive=false;
  setupMiniObjective(3,'survive',!mp.soloMode&&!mp.isHost);
};
gameTest.stormPosition=({x,z,downed=false})=>{
  player.pos.set(x,0,z);player.downed=downed;player.invincible=0;sendPlayerState();
};
gameTest.stormRemote=()=>{const p=Object.values(mp.remotePlayers)[0];return {x:p.pos.x,z:p.pos.z};};
gameTest.stormStep=dt=>{player.invincible=Math.max(0,player.invincible-dt);updateMiniObjective(dt,0);if(mp.isHost)sendHostState();return player.hp;};
// Damage cadence belongs to the host; compare the shared visual state only.
gameTest.stormSnapshot=()=>{const s=miniObjectiveSnapshot();delete s.safe.hitCd;return s;};
gameTest.stormSolo=()=>{
  mp.soloMode=true;initGame();hideGunSelect();hideMeleeSelect();const results=[];
  for(const [name,x,z,downed,hp] of [
    ['first center',-4.2,-2.6,false,100],['second center',4.2,2.6,false,100],
    ['edge',-8.6,-2.6,false,100],['outside edge',-8.601,-2.6,false,92],
    ['far outside',12,10,false,92],['downed outside',12,10,true,100]
  ]){
    gameTest.stormPrepare();gameTest.stormPosition({x,z,downed});gameTest.stormStep(0);
    results.push({name,actual:player.hp,expected:hp});
  }
  gameTest.stormPrepare();gameTest.stormPosition({x:12,z:10});
  gameTest.stormStep(0);gameTest.stormStep(.84);results.push({name:'cooldown',actual:player.hp,expected:92});
  gameTest.stormStep(.02);results.push({name:'next tick',actual:player.hp,expected:84});
  const s=miniObjective.safe,before=s.zones.map(z=>({x:z.x,z:z.z}));
  player.invincible=100;gameTest.stormStep(1);
  results.push({name:'moving zones',actual:s.zones.every((z,i)=>Math.hypot(z.x-before[i].x,z.z-before[i].z)>0),expected:true});
  miniObjective.timer=.01;gameTest.stormStep(.02);const hp=player.hp;gameTest.stormStep(1);
  results.push({name:'completion stops damage',actual:miniObjective.complete&&player.hp===hp&&miniObjective.meshes.every(m=>!m.visible),expected:true});
  return results;
};
`;
(async()=>{
  const browser=await launch(),errors=[];
  try{
    const c=await browser.newContext();await instrument(c,hooks);const host=await c.newPage();
    host.on('pageerror',e=>errors.push(e.message));await host.goto('http://127.0.0.1:3000');await host.waitForFunction(()=>!!window.gameTest);
    const results=await host.evaluate(()=>gameTest.stormSolo());console.log(results);
    assert.deepEqual(results.filter(r=>r.actual!==r.expected),[]);
    const c2=await browser.newContext();await instrument(c2,hooks);const guest=await c2.newPage();
    guest.on('pageerror',e=>errors.push(e.message));await startCoop(host,guest);
    for(const p of [host,guest])await p.evaluate(()=>gameTest.stormPrepare());
    await host.evaluate(()=>gameTest.stormPosition({x:-4.2,z:-2.6}));
    await guest.evaluate(()=>gameTest.stormPosition({x:12,z:10}));
    await host.waitForFunction(()=>gameTest.stormRemote().x===12&&gameTest.stormRemote().z===10);
    assert.equal(await guest.evaluate(()=>gameTest.stormStep(0)),100);
    await host.evaluate(()=>gameTest.stormStep(0));await guest.waitForFunction(()=>gameTest.state().hp===92);
    assert.equal(await guest.evaluate(()=>gameTest.stormStep(.86)),92);
    await host.evaluate(()=>gameTest.stormStep(.86));await guest.waitForFunction(()=>gameTest.state().hp===84);
    assert.equal(await host.evaluate(()=>gameTest.state().hp),100);
    const snap=await host.evaluate(()=>gameTest.stormSnapshot());
    await guest.waitForFunction(s=>JSON.stringify(gameTest.stormSnapshot())===JSON.stringify(s),snap);
    assert.deepEqual(errors,[]);console.log('PASS cooperative authoritative damage, cooldown, safe host and moving-zone snapshot');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

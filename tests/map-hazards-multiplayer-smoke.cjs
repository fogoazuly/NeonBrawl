const assert=require('node:assert/strict');
const {launch,instrument,startCoop}=require('./browser-harness.cjs');
const hooks=`
gameTest.hazardSetup=()=>{
  update=()=>{};resetRelics();clearSummons();for(const k of Object.keys(playerSkills))delete playerSkills[k];
  changeMapLayout(ARENA_PRESETS.findIndex(p=>p.name==='PHANTOM MIRROR'));
  player.hp=100;player.invincible=0;player.barrierActive=false;player.pos.set(mp.isHost?10:0,0,0);
  sendPlayerState();
};
gameTest.remoteAtHazard=()=>mp.remotePlayers[1]?.pos.x===0;
gameTest.hazardTick=dt=>{player.invincible=Math.max(0,player.invincible-dt);updateMapHazards(dt,0);return player.hp;};
`;
(async()=>{
  const browser=await launch(),errors=[];
  try{
    const pages=[];
    for(let i=0;i<2;i++){const c=await browser.newContext();await instrument(c,hooks);const p=await c.newPage();p.setDefaultTimeout(20000);p.on('pageerror',e=>errors.push(e.message));pages.push(p);}
    const [host,guest]=pages;await startCoop(host,guest);
    for(const p of pages)await p.evaluate(()=>gameTest.hazardSetup());
    await host.waitForFunction(()=>gameTest.remoteAtHazard());
    assert.equal(await guest.evaluate(()=>gameTest.hazardTick(0)),100,'Guest must await authoritative hazard damage');
    await host.evaluate(()=>gameTest.hazardTick(0));
    await guest.waitForFunction(()=>gameTest.state().hp===92);
    assert.equal(await guest.evaluate(()=>gameTest.hazardTick(.46)),92,'Local hazard must not add an extra tick');
    await host.evaluate(()=>gameTest.hazardTick(.54));
    assert.equal(await guest.evaluate(()=>gameTest.state().hp),92);
    await host.evaluate(()=>gameTest.hazardTick(.02));
    await guest.waitForFunction(()=>gameTest.state().hp===84);
    assert.equal(await host.evaluate(()=>gameTest.state().hp),100);
    assert.deepEqual(errors,[]);console.log('PASS host-authoritative hazard damage, cooldown and safe host');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

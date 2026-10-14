const assert=require('node:assert/strict');
const {launch,instrument,startCoop}=require('./browser-harness.cjs');
const hooks=`
gameTest.freezeReactor=()=>{update=()=>{};};
gameTest.netReactorPrepare=()=>{
  gState='playing';waveNum=3;waveClear=false;waveTransition=false;player.pos.set(0,0,0);
  setupMiniObjective(3,'defend');miniObjective.reactor.hp=100;miniObjective.pulseCd=100;
  sendHostState();
};
gameTest.netReactorMove=downed=>{
  player.pos.set(0,0,0);player.dead=false;player.downed=downed;player.hp=downed?0:100;sendPlayerState();
};
gameTest.netReactorRemote=()=>{const p=Object.values(mp.remotePlayers)[0];return {x:p.pos.x,z:p.pos.z,downed:p.downed};};
gameTest.netReactorState=()=>miniObjectiveSnapshot();
gameTest.netReactorStep=()=>{
  updateMiniObjective(1,0);sendHostState();return {hp:miniObjective.reactor.hp,charge:miniObjective.charge,snap:miniObjectiveSnapshot()};
};
function reactorFixture(){
  mp.soloMode=true;initGame();hideGunSelect();hideMeleeSelect();
  gState='playing';waveNum=3;waveClear=false;waveTransition=false;
  player.invincible=10000;player.pos.set(10,0,10);obstacleBoxes.length=0;
  setupMiniObjective(3,'defend');waveEvent={type:'mini'};
  miniObjective.reactor.hp=100;miniObjective.pulseCd=100;
  return miniObjective;
}
gameTest.reactorEffects=()=>{
  const results=[];
  const check=(label,condition,details)=>results.push({label,pass:!!condition,details});
  const near=(a,b)=>Math.abs(a-b)<1e-8;
  for(const [label,x,dead,downed,expected] of [
    ['center',0,false,false,true],['edge',3,false,false,true],['outside',3.001,false,false,false],
    ['dead',0,true,false,false],['downed',0,false,true,false]
  ]){
    const o=reactorFixture();player.pos.set(x,0,0);player.dead=dead;player.downed=downed;
    player.hp=dead||downed?0:100;updateMiniObjective(1,0);
    check(label,near(o.reactor.hp,expected?103.6:100)&&near(o.charge,expected?.215:0),{hp:o.reactor.hp,charge:o.charge});
  }
  {
    const o=reactorFixture();player.pos.set(0,0,0);o.reactor.hp=o.reactor.maxHp-.1;
    updateMiniObjective(1,0);check('healing capped',o.reactor.hp===o.reactor.maxHp);
    player.pos.set(10,0,10);o.charge=.5;updateMiniObjective(1,0);
    check('charge decay',near(o.charge,.465));updateMiniObjective(20,0);check('charge floor',o.charge===0);
  }
  for(const [type,dps] of [['chaser',2.2],['tank',4]]){
    const o=reactorFixture();spawnEnemy(type,0,0);const e=enemies[enemies.length-1];
    updateMiniObjective(1,0);check(type+' pressure',near(o.reactor.hp,100-dps));
    e.dead=true;updateMiniObjective(1,0);check(type+' dead excluded',near(o.reactor.hp,100-dps));
    e.dead=false;e.pos.set(2.2+e.cfg.r+.001,0,0);updateMiniObjective(1,0);
    check(type+' outside pressure',near(o.reactor.hp,100-dps));
  }
  {
    const o=reactorFixture();o.charge=1;o.pulseCd=0;const targets=[];
    for(let i=0;i<3;i++){
      spawnEnemy('tank',0,0);const e=enemies[enemies.length-1];e.hp=e.maxHp=10000;
      e.pos.x=i===0?4:8.8+e.cfg.r+(i===2?.001:0);targets.push(e);
    }
    player.pos.set(0,0,0);updateMiniObjective(0,0);
    check('pulse range',targets[0].hp===9843&&targets[1].hp===9843&&targets[2].hp===10000,targets.map(e=>e.hp));
    check('pulse reset',o.charge===0&&o.pulseCd===1.8);
    updateMiniObjective(0,0);check('no repeated pulse',targets[0].hp===9843);
  }
  {
    const o=reactorFixture();o.reactor.hp=1;o.timer=.1;spawnEnemy('tank',0,0);updateMiniObjective(1,0);
    const before=_eventBonusPicksLeft;claimWaveEventReward();
    check('destruction beats time completion',waveEvent.failed&&miniObjective.type==='clear'&&_eventBonusPicksLeft===before);
  }
  return results;
};
`;
(async()=>{
  const browser=await launch(),errors=[];
  try{
    const c=await browser.newContext();await instrument(c,hooks);const p=await c.newPage();
    p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:3000');await p.waitForFunction(()=>!!window.gameTest);
    const results=await p.evaluate(()=>gameTest.reactorEffects());results.forEach(r=>console.log(r.pass?'PASS':'FAIL',r.label,r.details||''));
    assert.deepEqual(results.filter(r=>!r.pass),[]);assert.deepEqual(errors,[]);
    const c2=await browser.newContext();await instrument(c2,hooks);const guest=await c2.newPage();
    guest.on('pageerror',e=>errors.push(e.message));await startCoop(p,guest);
    for(const page of [p,guest])await page.evaluate(()=>gameTest.freezeReactor());
    for(const downed of [false,true]){
      await p.evaluate(()=>gameTest.netReactorPrepare());
      await guest.evaluate(d=>gameTest.netReactorMove(d),downed);
      await p.waitForFunction(d=>{const r=gameTest.netReactorRemote();return r.x===0&&r.z===0&&r.downed===d;},downed);
      const result=await p.evaluate(()=>gameTest.netReactorStep());
      assert.ok(Math.abs(result.hp-(downed?103.6:105))<1e-8);
      assert.ok(Math.abs(result.charge-(downed?.215:.3))<1e-8);
      await guest.waitForFunction(s=>JSON.stringify(gameTest.netReactorState())===JSON.stringify(s),result.snap);
      console.log('PASS synchronized reactor with guest',downed?'downed':'helping');
    }
    assert.deepEqual(errors,[]);
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

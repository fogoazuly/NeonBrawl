const assert=require('node:assert/strict');
const {launch,instrument}=require('./browser-harness.cjs');
const hooks=`
gameTest.totem=id=>{
  mp.soloMode=true;initGame();hideGunSelect();hideMeleeSelect();update=()=>{};
  gState='playing';waveNum=1;waveClear=true;player.invincible=10000;
  if(id){_waveTotemOfferPending=true;_waveTotemOfferId=id;activateWaveTotem();activateWaveTotem();}
  const accepted=_pendingTotemMod;nextWave();const event=waveEvent;waveEvent=null;
  spawnEnemy('tank',8,8);const e=enemies[enemies.length-1];
  const stats={hp:e.maxHp,speed:e.spd,damage:e.dmgMult};
  const count=getWaveConfig(2).reduce((s,[,n])=>s+n,0);
  const old=CRYSTAL_DROP_TABLE.tank;
  try{CRYSTAL_DROP_TABLE.tank={chance:1,min:10,max:10};rollCrystalDrop(e);}finally{CRYSTAL_DROP_TABLE.tank=old;}
  const crystals=runCrystals;
  if(id==='promotion'){
    const random=Math.random;let elites=0;
    try{for(let i=0;i<20;i++){
      Math.random=()=>(i+.5)/20;spawnEnemy('chaser',8,8);const spawned=enemies[enemies.length-1];
      if(spawned.elite==='elite')elites++;releaseEnemySlot(spawned);enemies.pop();
    }}finally{Math.random=random;}stats.elites=elites;
  }
  const active=_activeTotemMod;deliverTotemReward();deliverTotemReward();
  return {accepted,active,event:!!event,...stats,count,crystals,picks:_eventBonusPicksLeft,cleared:_activeTotemMod===null};
};
`;
(async()=>{
  const browser=await launch(),errors=[];
  try{
    const c=await browser.newContext();await instrument(c,hooks);const page=await c.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:3000');await page.waitForFunction(()=>!!window.gameTest);
    const base=await page.evaluate(()=>gameTest.totem(null));
    for(const id of ['doubleTrouble','haste','ironSkin','sharpClaws','promotion','megaSwarm']){
      const r=await page.evaluate(id=>gameTest.totem(id),id);
      assert.equal(r.accepted,id);assert.equal(r.active,id);assert.equal(r.event,false);assert.ok(r.cleared);
      assert.equal(r.count,base.count*(id==='doubleTrouble'?2:id==='megaSwarm'?3:1));
      if(id!=='promotion'){
        assert.equal(r.hp,Math.round(base.hp*(id==='ironSkin'?1.5:id==='megaSwarm'?.6:1)));
        assert.ok(Math.abs(r.speed-base.speed*(id==='haste'?1.5:1))<.001);
        assert.ok(Math.abs(r.damage-base.damage*(id==='sharpClaws'?1.5:1))<.001);
      }else assert.equal(r.elites,10);
      assert.equal(r.crystals,10*(id==='haste'?2:id==='megaSwarm'?3:1));
      assert.equal(r.picks,['doubleTrouble','sharpClaws','promotion'].includes(id)?1:0);
      console.log('PASS wave totem',id);
    }
    assert.deepEqual(errors,[]);
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

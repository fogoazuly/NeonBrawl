const assert=require('node:assert/strict');
const {launch,instrument,startCoop}=require('./browser-harness.cjs');
const hooks=`
gameTest.freezeBossGroup=()=>{update=()=>{};gState='playing';waveClear=false;waveTransition=false;waveEvent=null;resetRelics();for(const k of Object.keys(playerSkills))delete playerSkills[k];};
gameTest.clearBossGroup=()=>{enemies.forEach(e=>{e.dead=true;releaseEnemySlot(e);});enemies.length=0;clearMapSpellsAndAllies();currentBossTargetPoolIdx=null;sendHostState();};
gameTest.bossGroupSnapshot=()=>({map:currentMapLayout,wave:waveNum,clear:waveClear,
  enemies:enemies.map(e=>({id:e.poolIdx,type:e.type,name:e.bossName,hp:e.hp,maxHp:e.maxHp})).sort((a,b)=>a.id-b.id)});
gameTest.prepareBossGroup=({index,uses})=>{
  waveNum=(index+1)*5;waveSpawned=true;waveClear=false;waveTransition=false;waveEvent=null;
  changeMapLayout(BOSS_PRESET_BY_NAME[BOSS_NAMES[index]]);shopTotemUses=uses;spawnWave(waveNum);
  sendHostState();return gameTest.bossGroupSnapshot();
};
gameTest.damageBossGroup=()=>{damageEnemyIndex(0,25);sendHostState();return gameTest.bossGroupSnapshot();};
gameTest.killMiddleBoss=()=>{
  const index=Math.floor(enemies.length/2),id=enemies[index].poolIdx;killEnemy(index);
  sendHostState();return {id,state:gameTest.bossGroupSnapshot()};
};
gameTest.bossGroupCount=()=>BOSS_NAMES.length;
`;
(async()=>{
  const browser=await launch(),errors=[];let cases=0;
  try{
    const pages=[];
    for(let i=0;i<2;i++){const c=await browser.newContext();await instrument(c,hooks);const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));pages.push(p);}
    const [host,guest]=pages;await startCoop(host,guest);
    for(const p of pages)await p.evaluate(()=>gameTest.freezeBossGroup());
    const count=await host.evaluate(()=>gameTest.bossGroupCount());
    const sync=async state=>guest.waitForFunction(s=>JSON.stringify(gameTest.bossGroupSnapshot())===JSON.stringify(s),state);
    for(let index=0;index<count;index++)for(let uses=0;uses<=3;uses++){
      await host.evaluate(()=>gameTest.clearBossGroup());await guest.waitForFunction(()=>gameTest.bossGroupSnapshot().enemies.length===0);
      const before=await host.evaluate(t=>gameTest.prepareBossGroup(t),{index,uses});
      assert.equal(before.enemies.length,2**uses);assert.equal(new Set(before.enemies.map(e=>e.id)).size,2**uses);await sync(before);
      const damaged=await host.evaluate(()=>gameTest.damageBossGroup());
      assert.ok(damaged.enemies[0].hp<before.enemies[0].hp);assert.deepEqual(damaged.enemies.slice(1),before.enemies.slice(1));await sync(damaged);
      if(uses>0){
        const removed=await host.evaluate(()=>gameTest.killMiddleBoss());
        assert.deepEqual(removed.state.enemies,damaged.enemies.filter(e=>e.id!==removed.id));
        assert.equal(removed.state.clear,false,'remaining bosses prevent wave completion');await sync(removed.state);
      }
      console.log('PASS boss group',index,2**uses);cases++;
    }
    assert.deepEqual(errors,[]);console.log('PASS cooperative boss groups',cases);
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

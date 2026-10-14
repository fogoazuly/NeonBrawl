const assert=require('node:assert/strict');
const {launch,instrument}=require('./browser-harness.cjs');
const hooks=`
gameTest.bossPlacement=({index,difficulty,uses})=>{
  update=()=>{};mp.soloMode=true;gState='playing';nbDifficulty=difficulty;
  waveNum=(index+1)*5;waveEvent=null;waveClear=false;waveTransition=false;
  for(const e of enemies){e.dead=true;releaseEnemySlot(e);}enemies.length=0;currentBossTargetPoolIdx=null;
  changeMapLayout(BOSS_PRESET_BY_NAME[BOSS_NAMES[index]]);clearMapSpellsAndAllies();
  shopTotemUses=uses;spawnWave(waveNum);
  const failures=[];
  for(const e of enemies){
    const {x,z}=e.pos,r=e.cfg.r;
    if(!Number.isFinite(x)||!Number.isFinite(z)||Math.abs(x)>ARENA_W-r+1e-6||Math.abs(z)>ARENA_H-r+1e-6||
      obstacleBoxes.some(o=>!o.gone&&Math.hypot(Math.max(Math.abs(x-o.x)-o.hw,0),Math.max(Math.abs(z-o.z)-o.hd,0))<r-1e-6))
      failures.push({x,z,r});
  }
  return {count:enemies.length,total:waveEnemyTotal,name:BOSS_NAMES[index],
    names:enemies.map(e=>e.bossName),ids:enemies.map(e=>e.poolIdx),
    validHp:enemies.every(e=>Number.isFinite(e.hp)&&e.hp>0&&e.hp===e.maxHp),failures};
};
gameTest.bossPlacementInventory=()=>({difficulties:Object.keys(DIFFICULTY),bosses:BOSS_NAMES.length,maxUses:SHOP_TOTEM_MAX_USES});
`;
(async()=>{
  const browser=await launch(),errors=[];let cases=0,bosses=0;
  try{
    const c=await browser.newContext();await instrument(c,hooks);const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));
    await p.goto('http://127.0.0.1:3000');await p.waitForFunction(()=>!!window.gameTest);
    const inv=await p.evaluate(()=>gameTest.bossPlacementInventory());
    for(const difficulty of inv.difficulties)for(let index=0;index<inv.bosses;index++)for(let uses=0;uses<=inv.maxUses;uses++){
      const r=await p.evaluate(t=>gameTest.bossPlacement(t),{index,difficulty,uses});
      const label=JSON.stringify({difficulty,index,uses});
      assert.equal(r.count,2**uses,label);assert.equal(r.total,r.count,label);assert.equal(new Set(r.ids).size,r.count,label);
      assert.ok(r.names.every(n=>n===r.name),label);assert.ok(r.validHp,label);assert.deepEqual(r.failures,[],label);
      cases++;bosses+=r.count;
    }
    assert.deepEqual(errors,[]);console.log('PASS boss placement',JSON.stringify({cases,bosses}));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

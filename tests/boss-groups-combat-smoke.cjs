const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const {launch,instrument}=require('./browser-harness.cjs');
const hooks=`
const groupCombatUpdate=update;
gameTest.bossCombat=({index,uses})=>{
  mp.soloMode=true;initGame();hideGunSelect();hideMeleeSelect();update=()=>{};
  nbDifficulty='hard';gState='playing';waveNum=(index+1)*5;waveSpawned=true;waveClear=false;waveTransition=false;waveEvent=null;
  changeMapLayout(BOSS_PRESET_BY_NAME[BOSS_NAMES[index]]);shopTotemUses=uses;spawnWave(waveNum);
  player.invincible=10000;player.pos.set(0,0,0);
  const bosses=enemies.filter(e=>e.type==='boss'),phases=[];
  if(bosses.length!==2**uses)throw new Error('wrong initial count');
  for(const fraction of [1,0.6,0.3]){
    const before=bosses.map(e=>e.attackSeq||0);
    for(const e of bosses){e.hp=e.maxHp*fraction;e.spawnAnim=0;e.specialCd=0;e.slamCd=0;e.burstCd=0;e.fireCd=0;}
    for(let step=0;step<240;step++){
      groupCombatUpdate(1/60);
      for(const e of enemies)for(const v of [e.hp,e.pos.x,e.pos.z])if(!Number.isFinite(v))throw new Error('non-finite enemy state');
      for(const b of bulletPool)if(b.active)for(const v of [b.pos.x,b.pos.z,b.life])if(!Number.isFinite(v))throw new Error('non-finite projectile');
      if(gState!=='playing'||waveClear)throw new Error('premature combat completion');
    }
    const phase=fraction===1?1:fraction===0.6?2:3;
    const attacks=bosses.map((e,i)=>(e.attackSeq||0)-before[i]);
    if(bosses.some(e=>e.phase!==phase||e.dead||!enemies.includes(e)))throw new Error('boss phase/lifecycle mismatch');
    if(attacks.some(n=>n<=0))throw new Error('inactive boss '+JSON.stringify({phase,attacks}));
    phases.push({phase,attacks,enemies:enemies.length,bullets:bulletPool.filter(b=>b.active).length});
  }
  return {boss:BOSS_NAMES[index],uses,count:bosses.length,phases};
};
`;
(async()=>{
  const browser=await launch(),report={cases:[],failures:[]};
  try{
    const c=await browser.newContext();await instrument(c,hooks);const p=await c.newPage();p.on('pageerror',e=>report.failures.push({async:e.message}));
    await p.goto('http://127.0.0.1:3000');await p.waitForFunction(()=>!!window.gameTest);
    const inv=await p.evaluate(()=>gameTest.inventory());
    for(let index=0;index<inv.bosses.length;index++)for(const uses of [1,2,3]){
      try{const r=await p.evaluate(t=>gameTest.bossCombat(t),{index,uses});report.cases.push(r);console.log('PASS',r.boss,r.count);}
      catch(e){report.failures.push({index,uses,error:e.message});console.log('FAIL',index,uses,e.message);}
    }
    assert.deepEqual(report.failures,[]);console.log('PASS scenarios',report.cases.length);
  }finally{await fs.writeFile('test-results/boss-groups-combat.json',JSON.stringify(report,null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

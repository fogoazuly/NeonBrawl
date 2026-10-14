const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const {launch,instrument}=require('./browser-harness.cjs');
const hooks=`
gameTest.enemyCase=(kind,id,difficulty,variant)=>{
  initGame();hideGunSelect();hideMeleeSelect();
  nbDifficulty=difficulty;gState='playing';waveNum=20;waveSpawned=true;waveClear=false;
  obstacleBoxes.length=0;player.pos.set(0,0,0);player.invincible=10000;
  if(kind==='boss') {
    waveNum=(BOSS_NAMES.indexOf(id)+1)*5;spawnBoss(waveNum);
  } else spawnEnemy(id,0,5);
  const enemy=enemies[enemies.length-1];enemy.pos.set(0,0,5);enemy.spawnAnim=0;
  if(variant){enemy.elite=variant;enemy.eliteCd=0;}
  const phases=[];
  for(const fraction of (kind==='boss'?[1,0.6,0.3]:[1])) {
    enemy.hp=enemy.maxHp*fraction;
    enemy.specialCd=0;enemy.slamCd=0;enemy.burstCd=0;enemy.fireCd=0;
    const attacks=enemy.attackSeq||0;
    for(let i=0;i<240;i++)update(1/60);
    for(const e of enemies)for(const value of [e.hp,e.pos.x,e.pos.z])
      if(!Number.isFinite(value))throw new Error('Non-finite enemy state');
    if(kind==='boss'){
      const expected=fraction===1?1:fraction===0.6?2:3;
      if(enemy.phase!==expected)throw new Error('Incorrect boss phase: '+enemy.phase);
      if((enemy.attackSeq||0)<=attacks)throw new Error('Boss did not attack');
      phases.push({phase:enemy.phase,attacks:enemy.attackSeq-attacks});
    }
  }
  const beforeScore=score,beforeKills=killCount;
  if(!enemy.dead)killEnemy(enemies.indexOf(enemy));
  if(!enemy.dead)throw new Error('Enemy survived kill');
  if(score<=beforeScore&&killCount<=beforeKills&&id!=='bomber')throw new Error('Kill did not award progress');
  return {kind,id,difficulty,variant,phases,score,kills:killCount};
};
`;
(async()=>{
  const browser=await launch(),report={scope:'Controlled AI simulation, finite state and death. Boss phase transitions and attack activity in all difficulties; regular, elite and champion enemy branches. Does not establish balance or every attack hitbox.',cases:[],failures:[]};
  try{
    const context=await browser.newContext();await instrument(context,hooks);
    const page=await context.newPage();page.on('pageerror',e=>report.failures.push({asynchronous:e.message}));
    await page.goto('http://127.0.0.1:3000');await page.waitForFunction(()=>!!window.gameTest);
    const inventory=await page.evaluate(()=>gameTest.inventory());
    const cases=[];
    for(const id of inventory.enemies.filter(id=>id!=='boss'))for(const variant of [null,'elite','champion'])cases.push({kind:'enemy',id,difficulty:'hard',variant});
    for(const id of inventory.bosses)for(const difficulty of inventory.difficulties)cases.push({kind:'boss',id,difficulty});
    for(const test of cases){
      try{report.cases.push(await page.evaluate(t=>gameTest.enemyCase(t.kind,t.id,t.difficulty,t.variant),test));}
      catch(e){report.failures.push({...test,error:e.message});console.log('FAIL',test,e.message);}
    }
    // Let real-time callbacks queued by death effects finish before checking errors.
    await page.waitForTimeout(1200);
    console.log('Enemy/boss scenarios',report.cases.length,'failures',report.failures.length);
    assert.deepEqual(report.failures,[]);
  }finally{
    await fs.mkdir('test-results',{recursive:true});await fs.writeFile('test-results/enemies.json',JSON.stringify(report,null,2));await browser.close();
  }
})().catch(e=>{console.error(e);process.exitCode=1;});

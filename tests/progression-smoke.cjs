const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const {launch,instrument,startSolo}=require('./browser-harness.cjs');
const hooks=`
const progressionUpdate=update;
gameTest.progressionStart=()=>{update=()=>{};};
gameTest.progressionState=()=>({state:gState,wave:waveNum,clear:waveClear,intro:waveTransition,
  map:currentMapLayout,mapType:ARENA_PRESETS[currentMapLayout]?.type,score,kills:killCount,hp:player.hp,
  objective:miniObjective?.type,complete:miniObjective?.complete,queue:_waveSpawnQueue.length,enemies:enemies.length,
  picks:Object.values(playerSkillPicks).reduce((a,b)=>a+b,0),shopDone:runShopDoneWave,
  summary:document.getElementById('bossRunSummary').classList.contains('show')});
gameTest.progressionDrive=()=>{
  for(let step=0;step<200;step++){
    player.invincible=10000;
    if(gState==='shopround'){player.pos.set(0,0,EXIT_Z);progressionUpdate(.05);break;}
    if(gState!=='playing'||waveTransition)break;
    if(waveClear){if(exitOpen)player.pos.set(0,0,EXIT_Z);progressionUpdate(.05);break;}
    // Combat is shortened through the normal kill path; waves are never assigned.
    for(const e of [...enemies]){const i=enemies.indexOf(e);if(i>=0&&!e.dead)killEnemy(i);}
    const o=miniObjective;
    if(o&&!o.complete){
      if(o.type==='cells'&&o.cells.active)player.pos.set(o.cells.posX,0,o.cells.posZ);
      else if(o.type==='relays'){const p=o.relays.positions[o.relays.index];player.pos.set(p.x,0,p.z);}
      else if(o.type==='defend')player.pos.set(0,0,0);
      else if(o.type==='survive'){const p=o.safe.zones[0];player.pos.set(p.x,0,p.z);}
      else if(o.type==='spawners')for(const s of o.spawners)if(s.alive){player.pos.set(s.x,0,s.z);damageMiniObjectiveAt(s.x,s.z,100000);}
    }
    progressionUpdate(.05);
  }
  return gameTest.progressionState();
};
`;
async function run(){
  const difficultyIndex=Number(process.argv[2]||0);
  assert.ok(Number.isInteger(difficultyIndex)&&difficultyIndex>=0&&difficultyIndex<5);
  const browser=await launch(),errors=[],history=[];
  try{
    const c=await browser.newContext();await instrument(c,hooks);const p=await c.newPage();
    p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:3000');
    if(difficultyIndex===0)await startSolo(p);
    else {
      await p.locator('#playBtn').click();await p.locator('#nbDiffGrid button').nth(difficultyIndex).click();
      await p.locator('#gunCards button').first().click({force:true});await p.locator('#meleeCards button').first().click({force:true});
      await p.locator('#buffCards .buff-card').first().waitFor({state:'visible'});
      await p.locator('#buffCards .buff-card').first().click({force:true});
      await p.waitForFunction(()=>gameTest.state().wave===1);
    }
    await p.evaluate(()=>gameTest.progressionStart());
    const deadline=Date.now()+180000;let previous=0,last;
    while(Date.now()<deadline){
      last=await p.evaluate(()=>gameTest.progressionDrive());
      assert.ok(Number.isFinite(last.hp)&&last.hp>0);assert.ok(['normal','boss','shop'].includes(last.mapType));
      assert.ok(last.wave===previous||last.wave===previous+1,'Wave skipped: '+JSON.stringify(last));
      if(last.wave!==previous){
        assert.equal(last.mapType,last.wave%5===0?'boss':'normal');
        history.push(last);console.log('PASS difficulty',difficultyIndex,'entered wave',last.wave,'map',last.map,'kills',last.kills);previous=last.wave;
      }
      if(last.wave>=11)break;
      if(last.summary){await p.locator('.boss-summary-close').click();continue;}
      if(last.state==='buffselect'){
        const card=p.locator('#buffCards .buff-card:visible:not([aria-disabled="true"])').first();
        if(await card.count()){await card.click({force:true});await p.waitForTimeout(750);continue;}
      }
      assert.ok(!['menu','gameover'].includes(last.state),JSON.stringify(last));
      await p.waitForTimeout(100);
    }
    assert.equal(last.wave,11,'Progression stalled: '+JSON.stringify(last));
    assert.ok(last.kills>0&&last.score>0);assert.ok(last.picks>1);assert.ok(last.shopDone>=9);
    assert.deepEqual(errors,[]);console.log('PASS ten consecutive waves, two bosses, rewards and shops');
  }finally{
    await fs.mkdir('test-results',{recursive:true});
    await fs.writeFile('test-results/progression-'+difficultyIndex+'.json',JSON.stringify({difficultyIndex,scope:'One continuous solo run; invulnerability, direct kills and objective positioning accelerate combat. Real wave/reward/shop transitions and UI card choices. Not natural gameplay.',history,errors},null,2));
    await browser.close();
  }
}
module.exports={hooks};
if(require.main===module)run().catch(e=>{console.error(e);process.exitCode=1;});

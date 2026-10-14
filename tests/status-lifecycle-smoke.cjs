const assert=require('node:assert/strict');
const {launch,instrument}=require('./browser-harness.cjs');
const hooks=`
function statusFixture(){
  mp.soloMode=true;initGame();hideGunSelect();hideMeleeSelect();gState='playing';
  player.invincible=10000;spawnEnemy('chaser',8,8);return enemies[enemies.length-1];
}
function markStatus(e){
  applyEnemySlow(e,2);phaseVulnMap.set(e.poolIdx,{t:2});
  poisonMap.set(e.poolIdx,{t:3,tick:0,dmg:20});tagElement(e,'fire',100);
}
function statusState(id){return {slow:slowMap.has(id),vulnerable:phaseVulnMap.has(id),poison:poisonMap.has(id),
  tag:elementTagMap.has(id),visible:_tagIndicators.some(i=>i.visible&&i._poolIdx===id)};}
gameTest.statusLifecycle=()=>{
  const results=[];let e=statusFixture();
  applyEnemySlow(e,2);applyEnemySlow(e,.5);results.push({label:'shorter slow preserves duration',pass:slowMap.get(e.poolIdx)===2});
  tickStatusMaps(.5);applyEnemySlow(e,3);results.push({label:'longer slow refreshes duration',pass:slowMap.get(e.poolIdx)===3});
  tickStatusMaps(3);results.push({label:'slow expires at boundary',pass:!slowMap.has(e.poolIdx)});
  for(const [level,duration] of [[0,3],[3,4.5],[5,6.6]]){
    playerSkills.lingeringMarks=level;tagElement(e,'fire',100);
    const t=elementTagMap.get(e.poolIdx).t;tickElementTags(duration+.0001);
    results.push({label:'tag duration level '+level,pass:Math.abs(t-duration)<1e-8&&!elementTagMap.has(e.poolIdx)&&!statusState(e.poolIdx).visible});
  }
  for(const action of ['kill','new run','map cleanup']){
    e=statusFixture();markStatus(e);const id=e.poolIdx;
    if(action==='kill')killEnemy(enemies.indexOf(e));
    else if(action==='new run')initGame();else clearMapSpellsAndAllies();
    const state=statusState(id);results.push({label:action+' clears statuses',pass:Object.values(state).every(v=>!v),state});
    if(action==='kill'){
      spawnEnemy('chaser',8,8);const next=enemies[enemies.length-1];const before=next.hp;
      tagElement(next,'ice',100);
      results.push({label:'reused slot has no inherited reaction',pass:next.poolIdx===id&&next.hp===before});
    }
  }
  return results;
};
`;
(async()=>{
  const browser=await launch(),errors=[];
  try{
    const c=await browser.newContext();await instrument(c,hooks);const p=await c.newPage();
    p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:3000');await p.waitForFunction(()=>!!window.gameTest);
    const results=await p.evaluate(()=>gameTest.statusLifecycle());console.log(results);
    assert.deepEqual(results.filter(r=>!r.pass),[]);assert.deepEqual(errors,[]);
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

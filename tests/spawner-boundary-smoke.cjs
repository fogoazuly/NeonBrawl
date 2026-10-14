const assert=require('node:assert/strict');
const {launch,instrument}=require('./browser-harness.cjs');
const hooks=`
gameTest.spawnerBoundary=()=>{
  mp.soloMode=true;initGame();hideGunSelect();hideMeleeSelect();update=()=>{};
  gState='playing';waveNum=3;waveClear=false;waveTransition=false;obstacleBoxes.length=0;
  const results=[];
  for(const [label,distance,dead,downed,refresh] of [
    ['center',0,false,false,true],['outer band',2.5,false,false,true],
    ['inclusive edge',2.9,false,false,true],['outside',2.901,false,false,true],
    ['leave before objective update',3,false,false,false],
    ['dead before objective update',0,true,false,false],
    ['downed before objective update',0,false,true,false]
  ]){
    setupMiniObjective(3,'spawners');const s=miniObjective.spawners[0];s.x=0;s.z=0;
    for(const sp of miniObjective.spawners){sp.hp=sp.maxHp=10000;sp.cd=10000;}
    player.pos.set(0,0,0);player.dead=false;player.downed=false;player.hp=100;
    updateMiniObjective(0,0); // establish a previously armed state
    player.pos.set(distance,0,0);player.dead=dead;player.downed=downed;player.hp=dead||downed?0:100;
    if(refresh)updateMiniObjective(0,0);
    const beforeArmed=s.armed,status=miniObjectiveStatus();
    damageMiniObjectiveAt(0,0,100);
    const expected=!dead&&!downed&&distance<=2.9;
    results.push({label,expected,beforeArmed,armed:s.armed,damage:10000-s.hp,status,refresh});
  }
  return results;
};
`;
(async()=>{
  const browser=await launch(),errors=[];
  try{
    const context=await browser.newContext();await instrument(context,hooks);const page=await context.newPage();
    page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:3000');
    await page.waitForFunction(()=>!!window.gameTest);
    const results=await page.evaluate(()=>gameTest.spawnerBoundary());console.log(results);
    const failures=results.filter(r=>r.damage!==(r.expected?75:0)||r.armed!==r.expected||
      (r.refresh&&(r.beforeArmed!==r.expected||r.status.includes('BREACH')!==r.expected)));
    assert.deepEqual(failures,[]);assert.deepEqual(errors,[]);
    console.log('PASS seven activation boundary and stale-state scenarios');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

const assert=require('node:assert/strict');
const {launch,instrument}=require('./browser-harness.cjs');
const hooks=`
gameTest.lethalReaction=pair=>{
  mp.soloMode=true;initGame();hideGunSelect();hideMeleeSelect();gState='playing';player.invincible=10000;
  const targets=[];
  for(let i=0;i<6;i++){spawnEnemy('chaser',i===5?8:i*.7,0);const e=enemies[enemies.length-1];e.hp=1;e.maxHp=10000;targets.push(e);}
  const root=targets[0];let error=null;
  try{tagElement(root,pair[0],100);tagElement(root,pair[1],100);}catch(e){error=e.message;}
  const chain=pair.includes('thunder')&&!pair.includes('ice');
  const deaths=targets.map(e=>e.dead);
  const leaked=targets.filter(e=>e.dead&&(slowMap.has(e.poolIdx)||poisonMap.has(e.poolIdx)||elementTagMap.has(e.poolIdx))).map(e=>e.poolIdx);
  return {pair,error,deaths,expected:chain?[true,true,true,true,false,false]:[true,false,false,false,false,false],leaked};
};
`;
(async()=>{
  const browser=await launch(),errors=[],results=[];
  try{
    const c=await browser.newContext();await instrument(c,hooks);const p=await c.newPage();
    p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:3000');await p.waitForFunction(()=>!!window.gameTest);
    for(const pair of [['fire','ice'],['fire','poison'],['ice','thunder'],['fire','thunder'],['poison','thunder']]){
      const r=await p.evaluate(pair=>gameTest.lethalReaction(pair),pair);results.push(r);console.log(r);
    }
    assert.deepEqual(results.filter(r=>r.error||r.leaked.length||JSON.stringify(r.deaths)!==JSON.stringify(r.expected)),[]);
    assert.deepEqual(errors,[]);
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

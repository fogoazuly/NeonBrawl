const assert=require('node:assert/strict');
const {launch,instrument}=require('./browser-harness.cjs');
const hooks=`
gameTest.masteryReaction=({pair,level,slowed=false})=>{
  mp.soloMode=true;initGame();hideGunSelect();hideMeleeSelect();gState='playing';
  playerSkills.elementalMastery=level;const targets=[];
  for(const x of [0,4,1,2,3,9]){
    spawnEnemy('chaser',x,0);const e=enemies[enemies.length-1];e.hp=e.maxHp=10000;targets.push(e);
  }
  if(slowed)applyEnemySlow(targets[0],2);
  const random=Math.random;
  try{Math.random=()=>.999;tagElement(targets[0],pair[0],100);tagElement(targets[0],pair[1],100);}
  finally{Math.random=random;}
  return targets.map(e=>({damage:10000-e.hp,slow:slowMap.get(e.poolIdx)||0,
    poison:poisonMap.get(e.poolIdx)?.dmg||0,duration:poisonMap.get(e.poolIdx)?.t||0,
    tagged:elementTagMap.has(e.poolIdx)}));
};
`;
(async()=>{
  const browser=await launch(),errors=[];let count=0;
  const pairs=[['fire','ice'],['fire','thunder'],['fire','poison'],['ice','thunder'],['ice','poison'],['poison','thunder']];
  // Multipliers advertised by the skill descriptions; level 3 retains +45%.
  const advertised=[1,1.25,1.45,1.45,1.75,2.1];
  try{
    const c=await browser.newContext();await instrument(c,hooks);const p=await c.newPage();
    p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:3000');await p.waitForFunction(()=>!!window.gameTest);
    for(const pair of pairs){
      let baseline;
      for(let level=0;level<=5;level++){
        const result=await p.evaluate(a=>gameTest.masteryReaction(a),{pair,level});
        const reversed=await p.evaluate(a=>gameTest.masteryReaction(a),{pair:[...pair].reverse(),level});count+=2;
        assert.deepEqual(result,reversed,'Order must not alter '+pair);
        assert.equal(result[0].tagged,false,'Reaction consumes elemental tag');
        assert.ok(result.some(r=>r.damage>0||r.poison>0));
        if(level===0)baseline=result;
        for(let i=0;i<result.length;i++){
          for(const key of ['damage','poison'])assert.ok(Math.abs(result[i][key]-baseline[i][key]*advertised[level])<=2,
            JSON.stringify({pair,level,i,key,actual:result[i],baseline:baseline[i]}));
          assert.equal(result[i].slow,baseline[i].slow);assert.equal(result[i].duration,baseline[i].duration);
        }
        const chain=pair.includes('thunder')&&!pair.includes('ice');
        assert.deepEqual(result.map(r=>r.damage>0||r.poison>0),chain?[true,false,true,true,true,false]:[true,false,false,false,false,false]);
      }
      console.log('PASS levels 0–5, reverse order, payload and target limit',pair.join('+'));
    }
    const normal=await p.evaluate(a=>gameTest.masteryReaction(a),{pair:['ice','thunder'],level:0});
    const frozen=await p.evaluate(a=>gameTest.masteryReaction(a),{pair:['ice','thunder'],level:0,slowed:true});
    assert.ok(frozen[0].damage>normal[0].damage);count+=2;
    for(const element of ['fire','ice','poison','thunder']){
      const result=await p.evaluate(a=>gameTest.masteryReaction(a),{pair:[element,element],level:5});count++;
      assert.ok(result.every(r=>r.damage===0&&r.poison===0));assert.equal(result[0].tagged,true);
    }
    assert.deepEqual(errors,[]);console.log('PASS',count,'reaction scenarios including Shatter bonus and repeated same element');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

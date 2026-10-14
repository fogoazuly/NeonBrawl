const assert=require('node:assert/strict');
const {launch,instrument}=require('./browser-harness.cjs');
const {hooks:base}=require('./boss-group-rewards-smoke.cjs');
const hooks=base+`
const comboEnsure=_ensureRelicPickState;let comboRoll=0,comboRolls=0,comboSequence=null;
getBossSkillChoices=()=>[(playerSkillPicks.rapidFire||0)<skillMaxLevel('rapidFire')?'rapidFire':'spread'];
_ensureRelicPickState=phase=>{const saved=Math.random;try{Math.random=()=>{const value=comboSequence?(comboSequence[comboRolls]?0:0.999):comboRoll;comboRolls++;return value;};comboEnsure(phase);}finally{Math.random=saved;}};
gameTest.comboEquip=({level,success,sequence})=>{for(let i=0;i<level;i++)applyRelic('fateGambit');comboRoll=success?0:0.999;comboSequence=sequence||null;comboRolls=0;return gameTest.groupRewardState();};
gameTest.comboRolls=()=>comboRolls;
gameTest.comboCards=()=>Object.values(playerSkillPicks).reduce((a,b)=>a+b,0);
`;
(async()=>{
  const browser=await launch(),errors=[];
  try{
    const c=await browser.newContext();await instrument(c,hooks);const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));
    await p.goto('http://127.0.0.1:3000');await p.waitForFunction(()=>!!window.gameTest);
    const cases=[];
    if(process.argv.includes('--mixed')){
      for(const level of [1,2,3])for(const sequence of [[true,false,true,true],[true,false,false,false],[false,true,false,true],[false,false,false,true]])cases.push({level,sequence,crown:3,uses:3});
    }else for(const level of [1,2,3])for(const success of [false,true])for(const crown of [0,3])for(const uses of [0,3])cases.push({level,success,crown,uses});
    const failures=[];
    for(const spec of cases){
      const {level,success,crown,uses,sequence}=spec;await p.evaluate(t=>gameTest.prepareGroupReward(t),spec);
      const before=await p.evaluate(t=>gameTest.comboEquip(t),spec);
      for(let i=0;i<2**uses;i++)await p.evaluate(()=>gameTest.killRewardBoss());
      await p.waitForFunction(()=>gameTest.groupRewardState().summary);await p.locator('.boss-summary-close').click();
      for(let clicks=0;clicks<12;clicks++){
        const s=await p.evaluate(()=>gameTest.groupRewardState());if(s.exit)break;
        await p.locator('#buffCards .buff-card:visible').first().click({force:true});await p.waitForTimeout(750);
      }
      const end=await p.evaluate(()=>gameTest.repeatRewardUpdate());
      const offers=1+(crown?2:0)+(uses?1:0);
      // New bonus offers stop at the ordinary cap; a successful Fate chain finishes in full.
      let rolls=0,cards=0;
      while(rolls<offers&&cards<3){if(sequence?sequence[rolls]:success)cards+=level+1;rolls++;}
      const actualCards=await p.evaluate(()=>gameTest.comboCards()),actualRolls=await p.evaluate(()=>gameTest.comboRolls());
      if(actualCards!==cards||actualRolls!==rolls)failures.push({spec,cards,rolls,actualCards,actualRolls});
      assert.equal(end.relics-before.relics,uses?2:0);assert.equal(end.bonusCards,0);assert.equal(end.bonusRelics,0);
      assert.equal(end.state,'playing');assert.equal(end.exit,true);assert.equal(end.queues,1);
      console.log(actualCards===cards&&actualRolls===rolls?'PASS':'FAIL','reward combination',JSON.stringify(spec),JSON.stringify({cards,rolls,actualCards,actualRolls}));
    }
    assert.deepEqual(failures,[]);
    assert.deepEqual(errors,[]);
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

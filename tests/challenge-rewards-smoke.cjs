const assert=require('node:assert/strict');
const {launch,instrument}=require('./browser-harness.cjs');
const hooks=`
// Exhausted-pool fallback is tested independently of Fate Gambit's random extra picks.
_phaseUsesFateGambit=()=>false;
gameTest.challengeSetup=(sub,full=false)=>{
  mp.soloMode=true;initGame();hideGunSelect();hideMeleeSelect();update=()=>{};
  gState='playing';waveNum=2;waveClear=true;waveTransition=false;waveSpawned=true;
  if(full)for(const id of Object.keys(RELIC_DEFS))for(let n=0;n<3;n++)applyRelic(id);
  waveEvent={type:'challenge',sub};claimWaveEventReward();claimWaveEventReward();afterBuffSelect();
};
gameTest.rewardState=()=>({wave:waveNum,state:gState,skills:Object.values(playerSkillPicks).reduce((a,b)=>a+b,0),relics:Object.values(playerRelics).reduce((a,b)=>a+b,0),bonus:_eventBonusPicksLeft,phase:_buffSelectPhase});
`;
(async()=>{
  const browser=await launch(),errors=[],failures=[];
  try{
    const c=await browser.newContext();await instrument(c,hooks);const page=await c.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:3000');await page.waitForFunction(()=>!!window.gameTest);
    for(const [choice,full] of [['card',false],['relic',false],['relic',true]]){
      await page.evaluate(t=>gameTest.challengeSetup('speedDemon',t),full);
      const before=await page.evaluate(()=>gameTest.rewardState());
      await page.locator('#buffCards .buff-card').nth(choice==='card'?1:0).dblclick({force:true});
      await page.waitForTimeout(800);
      await page.locator('#buffCards .buff-card').first().dblclick({force:true});
      await page.waitForTimeout(800);
      const actual=await page.evaluate(()=>gameTest.rewardState());
      const expected={wave:3,skills:before.skills+(choice==='card'||full?1:0),relics:before.relics+(choice==='relic'&&!full?1:0),bonus:0};
      const observed={wave:actual.wave,skills:actual.skills,relics:actual.relics,bonus:actual.bonus};
      try{assert.deepEqual(observed,expected);console.log('PASS challenge reward',choice,'full',full);}catch{failures.push({choice,full,observed,expected});}
    }
    await page.evaluate(()=>gameTest.challengeSetup('meteorStorm'));
    await page.locator('#buffCards .buff-card').nth(1).click({force:true});
    await page.evaluate(()=>gameTest.quit());await page.waitForTimeout(800);
    const canceled=await page.evaluate(()=>gameTest.rewardState());
    if(canceled.state!=='menu')failures.push({cancel:canceled});else console.log('PASS leaving cancels reward animation');
    await page.evaluate(()=>gameTest.challengeSetup('meteorStorm'));
    await page.locator('#buffCards .buff-card').nth(1).click({force:true});
    await page.evaluate(()=>{gameTest.quit();gameTest.challengeSetup('plagueField');});
    await page.waitForTimeout(800);
    const restarted=await page.evaluate(()=>gameTest.rewardState());
    assert.equal(restarted.phase,'challenge');assert.equal(restarted.bonus,0);assert.equal(restarted.skills,0);
    console.log('PASS old animation does not change new run');
    assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

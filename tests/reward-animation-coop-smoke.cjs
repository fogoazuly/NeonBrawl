const assert=require('node:assert/strict');
const {launch,instrument,startCoop}=require('./browser-harness.cjs');
const hooks=`
getBossSkillChoices=()=>['rapidFire'];getRelicChoices=()=>['heavyCrown'];
gameTest.animationCoopPrepare=phase=>{
  update=()=>{};gState='playing';waveNum=5;waveClear=true;waveSpawned=true;waveTransition=false;waveEvent=null;
  resetRelics();for(const k of Object.keys(playerSkills))delete playerSkills[k];
  for(const k of Object.keys(playerSkillPicks))delete playerSkillPicks[k];
  if(phase==='relic'){bossBonusRelicsLeft=1;showRelicSelect();}else showBuffSelect('boss');
};
gameTest.animationCoopClick=()=>{
  document.querySelector('#buffCards .buff-card').click();
  return document.getElementById('buffCards').classList.contains('choosing-card');
};
gameTest.animationCoopState=()=>({state:gState,rapid:playerSkillPicks.rapidFire||0,crown:relicLevel('heavyCrown'),
  visible:document.getElementById('buffSelect').style.display!=='none',players:mpPlayerIds().length});
`;
(async()=>{
  const browser=await launch(),errors=[];
  try{
    for(const phase of ['boss','relic'])for(const leaving of [0,1]){
      const contexts=[],pages=[];
      for(let i=0;i<2;i++){const c=await browser.newContext();contexts.push(c);await instrument(c,hooks);const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));pages.push(p);}
      const [host,guest]=pages;await startCoop(host,guest);
      for(const p of pages)await p.evaluate(t=>gameTest.animationCoopPrepare(t),phase);
      // Both callbacks are pending: departing player's callback must cancel;
      // a remaining host can finish, while a disconnected guest must cancel.
      for(const p of pages)assert.equal(await p.evaluate(()=>gameTest.animationCoopClick()),true);
      await pages[leaving].evaluate(()=>gameTest.quit());
      if(leaving===0)await guest.waitForFunction(()=>gameTest.animationCoopState().state==='menu');
      else await host.waitForFunction(()=>gameTest.animationCoopState().players===1);
      await pages[0].waitForTimeout(900);
      for(const [i,p] of pages.entries()){
        const s=await p.evaluate(()=>gameTest.animationCoopState()),keepsReward=leaving===1&&i===0;
        assert.equal(s.state,keepsReward?'playing':'menu');assert.equal(s.visible,false);
        assert.equal(s.rapid,keepsReward&&phase==='boss'?1:0);assert.equal(s.crown,keepsReward&&phase==='relic'?1:0);
      }
      console.log('PASS cooperative animation cancellation',phase,'leaving',leaving);
      for(const c of contexts)await c.close();
    }
    assert.deepEqual(errors,[]);
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

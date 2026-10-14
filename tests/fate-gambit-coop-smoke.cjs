const assert=require('node:assert/strict');
const {launch,instrument,startCoop}=require('./browser-harness.cjs');
const {hooks:base}=require('./boss-group-rewards-coop-smoke.cjs');
const hooks=base+`
const coopFateEnsure=_ensureRelicPickState;let coopFateRoll=0,coopFateRolls=0;
_ensureRelicPickState=phase=>{const random=Math.random;try{Math.random=()=>{coopFateRolls++;return coopFateRoll;};coopFateEnsure(phase);}finally{Math.random=random;}};
gameTest.equipFate=({level,success})=>{for(let i=0;i<level;i++)applyRelic('fateGambit');coopFateRoll=success?0:0.999;};
gameTest.fateRollCount=()=>coopFateRolls;
gameTest.rewardBroadcast=()=>sendHostState();
gameTest.fateEnterPortal=()=>{player.pos.set(0,0,EXIT_Z);return gameTest.rewardTick();};
gameTest.fateExitState=()=>({ready:Object.values(mp.exitReady).filter(Boolean).length,queued:mp.exitStartQueued,
  phase:_buffSelectPhase,wave:waveNum,clear:waveClear,state:gState});
`;
async function run(){
  const browser=await launch(),errors=[];
  try{
    for(const level of [1,2,3])for(const winner of [0,1]){
      const contexts=[],pages=[];
      for(let i=0;i<2;i++){const c=await browser.newContext();contexts.push(c);await instrument(c,hooks);const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));pages.push(p);}
      const [host,guest]=pages;await startCoop(host,guest);
      for(const [i,p] of pages.entries()){await p.evaluate(()=>gameTest.rewardFreeze(0));await p.evaluate(t=>gameTest.equipFate(t),{level,success:i===winner});}
      await host.evaluate(()=>gameTest.rewardAnnounce());await guest.waitForFunction(()=>gameTest.rewardState().wave===5);
      await host.evaluate(()=>gameTest.rewardSpawn());await guest.waitForFunction(()=>gameTest.rewardState().count===1);
      await host.evaluate(()=>gameTest.rewardKill());await guest.waitForFunction(()=>gameTest.rewardState().count===0);
      await guest.evaluate(()=>gameTest.rewardTick());
      for(const p of pages){await p.waitForFunction(()=>gameTest.rewardState().summary);await p.locator('.boss-summary-close').click();}
      const skipped=await pages[1-winner].evaluate(()=>gameTest.rewardState());
      assert.equal(skipped.rapid,0);assert.equal(skipped.state,'playing');assert.equal(skipped.exit,true);
      assert.equal((await pages[winner].evaluate(()=>gameTest.rewardState())).state,'buffselect');
      await pages[1-winner].evaluate(()=>gameTest.fateEnterPortal());
      await host.waitForFunction(()=>gameTest.fateExitState().ready===1);
      await host.waitForTimeout(300);
      assert.equal((await host.evaluate(()=>gameTest.fateExitState())).queued,false);
      assert.equal((await pages[winner].evaluate(()=>gameTest.rewardState())).state,'buffselect');
      for(const p of pages)assert.equal((await p.evaluate(()=>gameTest.rewardState())).wave,5);
      // Keep transmitting authoritative state while one player has already finished.
      await host.evaluate(()=>gameTest.rewardBroadcast());
      for(let clicks=0;clicks<6;clicks++){
        const s=await pages[winner].evaluate(()=>gameTest.rewardState());if(s.state==='playing')break;
        await pages[winner].locator('#buffCards .buff-card:visible').first().click({force:true});await pages[winner].waitForTimeout(750);
      }
      for(const [i,p] of pages.entries()){
        const s=await p.evaluate(()=>gameTest.rewardTick());assert.equal(s.rapid,i===winner?level+1:0);assert.equal(s.queues,1);
        assert.equal(s.state,'playing');assert.equal(s.exit,true);assert.equal(await p.evaluate(()=>gameTest.fateRollCount()),1);
      }
      assert.equal((await host.evaluate(()=>gameTest.fateExitState())).ready,1);
      await pages[winner].evaluate(()=>gameTest.fateEnterPortal());
      for(const p of pages){
        await p.waitForFunction(()=>{const s=gameTest.fateExitState();return s.state==='buffselect'&&s.phase==='status'&&!s.clear;});
        assert.equal((await p.evaluate(()=>gameTest.rewardState())).wave,5);
      }
      await host.waitForTimeout(300);
      for(const p of pages){const s=await p.evaluate(()=>gameTest.fateExitState());assert.equal(s.phase,'status');assert.equal(s.wave,5);assert.equal(s.ready,0);}
      console.log('PASS Fate cooperative',level,'successful player',winner);for(const c of contexts)await c.close();
    }
    assert.deepEqual(errors,[]);
  }finally{await browser.close();}
}
module.exports={hooks};
if(require.main===module)run().catch(e=>{console.error(e);process.exitCode=1;});

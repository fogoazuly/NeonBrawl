const assert=require('node:assert/strict');
const {launch,instrument,startCoop}=require('./browser-harness.cjs');
const {hooks:base}=require('./fate-gambit-coop-smoke.cjs');
const hooks=base+`
gameTest.rewardPlayers=()=>mpPlayerIds().length;
gameTest.rewardVisible=()=>document.getElementById('buffSelect').style.display!=='none';
`;
(async()=>{
  const browser=await launch(),errors=[];
  const abrupt=process.argv.includes('--close-tab');
  try{
    for(const leaving of [0,1])for(const winner of [0,1]){
      const contexts=[],pages=[];
      for(let i=0;i<2;i++){const c=await browser.newContext();contexts.push(c);await instrument(c,hooks);const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));pages.push(p);}
      const [host,guest]=pages;await startCoop(host,guest);
      for(const [i,p] of pages.entries()){await p.evaluate(()=>gameTest.rewardFreeze(0));await p.evaluate(t=>gameTest.equipFate(t),{level:3,success:i===winner});}
      await host.evaluate(()=>gameTest.rewardAnnounce());await guest.waitForFunction(()=>gameTest.rewardState().wave===5);
      await host.evaluate(()=>gameTest.rewardSpawn());await guest.waitForFunction(()=>gameTest.rewardState().count===1);
      await host.evaluate(()=>gameTest.rewardKill());await guest.waitForFunction(()=>gameTest.rewardState().count===0);await guest.evaluate(()=>gameTest.rewardTick());
      for(const p of pages){await p.waitForFunction(()=>gameTest.rewardState().summary);await p.locator('.boss-summary-close').click();}
      await pages[1-winner].evaluate(()=>gameTest.fateEnterPortal());await host.waitForFunction(()=>gameTest.fateExitState().ready===1);
      if(abrupt)await pages[leaving].close();else await pages[leaving].evaluate(()=>gameTest.quit());
      if(leaving===0){
        await guest.waitForFunction(()=>gameTest.rewardState().state==='menu');
        assert.equal(await guest.evaluate(()=>gameTest.rewardVisible()),false);
        await guest.waitForTimeout(700);assert.equal((await guest.evaluate(()=>gameTest.rewardState())).state,'menu');
      }else{
        await host.waitForFunction(()=>gameTest.rewardPlayers()===1);
        if(winner===0){
          assert.equal((await host.evaluate(()=>gameTest.rewardState())).state,'buffselect');
          for(let i=0;i<4;i++){await host.locator('#buffCards .buff-card:visible').first().click({force:true});await host.waitForTimeout(750);}
          assert.equal((await host.evaluate(()=>gameTest.rewardState())).rapid,4);
          await host.evaluate(()=>gameTest.fateEnterPortal());
        }
        await host.waitForFunction(()=>{const s=gameTest.fateExitState();return s.state==='buffselect'&&s.phase==='status'&&!s.clear;});
        await host.waitForTimeout(700);const s=await host.evaluate(()=>gameTest.fateExitState());assert.equal(s.wave,5);assert.equal(s.phase,'status');
      }
      console.log('PASS reward departure',{leaving,winner,abrupt});for(const c of contexts)await c.close();
    }
    assert.deepEqual(errors,[]);
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

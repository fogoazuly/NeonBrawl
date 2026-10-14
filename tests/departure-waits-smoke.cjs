const assert=require('node:assert/strict');
const {launch,instrument,startCoop}=require('./browser-harness.cjs');
const hooks=`
gameTest.departureSetup=mode=>{
  update=()=>{};player.invincible=10000;waveTransition=false;waveEvent=null;
  disposeMiniObjective();_waveSpawnQueue.length=0;gState='playing';waveNum=mode==='shop'?4:1;
  _eventBonusPicksLeft=0;_challengeRewardPending=false;_cursedShrinePending=false;
  resetExitReady();mp.buffReady={};mp.buffStartQueued=false;
  if(mode==='shop')startRunShopRound();
  else if(mode==='portal'){waveClear=true;openExit();}
  else {waveClear=false;showBuffSelect('status');}
};
gameTest.departureReady=mode=>requestExitTransition(mode==='shop'?'shop':'wave');
gameTest.departureState=()=>({state:gState,wave:waveNum,players:mpPlayerIds(),queued:mp.exitStartQueued,
  ready:!!mp.exitReady[mp.myId],shopDone:runShopDoneWave,open:exitOpen});
`;
(async()=>{
  const browser=await launch(),errors=[];
  try{
    const cases=[['portal',false],['shop',false],['buff',false],['portal',true]];
    for(const [mode,abrupt] of cases.slice(Number(process.argv[2]||0))){
      const contexts=[],pages=[];
      try{
        for(let i=0;i<2;i++){
          const c=await browser.newContext();contexts.push(c);await instrument(c,hooks);
          const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));pages.push(p);
        }
        const [host,guest]=pages;await startCoop(host,guest);
        for(const p of pages)await p.evaluate(mode=>gameTest.departureSetup(mode),mode);
        if(mode==='buff'){
          // Status selection may be followed by a skill selection in the same reward.
          for(let picks=0;picks<8;picks++){
            if((await host.evaluate(()=>gameTest.departureState())).state==='buffwait')break;
            await host.locator('#buffCards .buff-card:visible').first().click({force:true});
            await host.waitForTimeout(750);
          }
          await host.waitForFunction(()=>gameTest.departureState().state==='buffwait');
        }else await host.evaluate(mode=>gameTest.departureReady(mode),mode);
        const before=await host.evaluate(()=>gameTest.departureState());
        assert.equal(before.players.length,2);assert.equal(before.wave,mode==='shop'?4:1);
        if(mode!=='buff'){assert.equal(before.ready,true);assert.equal(before.queued,false);}
        if(abrupt)await guest.close();else await guest.evaluate(()=>gameTest.quit());
        await host.waitForFunction(()=>gameTest.departureState().players.length===1);
        if(mode==='portal')await host.waitForFunction(()=>gameTest.departureState().state==='buffselect');
        else await host.waitForFunction(w=>gameTest.departureState().wave===w,mode==='shop'?5:2);
        const after=await host.evaluate(()=>gameTest.departureState());
        if(mode==='shop')assert.equal(after.shopDone,4);
        if(mode==='portal'){assert.equal(after.wave,1);assert.equal(after.open,false);}
        await host.waitForTimeout(800);
        assert.equal((await host.evaluate(()=>gameTest.departureState())).wave,after.wave,'Duplicate advancement');
        console.log('PASS departure releases host wait',mode,abrupt?'closed tab':'quit menu');
      }finally{for(const c of contexts)await c.close();}
    }
    assert.deepEqual(errors,[]);
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

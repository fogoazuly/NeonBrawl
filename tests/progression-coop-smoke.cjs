const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const {launch,instrument,startCoop}=require('./browser-harness.cjs');
const {hooks:progressionHooks}=require('./progression-smoke.cjs');
const hooks=progressionHooks+`
gameTest.progressionGuestDrive=()=>{
  player.invincible=10000;
  if(gState==='shopround'||(gState==='playing'&&waveClear&&exitOpen))player.pos.set(0,0,EXIT_Z);
  progressionUpdate(.05);sendPlayerState();return gameTest.progressionState();
};
gameTest.progressionPublish=()=>{sendHostState();sendPlayerState();};
`;
(async()=>{
  const browser=await launch(),errors=[],history=[],previous=[0,0];let last=[];
  try{
    const pages=[];
    for(let i=0;i<2;i++){
      const c=await browser.newContext();await instrument(c,hooks);const p=await c.newPage();
      p.on('pageerror',e=>errors.push({peer:i,error:e.message}));pages.push(p);
    }
    const [host,guest]=pages;await startCoop(host,guest);
    for(const p of pages)await p.evaluate(()=>gameTest.progressionStart());
    const deadline=Date.now()+240000;
    while(Date.now()<deadline){
      last[0]=await host.evaluate(()=>gameTest.progressionDrive());
      await host.evaluate(()=>gameTest.progressionPublish());
      last[1]=await guest.evaluate(()=>gameTest.progressionGuestDrive());
      for(const [i,state] of last.entries()){
        assert.ok(state.wave===previous[i]||state.wave===previous[i]+1,'Skipped wave '+JSON.stringify({i,state}));
        assert.ok(Number.isFinite(state.hp)&&state.hp>0);assert.ok(!['menu','gameover'].includes(state.state));
        if(state.wave!==previous[i]){
          history.push({peer:i,...state});previous[i]=state.wave;
          console.log('PASS peer',i,'entered wave',state.wave,'map',state.map);
        }
      }
      if(last.every(s=>s.wave===11))break;
      let picked=false;
      for(const [i,p] of pages.entries()){
        if(last[i].summary){await p.locator('.boss-summary-close').click();picked=true;}
        else if(last[i].state==='buffselect'){
          const card=p.locator('#buffCards .buff-card:visible:not([aria-disabled="true"])').first();
          if(await card.count()){await card.click({force:true});picked=true;}
        }
      }
      await host.waitForTimeout(picked?750:100);
    }
    assert.deepEqual(last.map(s=>s.wave),[11,11],'Progression stalled: '+JSON.stringify(last));
    for(const s of last){assert.ok(s.picks>1);assert.ok(s.shopDone>=9);}
    assert.equal(last[0].map,last[1].map);assert.equal(last[0].score,last[1].score);
    for(let w=1;w<=11;w++){
      const states=history.filter(s=>s.wave===w);assert.equal(states.length,2);assert.equal(states[0].map,states[1].map);
    }
    assert.deepEqual(errors,[]);console.log('PASS cooperative ten-wave progression, two bosses, rewards, shops and shared maps/score');
  }finally{
    await fs.mkdir('test-results',{recursive:true});await fs.writeFile('test-results/progression-coop.json',JSON.stringify({scope:'Two connected browsers, accelerated combat and positioning; actual UI choices and network progression. Not natural combat or external network.',history,last,errors},null,2));
    await browser.close();
  }
})().catch(e=>{console.error(e);process.exitCode=1;});

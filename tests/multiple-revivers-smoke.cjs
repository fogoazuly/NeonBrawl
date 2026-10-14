const assert=require('node:assert/strict');
const {launch,instrument,startCoop}=require('./browser-harness.cjs');
const hooks=`
gameTest.freezeRescue=()=>{update=()=>{};gState='playing';waveTransition=false;waveClear=false;player.invincible=10000;return mp.myId;};
gameTest.rescueMove=({x,z})=>{player.pos.set(x,0,z);sendPlayerState();};
gameTest.rescueRemote=id=>{const p=mp.remotePlayers[id];return p?{x:p.pos.x,z:p.pos.z,downed:p.downed}:null;};
gameTest.rescueKnock=()=>{runRevives=0;player.invincible=0;player.barrierActive=false;hurtPlayer(100000);};
gameTest.rescueState=()=>({hp:player.hp,max:playerStats.maxHp,downed:player.downed,dead:player.dead,
  progress:player.reviveT,bleed:player.downedT,helpers:player.reviverCount,time:effectiveReviveTime()});
gameTest.rescueStep=dt=>{updateDowned(dt);return gameTest.rescueState();};
`;
(async()=>{
  const browser=await launch(),errors=[];
  const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,a+' != '+b);
  try{
    const pages=[];
    for(let i=0;i<3;i++){
      const c=await browser.newContext();await instrument(c,hooks);const p=await c.newPage();
      p.on('pageerror',e=>errors.push(e.message));pages.push(p);
    }
    await startCoop(...pages);const ids=[];
    for(const p of pages)ids.push(await p.evaluate(()=>gameTest.freezeRescue()));
    async function move(i,pos,observer){
      await pages[i].evaluate(p=>gameTest.rescueMove(p),pos);
      if(observer!==i)await pages[observer].waitForFunction(({id,p})=>{const r=gameTest.rescueRemote(id);return r?.x===p.x&&r?.z===p.z;},{id:ids[i],p:pos});
    }
    for(let victim=0;victim<3;victim++){
      const helpers=[0,1,2].filter(i=>i!==victim),p=pages[victim];
      for(const i of helpers)await move(i,{x:10,z:10},victim);
      await move(victim,{x:0,z:0},victim);await p.evaluate(()=>gameTest.rescueKnock());
      let s=await p.evaluate(()=>gameTest.rescueState());assert.equal(s.downed,true);const bleed=s.bleed;
      s=await p.evaluate(()=>gameTest.rescueStep(.5));near(s.bleed,bleed-.5);near(s.progress,0);assert.equal(s.helpers,0);
      await move(helpers[0],{x:2.8,z:0},victim);
      s=await p.evaluate(()=>gameTest.rescueStep(.4));near(s.progress,.4);near(s.bleed,bleed-.5);assert.equal(s.helpers,1);
      await move(helpers[1],{x:0,z:0},victim);
      s=await p.evaluate(()=>gameTest.rescueStep(.4));near(s.progress,1);assert.equal(s.helpers,2);
      await move(helpers[0],{x:10,z:10},victim);
      s=await p.evaluate(()=>gameTest.rescueStep(.4));near(s.progress,1.4);assert.equal(s.helpers,1);
      await move(helpers[1],{x:10,z:10},victim);
      s=await p.evaluate(()=>gameTest.rescueStep(.5));near(s.progress,1.05);near(s.bleed,bleed-1);assert.equal(s.helpers,0);
      for(const i of helpers)await move(i,{x:0,z:0},victim);
      s=await p.evaluate(dt=>gameTest.rescueStep(dt),(s.time-s.progress)/1.5+.01);
      assert.equal(s.downed,false);assert.equal(s.dead,false);assert.equal(s.hp,Math.round(s.max*.45));
      const hp=s.hp;s=await p.evaluate(()=>gameTest.rescueStep(.5));assert.equal(s.hp,hp);
      for(const i of helpers)await pages[i].waitForFunction(id=>gameTest.rescueRemote(id)?.downed===false,ids[victim]);
      console.log('PASS victim',victim,'0/1/2 helpers, bleed pause, decay, single synchronized rescue');
    }
    assert.deepEqual(errors,[]);
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

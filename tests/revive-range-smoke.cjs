const assert=require('node:assert/strict');
const {launch,instrument,startCoop}=require('./browser-harness.cjs');
const hooks=`
gameTest.rangePrepare=({rank,x})=>{
  update=()=>{};gState='playing';waveClear=false;waveTransition=false;
  player.dead=false;player.downed=false;player.hp=100;player.invincible=10000;
  playerSkills.repairDrone=rank;player.pos.set(x,0,0);sendPlayerState();return mp.myId;
};
gameTest.rangeRemote=()=>{const r=Object.values(mp.remotePlayers)[0];return {x:r.pos.x,rank:r.skills?.repairDrone||0,dead:r.dead,downed:r.downed};};
gameTest.rangeCheck=()=>{
  runRevives=0;player.invincible=0;player.barrierActive=false;hurtPlayer(100000);
  player.lastReviveTouch=0;updateDowned(.2);
  return {helpers:player.reviverCount,progress:player.reviveT,downed:player.downed};
};
`;
(async()=>{
  const browser=await launch(),errors=[],failures=[];
  try{
    const pages=[];
    for(let i=0;i<2;i++){const c=await browser.newContext();await instrument(c,hooks);const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));pages.push(p);}
    await startCoop(...pages);
    for(let victim=0;victim<2;victim++)for(const ranks of [[0,0],[3,0],[0,3],[3,3]])for(const distance of [2.8,3.2,3.61]){
      const helper=1-victim;
      await pages[helper].evaluate(a=>gameTest.rangePrepare(a),{rank:ranks[1],x:distance});
      await pages[victim].evaluate(a=>gameTest.rangePrepare(a),{rank:ranks[0],x:0});
      await pages[victim].waitForFunction(a=>{const r=gameTest.rangeRemote();return r.x===a.x&&r.rank===a.rank&&!r.dead&&!r.downed;},{x:distance,rank:ranks[1]});
      const actual=await pages[victim].evaluate(()=>gameTest.rangeCheck());
      const expected=distance<=(ranks[1]>=3?3.6:2.8)?1:0;
      if(!actual.downed||actual.helpers!==expected||Math.abs(actual.progress-expected*.2)>1e-8)failures.push({victim,ranks,distance,actual,expected});
    }
    console.log({cases:24,failures});assert.deepEqual(failures,[]);assert.deepEqual(errors,[]);
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

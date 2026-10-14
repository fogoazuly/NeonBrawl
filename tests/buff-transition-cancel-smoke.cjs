const assert=require('node:assert/strict');
const {launch,instrument}=require('./browser-harness.cjs');
const hooks=`
gameTest.queueBuffTransition=({wave,restart})=>{
  mp.soloMode=true;initGame();hideGunSelect();hideMeleeSelect();update=()=>{};
  waveNum=wave;gState='buffwait';waveClear=false;waveTransition=false;
  mp.soloMode=false;mp.isHost=true;mp.myId=0;mp.buffReady={};mp.buffStartQueued=false;
  markBuffReady(0);const queued=mp.buffStartQueued;
  nbQuitToMenu();
  if(restart){mp.soloMode=true;initGame();hideGunSelect();hideMeleeSelect();gState='playing';}
  return {queued,before:gameTest.buffTransitionState()};
};
gameTest.buffTransitionState=()=>({state:gState,wave:waveNum,shop:runShopDoneWave,map:currentMapLayout});
`;
(async()=>{
  const browser=await launch(),errors=[],failures=[];
  try{
    const c=await browser.newContext();await instrument(c,hooks);const p=await c.newPage();
    p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:3000');await p.waitForFunction(()=>!!window.gameTest);
    for(const wave of [1,4])for(const restart of [false,true]){
      const result=await p.evaluate(a=>gameTest.queueBuffTransition(a),{wave,restart});assert.equal(result.queued,true);
      await p.waitForTimeout(600);const after=await p.evaluate(()=>gameTest.buffTransitionState());
      if(JSON.stringify(after)!==JSON.stringify(result.before))failures.push({wave,restart,before:result.before,after});
      console.log({wave,restart,before:result.before,after});
    }
    assert.deepEqual(failures,[]);assert.deepEqual(errors,[]);
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

const assert=require('node:assert/strict');
const {launch,instrument}=require('./browser-harness.cjs');
const hooks=`
getSkillChoices=()=>['rapidFire'];getBossSkillChoices=()=>['rapidFire'];
const originalFateEnsure=_ensureRelicPickState;let fateTestRoll=0,fateRolls=0;
_ensureRelicPickState=phase=>{
  const random=Math.random;
  try{Math.random=()=>{fateRolls++;return fateTestRoll;};originalFateEnsure(phase);}finally{Math.random=random;}
};
gameTest.fatePrepare=({level,phase,success,roll})=>{
  mp.soloMode=true;mp.isHost=true;initGame();hideGunSelect();hideMeleeSelect();update=()=>{};
  gState='playing';waveNum=phase==='boss'?5:3;waveClear=true;waveSpawned=true;waveTransition=false;waveEvent=null;
  for(let i=0;i<level;i++)applyRelic('fateGambit');
  fateRolls=0;fateTestRoll=roll??(success?0:0.999);showBuffSelect(phase);
};
gameTest.fateNext=({phase,success})=>{fateTestRoll=success?0:0.999;showBuffSelect(phase);};
gameTest.fateState=()=>({picks:playerSkillPicks.rapidFire||0,rolls:fateRolls,state:gState,
  visible:document.getElementById('buffSelect').style.display!=='none',exit:exitOpen,
  extra:_relicFateExtras,active:_relicFateActive});
`;
(async()=>{
  const browser=await launch(),errors=[],failures=[];
  try{
    const c=await browser.newContext();await instrument(c,hooks);const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));
    await p.goto('http://127.0.0.1:3000');await p.waitForFunction(()=>!!window.gameTest);
    const finish=async()=>{
      for(let i=0;i<6;i++){
        const s=await p.evaluate(()=>gameTest.fateState());if(!s.visible)break;
        await p.locator('#buffCards .buff-card:visible').first().click({force:true});await p.waitForTimeout(750);
      }
      return p.evaluate(()=>gameTest.fateState());
    };
    for(const phase of ['skill','boss'])for(const level of [1,2,3])for(const offset of [-0.000001,0,0.000001]){
      const success=offset<0,roll=[0,0.8,0.7,0.6][level]+offset;
      await p.evaluate(t=>gameTest.fatePrepare(t),{level,phase,success,roll});
      await finish();
      const s=await p.evaluate(()=>gameTest.fateState()),expected=success?level+1:0;
      if(s.picks!==expected||s.rolls!==1||s.visible||s.extra!==0||s.active)failures.push({phase,level,roll,expected,...s});
      // A new offering in the same run must roll afresh, including after a skip.
      await p.evaluate(t=>gameTest.fateNext(t),{phase,success:!success});
      const next=await finish();
      if(next.picks!==level+1||next.rolls!==2||next.visible||next.extra!==0||next.active)failures.push({phase,level,roll,second:true,...next});
      console.log('FATE boundary and next offering',phase,level,roll,JSON.stringify(next));
    }
    assert.deepEqual(failures,[]);assert.deepEqual(errors,[]);
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

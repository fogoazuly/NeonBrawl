const assert=require('node:assert/strict');
const {launch,instrument}=require('./browser-harness.cjs');
const hooks=`
getSkillChoices=()=>['rapidFire'];getBossSkillChoices=()=>['rapidFire'];getRelicChoices=()=>['heavyCrown'];
gameTest.animationPrepare=phase=>{
  mp.soloMode=true;mp.isHost=true;initGame();hideGunSelect();hideMeleeSelect();update=()=>{};
  gState='playing';waveNum=5;waveClear=true;waveSpawned=true;waveTransition=false;waveEvent=null;
  if(phase==='relic'){bossBonusRelicsLeft=1;showRelicSelect();}else showBuffSelect(phase);
};
gameTest.animationState=()=>({state:gState,wave:waveNum,rapid:playerSkillPicks.rapidFire||0,crown:relicLevel('heavyCrown'),
  extraCards:bossBonusPicksLeft,extraRelics:bossBonusRelicsLeft,exit:exitOpen,
  visible:document.getElementById('buffSelect').style.display!=='none'});
gameTest.clickThenCancel=({phase,destination})=>{
  document.querySelector('#buffCards .buff-card').click();
  const pending=document.getElementById('buffCards').classList.contains('choosing-card');
  if(!pending)throw new Error('card animation did not start');
  if(destination==='menu')nbQuitToMenu();
  else gameTest.animationPrepare(phase);
  return gameTest.animationState();
};
`;
(async()=>{
  const browser=await launch(),errors=[];
  try{
    const c=await browser.newContext();await instrument(c,hooks);const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));
    await p.goto('http://127.0.0.1:3000');await p.waitForFunction(()=>!!window.gameTest);
    for(const phase of ['skill','boss','relic'])for(const destination of ['menu','new-run']){
      await p.evaluate(t=>gameTest.animationPrepare(t),phase);
      const before=await p.evaluate(t=>gameTest.clickThenCancel(t),{phase,destination});
      assert.equal(before.state,destination==='menu'?'menu':'buffselect');
      await p.waitForTimeout(900);
      assert.deepEqual(await p.evaluate(()=>gameTest.animationState()),before);
      if(destination==='new-run'){
        await p.locator('#buffCards .buff-card:visible').first().click({force:true});await p.waitForTimeout(750);
        const after=await p.evaluate(()=>gameTest.animationState());
        assert.equal(phase==='relic'?after.crown:after.rapid,1,'new reward must still work');
        assert.equal(after.visible,false);
      }
      console.log('PASS reward animation cancellation',phase,destination);
    }
    assert.deepEqual(errors,[]);
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

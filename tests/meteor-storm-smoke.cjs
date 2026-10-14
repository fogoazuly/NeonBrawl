const assert=require('node:assert/strict');
const {launch,instrument}=require('./browser-harness.cjs');
const hooks=`
function meteorFixture(){
  mp.soloMode=true;initGame();hideGunSelect();hideMeleeSelect();update=()=>{};gState='playing';
  waveNum=4;waveTransition=false;waveClear=false;waveEvent={type:'challenge',sub:'meteorStorm'};
  player.pos.set(0,0,0);player.hp=100;player.invincible=0;player.barrierActive=false;
}
gameTest.meteorCase=mode=>{
  meteorFixture();spawnMeteorStormStrike(0,0);
  const visible=warningZones.length===1&&warningZones[0].mesh.visible;
  updateWarningZones(.61);const before=player.hp;
  if(mode==='outside')player.pos.x=METEOR_STORM_RADIUS+.001;
  if(mode==='edge')player.pos.x=METEOR_STORM_RADIUS;
  if(mode==='invulnerable')player.invincible=1;
  if(mode==='barrier')player.barrierActive=true;
  if(mode==='clear')clearMapSpellsAndAllies();
  if(mode==='restart'){nbQuitToMenu();initGame();hideGunSelect();player.hp=100;player.invincible=0;}
  updateWarningZones(.02);const after=player.hp;
  player.invincible=0;updateWarningZones(1);
  return {visible,before,after,final:player.hp,warnings:warningZones.length};
};
gameTest.meteorRain=()=>{
  meteorFixture();const counts=[];
  for(const state of ['intro','cleared','menu','playing']){
    clearMapSpellsAndAllies();waveTransition=state==='intro';waveClear=state==='cleared';gState=state==='menu'?'menu':'playing';_meteorStormCd=0;
    tickMeteorStormChallenge(.01);counts.push({state,count:warningZones.length});
  }
  const first=warningZones.length;tickMeteorStormChallenge(.01);
  return {counts,first,second:warningZones.length};
};
`;
(async()=>{
  const browser=await launch(),errors=[];
  try{
    const c=await browser.newContext();await instrument(c,hooks);const page=await c.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:3000');await page.waitForFunction(()=>!!window.gameTest);
    for(const mode of ['center','edge','outside','invulnerable','barrier','clear','restart']){
      const r=await page.evaluate(mode=>gameTest.meteorCase(mode),mode);
      assert.ok(r.visible);assert.equal(r.before,100);assert.equal(r.after,['center','edge'].includes(mode)?82:100);assert.equal(r.final,r.after);assert.equal(r.warnings,0);
      console.log('PASS meteor',mode);
    }
    const rain=await page.evaluate(()=>gameTest.meteorRain());
    assert.ok(rain.counts.slice(0,3).every(s=>s.count===0));assert.ok(rain.first>=3&&rain.first<=5);assert.equal(rain.second,rain.first);
    assert.deepEqual(errors,[]);console.log('PASS rain state gates and interval');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

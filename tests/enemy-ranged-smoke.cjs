const assert=require('node:assert/strict');
const {launch,instrument}=require('./browser-harness.cjs');
const hooks=`
const rangedUpdate=update;
function rangedFixture(type){
  mp.soloMode=true;initGame();hideGunSelect();hideMeleeSelect();update=()=>{};
  gState='playing';waveNum=1;waveSpawned=true;waveClear=false;waveTransition=false;waveEvent=null;
  obstacleBoxes.length=0;mapHazards.length=0;buildNavBlocked();player.pos.set(0,0,0);player.hp=100;player.invincible=0;
  spawnEnemy(type,0,type==='bomber'?.5:4);const e=enemies[enemies.length-1];
  e.elite=null;e.spawnAnim=0;e.spd=0;e.fireCd=0;e.chargeT=0;e.dmgMult=1;e.stuckCheck=100;
  return e;
}
gameTest.rangedShot=({type,dodge})=>{
  const e=rangedFixture(type),random=Math.random;
  try{
    Math.random=()=>.5;rangedUpdate(0);const immediate=player.hp;
    let beforeShot=100;
    if(type==='sniper'){
      for(let i=0;i<60;i++)rangedUpdate(.01);
      beforeShot=player.hp;
      if(bulletPool.some(b=>b.active&&!b.isPlayer))throw new Error('Sniper fired before charge elapsed');
      for(let i=0;i<6;i++)rangedUpdate(.01);
    }
    const shots=bulletPool.filter(b=>b.active&&!b.isPlayer).length;e.fireCd=100;
    if(dodge)player.pos.x=10;
    for(let i=0;i<150;i++)rangedUpdate(.01);
    return {immediate,beforeShot,shots,hp:player.hp};
  }finally{Math.random=random;}
};
gameTest.rangedWarning=({type,mode})=>{
  rangedFixture(type);const random=Math.random;
  try{Math.random=()=>.5;rangedUpdate(0);}finally{Math.random=random;}
  const visible=warningZones.some(w=>w.mesh.visible),duration=type==='bomber'?.38:.82;
  updateWarningZones(duration-.01);const before=player.hp;
  if(mode==='dodge')player.pos.set(12,0,10);
  if(mode==='clear')clearMapSpellsAndAllies();
  if(mode==='barrier')player.barrierActive=true;
  updateWarningZones(.02);const after=player.hp;
  player.invincible=0;updateWarningZones(1);
  return {visible,before,after,final:player.hp,warnings:warningZones.length};
};
`;
(async()=>{
  const browser=await launch(),errors=[];
  try{
    const c=await browser.newContext();await instrument(c,hooks);const p=await c.newPage();
    p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:3000');await p.waitForFunction(()=>!!window.gameTest);
    for(const type of ['shooter','sniper'])for(const dodge of [false,true]){
      const r=await p.evaluate(a=>gameTest.rangedShot(a),{type,dodge});
      assert.equal(r.immediate,100);assert.equal(r.beforeShot,100);assert.equal(r.shots,1);
      assert.equal(r.hp,dodge?100:type==='shooter'?86:68);console.log('PASS projectile',type,dodge?'dodge':'hit');
    }
    for(const type of ['bomber','disruptor'])for(const mode of ['hit','dodge','clear','barrier']){
      const r=await p.evaluate(a=>gameTest.rangedWarning(a),{type,mode});
      assert.equal(r.visible,true);assert.equal(r.before,100);assert.equal(r.after,mode==='hit'?(type==='bomber'?80:87):100);
      assert.equal(r.final,r.after);assert.equal(r.warnings,0);console.log('PASS warning',type,mode);
    }
    assert.deepEqual(errors,[]);
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

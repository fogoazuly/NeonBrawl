const assert=require('node:assert/strict');
const {launch,instrument}=require('./browser-harness.cjs');
const hooks=`
const contactUpdate=update;
function contactFixture(type,distance=.5,count=1){
  mp.soloMode=true;initGame();hideGunSelect();hideMeleeSelect();update=()=>{};
  gState='playing';waveNum=1;waveSpawned=true;waveClear=false;waveTransition=false;waveEvent=null;
  obstacleBoxes.length=0;mapHazards.length=0;buildNavBlocked();player.pos.set(0,0,0);player.hp=100;player.invincible=0;
  for(let i=0;i<count;i++){
    spawnEnemy(type,0,distance);const e=enemies[enemies.length-1];
    e.elite=null;e.spawnAnim=0;e.spd=0;e.fireCd=0;e.dmgMult=1;e.dashCd=100;e.dashActive=0;e.stuckCheck=100;
  }
  return enemies[0];
}
gameTest.contactCase=type=>{
  let e=contactFixture(type);contactUpdate(0);const damage=100-player.hp,cooldown=e.fireCd;
  player.invincible=0;contactUpdate(0);const repeated=100-player.hp;
  for(let t=0;t<cooldown-.02;t+=.01)contactUpdate(.01);
  const early=100-player.hp;contactUpdate(.03);const after=100-player.hp;
  contactFixture(type,10);contactUpdate(0);const far=player.hp;
  contactFixture(type);player.invincible=1;contactUpdate(0);const protectedHp=player.hp;
  contactFixture(type);player.barrierActive=true;contactUpdate(0);const barrier={hp:player.hp,active:player.barrierActive};
  contactFixture(type,.5,2);contactUpdate(0);const swarm=100-player.hp;
  return {type,damage,repeated,early,after,far,protectedHp,barrier,swarm,cooldown};
};
`;
(async()=>{
  const browser=await launch(),errors=[],results=[];
  try{
    const c=await browser.newContext();await instrument(c,hooks);const p=await c.newPage();
    p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:3000');await p.waitForFunction(()=>!!window.gameTest);
    for(const [type,damage] of [['chaser',16],['speeder',9],['tank',28],['dasher',16],['shieldBearer',22],['splitter',18],['berserker',14],['splitterling',7]]){
      const r=await p.evaluate(type=>gameTest.contactCase(type),type);console.log(r);results.push(r);
      assert.equal(r.damage,damage);assert.equal(r.repeated,damage);assert.equal(r.early,damage);assert.equal(r.after,damage*2);
      assert.equal(r.far,100);assert.equal(r.protectedHp,100);assert.deepEqual(r.barrier,{hp:100,active:false});assert.equal(r.swarm,damage);
    }
    assert.deepEqual(errors,[]);console.log('PASS eight contact attackers: damage, cooldown, range, invulnerability, barrier and simultaneous hits');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

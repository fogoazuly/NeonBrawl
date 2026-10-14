const assert=require('node:assert/strict');
const {launch,instrument}=require('./browser-harness.cjs');
const hooks=`
const supportUpdate=update;
function supportFixture(type,wave=1){
  mp.soloMode=true;initGame();hideGunSelect();hideMeleeSelect();update=()=>{};
  gState='playing';waveNum=wave;waveSpawned=true;waveTransition=false;waveClear=false;waveEvent=null;
  obstacleBoxes.length=0;mapHazards.length=0;buildNavBlocked();player.pos.set(-10,0,-10);player.invincible=10000;
  spawnEnemy(type,0,0);const e=enemies[enemies.length-1];e.elite=null;e.spawnAnim=0;e.spd=0;e.fireCd=0;e.stuckCheck=100;e.hp=50;e.maxHp=100;
  e.pos.set(0,0,0);return e;
}
gameTest.healerCase=kind=>{
  const healer=supportFixture('healer');let target=healer;
  if(kind!=='self'){
    spawnEnemy('chaser',kind==='outside'?5.001:5,0);target=enemies[enemies.length-1];
    target.pos.set(kind==='outside'?5.001:5,0,0);
    target.spd=0;target.stuckCheck=100;target.fireCd=100;target.spawnAnim=100;target.hp=kind==='cap'?98:50;target.maxHp=100;target.elite=null;
    if(kind==='dead')target.dead=true;
    if(kind==='elite'||kind==='champion')target.elite=kind;
    if(kind==='boss')target.type='boss';
  }
  const before=target.hp;supportUpdate(0);const after=target.hp;supportUpdate(0);
  return {before,after,repeated:target.hp,healerHp:healer.hp,distance:Math.hypot(target.pos.x-healer.pos.x,target.pos.z-healer.pos.z)};
};
gameTest.specialHealCase=({type,variant,kind})=>{
  const healer=supportFixture(type),radius=type==='healer'?6:5;
  healer.elite=variant;healer.eliteCd=0;healer.elitePulseCd=100;healer.fireCd=100;
  player.pos.set(-5,0,-5);
  const targets=[];
  if(kind!=='self')for(let i=0;i<(kind==='multiple'?3:1);i++){
    const x=kind==='outside'?radius+0.001:radius;
    spawnEnemy('chaser',x,0);const t=enemies[enemies.length-1];
    t.pos.set(x,0,0);t.spd=0;t.stuckCheck=100;t.spawnAnim=100;t.elite=null;t.maxHp=100;
    t.hp=kind==='cap'?98:kind==='full'?100:50;
    if(kind==='dead')t.dead=true;
    if(kind==='elite'||kind==='champion')t.elite=kind;
    if(kind==='boss')t.type='boss';
    targets.push(t);
  }
  supportUpdate(0);const first=targets.map(t=>t.hp),cooldown=healer.eliteCd;
  supportUpdate(0);const repeated=targets.map(t=>t.hp);
  // Advance through the actual cooldown in small simulation steps.
  let elapsed=0;
  while(elapsed+0.01<cooldown){supportUpdate(0.01);elapsed+=0.01;}
  const beforeExpiry=targets.map(t=>t.hp);
  supportUpdate(cooldown-elapsed+0.001);
  return {first,repeated,beforeExpiry,afterExpiry:targets.map(t=>t.hp),cooldown,selfHp:healer.hp};
};
gameTest.summonerCase=({wave,count,variant=null})=>{
  const summoner=supportFixture('summoner',wave);
  summoner.elite=variant;summoner.eliteCd=0;summoner.elitePulseCd=100;
  if(variant)player.pos.set(-5,0,-5);
  for(let i=1;i<count;i++){spawnEnemy('chaser',8,8);const e=enemies[enemies.length-1];e.spawnAnim=100;e.elite=null;}
  supportUpdate(0);const first=enemies.length,created=enemies.slice(count).map(e=>e.type);supportUpdate(0);
  return {first,second:enemies.length,created,cooldown:summoner.fireCd};
};
`;
(async()=>{
  const browser=await launch(),errors=[],failures=[];
  try{
    const c=await browser.newContext();await instrument(c,hooks);const p=await c.newPage();
    p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:3000');await p.waitForFunction(()=>!!window.gameTest);
    for(const kind of ['edge','outside','cap','self','dead','elite','champion','boss']){
      const r=await p.evaluate(k=>gameTest.healerCase(k),kind),expected=kind==='edge'?58:kind==='cap'?100:50;
      assert.equal(r.after,expected,kind+' '+JSON.stringify(r));assert.equal(r.repeated,expected);assert.equal(r.healerHp,50);console.log('PASS healer',kind);
    }
    for(const type of ['healer','shieldBearer'])for(const variant of ['elite','champion'])for(const kind of ['edge','outside','cap','full','self','dead','elite','champion','boss','multiple']){
      const r=await p.evaluate(a=>gameTest.specialHealCase(a),{type,variant,kind});
      const heal=type==='healer'?7:5,allowed=['edge','multiple'].includes(kind);
      const expected=kind==='self'?[]:Array(kind==='multiple'?3:1).fill(allowed?50+heal:['cap','full'].includes(kind)?100:50);
      const label=[type,variant,kind].join(' ');
      assert.deepEqual(r.first,expected,label);assert.deepEqual(r.repeated,expected,label);assert.deepEqual(r.beforeExpiry,expected,label);
      assert.deepEqual(r.afterExpiry,expected.map(h=>allowed?h+heal:h),label);
      assert.equal(r.selfHp,50,label);
      const min=type==='healer'?3.8:4,max=type==='healer'?4.8:5,mult=variant==='champion'?0.7:1;
      assert.ok(r.cooldown>=min*mult&&r.cooldown<=max*mult,label+' cooldown '+r.cooldown);
      console.log('PASS special heal',label);
    }
    for(const variant of [null,'elite','champion'])for(const [wave,count,normalExpected] of [[1,1,2],[14,1,3],[14,44,46],[14,45,46],[14,46,46],[14,47,47]]){
      const expected=variant?Math.max(count,Math.min(46,normalExpected+2)):normalExpected;
      const r=await p.evaluate(a=>gameTest.summonerCase(a),{wave,count,variant});
      if(r.first!==expected||r.second!==expected||!r.created.every(t=>['chaser','speeder'].includes(t))||r.cooldown<5.5||r.cooldown>7)failures.push({wave,count,variant,expected,...r});
      console.log('SUMMON',variant,wave,count,r);
    }
    assert.deepEqual(failures,[]);assert.deepEqual(errors,[]);
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

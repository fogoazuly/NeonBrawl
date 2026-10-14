const assert=require('node:assert/strict');
const {launch,instrument,startCoop}=require('./browser-harness.cjs');
const hooks=`
const supportCoopUpdate=update;
gameTest.supportFreeze=()=>{
  update=()=>{};gState='playing';waveNum=14;waveSpawned=true;waveClear=false;waveTransition=false;waveEvent=null;
  clearMapSpellsAndAllies();obstacleBoxes.length=0;mapHazards.length=0;buildNavBlocked();
  resetRelics();for(const k of Object.keys(playerSkills))delete playerSkills[k];
  player.pos.set(-10,0,-10);player.invincible=10000;sendPlayerState();
};
gameTest.supportClear=()=>{enemies.forEach(e=>{e.dead=true;releaseEnemySlot(e);});enemies.length=0;sendHostState();};
gameTest.supportSnapshot=()=>enemies.map(e=>({id:e.poolIdx,type:e.type,hp:e.hp,maxHp:e.maxHp,elite:e.elite||null})).sort((a,b)=>a.id-b.id);
gameTest.supportPrepare=({type,variant,count})=>{
  for(let i=0;i<count;i++){
    spawnEnemy(i===0?type:'chaser',i===0?0:4,0);const e=enemies[enemies.length-1];
    e.pos.set(i===0?0:4,0,0);e.elite=i===0?variant:null;e.hp=50;e.maxHp=100;
    e.spd=0;e.stuckCheck=100;e.spawnAnim=i===0?0:100;e.fireCd=100;e.eliteCd=100;e.elitePulseCd=100;
  }
  const source=enemies[0];
  if(type==='summoner'||!variant)source.fireCd=0;
  if(variant)source.eliteCd=0;
  sendHostState();return gameTest.supportSnapshot();
};
gameTest.supportStep=()=>{supportCoopUpdate(0);return gameTest.supportSnapshot();};
gameTest.supportSend=()=>sendHostState();
gameTest.supportGuestReady=()=>{for(const e of enemies){e.fireCd=0;e.eliteCd=0;e.spawnAnim=0;}return gameTest.supportStep();};
`;
(async()=>{
  const browser=await launch(),errors=[];
  try{
    const pages=[];
    for(let i=0;i<2;i++){const c=await browser.newContext();await instrument(c,hooks);const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));pages.push(p);}
    const [host,guest]=pages;await startCoop(host,guest);
    for(const p of pages)await p.evaluate(()=>gameTest.supportFreeze());
    const cases=[];
    for(const type of ['healer','shieldBearer'])for(const variant of [null,'elite','champion'])if(type==='healer'||variant)cases.push({type,variant,count:4});
    for(const variant of [null,'elite','champion'])for(const count of [1,45])cases.push({type:'summoner',variant,count});
    for(const test of cases){
      await host.evaluate(()=>gameTest.supportClear());await guest.waitForFunction(()=>gameTest.supportSnapshot().length===0);
      const before=await host.evaluate(t=>gameTest.supportPrepare(t),test);
      await guest.waitForFunction(s=>JSON.stringify(gameTest.supportSnapshot())===JSON.stringify(s),before);
      assert.deepEqual(await guest.evaluate(()=>gameTest.supportGuestReady()),before,'guest must not execute support AI');
      const after=await host.evaluate(()=>gameTest.supportStep());
      if(test.type==='summoner'){
        assert.equal(after.length,Math.min(46,test.count+(test.variant?4:2)));
        assert.ok(after.filter(e=>!before.some(b=>b.id===e.id)).every(e=>['chaser','speeder'].includes(e.type)));
      }else{
        const heal=test.type==='shieldBearer'?5:test.variant?7:8;
        assert.ok(after.filter(e=>e.type==='chaser').every(e=>e.hp===50+heal));
        assert.equal(after.find(e=>e.type===test.type).hp,50);
      }
      await host.evaluate(()=>gameTest.supportSend());
      await guest.waitForFunction(s=>JSON.stringify(gameTest.supportSnapshot())===JSON.stringify(s),after);
      assert.deepEqual(await guest.evaluate(()=>gameTest.supportGuestReady()),after,'guest must not repeat synchronized effects');
      assert.deepEqual(await host.evaluate(()=>gameTest.supportStep()),after,'host cooldown');
      console.log('PASS cooperative support',test);
    }
    assert.deepEqual(errors,[]);
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

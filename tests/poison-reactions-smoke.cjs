const assert=require('node:assert/strict');
const {launch,instrument}=require('./browser-harness.cjs');
const hooks=`
gameTest.poisonReaction=({element,orb})=>{
  mp.soloMode=true;initGame();hideGunSelect();hideMeleeSelect();
  gState='playing';waveNum=3;waveClear=false;waveTransition=false;waveSpawned=true;
  player.invincible=10000;player.pos.set(-8,0,-8);obstacleBoxes.length=0;
  if(orb)applySkill('poisonOrb');
  for(let n=0;n<2;n++){spawnEnemy('tank',7+n,7);const e=enemies[enemies.length-1];e.hp=e.maxHp=10000;e.spd=0;e.spawnAnim=0;}
  const primary=enemies[0],target=element==='thunder'?enemies[1]:primary;
  tagElement(primary,'poison',100);tagElement(primary,element,100);
  const initial=poisonMap.get(target.poolIdx);if(!initial)throw new Error('Reaction did not create poison');
  const damage=initial.dmg,before=target.hp;
  update(.01);const first=target.hp;
  update(.2);const early=target.hp;
  for(let i=0;i<31;i++)update(.01);const second=target.hp;
  for(let i=0;i<600;i++)update(.01);
  const expired=!poisonMap.has(target.poolIdx),atExpiry=target.hp;
  for(let i=0;i<60;i++)update(.01);
  const afterExpiry=target.hp;
  poisonMap.set(target.poolIdx,{t:3,tick:0,dmg:20});initGame();
  return {element,orb,damage,firstDamage:before-first,earlyDamage:first-early,secondDamage:early-second,
    expired,afterExpiry:atExpiry-afterExpiry,reset:poisonMap.size===0};
};
`;
(async()=>{
  const browser=await launch(),errors=[],results=[];
  try{
    const c=await browser.newContext();await instrument(c,hooks);const p=await c.newPage();
    p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:3000');await p.waitForFunction(()=>!!window.gameTest);
    for(const orb of [false,true])for(const element of ['fire','ice','thunder']){
      const r=await p.evaluate(a=>gameTest.poisonReaction(a),{element,orb});results.push(r);console.log(r);
    }
    assert.deepEqual(results.filter(r=>r.firstDamage!==r.damage||r.earlyDamage!==0||r.secondDamage!==r.damage||!r.expired||r.afterExpiry!==0||!r.reset),[]);
    assert.deepEqual(errors,[]);
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

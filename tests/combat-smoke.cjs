const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { launch, instrument } = require('./browser-harness.cjs');
const hooks = `
function combatFixture(distance=2) {
  initGame(); hideGunSelect(); hideMeleeSelect();
  gState='playing'; waveNum=1; waveSpawned=true; waveClear=false;
  obstacleBoxes.length=0;
  player.pos.set(0,0,0); player.invincible=1000;
  spawnEnemy('tank',0,distance);
  const enemy=enemies[enemies.length-1];
  enemy.hp=enemy.maxHp=100000; enemy.spawnAnim=0;
  enemy.spd=0;
  return enemy;
}
function aimAt(enemy) {
  mouse.hasWorld=true; mouse.world.set(enemy.pos.x,0,enemy.pos.z);
}
gameTest.combatCase=(kind,id)=>{
  const enemy=combatFixture();
  const before=enemy.hp;
  if(kind==='sentinel') {
    applySkill('bladeSentinel');
    if(!sentinels.length) spawnSentinel();
    const sentinel=sentinels[0];
    sentinel.pos={x:0,z:enemy.pos.z-1.2}; sentinel.vel={x:0,z:0}; sentinel.attackCd=0;
    const count=slashVfx.length;
    // Summon spawning/separation can move the prepared sentinel out of reach.
    // Allow it to approach and attack instead of requiring a hit in one frame.
    for(let i=0;i<120&&enemy.hp>=before;i++)updateSummons(1/60,Date.now()+i*1000/60);
    if(enemy.hp>=before||slashVfx.length<=count) throw new Error('Sentinel must damage and create slash');
    const effect=slashVfx[slashVfx.length-1];
    let disposed=false; effect.mesh.geometry.addEventListener('dispose',()=>disposed=true);
    for(let i=0;i<20;i++) update(1/60);
    if(effect.mesh.parent||!disposed) throw new Error('Expired slash not disposed');
  } else if(kind==='guns') {
    // Grenades bounce off bodies; aim beside the stationary target to test splash.
    if(id==='grenade') enemy.pos.x=2;
    player.gun=id; player.ammo=currentMagSize(); player.reloadT=0;
    const ammo=player.ammo;
    for(let i=0;i<180;i++) {
      aimAt(enemy); if(id==='grenade') mouse.world.x=0;
      mouse.down=id==='railgun'?i<120:i<30;
      update(1/60);
    }
    mouse.down=false;
    if(enemy.hp>=before) throw new Error('Weapon did not damage target');
    if(player.ammo>=ammo) throw new Error('Weapon did not consume ammo');
    player.ammo=1; player.fireCd=0;
    if(id==='railgun') {player.railWasCharging=false;player.railCharge=0;}
    for(let i=0;i<(id==='railgun'?16:1);i++){aimAt(enemy);mouse.down=true;update(1/60);}
    if(id==='railgun'){mouse.down=false;aimAt(enemy);update(1/60);}
    mouse.down=false;
    if(player.ammo!==0||player.reloadT<=0) throw new Error('Empty magazine must start reload');
    for(let i=0;i<240;i++){aimAt(enemy);update(1/60);}
    if(player.ammo!==currentMagSize()||player.reloadT!==0) throw new Error('Reload must refill magazine');
  } else {
    player.meleeWeapon=id; aimAt(enemy); useMeleeAttack();
    if(player.meleeCd<=0) throw new Error('Melee must start cooldown');
    const cooldown=player.meleeCd; useMeleeAttack();
    if(player.meleeCd!==cooldown) throw new Error('Repeated melee changed cooldown');
    for(let i=0;i<90;i++){aimAt(enemy);update(1/60);}
    if(enemy.hp>=before) throw new Error('Melee did not damage target');
  }
  return {kind,id,damage:before-enemy.hp,ammo:player.ammo};
};
`;
(async()=>{
  const browser=await launch();
  const report={scope:'Controlled close-target damage, gun ammo and automatic reload, melee cooldown, sentinel damage and effect disposal.',cases:[],failures:[]};
  try {
    const context=await browser.newContext(); await instrument(context,hooks);
    const page=await context.newPage(); page.on('pageerror',e=>report.failures.push({asynchronous:e.message}));
    await page.goto('http://127.0.0.1:3000'); await page.waitForFunction(()=>!!window.gameTest);
    const inventory=await page.evaluate(()=>gameTest.inventory());
    for(const [kind,ids] of Object.entries({sentinel:['bladeSentinel'],guns:inventory.guns,melee:inventory.melee}))
      for(const id of ids) {
        try {report.cases.push(await page.evaluate(({kind,id})=>gameTest.combatCase(kind,id),{kind,id}));console.log('PASS',kind,id);}
        catch(e){report.failures.push({kind,id,error:e.message});console.log('FAIL',kind,id,e.message);}
      }
    assert.deepEqual(report.failures,[]);
  } finally {
    await fs.mkdir('test-results',{recursive:true});
    await fs.writeFile('test-results/combat.json',JSON.stringify(report,null,2));
    await browser.close();
  }
})().catch(e=>{console.error(e);process.exitCode=1;});

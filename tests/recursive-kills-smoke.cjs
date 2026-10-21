const assert=require('node:assert/strict');
const {launch,instrument}=require('./browser-harness.cjs');
const hooks=`
gameTest.recursiveKill=()=>{
 initGame();hideGunSelect();hideMeleeSelect();gState='playing';nbPaused=true;mp.soloMode=true;mp.isHost=true;
 waveTransition=false;waveClear=false;waveSpawned=false;_waveSpawnQueue.length=0;mouse.down=false;
 player.pos.set(0,0,0);player.invincible=10000;obstacleBoxes.length=0;
 for(const e of [...enemies]){releaseEnemySlot(e);}enemies.length=0;
 spawnEnemy('chaser',8,0);const target=enemies[enemies.length-1];target.hp=1;
 spawnEnemy('tank',1,0);const survivor=enemies[enemies.length-1];survivor.hp=survivor.maxHp=100000;
 for(const e of enemies){e.spd=0;e.spawnAnim=0;e.stuckCheck=100;}
 tagElement(target,'ice',10);playerSkills.stormCall=1;player.stormCallCd=0;
 const before=killCount;update(.01);
 const after=killCount;
 killEnemy(target);killEnemy(-1);killEnemy(999999);
 return {targetDead:target.dead,survivorAlive:enemies.includes(survivor)&&!survivor.dead,kills:after-before,repeatKills:killCount-after};
};
`;
(async()=>{
 const browser=await launch();try{
  const c=await browser.newContext();await instrument(c,hooks);const p=await c.newPage();
  await p.goto('http://127.0.0.1:3000');await p.waitForFunction(()=>!!window.gameTest);
  assert.deepEqual(await p.evaluate(()=>gameTest.recursiveKill()),{targetDead:true,survivorAlive:true,kills:1,repeatKills:0});
  console.log('PASS Storm Call + ice reaction: one kill, survivor preserved, repeated/invalid kills harmless.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

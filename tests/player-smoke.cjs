const assert=require('node:assert/strict');
const {launch,instrument}=require('./browser-harness.cjs');
const hooks=`
function playerFixture(){
  mp.soloMode=true;initGame();hideGunSelect();hideMeleeSelect();
  gState='playing';waveNum=1;waveSpawned=true;waveClear=false;
  obstacleBoxes.length=0;player.pos.set(0,0,0);runRevives=0;
  spawnEnemy('tank',12,12);enemies[0].spd=0;
}
gameTest.playerChecks=()=>{
  playerFixture();
  const results=[];
  for(const [key,axis,sign] of [['right','x',1],['left','x',-1],['up','z',-1],['down','z',1]]){
    player.pos.set(0,0,0);keys[NB_KEYBINDS[key]]=true;
    for(let i=0;i<15;i++)update(1/60);
    delete keys[NB_KEYBINDS[key]];
    if(player.pos[axis]*sign<=0)throw new Error('Movement '+key);
    results.push('movement '+key);
  }
  player.pos.set(0,0,0);keys[NB_KEYBINDS.right]=true;startDash();
  const cd=player.dashCd;if(cd<=0||player.dashT<=0||player.invincible<=0)throw new Error('Dash activation');
  startDash();if(player.dashCd!==cd)throw new Error('Dash cooldown');
  for(let i=0;i<30;i++)update(1/60);
  delete keys[NB_KEYBINDS.right];
  if(player.pos.x<=2||player.dashT>0)throw new Error('Dash movement/end');results.push('dash');
  player.invincible=0;const hp=player.hp;hurtPlayer(20);
  if(player.hp!==hp-20)throw new Error('Damage');
  hurtPlayer(20);if(player.hp!==hp-20)throw new Error('Damage invulnerability');
  player.invincible=0;player.barrierActive=true;hurtPlayer(20);
  if(player.hp!==hp-20||player.barrierActive)throw new Error('Barrier absorption');
  if(healPlayer(100000)!==20||player.hp!==hp)throw new Error('Healing cap');results.push('damage, invulnerability, barrier, healing');
  runRevives=1;player.invincible=0;hurtPlayer(100000);
  if(player.dead||player.hp<=0||runRevives!==0)throw new Error('Emergency revive');results.push('revive');
  applySkill('bladeSentinel');applyRelic('regenHeart');playerFixture();
  if(Object.keys(playerSkills).length||Object.keys(playerRelics).length||sentinels.length)throw new Error('Build reset');
  results.push('build reset');return results;
};
gameTest.deathExit=(restart)=>{
  playerFixture();player.invincible=0;hurtPlayer(100000);
  if(!player.dead)throw new Error('Lethal damage did not kill');
  nbQuitToMenu();if(restart)playerFixture();
};
gameTest.normalDeath=()=>{playerFixture();player.invincible=0;hurtPlayer(100000);};
`;
(async()=>{
  const browser=await launch();
  try{
    const context=await browser.newContext();await instrument(context,hooks);
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:3000');await page.waitForFunction(()=>!!window.gameTest);
    console.log(await page.evaluate(()=>gameTest.playerChecks()));
    for(const restart of [false,true]){
      await page.evaluate(restart=>gameTest.deathExit(restart),restart);
      await page.waitForTimeout(1800);
      assert.equal((await page.evaluate(()=>gameTest.state())).state,restart?'playing':'menu','Old death timer must not end menu/new run');
      console.log('PASS lethal damage then',restart?'new run':'menu');
    }
    await page.evaluate(()=>gameTest.normalDeath());
    await page.waitForTimeout(1800);
    assert.equal((await page.evaluate(()=>gameTest.state())).state,'gameover');
    console.log('PASS normal death opens game over');
    assert.deepEqual(errors,[]);
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

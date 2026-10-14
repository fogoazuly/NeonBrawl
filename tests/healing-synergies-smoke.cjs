const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const {launch,instrument}=require('./browser-harness.cjs');
const hooks=`
function healingFixture(){
  mp.soloMode=true;initGame();hideGunSelect();hideMeleeSelect();
  gState='playing';waveNum=1;waveSpawned=true;waveClear=false;
  player.invincible=10000;player._regenAcc=0;
  spawnEnemy('tank',12,12);enemies[0].spd=0;
}
gameTest.healingCase=(name,level)=>{
  healingFixture();
  const relic=(id,n)=>{for(let i=0;i<n;i++)applyRelic(id);};
  if(name==='curse-reset'||name==='curse-reset-client'){
    const baseline=playerStats.maxHp;applyCurseHp(.75,2);
    if(name==='curse-reset-client')startAsClient([0,0]);else initGame();
    if(playerStats.maxHp!==baseline||player.hp!==baseline)throw new Error('Curse carried into next run: '+playerStats.maxHp+' instead of '+baseline);
  }else if(name==='pact-steady'){
    relic('vampirePact',level);applySkill('steadyPulse');player.hp=10;
    for(const e of enemies)releaseEnemySlot(e);enemies.length=0;disposeMiniObjective();
    update(1/60);
    if(!waveClear||player.hp!==(level===0?15:10))throw new Error('Incorrect Steady Pulse regen');
  }else if(name==='pact-duel'){
    relic('vampirePact',level);applySkill('duelGuard');player.hp=10;player.pos.set(0,0,0);
    const e=enemies[0];e.pos.set(0,0,1.5);e.hp=e.maxHp=100000;e.spawnAnim=0;
    const before=waveContribution.damage;
    performMeleeAttack('katana',{x:0,z:0,dx:0,dz:1,ownerId:mp.myId});
    const damage=waveContribution.damage-before;
    if(damage<=0)throw new Error('Duel fixture did not hit');
    const expected=level===0?33:Math.min(playerStats.maxHp,10+Math.max(1,Math.round(damage*[0,.1,.2,.3][level])));
    if(player.hp!==expected)throw new Error('Duel Guard regen bypassed Pact: '+player.hp+' instead of '+expected);
  }else if(name==='pact'){
    relic('vampirePact',level);player.hp=10;
    recordDamageDealt(100);if(player.hp!==10+[0,10,20,30][level])throw new Error('Pact damage heal');
    player.hp=10;const gained=healPlayer(20);
    if(gained!==(level===3?0:20))throw new Error('Pact normal healing gate');
  }else if(name==='plague-pact'){
    relic('vampirePact',level);player.hp=10;waveEvent={type:'challenge',sub:'plagueField'};
    recordDamageDealt(100);if(player.hp!==10)throw new Error('Pact bypassed no-healing challenge');
  }else if(name==='zero-hp-recalc'){
    player.hp=0;player.dead=true;recalcPlayerMaxHp(false);
    if(player.hp!==0)throw new Error('Recalculation restored zero HP');
  }else{
    relic('regenHeart',1);
    if(name==='last-stand')relic('lastStandCore',level);
    if(name==='pact-regen')relic('vampirePact',level);
    if(name==='plague-regen')waveEvent={type:'challenge',sub:'plagueField'};
    player.hp=Math.ceil(playerStats.maxHp*.6);const before=player.hp;
    const expectedMultiplier=name==='plague-regen'||name==='pact-regen'&&level===3?0:name==='last-stand'?[1,.5,.5,0][level]:1;
    const expected=playerStats.maxHp*.10*expectedMultiplier;
    const healingBefore=waveContribution.healing;
    for(let i=0;i<60;i++)update(1/60);
    const gained=player.hp-before;
    if(Math.abs(gained-expected)>1)throw new Error('Regen expected '+expected+', got '+gained);
    if(waveContribution.healing-healingBefore!==gained)throw new Error('Regen missing from healing contribution');
  }
  return {name,level,hp:player.hp,maxHp:playerStats.maxHp};
};
`;
(async()=>{
  const browser=await launch(),report={cases:[],failures:[]};
  try{
    const context=await browser.newContext();await instrument(context,hooks);
    const page=await context.newPage();page.on('pageerror',e=>report.failures.push({asynchronous:e.message}));
    await page.goto('http://127.0.0.1:3000');await page.waitForFunction(()=>!!window.gameTest);
    for(const name of ['pact','plague-pact','last-stand','pact-regen','pact-steady','pact-duel','regen','plague-regen','zero-hp-recalc','curse-reset','curse-reset-client'])
      for(const level of ['regen','plague-regen','zero-hp-recalc','curse-reset','curse-reset-client'].includes(name)?[1]:['pact-steady','pact-duel'].includes(name)?[0,1,2,3]:[1,2,3]){
        try{report.cases.push(await page.evaluate(t=>gameTest.healingCase(t.name,t.level),{name,level}));console.log('PASS',name,level);}
        catch(e){report.failures.push({name,level,error:e.message});console.log('FAIL',name,level,e.message);}
      }
    assert.deepEqual(report.failures,[]);
  }finally{
    await fs.mkdir('test-results',{recursive:true});await fs.writeFile('test-results/healing-synergies.json',JSON.stringify(report,null,2));await browser.close();
  }
})().catch(e=>{console.error(e);process.exitCode=1;});

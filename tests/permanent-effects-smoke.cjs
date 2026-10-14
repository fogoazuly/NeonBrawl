const assert=require('node:assert/strict');
const {launch,instrument}=require('./browser-harness.cjs');
const hooks=`
gameTest.permanentEffect=(id,level)=>{
  persistData.upgrades={...DEFAULT_PERSIST.upgrades,[id]:level};
  mp.soloMode=true;initGame();hideGunSelect();hideMeleeSelect();
  gState='playing';waveNum=1;waveSpawned=true;waveClear=false;
  obstacleBoxes.length=0;player.pos.set(0,0,0);player.invincible=10000;
  spawnEnemy('chaser',12,12);enemies[0].spd=0;
  let value;
  if(id==='hp')value=player.hp;
  if(id==='dmg')value=playerDamageAmount(enemies[0],playerStats.attackDmg);
  if(id==='bossHunter')value=playerDamageAmount({type:'boss',hp:1000,maxHp:1000},100);
  if(id==='crit'){
    value=0;
    try{for(let i=0;i<10000;i++){window.testCritRoll=(i+.5)/10000;if(rollCrit())value++;}}
    finally{delete window.testCritRoll;}
  }
  if(id==='treasure'){
    const table=GOLD_DROP_TABLE.chaser,before=persistData.gold;
    try{GOLD_DROP_TABLE.chaser={chance:1,min:100,max:100};killEnemy(0);value=persistData.gold-before;}
    finally{GOLD_DROP_TABLE.chaser=table;}
  }
  if(id==='speed'){
    keys[NB_KEYBINDS.right]=true;for(let i=0;i<10;i++)update(1/60);delete keys[NB_KEYBINDS.right];value=player.pos.x;
  }
  if(id==='fireRate'){
    mouse.hasWorld=true;mouse.world.set(0,0,10);mouse.down=true;update(1/60);mouse.down=false;
    if(player.ammo!==currentMagSize()-1)throw new Error('Did not fire exactly once');value=player.fireCd+1/60;
  }
  if(id==='revive'){
    const count=[0,1,1,2][level];
    for(let i=0;i<count;i++){
      player.invincible=0;hurtPlayer(100000);
      const expected=Math.round(playerStats.maxHp*[0,.35,.6,.5][level]);
      if(player.dead||player.hp!==expected||runRevives!==count-i-1)throw new Error('Revive effect '+level);
    }
    value=runRevives;
  }
  if(id==='reroll'){
    beginOpeningLoadoutOrWave();const initial=runRerolls;
    for(let i=0;i<initial;i++){
      const btn=document.querySelector('.buff-reroll-btn');if(!btn)throw new Error('Missing reroll');btn.click();
      if(runRerolls!==initial-i-1)throw new Error('Reroll not consumed');
    }
    if(document.querySelector('.buff-reroll-btn'))throw new Error('Reroll offered at zero');value=initial;
  }
  return value;
};
gameTest.opening=level=>{
  persistData.upgrades={...DEFAULT_PERSIST.upgrades,startSkill:level};mp.soloMode=true;
  initGame();hideGunSelect();hideMeleeSelect();beginOpeningLoadoutOrWave();
};
gameTest.openingState=()=>({state:gState,wave:waveNum,picks:Object.values(playerSkillPicks).reduce((a,b)=>a+b,0),choosing:document.querySelector('#buffCards').classList.contains('choosing-card')});
`;
(async()=>{
  const browser=await launch();
  try{
    const context=await browser.newContext();
    // Damage captures its random function during boot; this wrapper permits deterministic crit rolls only inside each synchronous case.
    await context.addInitScript(()=>{const original=Math.random;Math.random=()=>window.testCritRoll??original();});
    await instrument(context,hooks);
    const page=await context.newPage(),errors=[];page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:3000');await page.waitForFunction(()=>!!window.gameTest);
    let count=0;
    for(const id of ['hp','dmg','bossHunter','crit','treasure','speed','fireRate','revive','reroll']){
      let baseline;
      for(let level=0;level<=(['revive','reroll'].includes(id)?3:10);level++){
        const value=await page.evaluate(t=>gameTest.permanentEffect(t.id,t.level),{id,level});
        if(level===0)baseline=value;
        const expected=id==='hp'?100+10*level:id==='dmg'?Math.round(25*(1+.02*level)):id==='bossHunter'?100+3*level:id==='crit'?330*level:id==='treasure'?100+6*level:id==='speed'?baseline*(1+.03*level):id==='fireRate'?.36/(1+.02*level):id==='reroll'?[0,3,5,8][level]:0;
        assert.ok(Math.abs(value-expected)<.0001,id+' '+level+': '+value+' != '+expected);count++;
      }
      console.log('PASS permanent effect',id);
    }
    for(let level=0;level<=3;level++){
      await page.evaluate(level=>gameTest.opening(level),level);
      const expected=Math.max(1,level);
      for(let pick=0;pick<expected;pick++){
        await page.waitForFunction(pick=>gameTest.openingState().picks===pick&&!gameTest.openingState().choosing,pick);
        await page.locator('#buffCards .buff-card').first().click({force:true});
      }
      await page.waitForFunction(()=>gameTest.openingState().wave===1);
      assert.equal((await page.evaluate(()=>gameTest.openingState())).picks,expected);
      console.log('PASS opening loadout level',level);
    }
    assert.deepEqual(errors,[]);console.log('PASS',count,'permanent level scenarios + 4 opening loadouts');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

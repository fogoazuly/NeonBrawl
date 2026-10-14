const assert=require('node:assert/strict');
const {launch,instrument}=require('./browser-harness.cjs');
const hooks=`
function objectiveFixture(){
  mp.soloMode=true;initGame();hideGunSelect();hideMeleeSelect();
  gState='playing';waveNum=4;waveSpawned=true;waveClear=false;
  obstacleBoxes.length=0;player.invincible=10000;
}
gameTest.objectiveCase=type=>{
  objectiveFixture();setupMiniObjective(waveNum,type);
  const o=miniObjective;
  if(type==='spawners'){
    player.pos.set(0,0,0);
    const s=o.spawners[0],hp=s.hp;damageMiniObjectiveAt(s.x,s.z,100000);
    if(s.hp!==hp)throw new Error('Unarmed spawner damaged');
    for(const sp of o.spawners){player.pos.set(sp.x,0,sp.z);damageMiniObjectiveAt(sp.x,sp.z,100000);}
    updateMiniObjective(1/60,Date.now());
  }else{
    for(let i=0;i<4000&&!o.complete;i++){
      if(type==='relays'){const p=RELAY_POSITIONS[o.relays.index];player.pos.set(p.x,0,p.z);}
      if(type==='cells'&&o.cells.active)player.pos.set(o.cells.posX,0,o.cells.posZ);
      if(type==='defend')player.pos.set(0,0,0);
      updateMiniObjective(1/60,Date.now()+i*1000/60);
    }
  }
  if(!o.complete||miniObjectiveBlocksWaveClear())throw new Error('Objective did not complete');
  waveEvent={type:'mini'};const rewards=_eventBonusPicksLeft;
  claimWaveEventReward();claimWaveEventReward();
  if(_eventBonusPicksLeft!==rewards+1)throw new Error('Objective reward duplicated or missing');
  return type;
};
gameTest.objectiveFailure=()=>{
  objectiveFixture();setupMiniObjective(waveNum,'defend');waveEvent={type:'mini'};
  miniObjective.reactor.hp=-100;player.pos.set(12,0,12);updateMiniObjective(1/60,Date.now());
  if(!waveEvent.failed||miniObjective.type!=='clear')throw new Error('Reactor failure');
  claimWaveEventReward();if(_eventBonusPicksLeft!==0)throw new Error('Failed objective rewarded');
};
gameTest.shopCheck=()=>{
  objectiveFixture();gState='shopround';runShopCards=['rapidFire'];runCrystals=0;renderRunShop();
  if(!document.querySelector('.run-shop-buy').disabled)throw new Error('Unfunded purchase enabled');
  const price=runShopCardPrice('rapidFire');runCrystals=price;renderRunShop();
  document.querySelector('.run-shop-buy').click();
  if(runCrystals!==0||skillPickLevel('rapidFire')!==1)throw new Error('Purchase debit/skill');
  if(runShopCardPrice('rapidFire')!==price*2)throw new Error('Repeat price must double');
  runCrystals=100000;renderRunShop();
  while(skillPickLevel('rapidFire')<skillMaxLevel('rapidFire'))document.querySelector('.run-shop-buy').click();
  if(!document.querySelector('.run-shop-buy').disabled)throw new Error('Maxed purchase enabled');
  const balance=runCrystals,cost=runShopRerollCost;document.querySelector('.run-shop-reroll').click();
  if(runCrystals!==balance-cost||runShopRerollCost<=cost)throw new Error('Reroll cost');
  if(runShopCards.includes('rapidFire')||new Set(runShopCards).size!==runShopCards.length)throw new Error('Invalid reroll stock');
  runCrystals=0;renderRunShop();if(!document.querySelector('.run-shop-reroll').disabled)throw new Error('Unfunded reroll enabled');
  shopTotemUses=0;shopTotemDestroyed=false;shopTotemBreakChance=1;
  activateShopTotem();activateShopTotem();
  if(!shopTotemDestroyed||shopTotemUses!==1)throw new Error('Broken totem activated twice');
  return {purchase:true,cap:true,reroll:true,totem:true};
};
`;
(async()=>{
  const browser=await launch();
  try{
    const context=await browser.newContext();await instrument(context,hooks);
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:3000');await page.waitForFunction(()=>!!window.gameTest);
    for(const type of ['spawners','defend','survive','relays','cells'])console.log('PASS objective',await page.evaluate(type=>gameTest.objectiveCase(type),type));
    await page.evaluate(()=>gameTest.objectiveFailure());console.log('PASS reactor failure');
    console.log('PASS shop',await page.evaluate(()=>gameTest.shopCheck()));
    assert.deepEqual(errors,[]);
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

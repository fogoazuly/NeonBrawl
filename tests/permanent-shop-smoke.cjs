const assert=require('node:assert/strict');
const {launch,instrument}=require('./browser-harness.cjs');
const hooks=`
function shopCard(name){return [...document.querySelectorAll('#shopBody .perm-card')].find(c=>c.querySelector('.perm-card-name')?.textContent===name);}
gameTest.permanentPurchases=async()=>{
  const results=[];
  for(const def of PERM_SHOP_DEFS){
    persistData.upgrades[def.id]=0;persistData.gold=0;setShopTab(def.cat);
    if(!shopCard(def.name).querySelector('button')?.disabled)throw new Error('Unfunded upgrade: '+def.id);
    const max=def.max||PERM_MAX_LVL,costs=def.costs||PERM_UPGRADE_COST;
    for(let level=1;level<=max;level++){
      persistData.gold=costs[level];renderShop();const btn=shopCard(def.name).querySelector('button');
      btn.click();btn.click();await Promise.resolve();
      if(persistData.gold!==0||persistData.upgrades[def.id]!==level)throw new Error('Debit/level '+def.id+' '+level);
      if(shopCard(def.name).textContent.includes('undefined'))throw new Error('Undefined effect '+def.id);
    }
    if(shopCard(def.name).querySelector('button'))throw new Error('Max upgrade still purchasable '+def.id);
    results.push({id:def.id,levels:max});
  }
  return results;
};
gameTest.weaponPurchases=async()=>{
  persistData.weapons={katana:true};persistData.gold=0;setShopTab('WEAPONS');
  for(const w of WEAPON_SHOP_DEFS){
    if(w.id==='katana')continue;
    if(canBuyWeapon(w.id))throw new Error('Unfunded weapon purchasable');
    if(w.requires&&!isWeaponOwned(w.requires)&&shopCard(w.name).querySelector('button'))throw new Error('Missing prerequisite allowed');
  }
  persistData.gold=100000;renderShop();
  const spend=spendAccountGold,first=WEAPON_SHOP_DEFS.find(w=>w.id==='dagger');
  try{
    spendAccountGold=async()=>{throw new Error('Simulated payment failure');};
    const before=persistData.gold;shopCard(first.name).querySelector('button').click();await Promise.resolve();
    if(persistData.gold!==before||isWeaponOwned(first.id)||shopCard(first.name).querySelector('button').disabled)throw new Error('Failed purchase did not preserve balance/allow retry');
  }finally{spendAccountGold=spend;}
  const results=[];
  for(const w of WEAPON_SHOP_DEFS){
    if(w.id==='katana')continue;
    if(w.requires&&!isWeaponOwned(w.requires))throw new Error('Fixture order '+w.id);
    const old=persistData.gold,btn=shopCard(w.name).querySelector('button');
    btn.click();btn.click();await Promise.resolve();
    if(persistData.gold!==old-w.cost||!isWeaponOwned(w.id))throw new Error('Weapon double charge '+w.id+': '+(old-persistData.gold)+' instead of '+w.cost);
    if(shopCard(w.name).querySelector('button'))throw new Error('Owned weapon purchasable');
    results.push(w.id);
  }
  return results;
};
gameTest.savedShop=()=>({gold:persistData.gold,upgrades:{...persistData.upgrades},weapons:{...persistData.weapons}});
`;
(async()=>{
  const browser=await launch();
  try{
    const context=await browser.newContext();await instrument(context,hooks);
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:3000');await page.waitForFunction(()=>!!window.gameTest);
    const upgrades=await page.evaluate(()=>gameTest.permanentPurchases());
    console.log('PASS upgrades',upgrades.length,'levels',upgrades.reduce((n,r)=>n+r.levels,0));
    console.log('PASS weapons',await page.evaluate(()=>gameTest.weaponPurchases()));
    const saved=await page.evaluate(()=>gameTest.savedShop());await page.reload();await page.waitForFunction(()=>!!window.gameTest);
    assert.deepEqual(await page.evaluate(()=>gameTest.savedShop()),saved);assert.deepEqual(errors,[]);
    console.log('PASS permanent shop persistence');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

const assert=require('node:assert/strict');
const {launch,instrument}=require('./browser-harness.cjs');
const hooks=`
gameTest.keyState=()=>({keys:persistData.gunKeys,owned:Object.keys(GUNS).filter(isGunOwned),opening:_gunChestOpening});
gameTest.keyAwards=()=>{
  mp.soloMode=true;initGame();
  const before=persistData.gunKeys||0;
  awardGunKeysForWave(9);awardGunKeysForWave(10);awardGunKeysForWave(10);awardGunKeysForWave(20);
  if(persistData.gunKeys!==before+2)throw new Error('Wave award eligibility/duplication');
  initGame();awardGunKeysForWave(10);
  if(persistData.gunKeys!==before+3)throw new Error('New run did not reset key awards');
  nbQuitToMenu();
};
gameTest.openChest=()=>openGunChest();
gameTest.noKeys=()=>{persistData.gunKeys=0;_savePD();};
gameTest.allGuns=()=>{persistData.gunKeys=1;for(const id of Object.keys(GUNS))persistData.guns[id]=true;_savePD();};
gameTest.chestOdds=()=>{
  const saved={...persistData.guns},random=Math.random;
  const sample=()=>{
    const counts={common:0,rare:0,epic:0};
    for(let i=0;i<1000;i++){
      let calls=0;Math.random=()=>++calls===1?(i+.5)/1000:.5;
      const prize=rollGunChestId();if(isGunOwned(prize.id))throw new Error('Owned prize');counts[prize.rarity]++;
    }
    return counts;
  };
  try{
    persistData.guns={pistol:true,shotgun:true};
    const full=sample();renderGunChest();
    const text=document.querySelector('.gun-chest-sub').textContent;
    if(!text.includes('COMMON 50%')||!text.includes('RARE 34%')||!text.includes('EPIC 16%'))throw new Error('Incorrect displayed odds');
    for(const id of GUN_CHEST_RARITIES.common.ids)persistData.guns[id]=true;
    const reduced=sample();renderGunChest();
    const reducedText=document.querySelector('.gun-chest-sub').textContent;
    if(reducedText.includes('COMMON')||!reducedText.includes('RARE 68%')||!reducedText.includes('EPIC 32%'))throw new Error('Completed rarity odds not renormalized');
    return {full,reduced};
  }finally{Math.random=random;persistData.guns=saved;}
};
`;
(async()=>{
  const browser=await launch();
  try{
    const context=await browser.newContext();await instrument(context,hooks);
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:3000');await page.waitForFunction(()=>!!window.gameTest);
    assert.deepEqual(await page.evaluate(()=>gameTest.chestOdds()),{full:{common:500,rare:340,epic:160},reduced:{common:0,rare:680,epic:320}});
    console.log('PASS chest weighting and displayed odds as rarities sell out');
    await page.evaluate(()=>gameTest.keyAwards());console.log('PASS wave key awards across runs');
    const before=await page.evaluate(()=>gameTest.keyState());
    await page.evaluate(()=>{gameTest.openChest();gameTest.openChest();});
    await page.waitForFunction(()=>!gameTest.keyState().opening);
    const after=await page.evaluate(()=>gameTest.keyState());
    assert.equal(after.keys,before.keys-1);assert.equal(after.owned.length,before.owned.length+1);
    await page.reload();await page.waitForFunction(()=>!!window.gameTest);
    assert.deepEqual(await page.evaluate(()=>gameTest.keyState()),after);
    await page.evaluate(()=>gameTest.noKeys());
    await page.evaluate(()=>gameTest.openChest());assert.equal((await page.evaluate(()=>gameTest.keyState())).opening,false);
    assert.deepEqual((await page.evaluate(()=>gameTest.keyState())).owned,after.owned);
    await page.evaluate(()=>{gameTest.allGuns();gameTest.openChest();});
    assert.equal((await page.evaluate(()=>gameTest.keyState())).keys,1);assert.equal((await page.evaluate(()=>gameTest.keyState())).opening,false);
    assert.deepEqual(errors,[]);console.log('PASS chest debit/unlock, double click, persistence, no keys, all owned');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

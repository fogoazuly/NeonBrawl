const assert=require('node:assert/strict');
const {launch,instrument}=require('./browser-harness.cjs');
const hooks=`
gameTest.shrineSetup=()=>{
  mp.soloMode=true;initGame();hideGunSelect();hideMeleeSelect();update=()=>{};
  gState='playing';waveNum=6;waveClear=true;waveTransition=false;waveEvent=null;
  playerStats.baseMaxHp=100;recalcPlayerMaxHp(false);player.hp=100;_cursedShrinePending=true;afterBuffSelect();
};
gameTest.shrineState=()=>({wave:waveNum,hp:player.hp,max:playerStats.maxHp,pct:player._curseHpPct||0,duration:player._curseHpWaves||0,skills:{...playerSkillPicks},relics:{...playerRelics},phase:_buffSelectPhase});
gameTest.shrineCatalog=()=>({skills:Object.fromEntries(Object.keys(SKILL_DEFS).map(id=>[id,skillRarity(id)])),relics:Object.fromEntries(Object.entries(RELIC_DEFS).map(([id,d])=>[id,!!d.cursed]))});
gameTest.exhaustRarity=rarity=>{for(const id of Object.keys(SKILL_DEFS))if(skillRarity(id)===rarity)playerSkillPicks[id]=skillMaxLevel(id);};
gameTest.exhaustAll=()=>{for(const id of Object.keys(SKILL_DEFS))playerSkillPicks[id]=skillMaxLevel(id);showCursedShrine();};
gameTest.curseDuration=(pct,waves)=>{
  gameTest.shrineSetup();applyCurseHp(pct,waves);const sequence=[];
  for(let i=0;i<waves;i++){tickCurseHpOnWaveClear();sequence.push(gameTest.shrineState());}
  return sequence;
};
`;
(async()=>{
  const browser=await launch(),errors=[];
  try{
    const c=await browser.newContext();await instrument(c,hooks);const page=await c.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:3000');await page.waitForFunction(()=>!!window.gameTest);
    const catalog=await page.evaluate(()=>gameTest.shrineCatalog());
    const offers=[['tribute',0,0,'common'],['sacrifice',.25,3,'uncommon'],['bargain',.5,5,'rare'],['pact',.75,5,'epic']];
    for(const [i,[name,cost,duration,rarity]] of offers.entries()){
      await page.evaluate(()=>gameTest.shrineSetup());
      await page.locator('#buffCards .buff-card').nth(i).dblclick({force:true});await page.waitForTimeout(800);
      const offered=await page.evaluate(()=>gameTest.shrineState());
      assert.equal(offered.max,100*(1-cost));assert.equal(offered.hp,offered.max);assert.equal(offered.duration,duration);
      if(rarity){await page.locator('#buffCards .buff-card').first().dblclick({force:true});await page.waitForTimeout(800);}
      const after=await page.evaluate(()=>gameTest.shrineState());assert.equal(after.wave,7,name+' advances once');
      if(rarity==='cursed'){assert.equal(Object.keys(after.relics).length,1);assert.equal(Object.values(after.relics)[0],1);assert.ok(catalog.relics[Object.keys(after.relics)[0]]);}
      else if(rarity){assert.equal(Object.keys(after.skills).length,1);assert.equal(Object.values(after.skills)[0],1);assert.equal(catalog.skills[Object.keys(after.skills)[0]],rarity);}
      else{assert.deepEqual(after.skills,{});assert.deepEqual(after.relics,{});}
      console.log('PASS shrine',name);
    }
    for(const [pct,waves] of [[.25,3],[.5,5],[.75,5]]){
      const steps=await page.evaluate(t=>gameTest.curseDuration(...t),[pct,waves]);
      for(let i=0;i<waves-1;i++){assert.equal(steps[i].max,100*(1-pct));assert.equal(steps[i].duration,waves-i-1);}
      assert.equal(steps.at(-1).max,100);assert.equal(steps.at(-1).hp,100);assert.equal(steps.at(-1).pct,0);assert.equal(steps.at(-1).duration,0);
      console.log('PASS curse duration',pct,waves);
    }
    for(const [i,[name,cost,duration,rarity]] of offers.entries()){
      await page.evaluate(r=>{gameTest.shrineSetup();gameTest.exhaustRarity(r);},rarity);
      await page.locator('#buffCards .buff-card').nth(i).click({force:true});await page.waitForTimeout(800);
      const result=await page.evaluate(()=>gameTest.shrineState());
      assert.equal(result.max,100,'No HP charge for exhausted '+rarity);assert.equal(result.duration,0);assert.equal(result.wave,6);
      assert.equal(await page.locator('#buffCards .buff-card').nth(i).getAttribute('aria-disabled'),'true');
      await page.locator('#buffCards .buff-card').nth(i).click({force:true});await page.waitForTimeout(750);
      assert.equal((await page.evaluate(()=>gameTest.shrineState())).max,100);
      console.log('PASS exhausted shrine rarity',rarity);
    }
    await page.evaluate(()=>{gameTest.shrineSetup();gameTest.exhaustAll();});
    const full=await page.evaluate(()=>gameTest.shrineState());assert.equal(full.wave,7);assert.equal(full.max,100);assert.equal(full.duration,0);
    console.log('PASS all shrine rewards exhausted continues without cost');
    assert.deepEqual(errors,[]);
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

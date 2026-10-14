const assert=require('node:assert/strict');
const {launch,instrument}=require('./browser-harness.cjs');
const hooks=`
gameTest.coopState=()=>({state:gState,id:mp.myId,hp:player.hp,maxHp:playerStats.maxHp,dead:player.dead,downed:player.downed,progress:player.reviveT,bleed:player.downedT,remotes:Object.fromEntries(Object.entries(mp.remotePlayers).map(([id,p])=>[id,{dead:p.dead,downed:p.downed,x:p.pos.x,z:p.pos.z}]))});
gameTest.safe=()=>{
  player.invincible=10000;player.barrierActive=false;runRevives=0;
  if(mp.isHost){for(const e of enemies)releaseEnemySlot(e);enemies.length=0;_waveSpawnQueue.length=0;spawnEnemy('tank',12,12);enemies[0].spd=0;enemies[0].hp=enemies[0].maxHp=100000;}
};
gameTest.move=(x,z)=>{player.pos.set(x,0,z);sendPlayerState();};
gameTest.knock=()=>{player.invincible=0;player.barrierActive=false;runRevives=0;hurtPlayer(100000);};
gameTest.expire=()=>{player.downedT=.01;};
gameTest.clearWave=()=>{for(const e of enemies)releaseEnemySlot(e);enemies.length=0;_waveSpawnQueue.length=0;disposeMiniObjective();};
gameTest.wipeSetup=()=>{gState='playing';waveClear=false;gameTest.safe();player.invincible=0;};
gameTest.rematchThenLeave=()=>{requestRematch();nbQuitToMenu();};
gameTest.guestReady=()=>!!mp.rematchReady[1];
`;
(async()=>{
  const browser=await launch();
  try{
    const contexts=await Promise.all([browser.newContext(),browser.newContext()]);
    for(const c of contexts)await instrument(c,hooks);
    const host=await contexts[0].newPage(),guest=await contexts[1].newPage(),errors=[];
    for(const page of [host,guest]){page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message));}
    await host.goto('http://127.0.0.1:3000');await host.locator('#nbBtnMP').click();await host.locator('#hostBtn').click();
    await host.waitForFunction(()=>document.querySelector('#mpStatus').textContent.includes('You are HOST'));
    const code=await host.locator('#roomCodeDisplay').innerText();
    await guest.goto('http://127.0.0.1:3000/?join='+code);
    await guest.waitForFunction(()=>document.querySelector('#mpStatus').textContent.includes('2/6'));
    await host.locator('#hostBtn').click();
    for(const selector of ['#gunCards button','#meleeCards button','#buffCards .buff-card'])
      for(const page of [host,guest]){await page.locator(selector).first().waitFor({state:'visible'});await page.locator(selector).first().click({force:true});}
    await guest.waitForFunction(()=>gameTest.state().wave===1);
    for(const p of [host,guest])await p.evaluate(()=>gameTest.safe());
    const state=p=>p.evaluate(()=>gameTest.coopState());
    for(const [victim,rescuer] of [[guest,host],[host,guest]]){
      await rescuer.evaluate(()=>gameTest.move(-8,-8));await victim.evaluate(()=>gameTest.move(0,0));
      await victim.waitForFunction(()=>Object.values(gameTest.coopState().remotes).some(p=>p.x<-7));
      await victim.evaluate(()=>gameTest.knock());
      assert.equal((await state(victim)).downed,true);
      await rescuer.waitForFunction(()=>Object.values(gameTest.coopState().remotes).some(p=>p.downed));
      const bleed=(await state(victim)).bleed;
      await victim.waitForFunction(bleed=>gameTest.coopState().bleed<bleed-.2,bleed);
      assert.equal((await state(victim)).progress,0);
      await rescuer.evaluate(()=>gameTest.move(0,0));
      await victim.waitForFunction(()=>!gameTest.coopState().dead,{},{timeout:15000});
      const revived=await state(victim);assert.ok(revived.hp>0&&revived.hp<=revived.maxHp);assert.equal(revived.downed,false);
      await rescuer.waitForFunction(()=>Object.values(gameTest.coopState().remotes).every(p=>!p.dead&&!p.downed));
      await victim.evaluate(()=>gameTest.safe());
      console.log('PASS down, bleed while alone, proximity revive:',victim===host?'host':'guest');
    }
    await host.evaluate(()=>gameTest.move(-8,-8));await guest.evaluate(()=>gameTest.move(0,0));
    await guest.waitForFunction(()=>Object.values(gameTest.coopState().remotes).some(p=>p.x<-7));
    await guest.evaluate(()=>{gameTest.knock();gameTest.expire();});
    await guest.waitForFunction(()=>gameTest.coopState().dead&&!gameTest.coopState().downed);
    assert.equal((await state(host)).state,'playing');console.log('PASS bleed out keeps living teammate playing');
    await host.evaluate(()=>gameTest.clearWave());
    await guest.waitForFunction(()=>!gameTest.coopState().dead);
    console.log('PASS wave clear revives eliminated teammate');
    // Finish the wave-clear transition before preparing a new combat state.
    await host.waitForTimeout(1000);
    for(const p of [host,guest])await p.evaluate(()=>{gameTest.wipeSetup();gameTest.knock();});
    for(const p of [host,guest])await p.waitForFunction(()=>gameTest.coopState().state==='gameover');
    console.log('PASS team wipe reaches game over on both clients');
    await guest.locator('#restartBtn').click();
    await guest.waitForFunction(()=>gameTest.coopState().state==='rematchwait');
    assert.equal((await state(host)).state,'gameover');
    await host.locator('#restartBtn').click();
    for(const selector of ['#gunCards button','#meleeCards button','#buffCards .buff-card'])
      for(const page of [host,guest]){await page.locator(selector).first().waitFor({state:'visible'});await page.locator(selector).first().click({force:true});}
    for(const p of [host,guest])await p.waitForFunction(()=>gameTest.state().wave===1&&gameTest.coopState().state==='playing'&&!gameTest.coopState().dead);
    console.log('PASS rematch waits for both players and starts a healthy new run');
    for(const p of [host,guest])await p.evaluate(()=>gameTest.death());
    await guest.locator('#restartBtn').click();
    await host.waitForFunction(()=>document.querySelector('#gameover').style.display!=='none');
    await host.waitForFunction(()=>gameTest.guestReady());
    await host.evaluate(()=>gameTest.rematchThenLeave());
    await guest.waitForFunction(()=>gameTest.coopState().state==='menu');
    await host.waitForTimeout(700);
    assert.equal((await state(host)).state,'menu','Leaving during rematch countdown must cancel restart');
    console.log('PASS leaving during rematch countdown cancels restart');
    assert.deepEqual(errors,[]);
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

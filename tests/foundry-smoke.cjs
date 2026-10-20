const assert=require('node:assert/strict');
const {launch,instrument,startCoop}=require('./browser-harness.cjs');
const hooks=`
gameTest.foundrySetup=()=>{
 initGame();hideGunSelect();hideMeleeSelect();gState='playing';nbPaused=true;mp.soloMode=true;mp.isHost=true;
 for(const e of enemies)e.dead=true;
 waveClear=false;waveTransition=false;mouse.down=false;
 changeMapLayout(ARENA_PRESETS.findIndex(p=>p.id==='enc_foundry_lanes'));
 player.pos.set(-4.5,0,0);player.hp=player.maxHp=200;player.invincible=0;
};
gameTest.heatAt=(t,x=-4.5,clear=false)=>{
 mapHazardTime=t;player.pos.x=x;player.invincible=0;waveClear=clear;
 for(const h of mapHazards)h.hitCd={};
 const before=player.hp;updateMapHazards(0,0);
 return {damage:before-player.hp,phases:mapHazards.map(h=>h.phase)};
};
gameTest.heatSafe=()=>{
 for(let z=-12;z<=12;z+=.25)for(let x=-1.5;x<=1.5;x+=.5){
  if(isBlockedAt(x,z,.4)||mapHazards.some(h=>pointInMapZone({x,z},h)))return false;
 }return true;
};
gameTest.heatReset=()=>{changeMapLayout(currentMapLayout);return mapHazardTime;};
gameTest.heatNetPrepare=()=>{nbPaused=true;update=()=>{};resetGameplayInput();};
gameTest.heatNetSend=()=>{
 changeMapLayout(ARENA_PRESETS.findIndex(p=>p.id==='enc_foundry_lanes'));
 mapHazardTime=6.5;sendHostState();
};
gameTest.heatNetState=()=>({map:ARENA_PRESETS[currentMapLayout].id,time:mapHazardTime,phase:foundryPhase(mapHazardTime,0)});
`;
(async()=>{
 const browser=await launch(),errors=[];
 try{
  const context=await browser.newContext();await instrument(context,hooks);
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:3000');await page.waitForFunction(()=>!!window.gameTest);
  await page.evaluate(()=>gameTest.foundrySetup());
  assert.equal(await page.evaluate(()=>gameTest.heatSafe()),true);
  for(const t of [0,4,5.99,8,12])assert.equal((await page.evaluate(t=>gameTest.heatAt(t),t)).damage,0);
  const active=await page.evaluate(()=>gameTest.heatAt(6.5));
  assert.ok(active.damage>0);assert.deepEqual(active.phases,['active','off']);
  assert.equal((await page.evaluate(()=>gameTest.heatAt(6.5,0))).damage,0);
  assert.equal((await page.evaluate(()=>gameTest.heatAt(6.5,-4.5,true))).damage,0);
  assert.ok((await page.evaluate(()=>gameTest.heatAt(12.5,4.5))).damage>0);
  await page.evaluate(()=>gameTest.heatAt(6.5,0));
  await page.waitForTimeout(250);
  await page.screenshot({path:'test-results/foundry-active.png'});
  assert.equal(await page.evaluate(()=>gameTest.heatReset()),0);
  await context.close();
  const hc=await browser.newContext(),gc=await browser.newContext();
  await instrument(hc,hooks);await instrument(gc,hooks);
  const host=await hc.newPage(),guest=await gc.newPage();
  for(const p of [host,guest])p.on('pageerror',e=>errors.push(e.message));
  await startCoop(host,guest);
  for(const p of [host,guest])await p.evaluate(()=>gameTest.heatNetPrepare());
  await host.evaluate(()=>gameTest.heatNetSend());
  await guest.waitForFunction(()=>gameTest.heatNetState().time===6.5);
  assert.deepEqual(await guest.evaluate(()=>gameTest.heatNetState()),{map:'enc_foundry_lanes',time:6.5,phase:'active'});
  assert.deepEqual(errors,[]);
  console.log('PASS Foundry: entry grace, warning, alternating damage, safe corridor, intermission, reset, host/guest phase.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

const assert=require('node:assert/strict');
const {launch,instrument,startCoop}=require('./browser-harness.cjs');
const hooks=`
gameTest.freezeSpawner=()=>{update=()=>{};};
gameTest.resetSpawnerAck=()=>{player.pos.x=.02;sendPlayerState();};
gameTest.netSpawner=()=>{
  gState='playing';waveNum=3;waveClear=false;waveTransition=false;player.pos.set(0,0,-10);
  setupMiniObjective(3,'spawners');const s=miniObjective.spawners[0];
  s.x=0;s.z=2;s.hp=s.maxHp=100000;s.mesh.position.set(0,0,2);sendHostState();
};
gameTest.netSpawnerAttack=id=>{
  player.pos.set(0,0,0);player.dead=false;player.downed=false;player.hp=100;
  player.meleeWeapon=id;player.meleeCd=0;mouse.hasWorld=true;mouse.world.set(0,0,2);
  sendPlayerState();useMeleeAttack();
  player.pos.x=0.01;sendPlayerState();
};
gameTest.netSpawnerResult=()=>({hp:miniObjective.spawners[0].hp,x:Object.values(mp.remotePlayers)[0].pos.x});
function spawnerFixture(){
  mp.soloMode=true;initGame();hideGunSelect();hideMeleeSelect();
  gState='playing';waveNum=3;waveSpawned=true;waveClear=false;waveTransition=false;
  obstacleBoxes.length=0;player.pos.set(0,0,0);player.invincible=10000;
  setupMiniObjective(3,'spawners');
  const s=miniObjective.spawners[0];s.x=0;s.z=2;s.mesh.position.set(0,0,2);
  for(const sp of miniObjective.spawners){sp.hp=sp.maxHp=100000;sp.cd=10000;}
  return s;
}
gameTest.spawnerWeapon=({kind,id})=>{
  const s=spawnerFixture(),before=s.hp;
  mouse.hasWorld=true;mouse.world.set(s.x,0,s.z);
  if(kind==='guns'){
    player.gun=id;player.ammo=currentMagSize();player.reloadT=0;
    for(let i=0;i<180;i++){
      mouse.world.set(s.x,0,s.z);mouse.down=id==='railgun'?i<120:i<30;update(1/60);
    }
    mouse.down=false;
  }else{
    player.meleeWeapon=id;useMeleeAttack();
    for(let i=0;i<90;i++)update(1/60);
  }
  return {kind,id,damage:before-s.hp};
};
gameTest.spawnerShield=()=>{
  const s=spawnerFixture();player.pos.set(0,0,-10);
  damageMiniObjectiveAt(s.x,s.z,100);const shielded=s.hp;
  player.pos.set(0,0,0);updateMiniObjective(0,0);damageMiniObjectiveAt(s.x,s.z,100);const armed=s.hp;
  player.pos.set(0,0,-10);updateMiniObjective(0,0);damageMiniObjectiveAt(s.x,s.z,100);
  return {shielded,armed,reprotected:s.hp};
};
`;
(async()=>{
  const browser=await launch(),errors=[],results=[];
  try{
    const context=await browser.newContext();await instrument(context,hooks);
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:3000');await page.waitForFunction(()=>!!window.gameTest);
    const inventory=await page.evaluate(()=>gameTest.inventory());
    for(const kind of ['guns','melee'])for(const id of inventory[kind]){
      const result=await page.evaluate(p=>gameTest.spawnerWeapon(p),{kind,id});results.push(result);console.log(result);
    }
    const shield=await page.evaluate(()=>gameTest.spawnerShield());
    assert.deepEqual(shield,{shielded:100000,armed:99925,reprotected:99925});
    assert.deepEqual(results.filter(r=>!(r.damage>0)),[]);assert.deepEqual(errors,[]);
    console.log('PASS all weapons damage armed nests; shield restored after leaving');
    const c2=await browser.newContext();await instrument(c2,hooks);const guest=await c2.newPage();
    guest.on('pageerror',e=>errors.push(e.message));await startCoop(page,guest);
    for(const p of [page,guest])await p.evaluate(()=>gameTest.freezeSpawner());
    for(const id of inventory.melee){
      await page.evaluate(()=>gameTest.netSpawner());
      await guest.evaluate(id=>gameTest.netSpawnerAttack(id),id);
      await page.waitForFunction(()=>gameTest.netSpawnerResult().x===.01);
      const result=await page.evaluate(()=>gameTest.netSpawnerResult());
      assert.ok(result.hp<100000,'Guest melee failed to damage nest: '+id);
      console.log('PASS guest melee',id);
      // Reset the acknowledgment coordinate before the next ordered attack.
      await guest.evaluate(()=>gameTest.resetSpawnerAck());
      await page.waitForFunction(()=>gameTest.netSpawnerResult().x===.02);
    }
    assert.deepEqual(errors,[]);
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

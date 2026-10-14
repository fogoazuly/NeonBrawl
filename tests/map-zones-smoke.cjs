const assert=require('node:assert/strict');
const {launch,instrument}=require('./browser-harness.cjs');
const hooks=`
gameTest.zones=()=>{
  mp.soloMode=true;initGame();hideGunSelect();update=()=>{};gState='playing';
  for(const k of Object.keys(playerSkills))delete playerSkills[k];resetRelics();
  const cases=[],issues=[];
  const check=(condition,label)=>{if(!condition)issues.push(label);};
  for(let i=0;i<ARENA_PRESETS.length;i++){
    changeMapLayout(i);const zones=[...mapHazards];
    for(const [j,h] of zones.entries()){
      mapHazards.length=0;mapHazards.push(h);
      const label=ARENA_PRESETS[i].name+' zone '+j+' '+(h.type||'damage');
      const edge=h.shape==='circle'?h.r:h.w/2;
      check(pointInMapZone({x:h.x,z:h.z},h),label+' center');
      check(pointInMapZone({x:h.x+edge-.0001,z:h.z},h),label+' inside edge');
      check(!pointInMapZone({x:h.x+edge+.0001,z:h.z},h),label+' outside edge');
      if(h.type==='slow'){
        check(mapMoveMultAt({x:h.x,z:h.z})===h.mult,label+' slowdown');
        check(mapMoveMultAt({x:h.x+edge+.001,z:h.z})===1,label+' exit restores speed');
      }else if(h.type==='grass'){
        spawnEnemy('chaser',h.x,h.z);const e=enemies[enemies.length-1];e.pos.set(h.x,0,h.z);e.spawnAnim=0;
        player.pos.set(100,0,100);
        for(let n=0;n<60;n++)updateEnemyGrassVisibility(e,1/30);
        check(!e.mesh.visible&&e.grassAlpha===0,label+' hides enemy');
        player.pos.set(h.x,0,h.z);
        for(let n=0;n<30;n++)updateEnemyGrassVisibility(e,1/30);
        check(e.mesh.visible&&e.grassAlpha===1,label+' same zone reveals');
        player.pos.set(100,0,100);e.grassRevealT=1;
        updateEnemyGrassVisibility(e,.01);check(e.mesh.visible,label+' attack reveal');
        e.pos.x=h.x+edge+.01;
        for(let n=0;n<30;n++)updateEnemyGrassVisibility(e,1/30);
        check(e.mesh.visible&&e.grassAlpha===1,label+' exit reveals');
        releaseEnemySlot(e);enemies.splice(enemies.indexOf(e),1);
      }else{
        player.pos.set(h.x,0,h.z);player.hp=1000;player.invincible=0;player.barrierActive=false;h.hitCd={};
        updateMapHazards(0,0);const hp=1000-(h.dmg||6);
        check(player.hp===hp,label+' damage');
        player.invincible=0;updateMapHazards(.54,540);check(player.hp===hp,label+' cooldown');
        updateMapHazards(.02,560);check(player.hp===hp-(h.dmg||6),label+' second tick');
        player.pos.x=h.x+edge+.01;player.invincible=0;const outsideHp=player.hp;
        updateMapHazards(1,1560);check(player.hp===outsideHp,label+' outside safe');
        player.pos.set(h.x,0,h.z);player.downed=true;updateMapHazards(1,2560);
        check(player.hp===outsideHp,label+' downed safe');player.downed=false;
      }
      cases.push(label);
    }
    mapHazards.length=0;mapHazards.push(...zones);
  }
  return {cases,issues};
};
`;
(async()=>{
  const browser=await launch(),errors=[];
  try{
    const c=await browser.newContext();await instrument(c,hooks);const page=await c.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:3000');await page.waitForFunction(()=>!!window.gameTest);
    const report=await page.evaluate(()=>gameTest.zones());console.log(JSON.stringify(report,null,2));
    assert.deepEqual(errors,[]);assert.deepEqual(report.issues,[]);
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

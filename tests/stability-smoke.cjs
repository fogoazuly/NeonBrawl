const assert=require('node:assert/strict');
const {launch,instrument,startSolo}=require('./browser-harness.cjs');
(async()=>{
 const browser=await launch();
 try{
 const c=await browser.newContext();
 await instrument(c,`
 gameTest.stressStart=()=>{nbPaused=true;player.gun='gravity';applySkill('gravityAscension');playerSkills.spread=5;player.invincible=100000;waveSpawned=true;_waveSpawnQueue.length=0;waveClear=false;waveTransition=false;spawnEnemy('tank',-10,-10);enemies.forEach(e=>{e.hp=e.maxHp=1e9;e.spd=0;});};
 let stressTicks=0;
 gameTest.stressStep=()=>{for(let i=0;i<40;i++){player.hp=player.maxHp;player.invincible=100;mouse.hasWorld=true;mouse.world.set(-10,0,-10);mouse.down=(++stressTicks%300)<280;update(.05);}sceneView.render();return {state:gState,bullets:bulletPool.filter(b=>b.active).length,children:scene.children.length};};
 gameTest.graphicsLost=()=>sceneView.contextLost;
 gameTest.throwOnce=()=>{const original=update;nbPaused=false;update=dt=>{update=original;throw Error('injected-frame-failure');};};
 gameTest.frameCount=0;const realRender=sceneView.render;sceneView.render=()=>{gameTest.frameCount++;realRender();};
 `);
 const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:3000');await startSolo(p);await p.evaluate(()=>gameTest.stressStart());
 let peak=0,last;
 for(let i=0;i<600;i++){last=await p.evaluate(()=>gameTest.stressStep());peak=Math.max(peak,last.children);if(i%100===0)console.log('STRESS simulated seconds',i*2,JSON.stringify(last));}
 assert.equal(last.state,'playing');assert.deepEqual(errors,[]);
 console.log('PASS 20 simulated minutes of gravity ascension + spread',JSON.stringify({peak,last}));
 await p.evaluate(()=>{const canvas=document.querySelector('canvas');window.testGL=canvas.getContext('webgl2')||canvas.getContext('webgl');window.testLoss=testGL.getExtension('WEBGL_lose_context');testLoss.loseContext();});
 await p.waitForFunction(()=>gameTest.graphicsLost());
 await p.waitForTimeout(300);
 await p.evaluate(()=>testLoss.restoreContext());await p.waitForFunction(()=>!gameTest.graphicsLost());
 const before=await p.evaluate(()=>gameTest.frameCount);await p.waitForTimeout(300);assert.ok(await p.evaluate(()=>gameTest.frameCount)>before);
 console.log('PASS real WebGL loss/restoration without reload');
 await p.evaluate(()=>gameTest.throwOnce());await p.waitForTimeout(500);
 assert.deepEqual(errors,['injected-frame-failure']);
 const after=await p.evaluate(()=>gameTest.frameCount);await p.waitForTimeout(300);assert.ok(await p.evaluate(()=>gameTest.frameCount)>after);
 console.log('PASS next frames continue after a single thrown update');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

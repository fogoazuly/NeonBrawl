const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const {launch,instrument,startSolo}=require('./browser-harness.cjs');
// Reuse the visible pilot; CLI flags select the standard difficulty and revives.
process.argv.push('--default','--protected');
const {hooks:pilot}=require('./watch-hell-run.cjs');
const hooks=pilot+`
const contentMaps=new Set(),contentEnemies=new Set(),contentObjectives=new Set();
let contentSeconds=0,contentRevives=0,contentPeak=0;
const contentMapPicker=presetForWave;
presetForWave=w=>w%5!==0&&w>=3?ARENA_PRESETS.findIndex(p=>p.id===(w%2?'enc_crystal_garden':'enc_foundry_lanes')):contentMapPicker(w);
rollWaveEvent=w=>w===8||w===13?{type:'mini',sub:'overload'}:null;
const contentHurt=hurtPlayer;
hurtPlayer=(...args)=>{const revives=runRevives;const result=contentHurt(...args);if(runRevives<revives)contentRevives++;return result;};
const contentUpdate=update;
gameTest.contentStart=()=>{setNbDifficulty('hard');update=()=>{};};
gameTest.contentState=()=>({...gameTest.watchState(),simulated:Math.round(contentSeconds),revives:contentRevives,
 map:ARENA_PRESETS[currentMapLayout].id,objective:miniObjectiveStatus(),enemies:enemies.filter(e=>!e.dead).length,
 children:scene.children.length,peak:contentPeak,maps:[...contentMaps],types:[...contentEnemies],completed:[...contentObjectives],
 lost:sceneView.contextLost,summary:document.getElementById('bossRunSummary').classList.contains('show')});
gameTest.contentDrive=()=>{
 for(let i=0;i<60;i++){
  if(!['playing','shopround'].includes(gState)||waveTransition)break;
  const objectiveBefore=miniObjective;
  contentUpdate(.037037037);contentSeconds+=.05;
  contentMaps.add(ARENA_PRESETS[currentMapLayout].id);
  for(const e of enemies)if(!e.dead)contentEnemies.add(e.type);
  if(objectiveBefore?.complete)contentObjectives.add(objectiveBefore.type);
  contentPeak=Math.max(contentPeak,scene.children.length);
 }
 sceneView.render();return gameTest.contentState();
};
`;
(async()=>{
 const browser=await launch(),errors=[],history=[];let last;
 try{
  const context=await browser.newContext();await instrument(context,hooks);
  const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:3000');await startSolo(p);await p.evaluate(()=>gameTest.contentStart());
  const started=Date.now();let nextLog=0;
  while(Date.now()-started<600000){
   last=await p.evaluate(()=>gameTest.contentDrive());
   assert.ok(Number.isFinite(last.hp)&&!last.lost,'Invalid health or lost WebGL');
   assert.ok(!['menu','gameover'].includes(last.state),'Run ended unexpectedly');
   if(last.simulated>=nextLog){history.push(last);console.log('RUN',JSON.stringify(last));nextLog+=60;}
   if(last.simulated>=1200)break;
   if(last.summary){await p.locator('.boss-summary-close:visible').click();continue;}
   if(last.state==='buffselect'){
    const card=p.locator('#buffCards .buff-card:visible:not([aria-disabled="true"])').first();
    if(await card.count()){await card.click({force:true});await p.waitForTimeout(750);continue;}
   }
   await p.waitForTimeout(last.state==='playing'?10:100);
  }
  await p.screenshot({path:'test-results/content-run.png'});
  assert.deepEqual(errors,[]);
  assert.ok(last.simulated>=1200,'Did not reach 20 simulated minutes');
  assert.ok(last.maps.includes('enc_crystal_garden')&&last.maps.includes('enc_foundry_lanes'));
  assert.ok(last.types.includes('rammer')&&last.types.includes('linker'));
  assert.ok(last.completed.includes('overload'),'Overload not completed');
  console.log('PASS content run: 20 simulated minutes, new maps/enemies, Overload and real combat/reward progression.');
 }catch(e){errors.push(String(e));throw e;}finally{
  await fs.writeFile('test-results/content-run.json',JSON.stringify({scope:'Standard difficulty with unlimited revives and automated controls. Alternating new maps from wave 3; Overload forced at waves 8/13. Real attacks, kills and UI rewards; accelerated simulation. Not a normal-player balance verdict.',history,last,errors},null,2));
  await browser.close();
 }
})().catch(e=>{console.error(e);process.exitCode=1;});

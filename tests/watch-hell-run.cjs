const fs=require('node:fs/promises');
const path=require('node:path');
const {instrument}=require('./browser-harness.cjs');
const {chromium}=require(path.join(require('node:os').homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const hooks=`
const watchDifficulty=${JSON.stringify(process.argv.includes('--default')?'hard':'hell')};
const watchProtected=${process.argv.includes('--protected')};
const watchUpdate=update;let watchEnabled=true,watchElapsed=0;
function watchWaypoint(goal){
  const start=nearestWalkableNavIndex(player.pos.x,player.pos.z),end=nearestWalkableNavIndex(goal.x,goal.z);
  if(start<0||end<0||start===end)return goal;
  const parents=new Int32Array(GNAV_W*GNAV_H).fill(-1),queue=[start];parents[start]=start;
  for(let k=0;k<queue.length&&parents[end]<0;k++){
    const cur=queue[k],gx=cur%GNAV_W,gz=Math.floor(cur/GNAV_W);
    for(const [dx,dz] of _ND){if(!_navCanStep(gx,gz,dx,dz))continue;const n=_ni(gx+dx,gz+dz);if(parents[n]>=0)continue;parents[n]=cur;queue.push(n);}
  }
  if(parents[end]<0)return goal;
  let n=end;while(parents[n]!==start)n=parents[n];
  return {x:-ARENA_W+(n%GNAV_W+.5)*NAV_STEP,z:-ARENA_H+(Math.floor(n/GNAV_W)+.5)*NAV_STEP};
}
const badge=document.createElement('div');badge.style.cssText='position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:99999;background:#091323dd;color:#7fffd4;padding:7px 16px;font:14px monospace;pointer-events:none;border:1px solid #35bfa0';
badge.textContent=watchDifficulty.toUpperCase()+' • PILOTO AUTOMÁTICO • 1,35× • '+(watchProtected?'TESTE COM PROTEÇÃO CONTRA MORTE':'dano normal');document.body.appendChild(badge);
update=dt=>{
  if(!watchEnabled)return watchUpdate(dt);
  if(watchProtected){runRevives=Math.max(runRevives,1);runReviveHpPct=1;}
  watchElapsed+=dt;
  for(const key of ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'])delete keys[key];
  mouse.down=false;
  if(!player.dead&&(gState==='playing'||gState==='shopround')){
    let target=null,nearest=Infinity;
    for(const e of enemies){if(e.dead)continue;const d=Math.hypot(e.pos.x-player.pos.x,e.pos.z-player.pos.z);if(d<nearest){nearest=d;target=e.pos;}}
    const priority=enemies.find(e=>!e.dead&&e.type==='boss')||enemies.find(e=>!e.dead&&e.type==='linker'&&Math.hypot(e.pos.x-player.pos.x,e.pos.z-player.pos.z)<10);
    if(priority)target=priority.pos;
    let goal=null;
    if(waveClear&&exitOpen||gState==='shopround')goal={x:0,z:EXIT_Z};
    else if(miniObjective&&!miniObjective.complete){const o=miniObjective;
      if(o.type==='cells'&&o.cells.active)goal={x:o.cells.posX,z:o.cells.posZ};
      if(o.type==='relays')goal=o.relays.positions[o.relays.index];
      if(o.type==='overload'){const t=o.overload.terminals.find(t=>t.state==='idle');if(t)goal={x:t.x,z:t.z};}
      if(o.type==='defend')goal={x:0,z:0};
      if(o.type==='survive')goal=o.safe.zones[0];
      if(o.type==='spawners'){const s=o.spawners.find(s=>s.alive);if(s){goal={x:s.x,z:s.z};target=goal;}}
    }
    if(target){mouse.world.set(target.x,0,target.z);mouse.hasWorld=true;mouse.down=gState==='playing';}
    if(!goal&&target){for(let t=.05;t<1;t+=.05){if(isBlockedAt(player.pos.x+(target.x-player.pos.x)*t,player.pos.z+(target.z-player.pos.z)*t,.2)){goal=target;break;}}}
    if(goal)goal=watchWaypoint(goal);
    let best=-Infinity,choice=[0,0];
    for(const [dx,dz] of [[0,0],[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]]){
      const len=Math.hypot(dx,dz)||1,x=player.pos.x+dx/len*1.5,z=player.pos.z+dz/len*1.5;
      if(isBlockedAt(x,z,.65))continue;
      let score=0;
      for(const e of enemies){if(e.dead)continue;const d=Math.hypot(x-e.pos.x,z-e.pos.z);score-=35/Math.max(.3,d*d);}
      for(const b of bulletPool){if(!b.active||b.isPlayer)continue;const d=Math.hypot(x-b.pos.x,z-b.pos.z);if(d<3)score-=3/Math.max(.2,d*d);}
      for(const w of warningZones)if(w.active&&w.kind==='circle'&&Math.hypot(x-w.x,z-w.z)<w.r+.8)score-=30;
      if(goal){const gx=goal.x-player.pos.x,gz=goal.z-player.pos.z,gl=Math.hypot(gx,gz)||1;score+=(dx/len*gx+dz/len*gz)/gl*5;}
      else if(target){score-=Math.abs(Math.hypot(x-target.x,z-target.z)-7)*.25;score+=(dx*(target.z-player.pos.z)-dz*(target.x-player.pos.x))*.025;}
      score-=.015*(x*x+z*z);
      if(score>best){best=score;choice=[dx,dz];}
    }
    if(choice[0]<0)keys.ArrowLeft=true;if(choice[0]>0)keys.ArrowRight=true;
    if(choice[1]<0)keys.ArrowUp=true;if(choice[1]>0)keys.ArrowDown=true;
    if(nearest<2.5){useMeleeAttack();startDash();}
  }
  watchUpdate(Math.min(dt*1.35,.0675));
};
gameTest.watchState=()=>({state:gState,wave:waveNum,hp:Math.round(player.hp),kills:killCount,score,difficulty:nbDifficulty,protected:watchProtected,event:waveEvent?.sub||waveEvent?.type,seconds:Math.round(watchElapsed)});
gameTest.watchStop=()=>{watchEnabled=false;resetGameplayInput();if(gState!=='gameover')nbPauseOpen();badge.textContent=watchDifficulty.toUpperCase()+' • PARTIDA ENCERRADA • resultado preservado';};
`;
module.exports={hooks};
if(require.main===module)(async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:false,args:['--start-maximized']});
  const c=await browser.newContext({viewport:null});await instrument(c,hooks);
  const p=await c.newPage(),errors=[];p.on('pageerror',e=>{errors.push(e.message);console.log('ERROR',e.message);});
  await p.goto('http://127.0.0.1:3000');await p.bringToFront();
  if(process.argv.includes('--preview')){console.log('PREVIEW_READY');await new Promise(resolve=>browser.on('disconnected',resolve));return;}
  await p.locator('#playBtn').click();await p.locator('#nbDiffGrid button').filter({hasText:process.argv.includes('--default')?/HARD/i:/HELL/i}).click();
  await p.locator('#gunCards button').first().click({force:true});await p.locator('#meleeCards button').first().click({force:true});
  const started=Date.now();let lastWave=-1,last;
  while(!p.isClosed()&&Date.now()-started<900000){
    last=await p.evaluate(()=>gameTest.watchState());
    if(last.wave!==lastWave){console.log('LIVE',JSON.stringify(last));lastWave=last.wave;}
    if(last.state==='gameover'){console.log('FINISHED',JSON.stringify({last,errors}));break;}
    if(last.wave>=31){console.log('TARGET_REACHED',JSON.stringify(last));break;}
    if(await p.locator('.boss-summary-close:visible').count())await p.locator('.boss-summary-close:visible').click();
    if(last.state==='buffselect'){
      await p.waitForTimeout(1300);
      const card=p.locator('#buffCards .buff-card:visible').first();if(await card.count())await card.click({force:true});
      await p.waitForTimeout(750);
    }
    await p.waitForTimeout(300);
  }
  if(!p.isClosed()){
    await p.evaluate(()=>gameTest.watchStop());
    const resultName=process.argv.includes('--default')?'watch-default-run':'watch-hell-run';
    await fs.writeFile('test-results/'+resultName+'.json',JSON.stringify({last,errors},null,2));
    await p.screenshot({path:'test-results/'+resultName+'.png'});
    console.log('WINDOW_LEFT_OPEN',JSON.stringify(last));
    await new Promise(resolve=>browser.on('disconnected',resolve));
  }
})().catch(e=>{console.error(e);process.exitCode=1;});

const assert=require('node:assert/strict');
const {launch,instrument,startCoop}=require('./browser-harness.cjs');
const hooks=`
const groupRewardUpdate=update,groupQueue=queueBossReward;let groupQueues=0;
queueBossReward=()=>{groupQueues++;groupQueue();};
getBossSkillChoices=()=>['rapidFire'];
gameTest.rewardFreeze=crown=>{
  update=()=>{};gState='playing';waveNum=4;waveClear=false;waveTransition=false;waveSpawned=false;waveEvent=null;
  for(const e of enemies){e.dead=true;releaseEnemySlot(e);}enemies.length=0;clearMapSpellsAndAllies();
  resetRelics();for(const k of Object.keys(playerSkills))delete playerSkills[k];
  for(const k of Object.keys(playerSkillPicks))delete playerSkillPicks[k];
  for(let i=0;i<crown;i++)applyRelic('heavyCrown');
  closeExit();player.pos.set(0,0,0);player.invincible=10000;
};
gameTest.rewardTotem=uses=>{shopTotemUses=uses;broadcastShopTotemState();};
gameTest.rewardAnnounce=()=>{waveNum=5;changeMapLayout(BOSS_PRESET_BY_NAME.WARDEN);sendHostState();};
gameTest.rewardSpawn=()=>{spawnWave(5);sendHostState();};
gameTest.rewardKill=()=>{killEnemy(0);groupRewardUpdate(0);sendHostState();};
gameTest.rewardTick=()=>{groupRewardUpdate(0);return gameTest.rewardState();};
gameTest.rewardState=()=>({state:gState,wave:waveNum,count:enemies.length,uses:shopTotemUses,clear:waveClear,exit:exitOpen,
  queues:groupQueues,rapid:playerSkillPicks.rapidFire||0,relics:Object.values(playerRelics).reduce((a,b)=>a+b,0),
  cards:bossBonusPicksLeft,bonusRelics:bossBonusRelicsLeft,summary:document.getElementById('bossRunSummary').classList.contains('show')});
`;
async function run(){
  const browser=await launch(),errors=[];
  try{
    for(let uses=0;uses<=3;uses++){
      const contexts=[],pages=[];
      for(let i=0;i<2;i++){const c=await browser.newContext();contexts.push(c);await instrument(c,hooks);const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));pages.push(p);}
      const [host,guest]=pages;await startCoop(host,guest);
      const crowns=[Number(process.argv[2]||0),Number(process.argv[3]||0)];
      for(const [i,p] of pages.entries())await p.evaluate(n=>gameTest.rewardFreeze(n),crowns[i]);
      await host.evaluate(n=>gameTest.rewardTotem(n),uses);await guest.waitForFunction(n=>gameTest.rewardState().uses===n,uses);
      await host.evaluate(()=>gameTest.rewardAnnounce());await guest.waitForFunction(()=>gameTest.rewardState().wave===5);
      await host.evaluate(()=>gameTest.rewardSpawn());await guest.waitForFunction(n=>gameTest.rewardState().count===n,2**uses);
      for(let left=2**uses-1;left>=0;left--){
        await host.evaluate(()=>gameTest.rewardKill());await guest.waitForFunction(n=>gameTest.rewardState().count===n,left);
        for(const p of pages){const s=await p.evaluate(()=>gameTest.rewardTick());assert.equal(s.queues,left===0?1:0);if(left>0)assert.equal(s.clear,false);}
      }
      for(const [playerIndex,p] of pages.entries()){
        await p.waitForFunction(()=>gameTest.rewardState().summary);await p.locator('.boss-summary-close').click();
        for(let clicks=0;clicks<8;clicks++){
          const s=await p.evaluate(()=>gameTest.rewardState());if(s.state==='playing'&&!s.summary)break;
          await p.locator('#buffCards .buff-card:visible').first().click({force:true});await p.waitForTimeout(750);
        }
        const end=await p.evaluate(()=>{for(let i=0;i<10;i++)gameTest.rewardTick();return gameTest.rewardState();});
        assert.equal(end.state,'playing');assert.equal(end.exit,true);assert.equal(end.queues,1);
        assert.equal(end.rapid,Math.min(3,(uses>=2?2:1)+[0,1,1,2][crowns[playerIndex]]));assert.equal(end.relics-crowns[playerIndex],[0,1,1,2][uses]);assert.equal(end.cards,0);assert.equal(end.bonusRelics,0);
      }
      console.log('PASS cooperative full-group rewards',uses);for(const c of contexts)await c.close();
    }
    assert.deepEqual(errors,[]);
  }finally{await browser.close();}
}
module.exports={hooks};
if(require.main===module)run().catch(e=>{console.error(e);process.exitCode=1;});

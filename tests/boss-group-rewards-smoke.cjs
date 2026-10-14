const assert=require('node:assert/strict');
const {launch,instrument}=require('./browser-harness.cjs');
const hooks=`
const rewardGroupUpdate=update;
let rewardQueues=0;
const originalQueueBossReward=queueBossReward;
queueBossReward=()=>{rewardQueues++;originalQueueBossReward();};
// Keep card effects from adding random extra picks while testing totem rewards.
getBossSkillChoices=()=>['rapidFire'];
gameTest.prepareGroupReward=({uses,crown=0})=>{
  mp.soloMode=true;mp.isHost=true;initGame();hideGunSelect();hideMeleeSelect();update=()=>{};
  gState='playing';waveNum=5;waveSpawned=true;waveClear=false;waveTransition=false;waveEvent=null;
  for(let i=0;i<crown;i++)applyRelic('heavyCrown');
  changeMapLayout(BOSS_PRESET_BY_NAME.WARDEN);shopTotemUses=uses;spawnWave(5);
  player.invincible=10000;player.pos.set(0,0,0);rewardQueues=0;
  return gameTest.groupRewardState();
};
gameTest.groupRewardState=()=>({state:gState,count:enemies.length,clear:waveClear,exit:exitOpen,queues:rewardQueues,
  bonusCards:bossBonusPicksLeft,bonusRelics:bossBonusRelicsLeft,phase:_buffSelectPhase,
  rapid:playerSkillPicks.rapidFire||0,relics:Object.values(playerRelics).reduce((a,b)=>a+b,0),
  summary:document.getElementById('bossRunSummary').classList.contains('show')});
gameTest.killRewardBoss=()=>{killEnemy(0);rewardGroupUpdate(0);return gameTest.groupRewardState();};
gameTest.repeatRewardUpdate=()=>{for(let i=0;i<10;i++)rewardGroupUpdate(0);return gameTest.groupRewardState();};
`;
async function run(){
  const browser=await launch(),errors=[];
  try{
    const c=await browser.newContext();await instrument(c,hooks);const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));
    await p.goto('http://127.0.0.1:3000');await p.waitForFunction(()=>!!window.gameTest);
    for(const crown of [0,1,2,3])for(let uses=0;uses<=3;uses++){
      const initial=await p.evaluate(n=>gameTest.prepareGroupReward(n),{uses,crown});assert.equal(initial.count,2**uses);
      for(let left=initial.count-1;left>=0;left--){
        const s=await p.evaluate(()=>gameTest.killRewardBoss());assert.equal(s.count,left);
        assert.equal(s.queues,left===0?1:0);assert.equal(s.clear,left===0);assert.equal(s.exit,false);
      }
      await p.waitForFunction(()=>gameTest.groupRewardState().summary);
      await p.locator('.boss-summary-close').click();
      for(let clicks=0;clicks<8;clicks++){
        const s=await p.evaluate(()=>gameTest.groupRewardState());if(s.exit)break;
        await p.locator('#buffCards .buff-card:visible').first().click({force:true});await p.waitForTimeout(750);
      }
      const end=await p.evaluate(()=>gameTest.repeatRewardUpdate());
      assert.equal(end.exit,true);assert.equal(end.state,'playing');assert.equal(end.queues,1);assert.equal(end.summary,false);
      assert.equal(end.rapid-initial.rapid,Math.min(3,(uses>=2?2:1)+[0,1,1,2][crown]),JSON.stringify({uses,crown}));assert.equal(end.relics-initial.relics,[0,1,1,2][uses]);
      assert.equal(end.bonusCards,0);assert.equal(end.bonusRelics,0);
      console.log('PASS complete boss group reward',uses,crown,JSON.stringify(end));
    }
    assert.deepEqual(errors,[]);
  }finally{await browser.close();}
}
module.exports={hooks};
if(require.main===module)run().catch(e=>{console.error(e);process.exitCode=1;});

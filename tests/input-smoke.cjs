const assert=require('node:assert/strict');
const {launch,instrument}=require('./browser-harness.cjs');
const hooks=`
gameTest.inputSetup=()=>{
  mp.soloMode=true;initGame();hideGunSelect();hideMeleeSelect();
  gState='playing';waveNum=1;waveSpawned=true;waveClear=false;
  player.invincible=10000;spawnEnemy('tank',12,12);enemies[0].spd=0;
};
gameTest.inputState=()=>({mobile:realIsMobile,keys:Object.keys(keys),mouse:mouse.down,joy:JSON.parse(JSON.stringify(joy)),melee:player.meleeCd,dash:player.dashCd,reload:player.reloadT,paused:nbPaused,ammo:player.ammo,x:player.pos.x,z:player.pos.z});
gameTest.pause=()=>nbPauseOpen();
gameTest.resume=()=>nbResume();
gameTest.shop=()=>{gState='shopround';};
gameTest.step=()=>{for(let i=0;i<15;i++) update(1/60);};
gameTest.openShop=()=>{gState='shopround';openRunShopUI();};
gameTest.prepareReload=()=>{player.ammo=3;player.reloadT=0;};
gameTest.touch=(type,id,x,y,targetId)=>{
  const target=targetId?document.getElementById(targetId):canvas;
  const t=new Touch({identifier:id,target,clientX:x,clientY:y});
  target.dispatchEvent(new TouchEvent(type,{bubbles:true,cancelable:true,changedTouches:[t],touches:type==='touchend'||type==='touchcancel'?[]:[t]}));
};
`;
(async()=>{
  const browser=await launch();
  const failures=[];
  try{
    for(const mobile of [false,true]){
      const context=await browser.newContext({viewport:{width:1000,height:700},hasTouch:mobile,isMobile:mobile});
      await instrument(context,hooks);const page=await context.newPage();
      page.on('pageerror',e=>failures.push(e.message));
      await page.goto('http://127.0.0.1:3000');await page.waitForFunction(()=>!!window.gameTest);
      await page.evaluate(()=>gameTest.inputSetup());
      const check=async(name,fn)=>{try{await fn();console.log('PASS',mobile?'touch':'keyboard',name);}catch(e){failures.push(name+': '+e.message);console.log('FAIL',name,e.message);}};
      const state=()=>page.evaluate(()=>gameTest.inputState());
      await check('device detection',async()=>assert.equal((await state()).mobile,mobile));
      if(!mobile){
        await check('keyboard movement and release',async()=>{
          const before=await state();await page.keyboard.down('d');await page.evaluate(()=>gameTest.step());
          assert.ok((await state()).x>before.x);await page.keyboard.up('d');assert.deepEqual((await state()).keys,[]);
        });
        await check('manual reload starts from R',async()=>{
          await page.evaluate(()=>gameTest.prepareReload());await page.keyboard.press('r');
          const s=await state();assert.equal(s.ammo,0);assert.ok(s.reload>0);
        });
        await check('blur clears held keys and fire',async()=>{
          await page.keyboard.down('d');await page.mouse.move(450,350);await page.mouse.down();
          await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
          const s=await state();assert.deepEqual(s.keys,[]);assert.equal(s.mouse,false);
          await page.keyboard.up('d');await page.mouse.up();
        });
        await check('pause blocks melee and dash',async()=>{
          await page.evaluate(()=>gameTest.pause());
          const before=await state();await page.keyboard.press('f');await page.keyboard.press('Space');
          const after=await state();assert.equal(after.melee,before.melee);assert.equal(after.dash,before.dash);
          await page.evaluate(()=>gameTest.resume());
        });
        await check('holding Escape does not toggle pause repeatedly',async()=>{
          await page.keyboard.down('Escape');await page.keyboard.down('Escape');
          assert.equal((await state()).paused,true);await page.keyboard.up('Escape');
          await page.keyboard.press('Escape');assert.equal((await state()).paused,false);
        });
      }else{
        const touch=(type,id,x,y,targetId)=>page.evaluate(t=>gameTest.touch(...t),[type,id,x,y,targetId]);
        await check('crossing center keeps joystick ownership',async()=>{
          await touch('touchstart',1,450,600);await touch('touchmove',1,550,600);
          const s=await state();assert.equal(s.joy.L.id,1);assert.equal(s.joy.R.act,false);
          await touch('touchcancel',1,550,600);
        });
        await check('second finger does not steal left stick',async()=>{
          await touch('touchstart',2,100,600);await touch('touchmove',2,140,600);await touch('touchstart',3,200,600);
          assert.equal((await state()).joy.L.id,2);
          await touch('touchcancel',2,140,600);await touch('touchcancel',3,200,600);
        });
        await check('shop supports movement',async()=>{
          await page.evaluate(()=>gameTest.shop());await touch('touchstart',4,100,600);await touch('touchmove',4,150,600);
          assert.ok((await state()).joy.L.dx>0);await touch('touchcancel',4,150,600);
        });
        await check('two sticks move and shoot; cancel releases both',async()=>{
          await page.evaluate(()=>gameTest.inputSetup());
          await touch('touchstart',5,100,600);await touch('touchmove',5,150,600);
          await touch('touchstart',6,700,600);await touch('touchmove',6,750,600);
          const before=await state();await page.evaluate(()=>gameTest.step());const after=await state();
          assert.ok(after.x>before.x);assert.ok(after.ammo<before.ammo);
          await touch('touchcancel',5,150,600);await touch('touchcancel',6,750,600);
          assert.equal((await state()).joy.L.act,false);assert.equal((await state()).joy.R.act,false);
        });
        await check('paused action buttons do not queue attacks',async()=>{
          await page.evaluate(()=>gameTest.inputSetup());await page.evaluate(()=>gameTest.pause());
          await touch('touchstart',7,850,600,'dashBtn');await touch('touchstart',8,850,550,'meleeBtn');
          await page.evaluate(()=>{gameTest.resume();gameTest.step();});
          assert.equal((await state()).dash,0);assert.equal((await state()).melee,0);
        });
        await check('shop overlay releases movement and ignores touches',async()=>{
          await touch('touchstart',9,100,600);await touch('touchmove',9,150,600);
          await page.evaluate(()=>gameTest.openShop());await touch('touchstart',10,100,600);
          assert.equal((await state()).joy.L.act,false);
        });
      }
      await context.close();
    }
    assert.deepEqual(failures,[]);
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

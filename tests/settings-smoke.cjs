const assert=require('node:assert/strict');
const {launch,instrument}=require('./browser-harness.cjs');
const hooks=`
gameTest.settings=()=>({bindings:{...NB_KEYBINDS},volume:nbVolume,muted:nbMuted,bgm:nbBgmVol,bgmMuted:nbBgmMuted,others:nbOthersSfx,gain:nbAudioGain(),bgmGain:nbBgmGain()});
gameTest.capture=action=>nbStartCapture(action);
`;
(async()=>{
  const browser=await launch();
  try{
    const context=await browser.newContext();await instrument(context,hooks);
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:3000');await page.waitForFunction(()=>!!window.gameTest);
    const state=()=>page.evaluate(()=>gameTest.settings());
    const initial=await state();
    await page.evaluate(()=>gameTest.capture('up'));await page.keyboard.press('s');
    assert.equal((await state()).bindings.up,'KeyS');assert.equal((await state()).bindings.down,'KeyW');
    await page.evaluate(()=>gameTest.capture('dash'));await page.keyboard.press('Escape');
    assert.equal((await state()).bindings.dash,'Space');
    await page.evaluate(()=>{
      nbToggleMute();nbToggleBgm();nbToggleOthersSfx();
      const set=(id,value)=>{const el=document.getElementById(id);el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));};
      set('nbVolSlider',37);set('nbBgmSlider',23);
    });
    const configured=await state();
    assert.equal(configured.volume,37);assert.equal(configured.bgm,23);
    assert.equal(configured.gain,.37);assert.equal(configured.bgmGain,.23);
    assert.equal(configured.others,!initial.others);
    await page.reload();await page.waitForFunction(()=>!!window.gameTest);
    assert.deepEqual(await state(),configured);
    await page.evaluate(()=>nbResetKeybinds());
    assert.deepEqual((await state()).bindings,initial.bindings);
    await page.evaluate(()=>{nbToggleMute();nbToggleBgm();});
    assert.equal((await state()).gain,0);assert.equal((await state()).bgmGain,0);
    assert.deepEqual(errors,[]);console.log('PASS key swap, Escape cancel, reset, audio gains, mute and persistence');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

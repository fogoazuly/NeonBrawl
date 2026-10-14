import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

test('meteoros só entram no sorteio após a onda 25', async()=>{
  const source=await readFile('local/game.js','utf8');
  const block=source.slice(source.indexOf('const WAVE_EVENT_CATEGORIES ='),source.indexOf('const WAVE_EVENT_LABELS ='));
  const math=Object.create(Math);
  const context=vm.createContext({Math:math});
  vm.runInContext(block,context);
  const events=w=>Array.from({length:700},(_,i)=>{
    let call=0;math.random=()=>call++===0?.4:(i+.5)/700;
    return context.rollWaveEvent(w)?.sub;
  });
  for(let w=1;w<=25;w++)assert.ok(!events(w).includes('meteorStorm'),`onda ${w}`);
  assert.ok(events(26).includes('meteorStorm'));
  assert.ok(events(29).includes('meteorStorm'));
  assert.ok(events(30).every(e=>e===undefined));
  assert.ok(events(24).includes('eliteSurge'));
});

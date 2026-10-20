import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceOverload, overloadSpawnInterval } from '../local/combat/overload.js';
const terminal=()=>({state:'idle',arm:0,remaining:18});
test('overload needs continuous activation and keeps charging away from player',()=>{
  const t=terminal();
  advanceOverload(t,1,true);advanceOverload(t,.1,false);
  assert.equal(t.arm,0);
  advanceOverload(t,2,true);assert.equal(t.state,'active');
  advanceOverload(t,17,false);assert.equal(t.state,'active');
  advanceOverload(t,1,false);assert.equal(t.state,'done');
  advanceOverload(t,10,true);assert.equal(t.remaining,0);
});
test('simultaneous terminals charge independently and increase bounded pressure',()=>{
  const ts=[terminal(),terminal(),terminal()];
  const idle=overloadSpawnInterval(ts);
  ts.forEach(t=>advanceOverload(t,2,true));
  assert.ok(overloadSpawnInterval(ts)<idle);
  assert.ok(overloadSpawnInterval(ts)>=.9);
  ts.forEach(t=>advanceOverload(t,18,false));
  assert.ok(ts.every(t=>t.state==='done'));
  assert.equal(overloadSpawnInterval(ts),idle);
});

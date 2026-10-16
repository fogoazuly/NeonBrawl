import test from 'node:test';
import assert from 'node:assert/strict';
import { PrecisionStreak, lastWordBonus } from '../local/combat/pistol.js';
test('precision resolves in shot order, caps at five and counts piercing once', () => {
  const combo=new PrecisionStreak(), a=combo.begin(0), b=combo.begin(0);
  combo.finish(b,true); assert.equal(combo.streak(0),0);
  combo.finish(a,false); assert.equal(combo.streak(0),1);
  combo.finish(b,true); assert.equal(combo.streak(0),1);
  for(let i=0;i<8;i++)combo.finish(combo.begin(0),true);
  assert.equal(combo.streak(0),5); assert.equal(combo.multiplier(0,3),1.4);
  assert.equal(combo.multiplier(1,3),1);
  combo.finish(combo.begin(0),false); assert.equal(combo.streak(0),0);
});
test('old pooled bullets cannot change a new run; last round scales within card caps', () => {
  const combo=new PrecisionStreak(), old=combo.begin(0); combo.reset();
  combo.finish(combo.begin(0),true); combo.finish(old,false);
  assert.equal(combo.streak(0),1);
  assert.deepEqual(lastWordBonus(0),{damage:1,pierce:0});
  assert.deepEqual(lastWordBonus(3),{damage:2.2,pierce:3});
});

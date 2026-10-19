import test from 'node:test';
import assert from 'node:assert/strict';
import { NeonJudgment } from '../local/combat/pistol.js';

test('judgment requires 30 hits and a completed reload, with finite empowered rounds',()=>{
  const power=new NeonJudgment();
  for(let i=0;i<29;i++)power.hit();
  power.reload(15);assert.equal(power.rounds,0);assert.equal(power.hits,29);
  power.hit();power.hit();assert.equal(power.hits,30);assert.equal(power.fire(),false);
  power.reload(15);assert.equal(power.hits,0);
  for(let i=0;i<15;i++){power.hit();assert.equal(power.hits,0);assert.equal(power.fire(),true);}
  assert.equal(power.fire(),false);
  power.hit();assert.equal(power.hits,1);
});
test('manual reload discards unspent empowered rounds; run reset clears everything',()=>{
  const power=new NeonJudgment();for(let i=0;i<30;i++)power.hit();
  power.reload(25);power.fire();assert.equal(power.rounds,24);
  power.reload(25);assert.equal(power.rounds,0);
  power.hit();power.reset();assert.equal(power.hits,0);assert.equal(power.rounds,0);
});

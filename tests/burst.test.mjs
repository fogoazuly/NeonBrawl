import test from 'node:test';
import assert from 'node:assert/strict';
import {BurstSalvos,BurstOpening,burstSpread} from '../local/combat/burst.js';
test('burst precision and opening bonus are bounded and consumed once',()=>{
 assert.equal(burstSpread(0),.075);assert.equal(burstSpread(99),.0375);
 const b=new BurstOpening();assert.equal(b.fire(3),1);b.reload();assert.equal(b.fire(3),1.55);assert.equal(b.fire(3),1);b.reload();b.reset();assert.equal(b.fire(3),1);
});
test('triple impact needs three distinct primary rounds on one target and is isolated by owner',()=>{
 const s=new BurstSalvos(),a={},b={},g=s.acquire(1,'a'),other=s.acquire(2,'a');
 assert.equal(s.hit(g,a,0,3),1);assert.equal(s.hit(g,a,0,3),1);assert.equal(s.hit(g,a,null,3),1);
 assert.equal(s.hit(g,b,1,3),1);assert.equal(s.hit(other,a,2,3),1);
 assert.equal(s.hit(g,a,2,3),1);assert.equal(s.hit(g,a,1,3),2.1);assert.equal(s.hit(g,a,1,3),1);
 s.release(g);s.release(other);assert.equal(s.groups.size,0);assert.equal(s.hit(g,a,1,3),1);
});

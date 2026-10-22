import test from 'node:test';
import assert from 'node:assert/strict';
import {BurstSalvos,BurstOpening,CelestialTriad,burstSpread} from '../local/combat/burst.js';
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

test('Celestial Triad charges once per completed burst and consumes at six',()=>{
 const groups=new BurstSalvos(),c=new CelestialTriad(),target={},other={};
 for(let n=0;n<6;n++){
  const g=groups.acquire(1,n);groups.hit(g,target,0,0);groups.hit(g,target,1,0);assert.equal(groups.charge(g),false);
  groups.hit(g,target,2,0);assert.equal(groups.charge(g),true);c.hit();assert.equal(groups.charge(g),false);
  for(let i=0;i<3;i++)groups.hit(g,other,i,0);assert.equal(groups.charge(g),false);groups.release(g);
  assert.equal(c.ready,n===5);
 }
 c.hit();assert.equal(c.hits,6);assert.equal(c.fire(),true);assert.equal(c.fire(),false);assert.equal(c.hits,0);
 c.hit();c.reset();assert.equal(c.hits,0);
});

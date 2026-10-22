import test from 'node:test';
import assert from 'node:assert/strict';
import {GrenadePrimer,SupernovaCharge,grenadeRadius,grenadeCore} from '../local/combat/grenade.js';
test('grenade radius and core bonus are bounded and center-only',()=>{
 assert.equal(grenadeRadius(0),1);assert.equal(grenadeRadius(99),1.45);
 assert.equal(grenadeCore(3,1,3),1.7);assert.equal(grenadeCore(3,2,3),1);assert.equal(grenadeCore(0,0,3),1);
});
test('hot chamber requires reload and consumes exactly once',()=>{
 const p=new GrenadePrimer();assert.deepEqual(p.fire(3),{damage:1,quick:false});p.reload();assert.deepEqual(p.fire(3),{damage:1.55,quick:true});assert.equal(p.fire(3).quick,false);p.reload();p.reset();assert.equal(p.fire(3).quick,false);p.reload();assert.equal(p.fire(0).quick,false);
});

test('Supernova requires eight charges, caps and consumes once',()=>{
 const c=new SupernovaCharge();for(let i=0;i<7;i++)c.hit();assert.equal(c.fire(),false);c.hit();c.hit();assert.equal(c.hits,8);assert.equal(c.fire(),true);assert.equal(c.fire(),false);c.hit();c.reset();assert.equal(c.hits,0);
});

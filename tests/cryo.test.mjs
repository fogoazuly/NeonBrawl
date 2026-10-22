import test from 'node:test';
import assert from 'node:assert/strict';
import {AbsoluteZeroCharge,cryoReach,cryoSlowTime,cryoBrittle} from '../local/combat/cryo.js';
test('cryo card effects are bounded and brittle requires pre-existing slow',()=>{
 assert.equal(cryoReach(0),1);assert.equal(cryoReach(99),1.45);assert.equal(cryoSlowTime(0),.48);assert.equal(cryoSlowTime(99),1.4);assert.equal(cryoBrittle(3,false),1);assert.equal(cryoBrittle(3,true),1.5);assert.equal(cryoBrittle(0,true),1);
});

test('Absolute Zero caps at thirty hits and consumes once',()=>{
 const c=new AbsoluteZeroCharge();for(let i=0;i<29;i++)c.hit();assert.equal(c.fire(),false);c.hit();c.hit();assert.equal(c.hits,30);assert.equal(c.fire(),true);assert.equal(c.fire(),false);c.hit();c.reset();assert.equal(c.hits,0);
});

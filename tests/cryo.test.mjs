import test from 'node:test';
import assert from 'node:assert/strict';
import {cryoReach,cryoSlowTime,cryoBrittle} from '../local/combat/cryo.js';
test('cryo card effects are bounded and brittle requires pre-existing slow',()=>{
 assert.equal(cryoReach(0),1);assert.equal(cryoReach(99),1.45);assert.equal(cryoSlowTime(0),.48);assert.equal(cryoSlowTime(99),1.4);assert.equal(cryoBrittle(3,false),1);assert.equal(cryoBrittle(3,true),1.5);assert.equal(cryoBrittle(0,true),1);
});

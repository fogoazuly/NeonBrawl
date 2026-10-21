import test from 'node:test';
import assert from 'node:assert/strict';
import {RifleRhythm,SteelStorm,ak47Spread} from '../local/combat/ak47.js';
test('AK47 dispersion is bounded at four picks',()=>{
 assert.equal(ak47Spread(0),.14);assert.equal(ak47Spread(4),.14*.55);
 assert.equal(ak47Spread(99),ak47Spread(4));
});
test('sustained fire caps at ten increments and resets on gap, reload or switch',()=>{
 const r=new RifleRhythm();assert.equal(r.shot(3),1);
 for(let i=0;i<10;i++){r.tick(.22,true,false);r.shot(3);}
 assert.equal(r.shot(3),1.4);
 r.tick(.7,true,false);assert.equal(r.shot(3),1);
 r.tick(.01,true,true);assert.equal(r.shot(3),1);
 r.tick(.01,false,false);assert.equal(r.shot(3),1);
});
test('combat reload consumes one non-stacking four-second bonus',()=>{
 const r=new RifleRhythm();r.kill();r.kill();
 assert.equal(r.reload(3),.6);assert.equal(r.reload(3),1);
 r.kill();r.tick(4,true,false);assert.equal(r.reload(3),1);
 r.kill();r.tick(.01,false,false);assert.equal(r.reload(3),1);
});

test('Steel Storm charges only normal shots and consumes exactly twelve empowered shots',()=>{
 const s=new SteelStorm();
 for(let i=0;i<40;i++){s.tick(.22,true);assert.equal(s.shot(),false);}
 assert.equal(s.rounds,12);
 for(let i=0;i<12;i++)assert.equal(s.shot(),true);
 assert.equal(s.charge,0);assert.equal(s.rounds,0);assert.equal(s.shot(),false);assert.equal(s.charge,1);
});
test('Steel Storm survives a normal reload but expires on inactivity, switch and reset',()=>{
 const s=new SteelStorm();s.shot();s.tick(1.85,true);assert.equal(s.charge,1);
 s.tick(1.15,true);assert.equal(s.charge,0);
 for(let i=0;i<40;i++)s.shot();s.tick(.01,false);assert.equal(s.rounds,0);
 s.shot();s.reset();assert.equal(s.charge,0);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {ShotgunSalvos,shotgunPattern,RuptureCharge} from '../local/combat/shotgun.js';
test('rupture charges once per close blast, requires eight hits, consumes and resets',()=>{
  const meter=new RuptureCharge(),salvos=new ShotgunSalvos();
  for(let i=0;i<8;i++){
    const group=salvos.acquire(0,String(i));
    assert.equal(salvos.charge(group,false),false);
    if(salvos.charge(group,true))meter.hit();
    assert.equal(salvos.charge(group,true),false);
    if(i<7)assert.equal(meter.fire(),false);
  }
  assert.equal(meter.ready,true);meter.hit();assert.equal(meter.hits,8);
  assert.equal(meter.fire(),true);assert.equal(meter.fire(),false);
  meter.hit();meter.reset();assert.equal(meter.hits,0);
});
test('lead rain adds bounded pellet count and widens dispersion',()=>{
  assert.deepEqual(shotgunPattern(0),{pellets:12,spread:.34});
  assert.equal(shotgunPattern(1).pellets,14);
  assert.equal(shotgunPattern(99).pellets,20);
  assert.ok(Math.abs(shotgunPattern(4).spread-.476)<1e-8);
});
test('focus belongs to one target, blast and owner; impact occurs once at close range',()=>{
  const salvos=new ShotgunSalvos(),a=salvos.acquire(0,'1'),b=salvos.acquire(1,'1'),enemy={},other={};
  assert.deepEqual(salvos.hit(a,enemy,3,3,false),{damage:1,stagger:0,push:0});
  assert.deepEqual(salvos.hit(a,enemy,3,3,true),{damage:1.08,stagger:.24,push:.85});
  assert.equal(salvos.hit(a,enemy,3,3,true).push,0);
  for(let n=0;n<30;n++)salvos.hit(a,enemy,3,3,true);
  assert.ok(Math.abs(salvos.hit(a,enemy,3,3,true).damage-1.64)<1e-8);
  assert.equal(salvos.hit(a,other,3,3,true).damage,1);
  assert.equal(salvos.hit(b,enemy,3,3,true).damage,1);
  assert.equal(salvos.hit(salvos.acquire(0,'2'),enemy,3,3,true).damage,1);
});
test('salvos release when all projectiles end and stale cleanup cannot delete new runs',()=>{
  const salvos=new ShotgunSalvos(),a=salvos.acquire(0,'1');salvos.acquire(0,'1');
  salvos.release(a);assert.equal(salvos.groups.size,1);
  salvos.release(a);assert.equal(salvos.groups.size,0);
  const old=salvos.acquire(0,'1');salvos.reset();const fresh=salvos.acquire(0,'1');
  salvos.release(old);assert.equal(salvos.groups.size,1);
  assert.equal(salvos.hit(old,{},3,3,true).push,0);
  salvos.release(fresh);assert.equal(salvos.groups.size,0);
});

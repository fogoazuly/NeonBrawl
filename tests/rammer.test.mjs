import test from 'node:test';
import assert from 'node:assert/strict';
import {Rammer} from '../local/combat/rammer.js';
import {createDamageSystem} from '../local/combat/damage.js';
const env=(extra={})=>({dx:8,dz:0,distance:8,canStart:true,speed:14,controlled:false,warn(){},crash(){},move(dx,dz,distance){return {distance,blocked:false};},...extra});
test('rammer locks aim for a full readable windup then travels a finite distance',()=>{
 const r=new Rammer();r.timer=0;let moved=0;
 r.tick(.016,env());assert.equal(r.phase,'windup');
 r.tick(.8,env({dx:0,dz:8}));assert.equal(r.phase,'windup');assert.equal(r.dx,1);assert.equal(r.dz,0);
 r.tick(.11,env());assert.equal(r.phase,'rush');
 for(let i=0;i<20;i++)r.tick(.1,env({move(dx,dz,d){moved+=d;return {distance:d,blocked:false};}}));
 assert.ok(Math.abs(moved-12)<1e-8);assert.notEqual(r.phase,'rush');
});
test('wall crashes expose for 1.6s; control cancels charges without cancelling exposure',()=>{
 const r=new Rammer();r.phase='rush';r.remaining=12;let crashes=0;
 r.tick(.05,env({move(){return {distance:.2,blocked:true};},crash(){crashes++;}}));
 assert.equal(r.phase,'crashed');assert.equal(crashes,1);
 r.tick(.8,env({controlled:true}));assert.equal(r.phase,'crashed');
 r.tick(.81,env());assert.equal(r.phase,'idle');
 r.phase='rush';r.tick(.01,env({controlled:true}));assert.equal(r.phase,'recover');
});
test('rammer vulnerability applies only while crashed',()=>{
 const damage=createDamageSystem({permLevel:()=>0,relicDamageMult:()=>1,getSkills:()=>({}),getPlayer:()=>({pos:{x:0,z:0}}),getPhaseVulnerability:()=>new Map(),getCritBonus:()=>0,onExecute(){},PERM_CRIT_CHANCE:[0],CRIT_LUCK_BONUS:[0],PERM_BOSS_DMG_MULT:[1],random:()=>1});
 const e={type:'rammer',ram:{phase:'crashed'}};
 assert.equal(damage.playerDamageAmount(e,100,{}),135);
 e.ram.phase='rush';assert.equal(damage.playerDamageAmount(e,100,{}),100);
});

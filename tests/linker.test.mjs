import test from 'node:test';
import assert from 'node:assert/strict';
import {chooseLinks,linkIsValid} from '../local/combat/linker.js';
import {createDamageSystem} from '../local/combat/damage.js';
const make=(type,x=0)=>({type,hp:100,maxHp:100,pos:{x,z:0},spawnAnim:0,stagger:0});
const clear=()=>false;
test('linkers protect at most two unique nearby allies, excluding bosses and support',()=>{
 const source=make('linker'),other=make('linker',.1);
 const a=make('chaser',1),b=make('chaser',2),c=make('chaser',3);
 const links=chooseLinks([source,other,a,b,c,make('boss'),make('chaser',9)],clear);
 assert.equal(links.length,3);assert.equal(new Set(links.map(l=>l.target)).size,3);
 assert.equal(links.filter(l=>l.source===source).length,2);
});
test('walls, death, range, spawning and stagger break links',()=>{
 const s=make('linker'),t=make('chaser',2);
 assert.ok(linkIsValid(s,t,clear));
 assert.equal(linkIsValid(s,t,()=>true),false);
 for(const [key,value] of [['dead',true],['hp',0],['spawnAnim',.2],['stagger',.2]]){
  const copy={...s,[key]:value};assert.equal(linkIsValid(copy,t,clear),false);
 }
 t.pos.x=6.01;assert.equal(linkIsValid(s,t,clear),false);
});
test('30 percent protection is live, owner-independent and preserves executions',()=>{
 const source=make('linker'),target=make('chaser',2);
 const d=createDamageSystem({permLevel:()=>0,relicDamageMult:()=>1,getSkills:()=>({}),
  getPlayer:()=>({pos:{x:0,z:0}}),getPhaseVulnerability:()=>new Map(),getCritBonus:()=>0,onExecute(){},
  getProtectionMult:e=>linkIsValid(source,e,clear)?.7:1,
  PERM_CRIT_CHANCE:[0],CRIT_LUCK_BONUS:[0],PERM_BOSS_DMG_MULT:[1],random:()=>1});
 assert.equal(d.playerDamageAmount(target,100,{}),70);
 source.dead=true;assert.equal(d.playerDamageAmount(target,100,{}),100);
 source.dead=false;target.hp=20;
 assert.ok(d.playerDamageAmount(target,1,{executionRounds:true})>=20);
});

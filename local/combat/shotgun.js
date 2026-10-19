const rank = (value, max) => Math.max(0, Math.min(max, Math.floor(Number(value) || 0)));
export function shotgunPattern(level) {
  const n=rank(level,4);
  return {pellets:12+2*n,spread:0.34*(1+0.1*n)};
}

export class RuptureCharge {
  constructor(){this.reset();}
  reset(){this.hits=0;}
  get ready(){return this.hits>=8;}
  hit(){this.hits=Math.min(8,this.hits+1);}
  fire(){if(!this.ready)return false;this.reset();return true;}
}

// Groups live only while their projectiles do; owners never share hit counters.
export class ShotgunSalvos {
  constructor(){this.groups=new Map();}
  reset(){this.groups.clear();}
  acquire(owner,id){
    const key=JSON.stringify([owner,id]);
    let group=this.groups.get(key);
    if(!group){group={key,refs:0,targets:new WeakMap()};this.groups.set(key,group);}
    group.refs++;return group;
  }
  release(group){
    if(group&&--group.refs<=0&&this.groups.get(group.key)===group)this.groups.delete(group.key);
  }
  charge(group,close){
    if(!close||!group||group.charged||this.groups.get(group.key)!==group)return false;
    group.charged=true;return true;
  }
  hit(group,target,focus,impact,close){
    if(!group||this.groups.get(group.key)!==group)return {damage:1,stagger:0,push:0};
    const state=group.targets.get(target)||{hits:0,impacted:false};
    const damage=1+Math.min(8,state.hits)*([0,.04,.06,.08][rank(focus,3)]);
    state.hits++;
    const control=close&&!state.impacted?rank(impact,3):0;
    if(control)state.impacted=true;
    group.targets.set(target,state);
    return {damage,stagger:[0,.12,.18,.24][control],push:[0,.45,.65,.85][control]};
  }
}

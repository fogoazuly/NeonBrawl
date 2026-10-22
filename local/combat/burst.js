import {ShotgunSalvos} from './shotgun.js';
const rank=(n,max)=>Math.max(0,Math.min(max,Math.floor(Number(n)||0)));
export const burstSpread=n=>.075*(1-[0,.2,.3,.4,.5][rank(n,4)]);
export class BurstOpening{
  constructor(){this.reset();}
  reset(){this.ready=false;}
  reload(){this.ready=true;}
  fire(level){const bonus=this.ready?[0,.25,.4,.55][rank(level,3)]:0;this.reset();return 1+bonus;}
}
export class BurstSalvos extends ShotgunSalvos{
  hit(group,target,index,level){
    if(!group||this.groups.get(group.key)!==group||!Number.isInteger(index)||index<0||index>2)return 1;
    const previous=group.targets.get(target)||0;
    const mask=previous|(1<<index);group.targets.set(target,mask);
    return mask===7&&previous!==7?1+[0,.5,.8,1.1][rank(level,3)]:1;
  }
}

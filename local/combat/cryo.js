const rank=(n,max)=>Math.max(0,Math.min(max,Math.floor(Number(n)||0)));
export const cryoReach=n=>1+[0,.15,.25,.35,.45][rank(n,4)];
export const cryoSlowTime=n=>[.48,.8,1.1,1.4][rank(n,3)];
export const cryoBrittle=(n,slowed)=>slowed?1+[0,.2,.35,.5][rank(n,3)]:1;

export class AbsoluteZeroCharge{
  constructor(){this.reset();}
  reset(){this.hits=0;}
  get ready(){return this.hits>=30;}
  hit(){this.hits=Math.min(30,this.hits+1);}
  fire(){if(!this.ready)return false;this.reset();return true;}
}

const rank=(n,max)=>Math.max(0,Math.min(max,Math.floor(Number(n)||0)));
export const grenadeRadius=n=>1+[0,.15,.25,.35,.45][rank(n,4)];
export const grenadeCore=(n,distance,radius)=>distance<=radius*.4?1+[0,.3,.5,.7][rank(n,3)]:1;
export class GrenadePrimer{
  constructor(){this.reset();}
  reset(){this.ready=false;}
  reload(){this.ready=true;}
  fire(level){
    const n=rank(level,3),active=this.ready&&n>0;this.reset();
    return {damage:active?1+[0,.25,.4,.55][n]:1,quick:active};
  }
}

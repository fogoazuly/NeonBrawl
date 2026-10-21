const rank=(n,max)=>Math.max(0,Math.min(max,Math.floor(Number(n)||0)));
export function ak47Spread(level){return .14*(1-[0,.15,.25,.35,.45][rank(level,4)]);}
export class RifleRhythm{
  constructor(){this.reset();}
  reset(){this.resetBurst();this.reloadWindow=0;}
  resetBurst(){this.shots=0;this.gap=0;}
  tick(dt,enabled,reloading){
    this.reloadWindow=Math.max(0,this.reloadWindow-dt);
    this.gap+=dt;
    if(!enabled){this.reset();return;}
    if(reloading||this.gap>=.7)this.resetBurst();
  }
  shot(level){
    const mult=1+Math.min(10,this.shots)*[0,.02,.03,.04][rank(level,3)];
    this.shots=Math.min(10,this.shots+1);this.gap=0;return mult;
  }
  kill(){this.reloadWindow=4;}
  reload(level){
    const mult=this.reloadWindow>0?1-[0,.2,.3,.4][rank(level,3)]:1;
    this.reloadWindow=0;this.resetBurst();return mult;
  }
}

export class Rammer {
  constructor(){this.phase='idle';this.timer=2;this.dx=0;this.dz=1;this.remaining=0;this.hit=new Set();}
  tick(dt,env){
    if(env.controlled&&this.phase!=='crashed'){this.phase='recover';this.timer=.65;return true;}
    if(this.phase==='idle'){
      this.timer=Math.max(0,this.timer-dt);
      if(this.timer>0||!env.canStart||env.distance<2||env.distance>12)return false;
      this.dx=env.dx/env.distance;this.dz=env.dz/env.distance;
      this.phase='windup';this.timer=.9;this.remaining=12;this.hit.clear();
      env.warn(this.dx,this.dz);return true;
    }
    if(this.phase==='windup'){
      this.timer-=dt;if(this.timer<=0)this.phase='rush';return true;
    }
    if(this.phase==='rush'){
      const result=env.move(this.dx,this.dz,Math.min(this.remaining,env.speed*dt));
      this.remaining-=result.distance;
      if(result.blocked){this.phase='crashed';this.timer=1.6;env.crash();}
      else if(this.remaining<=.001){this.phase='recover';this.timer=.65;}
      return true;
    }
    this.timer-=dt;
    if(this.timer<=0){this.phase='idle';this.timer=2.5;}
    return true;
  }
}

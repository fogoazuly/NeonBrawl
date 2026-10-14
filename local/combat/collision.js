// Geometry and movement queries share the live obstacle array as maps change.
// No rendering, DOM or multiplayer dependencies.
export function createCollisionSystem({ arenaWidth: ARENA_W, arenaHeight: ARENA_H, obstacleBoxes }) {
function boxOverlap(cx, cz, cr, bx, bz, bhw, bhd){
  const dx = Math.max(bx-bhw, Math.min(bx+bhw, cx)) - cx;
  const dz = Math.max(bz-bhd, Math.min(bz+bhd, cz)) - cz;
  return dx*dx + dz*dz < cr*cr;
}
function isBlockedAt(x,z,r){
  if(x<-ARENA_W+r||x>ARENA_W-r||z<-ARENA_H+r||z>ARENA_H-r) return true;
  for(const o of obstacleBoxes) if(boxOverlap(x,z,r,o.x,o.z,o.hw,o.hd)) return true;
  return false;
}
function rayBoxHitDistance(x,z,dx,dz,bx,bz,hw,hd,pad=0){
  const hit=rayBoxHitInfo(x,z,dx,dz,bx,bz,hw,hd,pad);
  return hit ? hit.dist : null;
}
function rayBoxHitInfo(x,z,dx,dz,bx,bz,hw,hd,pad=0){
  hw+=pad; hd+=pad;
  const minX=bx-hw, maxX=bx+hw, minZ=bz-hd, maxZ=bz+hd;
  let tMin=0, tMax=Infinity;
  let nx=0, nz=0;
  if(Math.abs(dx)<0.00001){
    if(x<minX||x>maxX) return null;
  } else {
    const t1=dx>0 ? (minX-x)/dx : (maxX-x)/dx;
    const t2=dx>0 ? (maxX-x)/dx : (minX-x)/dx;
    const n1x=dx>0 ? -1 : 1;
    if(t1>tMin){ tMin=t1; nx=n1x; nz=0; }
    tMax=Math.min(tMax,t2);
  }
  if(Math.abs(dz)<0.00001){
    if(z<minZ||z>maxZ) return null;
  } else {
    const t1=dz>0 ? (minZ-z)/dz : (maxZ-z)/dz;
    const t2=dz>0 ? (maxZ-z)/dz : (minZ-z)/dz;
    const n1z=dz>0 ? -1 : 1;
    if(t1>tMin){ tMin=t1; nx=0; nz=n1z; }
    tMax=Math.min(tMax,t2);
  }
  if(tMax<0||tMin>tMax) return null;
  return {dist:Math.max(0,tMin),nx,nz,type:'obstacle'};
}
function firstObstacleHitDistance(x,z,dx,dz,maxDist,pad=0){
  let best=maxDist;
  for(const o of obstacleBoxes){
    const t=rayBoxHitDistance(x,z,dx,dz,o.x,o.z,o.hw,o.hd,pad);
    if(t!==null&&t<best) best=t;
  }
  return best;
}
function rayArenaHitInfo(x,z,dx,dz,maxDist,pad=0){
  const limX=ARENA_W-pad, limZ=ARENA_H-pad;
  let best=null;
  const consider=(t,nx,nz)=>{
    if(t>0.001&&t<=(maxDist+0.001)&&(!best||t<best.dist)) best={dist:t,nx,nz,type:'border'};
  };
  if(dx>0.00001) consider((limX-x)/dx,-1,0);
  else if(dx<-0.00001) consider((-limX-x)/dx,1,0);
  if(dz>0.00001) consider((limZ-z)/dz,0,-1);
  else if(dz<-0.00001) consider((-limZ-z)/dz,0,1);
  return best;
}
function firstSolidHitInfo(x,z,dx,dz,maxDist,pad=0){
  let best=rayArenaHitInfo(x,z,dx,dz,maxDist,pad);
  for(const o of obstacleBoxes){
    const hit=rayBoxHitInfo(x,z,dx,dz,o.x,o.z,o.hw,o.hd,pad);
    if(hit&&hit.dist>0.001&&hit.dist<=(maxDist+0.001)&&(!best||hit.dist<best.dist)) best=hit;
  }
  return best || {dist:maxDist,nx:0,nz:0,type:null};
}
function reflectedRaySegments(x,z,dx,dz,maxDist,bounces=0,pad=0){
  const segs=[];
  let sx=x, sz=z, vx=dx, vz=dz, remain=maxDist;
  const maxSegs=Math.max(1,Math.min(7,(bounces|0)+1));
  for(let i=0;i<maxSegs&&remain>0.08;i++){
    const hit=firstSolidHitInfo(sx,sz,vx,vz,remain,pad);
    const segLen=Math.max(0.05,hit.type?hit.dist-0.14:hit.dist);
    segs.push({x:sx,z:sz,dx:vx,dz:vz,len:segLen});
    if(!hit.type||i>=bounces) break;
    sx+=vx*Math.max(0.05,hit.dist-0.08);
    sz+=vz*Math.max(0.05,hit.dist-0.08);
    const dot=vx*hit.nx+vz*hit.nz;
    vx-=2*dot*hit.nx; vz-=2*dot*hit.nz;
    const l=Math.hypot(vx,vz)||1; vx/=l; vz/=l;
    sx+=vx*0.10; sz+=vz*0.10;
    remain-=hit.dist;
  }
  return segs;
}
function lineBlockedByObstacle(x,z,tx,tz,pad=0.04){
  const dx=tx-x, dz=tz-z;
  const d=Math.hypot(dx,dz);
  if(d<0.001) return false;
  return firstObstacleHitDistance(x,z,dx/d,dz/d,d,pad)<Math.max(0,d-0.16);
}
function projectToNearestOpen(pos,r,maxRadius=4){
  clamp(pos,r);
  resolveObst(pos,r);
  if(!isBlockedAt(pos.x,pos.z,r)) return false;

  const ox=pos.x, oz=pos.z;
  const rings=Math.ceil(maxRadius/0.25);
  for(let ring=1;ring<=rings;ring++){
    const rad=ring*0.25;
    const samples=Math.max(16,Math.ceil(rad*12));
    for(let i=0;i<samples;i++){
      const a=(i/samples)*Math.PI*2;
      const x=ox+Math.cos(a)*rad;
      const z=oz+Math.sin(a)*rad;
      if(!isBlockedAt(x,z,r)){
        pos.x=x; pos.z=z;
        clamp(pos,r);
        return true;
      }
    }
  }
  return false;
}
function wallAvoidVector(pos,r){
  let ax=0,az=0;
  const margin=r+0.9;
  const left=pos.x-(-ARENA_W+r), right=(ARENA_W-r)-pos.x;
  const bottom=pos.z-(-ARENA_H+r), top=(ARENA_H-r)-pos.z;
  if(left<margin) ax+=(margin-left)/margin;
  if(right<margin) ax-=(margin-right)/margin;
  if(bottom<margin) az+=(margin-bottom)/margin;
  if(top<margin) az-=(margin-top)/margin;
  for(const o of obstacleBoxes){
    const cx=Math.max(o.x-o.hw,Math.min(o.x+o.hw,pos.x));
    const cz=Math.max(o.z-o.hd,Math.min(o.z+o.hd,pos.z));
    let dx=pos.x-cx,dz=pos.z-cz,dist=Math.hypot(dx,dz);
    const safe=r+0.95;
    if(dist<0.001&&boxOverlap(pos.x,pos.z,r,o.x,o.z,o.hw,o.hd)){
      const ox=o.hw+r-Math.abs(pos.x-o.x);
      const oz=o.hd+r-Math.abs(pos.z-o.z);
      if(ox<oz){dx=Math.sign(pos.x-o.x||1);dz=0;dist=1;}
      else{dx=0;dz=Math.sign(pos.z-o.z||1);dist=1;}
    }
    if(dist<safe){
      const w=(safe-dist)/safe;
      ax+=(dx/(dist||1))*w*w;
      az+=(dz/(dist||1))*w*w;
    }
  }
  return {x:ax,z:az};
}
function canMoveAlong(pos,x,z,r,step){
  for(let i=1;i<=3;i++){
    const t=i/3;
    if(isBlockedAt(pos.x+x*step*t,pos.z+z*step*t,r)) return false;
  }
  return true;
}
function steerScore(x,z,vx,vz,preferX,preferZ){
  let score=x*vx+z*vz;
  const pl=Math.hypot(preferX,preferZ);
  if(pl>0.001) score+=0.45*(x*preferX+z*preferZ)/pl;
  return score;
}
function openSteer(pos,vx,vz,r,step,preferX=0,preferZ=0){
  let l=Math.hypot(vx,vz);
  if(l<0.001) return {x:0,z:0};
  vx/=l; vz/=l;
  if(isBlockedAt(pos.x,pos.z,r)){
    const away=wallAvoidVector(pos,r);
    l=Math.hypot(away.x,away.z);
    return l>0.001?{x:away.x/l,z:away.z/l}:{x:-vx,z:-vz};
  }
  let best=null,bestScore=-1e9;
  const addCandidate=(x,z)=>{
    if(!canMoveAlong(pos,x,z,r,step)) return;
    const s=steerScore(x,z,vx,vz,preferX,preferZ);
    if(s>bestScore){bestScore=s;best={x,z};}
  };
  addCandidate(vx,vz);

  const away=wallAvoidVector(pos,r);
  const al=Math.hypot(away.x,away.z);
  if(al>0.001){
    const nx=away.x/al,nz=away.z/al;
    const dot=vx*nx+vz*nz;
    if(dot<0.2){
      const sx=vx-nx*Math.min(dot,0), sz=vz-nz*Math.min(dot,0);
      const sl=Math.hypot(sx,sz);
      if(sl>0.001) addCandidate(sx/sl,sz/sl);
      addCandidate(-nz,nx);
      addCandidate(nz,-nx);
    }
  }

  const angles=[0.25,-0.25,0.5,-0.5,0.8,-0.8,1.1,-1.1,1.57,-1.57,2.1,-2.1,2.7,-2.7,3.14];
  for(const a of angles){
    const ca=Math.cos(a),sa=Math.sin(a);
    const x=vx*ca-vz*sa,z=vx*sa+vz*ca;
    addCandidate(x,z);
  }
  if(best) return best;
  return al>0.001?{x:away.x/al,z:away.z/al}:{x:-vx,z:-vz};
}
function chooseDetourDirection(pos,goalX,goalZ,r,step,preferX=0,preferZ=0){
  let gl=Math.hypot(goalX,goalZ);
  if(gl<0.001){goalX=preferX;goalZ=preferZ;gl=Math.hypot(goalX,goalZ);}
  if(gl<0.001){goalX=1;goalZ=0;gl=1;}
  goalX/=gl; goalZ/=gl;

  const away=wallAvoidVector(pos,r);
  const al=Math.hypot(away.x,away.z);
  const candidates=[];
  const add=(x,z)=>{
    const l=Math.hypot(x,z);
    if(l<0.001) return;
    x/=l; z/=l;
    if(canMoveAlong(pos,x,z,r,step)) candidates.push({x,z});
  };
  if(al>0.001){
    const nx=away.x/al,nz=away.z/al;
    add(-nz,nx);
    add(nz,-nx);
    add(nx*0.45-nz,nz*0.45+nx);
    add(nx*0.45+nz,nz*0.45-nx);
    add(nx,nz);
  } else {
    add(-goalZ,goalX);
    add(goalZ,-goalX);
  }
  add(goalX,goalZ);

  let best=null,bestScore=-1e9;
  for(const c of candidates){
    const s=c.x*goalX+c.z*goalZ+0.65*(c.x*preferX+c.z*preferZ);
    if(s>bestScore){bestScore=s;best=c;}
  }
  return best||{x:-goalZ,z:goalX};
}
function clamp(pos, r=0.6){
  pos.x = Math.max(-ARENA_W+r, Math.min(ARENA_W-r, pos.x));
  pos.z = Math.max(-ARENA_H+r, Math.min(ARENA_H-r, pos.z));
}
function resolveObst(pos, r){
  for(let pass=0;pass<2;pass++){
    for(const o of obstacleBoxes){
      if(boxOverlap(pos.x, pos.z, r, o.x, o.z, o.hw, o.hd)){
        const dx = pos.x - o.x, dz = pos.z - o.z;
        const overlapX = o.hw+r - Math.abs(dx);
        const overlapZ = o.hd+r - Math.abs(dz);
        if(overlapX < overlapZ) pos.x += Math.sign(dx||1)*overlapX;
        else                     pos.z += Math.sign(dz||1)*overlapZ;
      }
    }
  }
  pos.x = Math.max(-ARENA_W+r, Math.min(ARENA_W-r, pos.x));
  pos.z = Math.max(-ARENA_H+r, Math.min(ARENA_H-r, pos.z));
}


return { boxOverlap, isBlockedAt, rayBoxHitDistance, rayBoxHitInfo, firstObstacleHitDistance, rayArenaHitInfo, firstSolidHitInfo, reflectedRaySegments, lineBlockedByObstacle, projectToNearestOpen, wallAvoidVector, canMoveAlong, steerScore, openSteer, chooseDetourDirection, clamp, resolveObst };
}

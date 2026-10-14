// Damage rules have explicit live-state readers so resets and remote snapshots
// are not captured accidentally. Visual feedback is supplied by the caller.
export function createDamageSystem({ permLevel, relicDamageMult, getSkills, getPlayer,
  getPhaseVulnerability, getCritBonus, onExecute,
  PERM_CRIT_CHANCE, CRIT_LUCK_BONUS, PERM_BOSS_DMG_MULT, random = Math.random }) {
function rollCrit(sourcePerm){
  const critLvl = sourcePerm ? (sourcePerm.crit||0)     : permLevel('crit');
  const luckLvl = sourcePerm ? (sourcePerm.critLuck||0) : (getSkills().critLuck||0);
  const base    = PERM_CRIT_CHANCE[critLvl] || 0;
  const bonus   = CRIT_LUCK_BONUS[luckLvl]  || 0;
  return random() < Math.min(0.95, base + bonus + (getCritBonus()||0));
}

function playerDamageAmount(enemy, base, sourcePerm=null){
  let dmg=base*(sourcePerm?(sourcePerm.relicDmg||1):relicDamageMult());
  const bossLvl=sourcePerm?sourcePerm.bossHunter||0:permLevel('bossHunter');
  if(enemy&&enemy.type==='boss') dmg*=PERM_BOSS_DMG_MULT[bossLvl]||1;
  if(enemy&&sourcePerm?.executionRounds){
    const hpPct=enemy.hp/Math.max(1,enemy.maxHp||enemy.hp||1);
    if(enemy.type==='boss') dmg*=1.28;
    else if(hpPct<=0.25){
      dmg=Math.max(dmg,enemy.hp||enemy.maxHp||dmg);
      // Execute pop so the instant-kill reads as a deliberate effect, not luck.
      // Throttled per enemy so multiple bullets in one frame don't spam it.
      if(!enemy.dead && enemy.pos) onExecute(enemy);
    }
  }
  if(enemy&&enemy.type==='tank'){
    const src=getPlayer()?.pos || {x:0,z:0};
    const fx=Math.sin(enemy.mesh?.rotation?.y||0), fz=Math.cos(enemy.mesh?.rotation?.y||0);
    const vx=src.x-enemy.pos.x, vz=src.z-enemy.pos.z;
    const vl=Math.hypot(vx,vz)||1;
    const facing=(vx/vl)*fx+(vz/vl)*fz;
    if(facing>0.28) dmg*=0.55;
    else if(facing<-0.22) dmg*=1.28;
  }
  if(enemy){
    const phase=getPhaseVulnerability().get(enemy.poolIdx);
    if(phase&&phase.t>0) dmg*=1+(phase.mult||0);
  }
  // Hollow Point — bonus damage vs healthy (>75% HP) targets. Encourages
  // first-strike kills and opening blows.
  if(enemy){
    const _hpLvl=sourcePerm?(sourcePerm.hollowPoint||0):(getSkills().hollowPoint||0);
    if(_hpLvl){
      const _hpPct=enemy.hp/Math.max(1,enemy.maxHp||enemy.hp||1);
      if(_hpPct>=0.75){
        const _hpMul=[0,1.35,1.55,1.55,1.75,1.95][_hpLvl]||1;
        dmg*=_hpMul;
      }
    }
  }
  const crit=rollCrit(sourcePerm);
  if(crit) dmg*=1.85;
  if(enemy) enemy._lastCrit=crit;
  return Math.max(1,Math.round(dmg));
}


return { rollCrit, playerDamageAmount };
}

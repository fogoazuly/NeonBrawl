export function linkIsValid(source, target, blocked) {
  return !!source && !!target && source !== target && !source.dead && !target.dead &&
    source.hp > 0 && target.hp > 0 && source.type === 'linker' &&
    target.type !== 'linker' && target.type !== 'boss' &&
    !(source.spawnAnim > 0) && !(target.spawnAnim > 0) && !(source.stagger > 0.1) &&
    Math.hypot(source.pos.x-target.pos.x,source.pos.z-target.pos.z) <= 6 &&
    !blocked(source.pos.x,source.pos.z,target.pos.x,target.pos.z,.08);
}

// A fixed cap also bounds rendering costs during unusually crowded waves.
export function chooseLinks(enemies, blocked) {
  const links=[], claimed=new Set();
  for (const source of enemies.filter(e=>e.type==='linker'&&!e.dead).slice(0,8)) {
    const candidates=enemies.filter(target=>!claimed.has(target)&&linkIsValid(source,target,blocked))
      .sort((a,b)=>Math.hypot(source.pos.x-a.pos.x,source.pos.z-a.pos.z)-
        Math.hypot(source.pos.x-b.pos.x,source.pos.z-b.pos.z));
    for (const target of candidates.slice(0,2)) {
      claimed.add(target);links.push({source,target});
    }
  }
  return links;
}

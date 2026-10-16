// Resolve primary shots in firing order; piercing and bonus bullets never add stacks.
export class PrecisionStreak {
  constructor() { this.owners = new Map(); }
  reset() { this.owners.clear(); }
  streak(owner) { return this.owners.get(owner)?.streak || 0; }
  multiplier(owner, level) { return 1 + this.streak(owner) * ([0,.04,.06,.08][level] || 0); }
  begin(owner) {
    let state = this.owners.get(owner);
    if (!state) { state = { streak:0, pending:[] }; this.owners.set(owner,state); }
    const shot = { owner, state, result:null };
    state.pending.push(shot); return shot;
  }
  finish(shot, hit) {
    if (!shot || shot.result !== null || this.owners.get(shot.owner) !== shot.state) return;
    shot.result = !!hit;
    const state = shot.state;
    while (state.pending.length && state.pending[0].result !== null) {
      state.streak = state.pending.shift().result ? Math.min(5,state.streak+1) : 0;
    }
  }
}
export const lastWordBonus = level => ({ damage: [1,1.6,1.9,2.2][level] || 1, pierce: Math.max(0,Math.min(3,level||0)) });

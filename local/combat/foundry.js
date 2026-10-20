// Four seconds to enter the arena, then alternating six-second lane slots.
// Each slot warns for two seconds, burns for two, and cools for two.
export function foundryPhase(seconds, lane) {
  if (!Number.isFinite(seconds) || seconds < 4) return 'off';
  const cycle = (seconds - 4) % 12;
  const local = cycle - (lane === 1 ? 6 : 0);
  if (local < 0 || local >= 4) return 'off';
  return local < 2 ? 'warning' : 'active';
}

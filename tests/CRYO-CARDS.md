# Cryo Sprayer exclusive cards

- Polar Reach (uncommon, four picks): cone range +15/25/35/45%, multiplicative with Long Shot. Existing cone width/Spread Pattern behavior remains.
- Lingering Frost (rare, three picks): minimum remaining slow duration 0.8/1.1/1.4 seconds instead of 0.48. Repeated hits refresh rather than add duration. Longer slows from other effects are preserved; the slow expires after firing stops.
- Brittle Ice (rare, three picks): +20/35/50% cryo damage against enemies already slowed before the current hit. An unslowed target takes normal damage on its first hit. No change to movement reduction or full freeze.

Reflected segments retain the existing per-shot hit set and wall checks. Only the cryo cone passes a target-dependent damage multiplier; other weapons remain unchanged. Guest attack snapshots carry the three card ranks for host-authoritative range, damage and slow.

## Divine Ascension: Absolute Zero

Thirty cryo firing events hitting an already slowed enemy prepare the next shot. A shot awards at most one charge across all targets/reflections. The empowered shot deals four times damage, applies 0.8s stagger and 3s slow, and cannot charge itself. Boss/elite control factors reduce the special durations; existing longer slows are preserved. Reload/pauses retain charge; new runs clear it.

Polar Reach, Lingering Frost, Brittle Ice, the widened cone and wall checks remain active. The host confirms guest charge, and GUN_SPECIAL carries an explicit empowered flag. The HUD shows progress/ready state and the empowered cone has a brighter icy flash.

Validation:
- `node --test tests/*.test.mjs`: 75 passing tests.
- `node tests/cryo-smoke.cjs`: eligibility/caps, first-hit ordering, range, wall blocking, Spread Pattern wide-cone synergy, slow expiry, Divine cap, one charge per shot, real fire consumption, empowered damage, wall blocking, boss resistance and guest charge/damage.
- Visual card inspection: `test-results/cryo-cards.png` and `test-results/cryo-absolute-zero.png`.
- `node scripts/build-pages.mjs` and `node tests/pages-smoke.cjs`: production package/browser checks.

Values are initial balance values for player feedback.

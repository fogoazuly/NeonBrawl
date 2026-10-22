# Cryo Sprayer exclusive cards

- Polar Reach (uncommon, four picks): cone range +15/25/35/45%, multiplicative with Long Shot. Existing cone width/Spread Pattern behavior remains.
- Lingering Frost (rare, three picks): minimum remaining slow duration 0.8/1.1/1.4 seconds instead of 0.48. Repeated hits refresh rather than add duration. Longer slows from other effects are preserved; the slow expires after firing stops.
- Brittle Ice (rare, three picks): +20/35/50% cryo damage against enemies already slowed before the current hit. An unslowed target takes normal damage on its first hit. No change to movement reduction or full freeze.

Reflected segments retain the existing per-shot hit set and wall checks. Only the cryo cone passes a target-dependent damage multiplier; other weapons remain unchanged. Guest attack snapshots carry the three card ranks for host-authoritative range, damage and slow.

Validation:
- `node --test tests/*.test.mjs`: 74 passing tests.
- `node tests/cryo-smoke.cjs`: eligibility/caps, first-hit ordering, range, wall blocking, Spread Pattern wide-cone synergy, slow expiry and guest modifiers.
- Visual card inspection: `test-results/cryo-cards.png`.
- `node scripts/build-pages.mjs` and `node tests/pages-smoke.cjs`: production package/browser checks.

Values are initial balance values for player feedback.

# Shotgun identity — first three cards

- Brutal Impact (rare, 3 picks): within 3m of the pellet muzzle, push
  0.45/0.65/0.85m and stagger 0.12/0.18/0.24s. Once per enemy per blast;
  existing boss/elite control resistance applies. Movement advances in small
  collision-resolved steps to respect walls.
- Lead Rain (uncommon, 4 picks): +2/4/6/8 pellets and +10/20/30/40% dispersion.
  Retains the two-row fan and consumes one ammo per blast.
- Point Blank (rare, 3 picks): each previous pellet hit on that enemy in the
  same blast grants +4/6/8% damage, capped after eight prior hits (+32/48/64%).
  Other targets, shots and players have separate counters.

Generic spread shares the blast's effects. Remote pellets receive the owner's
card levels and blast ID. Falloff is initialized in the shared bullet factory,
so both host and guest shotgun pellets lose damage at range. Salvo references
are released with pooled projectiles and cleared on a new run.

Validation: `node --test tests/*.test.mjs`,
`node tests/shotgun-smoke.cjs`, `node tests/pistol-ascension-smoke.cjs`,
`node scripts/build-pages.mjs`, `node tests/pages-smoke.cjs`.
The browser test checks real firing, delayed rows, extra projectiles, actual
damage/impact, wall collision, exclusive card caps, pool cleanup, and two-client
co-op. Screenshot: `test-results/shotgun-cards.png` (ignored artifact).

Rupture / Shotgun Divine Ascension is a future stage, not part of this change.

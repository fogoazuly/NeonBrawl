# Linker enemy

Violet support enemy, introduced at wave 9 (one), then wave 18 (two), before
existing roster modifiers. Uses rear-distance navigation like the medic.
72 base HP, 2.0 base movement speed, 65 points.

Each linker selects the nearest two unclaimed allies within six meters and
unobstructed line of sight. Links exclude bosses, other linkers, dead enemies
and enemies still spawning. Targets cannot stack protection. A substantial
stagger on the source interrupts its links until it recovers.

Linked targets receive 30% less damage through the shared player attack damage
calculator. This covers owner-specific direct weapon, melee and skill damage
using that calculator; raw damage-over-time and environmental damage paths are
unchanged. Execution effects retain their existing kill behavior.

Protection checks the live source at damage time, so death, walls or distance
invalidate it without waiting for another target-selection pass. Host chooses
links, and snapshots transmit source IDs to guests. A reusable geometry buffer
renders up to 16 visible beams (eight supported sources) without allocating
new geometries/materials each frame. The enemy silhouette retains antennae
and a ring in low-detail mode.

Validation:

- `node --test tests/*.test.mjs`: cap, no stacking, exclusions, interrupts,
  live damage reduction, and executions.
- `node tests/linker-smoke.cjs` with local server: roster, integrated damage,
  walls/range/death, visible beam geometry, two-browser link synchronization
  and removal.
- `node scripts/build-pages.mjs` and `node tests/pages-smoke.cjs`.

Ignored screenshot output: `test-results/linker.png`.

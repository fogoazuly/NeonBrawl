# Neon Ram / Aríete Neon

Introduced at wave 7: one per base roster, two from wave 13, three from wave 19.
Existing wave modifiers still apply. Base stats: 110 HP, 2.7 walk speed, 0.65
collision radius, 45 points. Horned orange model retains key parts on low graphics.

Behavior: approach (or back off when too close), lock direction for a 0.9s warning,
then rush up to 12m at 14–17.5 units/s. Difficulty cannot shorten the warning.
Movement uses <=0.12m collision steps, checks arena and walls, and damages each
target at most once per rush (24 damage before ordinary difficulty/defense rules).
Wall collision stops movement for 1.6s and grants +35% incoming damage. A miss
recovers for 0.65s; another attempt requires a 2.5s cooldown. Gravity and substantial
stagger interrupt charges. Slow affects rush speed. Boss/elite scaling remains
available, but the rammer uses its own attack rather than unrelated elite attacks.

Host owns AI, collisions and damage. Warning lines relay to guests, and state
snapshots carry phase and locked heading. Stopped phases transmit zero velocity
to avoid extrapolating a crashed enemy forward.

Also corrected warning-line Euler rotation: the warning plane remains flat and
aligned with its intended direction at every angle.

Checks: `node --test tests/*.test.mjs`, `node tests/rammer-smoke.cjs`,
`node scripts/build-pages.mjs`, `node tests/pages-smoke.cjs`.
Browser coverage includes wave gate/cap, fixed aim, thin walls, arena boundary,
Hell windup, exposure, one collision hit, telegraph orientation, and two-client
model/phase/warning replication. Visuals: `test-results/rammer-warning.png` and
`test-results/rammer-crash.png`.

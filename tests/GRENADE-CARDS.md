# Grenade Launcher exclusive cards

- Blast Envelope (uncommon, four picks): base explosion radius +15/25/35/45%. Existing generic explosive/heavy radius additions remain additive.
- Epicenter (rare, three picks): +30/50/70% explosion damage within the inner 40% of the final radius. Applies to enemies and spawner objectives. Other explosive weapons remain unchanged.
- Hot Chamber (rare, three picks): after completing a reload, the next firing event gains +25/40/55% damage and a 0.5-second grounded fuse instead of 1 second. Includes extra grenades. The entire firing event consumes one bonus; weapon switch/new run cancels it. Flight and bounce behavior remain unchanged.

Projectile snapshots carry radius/core ranks and quick-fuse state for guest-owned attacks. Warning circles use the actual fuse duration.

Validation:
- `node --test tests/*.test.mjs`: 72 passing tests.
- `node tests/grenade-smoke.cjs`: eligibility/pick caps; extra projectiles, radius, center vs outer damage, RPG isolation, reload completion, wall bounce at normal frame intervals, actual timed detonation and guest explosion/fuse.
- Visual card inspection: `test-results/grenade-cards.png`.
- `node scripts/build-pages.mjs` and `node tests/pages-smoke.cjs`: production package/browser checks.

These checks validate mechanics; the initial balance values remain open to player feedback.

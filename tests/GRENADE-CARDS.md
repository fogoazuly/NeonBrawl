# Grenade Launcher exclusive cards

- Blast Envelope (uncommon, four picks): base explosion radius +15/25/35/45%. Existing generic explosive/heavy radius additions remain additive.
- Epicenter (rare, three picks): +30/50/70% explosion damage within the inner 40% of the final radius. Applies to enemies and spawner objectives. Other explosive weapons remain unchanged.
- Hot Chamber (rare, three picks): after completing a reload, the next firing event gains +25/40/55% damage and a 0.5-second grounded fuse instead of 1 second. Includes extra grenades. The entire firing event consumes one bonus; weapon switch/new run cancels it. Flight and bounce behavior remain unchanged.

Projectile snapshots carry radius/core ranks and quick-fuse state for guest-owned attacks. Warning circles use the actual fuse duration.

## Divine Ascension: Supernova

Eight primary grenade explosions hitting at least two living enemies each charge the next firing event. That event deals triple damage and multiplies the grenade radius (including Blast Envelope) by 1.5; generic radius additions remain additive. Extra grenades inherit the empowered damage/radius and Hot Chamber fuse. Epicenter continues to use the resulting final radius.

Extra grenades, empowered grenades and objective structures cannot charge Supernova. One primary explosion awards at most one charge. Reloads preserve progress; new runs clear it. The host credits successful explosions to the owning guest. HUD displays charge/ready state.

Validation:
- `node --test tests/*.test.mjs`: 73 passing tests.
- `node tests/grenade-smoke.cjs`: eligibility/pick caps; extra projectiles, radius, center vs outer damage, RPG isolation, reload completion, wall bounce at normal frame intervals, actual timed detonation and guest explosion/fuse, Divine pick cap, damage/radius combinations, charge threshold, duplicate/extra/empowered exclusions and guest charge ownership.
- Visual card inspection: `test-results/grenade-cards.png` and `test-results/grenade-supernova.png`.
- `node scripts/build-pages.mjs` and `node tests/pages-smoke.cjs`: production package/browser checks.

These checks validate mechanics; the initial balance values remain open to player feedback.

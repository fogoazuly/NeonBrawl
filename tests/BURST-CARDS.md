# Burst Rifle exclusive cards

- Tight Formation (uncommon, four picks): 20/30/40/50% less primary dispersion.
- Triple Impact (rare, three picks): the hit completing three distinct primary rounds of one burst on one target deals +50/80/110% damage. Targets and owners are isolated; extra projectiles and repeat hits do not complete the trio.
- Fresh Magazine (rare, three picks): after a reload completes, the next burst deals +25/40/55% damage, including Spread Pattern projectiles. Consumed once; switching weapon or starting a new run clears it. No free bonus on initial spawn.

Existing three-round firing timing, ammunition cost and general card bonuses are preserved. The host tracks Triple Impact from each guest's burst ID, round index and attack modifiers. Tracking is released with projectiles and cleared on run reset.

Validation:
- `node --test tests/*.test.mjs`: 69 passing tests, including distinct-round counting, target/owner isolation, bounds, cleanup and reload consumption.
- `node tests/burst-smoke.cjs`: card exclusivity/caps, reload completion and extra projectile damage, actual third-hit damage, pool cleanup and guest hits on host.
- Visual inspection: `test-results/burst-cards.png`.
- `node scripts/build-pages.mjs` and `node tests/pages-smoke.cjs`: production package/browser checks.

Balance values are initial values for player feedback; automated checks establish mechanics, not long-run balance.

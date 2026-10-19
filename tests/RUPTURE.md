# Shotgun Divine Ascension: Rupture

Eight blasts landing within 3m of a pellet's muzzle charge Rupture. Each blast
counts once, even with Lead Rain, generic spread, piercing, or multiple targets.
The next valid shot consumes the charge and adds a frontal shockwave: 10m range,
1.2-radian cone, 12 times the base pellet damage, 0.4s stagger before boss/elite
resistance. Walls block damage. Normal pellets retain all three exclusive cards;
the empowered blast and its wave cannot charge the next activation.

Works with normal and infinite ammo. Reload, ammo and firing cooldown gates still
apply. New runs clear charge. The host confirms guest hits; remote wave rendering
does not apply damage. Wave effects reuse the existing effect pool, resetting
geometry for ordinary shockwaves.

Checks:

- `node --test tests/*.test.mjs`: includes once-per-blast charge, threshold,
  consumption and reset.
- `node tests/rupture-smoke.cjs`: real pellet hits, far/special exclusions,
  actual firing with 22 pellets, forward cone, walls, visual-only safety,
  exclusive single-level card, guest charge feedback and host wave damage.
- `node tests/shotgun-smoke.cjs`: regression for the three shotgun cards.
- `node scripts/build-pages.mjs` and `node tests/pages-smoke.cjs`.

Visual artifacts: `test-results/rupture-card.png`, `test-results/rupture-wave.png`.

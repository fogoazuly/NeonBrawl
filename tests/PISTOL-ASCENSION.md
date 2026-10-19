# Pistol Divine Ascension — Neon Judgment

One-level, pistol-exclusive Divine Ascension card. Thirty confirmed primary
projectile hits fill the meter; piercing multiple enemies counts only once.
Completing a reload when ready grants `currentMagSize()` empowered trigger
pulls: double projectile damage and three additional pierces. Spread inherits
the same shot modifier, consuming only one empowered round per trigger.
Ricochet, Precise Shot and Last Word still stack with the effect.

Empowered projectiles and bonus projectiles cannot charge the meter. Reloading
early discards unspent empowered rounds. Infinite Reserve retains its ammo
benefit but has a finite empowered-round budget; reload is permitted at full
ammo when the ability is ready. The HUD is also a reload button for touch use.
Both new-run paths reset the meter. The host confirms guest projectile hits
through `PISTOL_CHARGE`; guest visuals do not award duplicate charge.

Validation:

- `node --test tests/*.test.mjs`: meter lifecycle, reload, finite magazine, reset,
  existing combat/save/network/server tests.
- `node tests/pistol-ascension-smoke.cjs`: real collision charge; no charge from
  spread or empowered shots; actual reload/fire loop; Last Word + spread damage
  and pierce; Infinite Reserve HUD activation; card cap/exclusivity; new-run reset;
  two-browser guest-to-host damage and host-to-guest hit confirmation.
- `node tests/pistol-smoke.cjs`: existing three pistol cards and co-op modifiers.
- `node scripts/build-pages.mjs`: static production build.

Screenshots (ignored test artifacts): `test-results/pistol-ascension-card.png`
and `test-results/pistol-ascension-hud.png`.

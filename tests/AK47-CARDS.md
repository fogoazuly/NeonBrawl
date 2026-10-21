# AK47 exclusive cards

- Recoil Control (uncommon, four picks): dispersion reduced by 15/25/35/45%.
- Sustained Fire (rare, three picks): each consecutive primary shot adds 2/3/4% damage, capped at ten increments (+20/30/40%). The first shot has normal damage. A firing gap of 0.7 seconds, reload, or weapon change resets the streak. Extra projectiles inherit the multiplier without adding stacks.
- Combat Reload (rare, three picks): an owned kill while holding AK47 grants a four-second window to start one reload with 20/30/40% less duration. Further kills refresh the window; bonuses do not stack. A reload already in progress is unchanged.

Cards are offered only with AK47 equipped. New runs reset all temporary state. In multiplayer the host credits kills and notifies the owning guest; transmitted bullet damage already includes Sustained Fire.

## Divine Ascension: Steel Storm

Fire 40 primary shots to prepare 12 empowered primary shots with double damage and +2 pierce. Extra projectiles inherit both bonuses and do not add charge or consume additional empowered shots. Sustained Fire multiplies with the ascension. Empowered shots never recharge the ability.

A reload preserves progress while the interval between shots stays below three gameplay seconds. A three-second firing gap, weapon switch, or new run clears charge and empowered shots. The HUD shows progress or remaining empowered shots; empowered fire adds a violet muzzle pulse. Existing FIRE messages carry final damage and pierce to the host and other players.

## Validation

- `node --test tests/*.test.mjs`: 67 passing tests, including spread bounds, burst reset/cap and reload consumption/expiry.
- `node tests/ak47-smoke.cjs`: browser checks for exclusive offers, pick caps, extra projectile scaling, actual kill/manual reload, guest kill ownership, Divine rarity/pick cap, empowered extra projectiles and transmitted damage/pierce.
- `node scripts/build-pages.mjs` followed by `node tests/pages-smoke.cjs`: production package and browser startup checks.

These checks cover mechanics and integration; extended player testing is still useful for balance.

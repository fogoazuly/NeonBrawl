# Overload objective

Enters the existing mini-objective event pool on non-boss waves from wave 8.
The category probability is unchanged. Three terminals use collision-safe
placement with at least four meters between centers.

- Remain within 1.8 meters for two continuous seconds to activate a terminal.
- Leaving before activation resets that terminal's activation progress.
- Once active, its 18-second countdown continues without nearby players.
- Any living player can activate a terminal. Multiple players do not accelerate
  the same terminal; they can activate separate terminals simultaneously.
- Additional enemy spawn interval is `2.4 / (1 + 0.5 * active terminals)`
  seconds, subject to the existing objective enemy cap.
- Amber means idle, red means charging, green means finished. HUD lists each
  terminal's activation percentage or remaining seconds.
- All three finished completes the objective and clears the enemy remainder.
  Pending objective spawn warnings cannot create enemies after completion or
  replacement of the objective.
- Host owns timers and activation. Guests receive positions, states and timers.

Validation:

`node --test tests/*.test.mjs`

`node tests/overload-smoke.cjs` (requires local server)

Browser test covers all-map placement, eligibility, overlapping countdowns,
completion, visual-only client authority and two-browser synchronization.
Ignored visual output: `test-results/overload.png`.

`node scripts/build-pages.mjs` and `node tests/pages-smoke.cjs` validate the
static build and browser startup.

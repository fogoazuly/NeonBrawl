# Neon Foundry

Reworks the existing `enc_foundry_lanes` normal arena in place, preserving its
map index and the existing random selection rules. Four industrial obstacles
leave a clear central corridor and routes around both heat strips.

Heat clock advances during combat, pauses outside combat, and resets on map
construction. Four seconds of entry grace precede the repeating cycle:

| Cycle time | Left strip | Right strip |
| --- | --- | --- |
| 0–2 seconds | Yellow warning | Off |
| 2–4 seconds | Red heat | Off |
| 4–6 seconds | Off | Off |
| 6–8 seconds | Off | Yellow warning |
| 8–10 seconds | Off | Red heat |
| 10–12 seconds | Off | Off |

Heat uses the existing hazard damage path: 6 base damage with a 0.55 second
per-player cooldown, subject to normal player defenses. Host owns damage and
sends the map clock with HOST_STATE; guests animate it locally between snapshots.
Intermissions disable heat damage and visuals.

Validation:

- `node --test tests/*.test.mjs`: includes phase boundaries, entry grace,
  periodicity, and no simultaneous burning across one simulated hour.
- `node tests/foundry-smoke.cjs` with local server: real browser damage during
  active heat only, full central corridor clearance, intermission safety,
  map reset, and two-browser host/guest clock synchronization.
- `node scripts/build-pages.mjs` and `node tests/pages-smoke.cjs`: static build
  and browser startup.

Screenshot: ignored `test-results/foundry-active.png`. Browser fixtures are
injected only into intercepted test responses and are never shipped.

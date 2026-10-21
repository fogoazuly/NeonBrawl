# Combined content run

Run `node tests/content-run.cjs` with `node server.mjs` running locally.
The browser is isolated and unauthenticated; test scores are not submitted to
an account leaderboard. Hooks exist only in intercepted test responses.

The test uses the standard `hard` difficulty, automatic controls and unlimited
revives, with real attacks, enemy AI, kills, reward selections, shops and wave
transitions. It advances 20 minutes of simulation in small steps and renders
between batches. The new maps alternate from wave 3, and Overload is forced on
waves 8 and 13; other random wave events are disabled for focused coverage.
No enemies are directly killed by the harness and waves are not skipped.

Coverage requires both new maps, the Rammer and Linker, Overload completion,
finite health, a live WebGL context, and no execution errors. Outputs are
ignored `test-results/content-run.json` and `test-results/content-run.png`.
The completion tracker retains the objective reference across updates because
wave completion disposes the active objective in the same frame.

This validates stability and functional progression. Unlimited revives and an
automated pilot cannot establish normal-player difficulty or long real-time
GPU stability on every device.

## Bug discovered

A Storm Call elemental reaction could kill and remove its target before the
outer Storm Call attempted to kill it again using an obsolete array index.
The stale index could be out of bounds (throwing an exception) or point at a
different, still-living enemy. The shared death handler now accepts an enemy
reference, ignores already-processed/missing targets, and attack callers keep
the target identity across reactions. Damage loops tolerate array contraction
from recursive kills.

`node tests/recursive-kills-smoke.cjs` reproduces Storm Call plus an ice
reaction and checks exactly one kill, survival of a neighboring enemy, and
harmless repeated/invalid death calls.

## Verified result

The confirmation run completed 1,200 simulated seconds, reached wave 19 and
recorded 809 kills, with both new arenas, both new enemy types and Overload
completion covered. No execution error or WebGL context loss was recorded.
The pilot used 48 automatic revives, so these results establish functional
progression and stability rather than normal-player balance.

The 62 unit tests, the focused recursive-kill browser regression and the
static Pages browser smoke test also passed.

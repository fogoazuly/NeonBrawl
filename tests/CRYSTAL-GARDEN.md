# Crystal Garden

New normal arena appended to the preset list to preserve previous map indices.
Uses the existing normal-map rotation (wave 3 onward).

Six violet crystal obstacles, each with 90 HP, form two rows around a clear
central corridor. Outer routes and gaps between crystals remain traversable.
Four small permanent rocks occupy the outer corners. There are no map hazards.

Crystals use the existing projectile/terrain damage system. Their destruction
removes collision, rebuilds navigation and uses the existing host broadcast.
Each crystal owns its tinted material; geometry and material are disposed on
destruction or map change. The octahedron geometry stays within the obstacle's
existing rectangular collision bounds. Damage also refreshes the static mesh
matrix so the existing damage deformation is rendered.

Validation:

- `node --test tests/*.test.mjs`
- `node tests/crystal-garden-smoke.cjs` with local server: full navigation graph
  connectivity before/after destruction, clear center, safe Overload terminals,
  actual projectile destruction, geometry disposal, reset, and synchronized
  host/guest removal.
- `node scripts/build-pages.mjs` and `node tests/pages-smoke.cjs`.

Ignored screenshot: `test-results/crystal-garden.png`.

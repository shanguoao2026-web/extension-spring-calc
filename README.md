# extension-spring-calc

A TypeScript CLI for body-only helical extension spring design checks. Requires Node 18 or newer. No runtime dependencies.

```sh
npm install
npm run build
node dist/cli.js --wire 2 --mean-dia 16 --active 10
node dist/cli.js --wire 2 --mean-dia 16 --active 10 --initial-tension 10 --deflection 20 --allow 800
node dist/cli.js --wire 2 --mean-dia 16 --active 10 --initial-tension 10 --force 50 --json
npm test
```

The package bin is `extension-spring-calc`, pointing to `dist/cli.js`. After building, `npm link` makes the command available locally. Use `--help` for all options. If network access is unavailable, install from a populated npm cache with `npm install --offline` (or add `--cache .npm-cache` for a project-local cache).

Wire diameter `d`, mean coil diameter `D`, and active coils `N` are required. All numeric inputs must be finite. Require `d > 0`, `D > d`, and `N > 0`. Shear modulus `G` defaults to 79300 MPa and must be positive; initial tension `Fi` defaults to 0 N and must be nonnegative. Optional allowable stress must be positive. Fractional active coil counts are supported.

Supply either nonnegative deflection or nonnegative force, or neither for rate-only output. Both together are an error. Table output is the default; `--json` emits full precision numbers. Errors go to stderr with exit 1. Warnings go to stderr with exit 0, including spring index outside 4–12 and force below initial tension. Below initial tension, reported deflection is clamped to zero and stress uses the requested force.

Calculations use mm, N, and MPa (= N/mm²):

- Rate: `k = G*d^4 / (8*D^3*N)` in N/mm.
- Spring index: `C = D/d`; Wahl factor: `K = (4*C-1)/(4*C-4) + 0.615/C`.
- Force: `F = Fi + k*x`; deflection: `x = max(0, (F-Fi)/k)`.
- Shear stress: `tau = K*8*F*D / (pi*d^3)` in MPa; initial-tension stress uses `Fi` in the same formula.
- Approximate closed body length: `(N+1)*d` mm.
- Safety factor: allowable stress divided by loaded shear stress.

For the examples above, rate is 3.8721 N/mm, index 8, Wahl factor 1.18402, and closed body length 22.00 mm. At initial tension 10 N and deflection 20 mm, force is 87.441 N, stress 527.29 MPa, and safety factor at 800 MPa allowable is 1.517. At force 50 N, deflection is 10.330 mm and stress 301.51 MPa.

JSON fields are `rate`, `springIndex`, `wahlFactor`, `closedBodyLength`, and `initialTensionStress`; loaded calculations add `force`, `deflection`, and `shearStress`. `safetyFactor` appears only when both a load and `--allow` are supplied. At zero stress its value is `null` in JSON and `Infinity` in the table. In rate-only mode `--allow` has no effect.

These are simplified linear elastic, close-coiled spring body calculations. Hook stresses are ignored. Closed body length excludes hooks and end geometry. The model does not assess fatigue, residual stresses, manufacturing tolerances, material limits, or large-deflection effects; initial tension is a supplied value rather than predicted from manufacture.

MIT licensed; see LICENSE.

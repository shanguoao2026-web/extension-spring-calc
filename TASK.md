# extension-spring-calc

Build a small TypeScript Node CLI (Node 18+, no runtime deps; devDeps typescript + @types/node only; tests with node:test) for helical extension spring design checks.

Inputs: --wire d (mm, required, >0), --mean-dia D (mm, required, > d), --active N (active coils, required, >0), --shear-modulus G (MPa, default 79300), --initial-tension Fi (N, default 0, >=0), exactly one of --deflection x (mm, >=0) or --force F (N, >=0) (optional; neither → rate only; both → error), --allow S (MPa, optional allowable shear stress, prints safety factor S/τ), --json, --help.
Formulas (body only; hook stresses ignored, state this in README):
- Rate k = G·d⁴ / (8·D³·N) N/mm. Spring index C = D/d. Wahl factor K = (4C−1)/(4C−4) + 0.615/C.
- Force from deflection: F = Fi + k·x. Deflection from force: x = (F − Fi)/k; if F < Fi, deflection is 0 with a stderr warning (exit 0).
- Shear stress τ = K·8·F·D/(π·d³) MPa; also report initial-tension stress τi with the same formula using Fi.
- Body length closed ≈ (N+1)·d mm.
- Validate finite numbers; errors to stderr with exit 1. Warn (stderr, exit 0) if C < 4 or C > 12.
- Table output by default, README with examples and the simplifications, MIT LICENSE (author shanguoao2026-web), .gitignore with node_modules/ dist/ *.log .npm-cache/.
- package.json "bin" must point to the built CLI. npm test must build and pass. No secrets, no personal info.

Check values (must be in tests):
- d2 D16 N10 G79300 → k 3.8721 N/mm, C 8, K 1.18402, closed body length 22.00 mm.
- + Fi 10 deflection 20 → F 87.441 N, τ 527.29 MPa.
- + Fi 10 force 50 → x 10.330 mm, τ 301.51 MPa.
- + Fi 10 deflection 20 allow 800 → safety factor 1.517.
- d 16 with D 16 → exit 1; active 0 → exit 1; force and deflection together → exit 1.

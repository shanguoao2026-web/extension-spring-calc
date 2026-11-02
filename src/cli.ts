#!/usr/bin/env node

import { pathToFileURL } from 'node:url';

const help = `Usage: extension-spring-calc --wire d --mean-dia D --active N [options]

Body-only helical extension spring checks (hook stresses ignored).
  --wire d             Wire diameter (mm), required, > 0
  --mean-dia D         Mean coil diameter (mm), required, > d
  --active N           Active coils, required, > 0
  --shear-modulus G    Shear modulus (MPa), > 0, default 79300
  --initial-tension Fi Initial tension (N), >= 0, default 0
  --deflection x       Deflection (mm), >= 0; exclusive with --force
  --force F            Force (N), >= 0; exclusive with --deflection
  --allow S            Allowable shear stress (MPa), > 0
  --json               Output JSON
  --help               Show this help

Omit --force and --deflection for rate-only output.
Warnings go to stderr; input errors exit with status 1.`;

const numeric = new Set(['wire', 'mean-dia', 'active', 'shear-modulus', 'initial-tension', 'deflection', 'force', 'allow']);

export function main(args: string[]): void {
  const values = new Map<string, number>();
  const seen = new Set<string>();
  let json = false;
  let showHelp = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg.startsWith('--')) throw new Error(`Unexpected argument: ${arg}`);
    const name = arg.slice(2);
    if (!numeric.has(name) && name !== 'json' && name !== 'help') throw new Error(`Unknown option: ${arg}`);
    if (seen.has(name)) throw new Error(`Duplicate option: ${arg}`);
    seen.add(name);
    if (name === 'json') { json = true; continue; }
    if (name === 'help') { showHelp = true; continue; }
    const raw = args[++i];
    if (raw === undefined || raw.trim() === '' || raw.startsWith('--')) throw new Error(`Missing value for ${arg}`);
    const value = Number(raw);
    if (!Number.isFinite(value)) throw new Error(`${arg} must be a finite number`);
    values.set(name, value);
  }
  if (showHelp) { console.log(help); return; }
  for (const name of ['wire', 'mean-dia', 'active']) {
    if (!values.has(name)) throw new Error(`Missing required option --${name}`);
  }
  const d = values.get('wire')!;
  const D = values.get('mean-dia')!;
  const N = values.get('active')!;
  const G = values.get('shear-modulus') ?? 79300;
  const Fi = values.get('initial-tension') ?? 0;
  for (const [name, value] of [['wire', d], ['active', N], ['shear-modulus', G], ['allow', values.get('allow')]] as const) {
    if (value !== undefined && value <= 0) throw new Error(`--${name} must be > 0`);
  }
  if (D <= d) throw new Error('--mean-dia must be greater than --wire');
  for (const name of ['initial-tension', 'deflection', 'force']) {
    if ((values.get(name) ?? 0) < 0) throw new Error(`--${name} must be >= 0`);
  }
  if (values.has('force') && values.has('deflection')) throw new Error('--force and --deflection are mutually exclusive');

  const C = D / d;
  const K = (4 * C - 1) / (4 * C - 4) + 0.615 / C;
  const k = G * d ** 4 / (8 * D ** 3 * N);
  if (!Number.isFinite(k) || k <= 0) throw new Error('Calculated spring rate is outside the supported numeric range');
  const stress = (force: number): number => K * 8 * force * D / (Math.PI * d ** 3);
  const result: Record<string, number> = {
    rate: k, springIndex: C, wahlFactor: K,
    closedBodyLength: (N + 1) * d, initialTensionStress: stress(Fi),
  };
  const warnings: string[] = [];
  if (C < 4 || C > 12) warnings.push('Spring index is outside the recommended range 4–12.');
  if (values.has('deflection')) {
    result.deflection = values.get('deflection')!;
    result.force = Fi + k * result.deflection;
  } else if (values.has('force')) {
    result.force = values.get('force')!;
    result.deflection = Math.max(0, (result.force - Fi) / k);
    if (result.force < Fi) warnings.push('Force is below initial tension; deflection is 0.');
  }
  if (result.force !== undefined) {
    result.shearStress = stress(result.force);
    if (values.has('allow')) result.safetyFactor = values.get('allow')! / result.shearStress;
  }
  for (const [name, value] of Object.entries(result)) {
    if (!Number.isFinite(value) && !(name === 'safetyFactor' && value === Infinity)) throw new Error(`Calculated ${name} is outside the supported numeric range`);
  }
  for (const warning of warnings) console.error(`Warning: ${warning}`);
  if (json) {
    // JSON cannot represent infinity; use null for an unbounded safety factor at zero load.
    console.log(JSON.stringify(result, null, 2));
  } else {
    const rows: [string, string][] = [
      ['Spring rate', `${k.toFixed(4)} N/mm`], ['Spring index', C.toFixed(3)],
      ['Wahl factor', K.toFixed(5)], ['Closed body length', `${result.closedBodyLength.toFixed(2)} mm`],
      ['Initial-tension stress', `${result.initialTensionStress.toFixed(2)} MPa`],
    ];
    if (result.force !== undefined) rows.push(['Force', `${result.force.toFixed(3)} N`], ['Deflection', `${result.deflection.toFixed(3)} mm`], ['Shear stress', `${result.shearStress.toFixed(2)} MPa`]);
    if (result.safetyFactor !== undefined) rows.push(['Safety factor', result.safetyFactor.toFixed(3)]);
    console.log(rows.map(([label, value]) => `${label.padEnd(25)} | ${value}`).join('\n'));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
try { main(process.argv.slice(2)); }
catch (error) { console.error(`Error: ${error instanceof Error ? error.message : String(error)}`); process.exitCode = 1; }

}

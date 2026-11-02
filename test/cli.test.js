import { test } from 'node:test';
import assert from 'node:assert/strict';
import { main } from '../dist/cli.js';

const base = ['--wire', '2', '--mean-dia', '16', '--active', '10'];
function run(args = [], defaults = base) {
  let stdout = '', stderr = '', status = 0;
  const log = console.log, error = console.error;
  console.log = (message) => { stdout += String(message) + '\n'; };
  console.error = (message) => { stderr += String(message) + '\n'; };
  try { main([...defaults, ...args]); }
  catch (e) { status = 1; stderr += `Error: ${e.message}\n`; }
  finally { console.log = log; console.error = error; }
  return { stdout, stderr, status };
}
function result(args = []) {
  const p = run([...args, '--json']);
  assert.equal(p.status, 0, p.stderr);
  return JSON.parse(p.stdout);
}
function near(actual, expected, tolerance) { assert.ok(Math.abs(actual - expected) < tolerance, `${actual} ≈ ${expected}`); }

test('reference geometry and rate only', () => {
  const r = result();
  near(r.rate, 3.8721, 0.00005);
  assert.equal(r.springIndex, 8);
  near(r.wahlFactor, 1.18402, 0.000005);
  assert.equal(r.closedBodyLength, 22);
  assert.equal(r.initialTensionStress, 0);
  assert.equal(r.force, undefined);
  assert.match(run().stdout, /22\.00 mm/);
});
test('deflection, initial stress and allowable stress', () => {
  const r = result(['--initial-tension', '10', '--deflection', '20', '--allow', '800']);
  near(r.force, 87.441, 0.0005);
  near(r.shearStress, 527.29, 0.005);
  near(r.initialTensionStress, 60.30, 0.005);
  near(r.safetyFactor, 1.517, 0.0005);
});
test('force to deflection', () => {
  const r = result(['--initial-tension', '10', '--force', '50']);
  near(r.deflection, 10.330, 0.0005);
  near(r.shearStress, 301.51, 0.005);
});
test('force below initial tension warns and clamps deflection', () => {
  const p = run(['--initial-tension', '10', '--force', '5', '--json']);
  assert.equal(p.status, 0);
  assert.match(p.stderr, /Warning:.*below initial tension/);
  assert.equal(JSON.parse(p.stdout).deflection, 0);
  near(JSON.parse(p.stdout).shearStress, 30.151, 0.001);
});
test('index warning boundaries', () => {
  for (const D of [6, 26]) {
    const p = run([], ['--wire', '2', '--mean-dia', String(D), '--active', '10']);
    assert.equal(p.status, 0);
    assert.match(p.stderr, /Warning:.*index/);
  }
  for (const D of [8, 24]) assert.equal(run([], ['--wire', '2', '--mean-dia', String(D), '--active', '10']).stderr, '');
});
test('reject invalid inputs with stderr and exit 1', () => {
  const cases = [
    ['--wire', '16', '--mean-dia', '16', '--active', '10'],
    ['--wire', '2', '--mean-dia', '16', '--active', '0'],
    [...base, '--force', '1', '--deflection', '1'], [],
    [...base, '--force', 'NaN'], [...base, '--force', 'Infinity'],
    [...base, '--force', '-1'], [...base, '--initial-tension', '-1'],
    [...base, '--shear-modulus', '0'], [...base, '--allow', '0'],
    [...base, '--deflection', '-1'], [...base, '--force'],
    [...base, '--unknown'], [...base, '--wire', '2'], [...base, 'extra'],
    ['--wire', '-2', '--mean-dia', '16', '--active', '10'],
  ];
  for (const args of cases) {
    const p = run([], args);
    assert.equal(p.status, 1, args.join(' '));
    assert.match(p.stderr, /Error:/);
    assert.equal(p.stdout, '');
  }
});
test('help does not require geometry', () => {
  const p = run(['--help'], []);
  assert.equal(p.status, 0);
  assert.match(p.stdout, /Usage:/);
});
test('zero load has zero stress and unbounded safety factor', () => {
  const r = result(['--force', '0', '--allow', '800']);
  assert.equal(r.shearStress, 0);
  assert.equal(r.safetyFactor, null);
  assert.match(run(['--force', '0', '--allow', '800']).stdout, /Infinity/);
});
test('custom modulus changes rate proportionally', () => {
  near(result(['--shear-modulus', '39650']).rate, result().rate / 2, 1e-12);
});

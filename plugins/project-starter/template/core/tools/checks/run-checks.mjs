#!/usr/bin/env node
/**
 * Runs the checks a card must pass before its pull request is opened and before it is merged
 * (docs/testing.md §4): the commands in .project/config.json → delivery.checks, in order, from the
 * project root, stopping at the first failure; then, when delivery.coverage is set, the minimum line
 * coverage read from the Cobertura reports written during this run.
 *
 *   node tools/checks/run-checks.mjs          run them; exit 1 if one fails, 2 if the config is wrong
 *   node tools/checks/run-checks.mjs --list   print the checks without running them
 *
 * Node 18+, no packages.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CONFIG = join(ROOT, '.project', 'config.json');
const bad = (msg) => { console.log(`✕ ${msg}`); process.exit(2); };

let config;
try { config = JSON.parse(readFileSync(CONFIG, 'utf8')); } catch (e) { bad(`cannot read .project/config.json: ${e.message}`); }
const delivery = config?.delivery;
if (!delivery || !Array.isArray(delivery.checks) || !delivery.checks.length || !delivery.checks.every((c) => typeof c === 'string' && c.trim())) {
  bad('.project/config.json has no delivery.checks (a non-empty list of commands). See docs/conventions.md §2.');
}
const cov = delivery.coverage ?? null;
if (cov !== null && !(Number.isFinite(cov.min) && cov.min > 0 && cov.min <= 100)) bad('delivery.coverage.min must be a percent from 1 to 100, or delivery.coverage null.');

if (process.argv.includes('--list')) {
  delivery.checks.forEach((c, i) => console.log(`${i + 1}. ${c}`));
  if (cov) console.log(`coverage: at least ${cov.min}% (${cov.file ?? 'coverage.cobertura.xml'} under ${cov.report ?? 'not set'})`);
  process.exit(0);
}

// Coverage reports that exist before the run, with their times: only a report written by this run counts.
const findReports = () => {
  const found = new Map();
  if (!cov?.report) return found;
  const file = cov.file ?? 'coverage.cobertura.xml';
  const walk = (dir) => {
    if (!existsSync(dir)) return;
    for (const n of readdirSync(dir)) {
      const full = join(dir, n);
      const st = statSync(full);
      if (st.isDirectory()) walk(full);
      else if (n === file) found.set(full, st.mtimeMs);
    }
  };
  walk(join(ROOT, cov.report));
  return found;
};
const before = findReports();
const started = Date.now();
const secs = (t) => `${((Date.now() - t) / 1000).toFixed(1)}s`;
const tail = (text, n = 40) => text.trimEnd().split('\n').slice(-n).map((l) => `    ${l}`).join('\n');

for (const command of delivery.checks) {
  const t = Date.now();
  const r = spawnSync(command, { cwd: ROOT, shell: true, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  if (r.status === 0) { console.log(`PASS  ${command}  (${secs(t)})`); continue; }
  console.log(`FAIL  ${command}  (${r.error ? r.error.message : `exit ${r.status}`}, ${secs(t)})`);
  const out = `${r.stdout ?? ''}${r.stderr ?? ''}`;
  if (out.trim()) console.log(tail(out));
  console.log('\nChecks failed: fix the failure and run again; a failing check is never skipped.');
  process.exit(1);
}

if (cov) {
  const file = cov.file ?? 'coverage.cobertura.xml';
  if (!cov.report) {
    console.log(`FAIL  coverage  (delivery.coverage.min is ${cov.min}% but delivery.coverage.report is not set: name the folder the test check writes ${file} to)`);
    process.exit(1);
  }
  // Only reports written during this run count: an old report says nothing about this code.
  const found = [...findReports()].filter(([f, t]) => !before.has(f) || t !== before.get(f)).map(([f]) => f);
  if (!found.length) {
    console.log(`FAIL  coverage  (no ${file} written under ${cov.report} during this run: the test check must collect coverage, see docs/testing.md §4; for .NET the test project needs the coverlet.collector package)`);
    process.exit(1);
  }
  // Several reports (one per test project) often instrument the same code: merge them line by line, so a line
  // covered by any report counts once, instead of adding up each report's totals. A file is named by its path
  // under the report's <source> root, so two roots holding the same relative name stay two files.
  const failCov = (why) => { console.log(`FAIL  coverage  (${why})`); process.exit(1); };
  const reports = found.map((f) => {
    const xml = readFileSync(f, 'utf8');
    const sources = [...xml.matchAll(/<source>([^<]*)<\/source>/g)].map((m) => m[1].trim().replace(/\\/g, '/').replace(/\/+$/, ''));
    const fileKey = (name) => {
      const n = name.replace(/\\/g, '/');
      if (/^([a-zA-Z]:)?\//.test(n) || !sources.length) return n;
      return sources.length === 1 ? `${sources[0]}/${n}` : `${sources.join('|')}::${n}`;
    };
    const lines = new Map();
    for (const cls of xml.matchAll(/<class\b[^>]*\bfilename="([^"]*)"[^>]*>([\s\S]*?)<\/class>/g)) {
      for (const [tag] of cls[2].matchAll(/<line\b[^>]*>/g)) {
        const number = tag.match(/\bnumber="(\d+)"/)?.[1];
        const hits = tag.match(/\bhits="(\d+)"/)?.[1];
        if (number === undefined || hits === undefined) continue;
        const key = `${fileKey(cls[1])}:${number}`;
        lines.set(key, lines.get(key) || Number(hits) > 0);
      }
    }
    const attr = (a) => xml.match(new RegExp(`<coverage\\b[^>]*\\b${a}="([\\d.]+)"`))?.[1];
    const covered = attr('lines-covered'), valid = attr('lines-valid'), rate = attr('line-rate');
    return { f, lines, covered: covered === undefined ? null : Number(covered), valid: valid === undefined ? null : Number(valid), rate: rate === undefined ? null : Number(rate) };
  });
  const withLines = reports.filter((r) => r.lines.size);
  let pct;
  if (withLines.length === reports.length) {
    const all = new Map();
    for (const r of reports) for (const [k, v] of r.lines) all.set(k, all.get(k) || v);
    pct = ([...all.values()].filter(Boolean).length / all.size) * 100;
  } else if (withLines.length) {
    // A report without lines cannot be merged with the others: leaving it out could pass code it says is untested.
    failCov(`${relative(ROOT, reports.find((r) => !r.lines.size).f)} has no line elements, so it cannot be merged with the other reports: write every report with lines (Cobertura with line detail)`);
  } else if (reports.every((r) => r.covered !== null && r.valid)) {
    // Totals only: add the counts (each report weighs by its size). Overlap between reports cannot be seen here.
    pct = (reports.reduce((a, r) => a + r.covered, 0) / reports.reduce((a, r) => a + r.valid, 0)) * 100;
  } else if (reports.length === 1 && reports[0].rate !== null) {
    pct = reports[0].rate * 100;
  } else {
    failCov(`${reports.length} report(s) found but they have neither line elements nor lines-covered and lines-valid to add up: is it Cobertura XML?`);
  }
  const ok = pct >= cov.min;
  console.log(`${ok ? 'PASS' : 'FAIL'}  coverage ${pct.toFixed(1)}% (minimum ${cov.min}%, ${found.length} report${found.length > 1 ? 's' : ''})`);
  if (!ok) { console.log('\nChecks failed: add tests for the rules that are not covered (docs/testing.md §2).'); process.exit(1); }
}

console.log(`\nAll checks passed (${secs(started)}).`);

#!/usr/bin/env node
/**
 * Updates the kit's tools in a project made with devflow (tools/board, tools/checks, tools/review) to this
 * version of the kit. Never touches cards, docs, CLAUDE.md, README.md or .project/config.json.
 *
 *   node update.mjs [--target <project dir>]                    dry run: what would change
 *   node update.mjs --apply [--include a,b | --all]             write it
 *
 * Each kit file is one of:
 *   add      missing in the project                              written by --apply
 *   update   unchanged since the kit wrote it (per kit.json)     written by --apply
 *   current  already the same as this kit                       nothing to do
 *   changed  edited in the project since the kit wrote it       written only with --include <path> or --all
 *   unknown  no record (project made before 0.5.2)              written only with --include <path> or --all
 * Files the project added under tools/ are left alone. .project/kit.json records the version and the hashes.
 * Node 18+, no packages.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve, extname } from 'node:path';
import { KIT_VERSION, KIT_FILE, hashOf, kitTools, kitRecord } from './kit-tools.mjs';

const argv = process.argv.slice(2);
const valueOf = (name) => { const i = argv.indexOf(`--${name}`); return i === -1 ? undefined : argv[i + 1]; };
for (let i = 0; i < argv.length; i++) {
  if (['--target', '--include'].includes(argv[i])) { i++; continue; }
  if (!['--apply', '--all'].includes(argv[i])) { console.error(`✕ Unknown argument "${argv[i]}". Options: --target <dir> --apply --include a,b --all`); process.exit(1); }
}
const target = resolve(valueOf('target') ?? '.');
const apply = argv.includes('--apply');
const all = argv.includes('--all');
const include = new Set((valueOf('include') ?? '').split(',').map((s) => s.trim().replace(/\\/g, '/')).filter(Boolean));

if (!existsSync(join(target, '.project', 'config.json'))) {
  console.error(`✕ ${join(target, '.project', 'config.json')} not found: run this from a project made with the kit (or pass --target).`);
  process.exit(1);
}

const recordFile = join(target, KIT_FILE);
let record = { version: null, files: {} };
if (existsSync(recordFile)) {
  try { record = { version: null, files: {}, ...JSON.parse(readFileSync(recordFile, 'utf8')) }; } catch (e) {
    console.error(`✕ ${KIT_FILE} is not valid JSON (${e.message}). Fix or delete it (then every file counts as unknown), and run again.`);
    process.exit(1);
  }
}

const kit = kitTools();
for (const p of include) if (!kit.has(p)) { console.error(`✕ --include ${p}: not a kit file. Kit files: ${[...kit.keys()].join(', ')}`); process.exit(1); }

const rows = [];
for (const [rel, src] of kit) {
  const kitBuf = readFileSync(src);
  const kitHash = hashOf(kitBuf);
  const dest = join(target, rel);
  let state;
  if (!existsSync(dest)) state = 'add';
  else {
    const own = hashOf(readFileSync(dest));
    if (own === kitHash) state = 'current';
    else if (!record.files[rel]) state = 'unknown';
    else state = record.files[rel] === own ? 'update' : 'changed';
  }
  const write = state === 'add' || state === 'update' || ((state === 'changed' || state === 'unknown') && (all || include.has(rel)));
  rows.push({ rel, state, write, kitBuf, kitHash });
}

const from = record.version ?? 'not recorded';
console.log(`devflow tools: project ${from} → kit ${KIT_VERSION}${apply ? '' : ' (dry run)'}`);
for (const r of rows) console.log(`  ${r.state.padEnd(8)} ${r.rel}${r.state !== 'current' && !r.write ? '  (kept: --include it or --all to replace)' : ''}`);
const toWrite = rows.filter((r) => r.write);
const held = rows.filter((r) => !r.write && (r.state === 'changed' || r.state === 'unknown'));

if (!apply) {
  console.log(toWrite.length || held.length
    ? `\n${toWrite.length} to write with --apply${held.length ? `; ${held.length} kept unless included (changed: edited in the project; unknown: no record, project made before the kit recorded hashes)` : ''}.`
    : '\nEverything is current.');
  process.exit(0);
}

for (const r of toWrite) {
  const dest = join(target, r.rel);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, r.kitBuf, extname(r.rel) === '.sh' ? { mode: 0o755 } : undefined);
}
// The record keeps, per file, the hash of what the kit wrote: the new one where the file now matches the kit,
// the old one where an edited file was kept (so it stays "changed" next time).
const files = {};
for (const r of rows) {
  if (r.write || r.state === 'current') files[r.rel] = r.kitHash;
  else if (record.files[r.rel]) files[r.rel] = record.files[r.rel];
}
writeFileSync(recordFile, kitRecord(files));
console.log(`\n✔ wrote ${toWrite.length} file${toWrite.length === 1 ? '' : 's'} and ${KIT_FILE} (version ${KIT_VERSION})${held.length ? `; kept ${held.length}: ${held.map((r) => r.rel).join(', ')}` : ''}.`);

#!/usr/bin/env node
// How much of Codex's usage limits is left, from the last figures Codex wrote in its session files.
//   node tools/review/usage.mjs
// Rule: send a batch only when what is left of BOTH limits is above its estimated use
// (a small batch about 5-15%, a normal one 15-25%); otherwise wait for the reset.
import { readdirSync, statSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const root = join(homedir(), '.codex', 'sessions');
if (!existsSync(root)) { console.log('No Codex session files found.'); process.exit(0); }

const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full);
    else if (/^rollout-.*\.jsonl$/.test(name)) files.push({ full, mtime: st.mtimeMs });
  }
})(root);
files.sort((a, b) => b.mtime - a.mtime);

// The last rate_limits block of the codex limit inside one session line.
function find(node) {
  let found = null;
  if (Array.isArray(node)) for (const v of node) found = find(v) ?? found;
  else if (node && typeof node === 'object') {
    if (node.limit_id === 'codex' && 'primary' in node) found = node;
    for (const v of Object.values(node)) found = find(v) ?? found;
  }
  return found;
}

let last = null;
for (const f of files.slice(0, 20)) {
  for (const line of readFileSync(f.full, 'utf8').split('\n')) {
    if (!line.includes('"limit_id":"codex"')) continue;
    try { last = find(JSON.parse(line)) ?? last; } catch { /* partial line */ }
  }
  if (last) break;
}
if (!last) { console.log('No Codex usage figures found.'); process.exit(0); }

const now = Date.now() / 1000;
const fmt = (t) => new Date(t * 1000).toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' });
let lowest = null;
for (const [name, key] of [['5-hour', 'primary'], ['weekly', 'secondary']]) {
  const w = last[key] ?? {};
  let used = w.used_percent;
  const reset = w.resets_at;
  if (used == null) continue;
  if (reset && reset <= now) used = 0; // the window has reset since these figures
  const when = reset && reset > now ? fmt(reset) : 'already reset';
  console.log(`${name.padEnd(7)} used ${used.toFixed(1).padStart(5)}%  left ${(100 - used).toFixed(1).padStart(5)}%  resets ${when}`);
  if (!lowest || 100 - used < lowest.left) lowest = { name, left: 100 - used, when };
}
if (lowest) console.log(`  -> a batch goes only if its estimated use is under ${Math.round(lowest.left)}% (${lowest.name}): small batch about 5-15%, normal 15-25%. Otherwise wait for the reset at ${lowest.when}.`);

#!/usr/bin/env node
/**
 * Creates a new project from the project-starter template. Never overwrites a file
 * that already exists: it skips it and says so.
 *
 *   node scaffold.mjs --target <dir> --name "Project name" [--code-name ProjectName]
 *        [--summary "One paragraph"] [--lang en|ar-eg] [--preset none|dotnet]
 *        [--modules client,regulated,migration,design-first,offline-deploy]
 *        [--reviewer codex|opencode|agents|none] [--model <opencode model>]
 *        [--host github|gitea|azure|local|none] [--merge squash|merge|rebase] [--coverage <min %>|none]
 *        (none = not chosen / no minimum, even when the defaults file sets one)
 *        [--no-git] [--dry-run]
 *
 * Defaults come from ~/.claude/project-starter.json ({ "defaultReplyLanguage", "defaultPreset",
 * "defaultReviewer", "defaultReviewerModel", "defaultModules", "defaultHost", "defaultMerge", "defaultCoverage" }).
 * Node 18+, no packages.
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname, relative, resolve, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { execFileSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const TEMPLATE = join(HERE, '..', 'template');

// ─── Arguments and defaults ──────────────────────────────────────────────────

const VALUED = ['target', 'name', 'code-name', 'summary', 'lang', 'preset', 'modules', 'reviewer', 'model', 'host', 'merge', 'coverage'];
const FLAGS = ['no-git', 'dry-run'];
const fail = (msg) => { console.error(`✕ ${msg}`); process.exit(1); };

const argv = process.argv.slice(2);
const args = {};
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  const key = a.startsWith('--') ? a.slice(2) : null;
  if (key && FLAGS.includes(key)) { args[key] = true; continue; }
  if (key && VALUED.includes(key)) {
    const v = argv[i + 1];
    if (v === undefined || v.startsWith('--')) fail(`--${key} needs a value.`);
    args[key] = v;
    i++;
    continue;
  }
  fail(`Unknown argument "${a}". Options: ${[...VALUED, ...FLAGS].map((x) => `--${x}`).join(' ')}`);
}
const opt = (name) => args[name];
const flag = (name) => args[name] === true;

const globalFile = join(homedir(), '.claude', 'project-starter.json');
const defaults = existsSync(globalFile) ? JSON.parse(readFileSync(globalFile, 'utf8')) : {};

const target = resolve(opt('target') ?? '.');
const name = opt('name') ?? basename(target);
// The name used in code (solution, projects, namespaces): "Task API" → "TaskApi". Without ASCII letters it cannot be
// guessed, so {{CODE_NAME}} is left in the files for Claude to fill.
const CODE_NAME_RE = /^[A-Za-z][A-Za-z0-9]*(\.[A-Za-z][A-Za-z0-9]*)*$/;
const guessCodeName = (s) => {
  const joined = (s.match(/[A-Za-z0-9]+/g) ?? [])
    .map((w) => (w.length > 2 && w === w.toUpperCase() ? w[0] + w.slice(1).toLowerCase() : w[0].toUpperCase() + w.slice(1)))
    .join('');
  return CODE_NAME_RE.test(joined) ? joined : null;
};
const codeName = opt('code-name') ?? guessCodeName(name);
const summary = opt('summary');
const lang = opt('lang') ?? defaults.defaultReplyLanguage ?? 'en';
const preset = opt('preset') ?? defaults.defaultPreset ?? 'none';
const modules = [...new Set((opt('modules') ?? (defaults.defaultModules ?? []).join(',')).split(',').map((m) => m.trim()).filter(Boolean))];
const reviewer = opt('reviewer') ?? defaults.defaultReviewer ?? 'codex';
const model = opt('model') ?? defaults.defaultReviewerModel;
// Delivery: where pull requests live (null = not chosen yet, card ENV-02), how they merge, and the coverage floor.
// "none" on the command line means "not chosen" or "no minimum" and overrides the defaults file.
const host = opt('host') === 'none' ? null : opt('host') ?? defaults.defaultHost ?? null;
const merge = opt('merge') ?? defaults.defaultMerge ?? 'squash';
// In the defaults file, 0, false or "" also mean "no minimum"; on the command line a value must be a percent.
const coverageArg = opt('coverage') === 'none' ? null : opt('coverage') ?? ([0, false, ''].includes(defaults.defaultCoverage) ? null : defaults.defaultCoverage ?? null);
const coverageMin = coverageArg === null ? null : Number(coverageArg);
const dryRun = flag('dry-run');
const today = new Date().toISOString().slice(0, 10);

// Phase numbers, gates and the config are computed together, so a second run that adds a module would leave
// new cards pointing at old phase numbers. Re-running on a kit project is refused; change it by hand instead.
if (existsSync(join(target, '.project', 'config.json'))) {
  fail(`${target} is already a project made with the kit (.project/config.json exists). Add a module by hand: copy its files, add it to the config, and renumber docs/plan.md and _phases.md together.`);
}
if (codeName !== null && !CODE_NAME_RE.test(codeName)) fail(`--code-name "${codeName}" must start with a letter and hold only letters and digits, with dots between parts (TaskApi, Contoso.Orders).`);
if (!['en', 'ar-eg'].includes(lang)) fail(`Unknown language "${lang}" (en | ar-eg).`);
if (!['codex', 'opencode', 'agents', 'none'].includes(reviewer)) fail(`Unknown reviewer "${reviewer}".`);
if (host !== null && !['github', 'gitea', 'azure', 'local'].includes(host)) fail(`Unknown host "${host}" (github | gitea | azure | local | none).`);
if (!['squash', 'merge', 'rebase'].includes(merge)) fail(`Unknown merge style "${merge}" (squash | merge | rebase).`);
if (coverageMin !== null && !(Number.isInteger(coverageMin) && coverageMin >= 1 && coverageMin <= 100)) fail(`${opt('coverage') !== undefined ? '--coverage' : `defaultCoverage in ${globalFile}`} needs a whole percent from 1 to 100 (or none), not "${coverageArg}".`);
if (preset !== 'none' && !existsSync(join(TEMPLATE, 'presets', preset, 'preset.json'))) fail(`Unknown preset "${preset}".`);
for (const m of modules) if (!existsSync(join(TEMPLATE, 'modules', m, 'module.json'))) fail(`Unknown module "${m}".`);

// {{CODE_NAME}} in a preset or module is filled here, since fill() does not expand placeholders inside values.
const readJson = (f) => JSON.parse(readFileSync(f, 'utf8').replaceAll('{{CODE_NAME}}', codeName ?? '{{CODE_NAME}}'));
const presetDef = preset === 'none' ? null : readJson(join(TEMPLATE, 'presets', preset, 'preset.json'));
const moduleDefs = modules.map((m) => ({ key: m, ...readJson(join(TEMPLATE, 'modules', m, 'module.json')) }));

// ─── Delivery: checks before a pull request and before merge ─────────────────

const BOARD_CHECK = 'node tools/board/build-board.mjs --check';
const presetCov = presetDef?.coverage;
let checks = [...(presetDef?.checks ?? []), BOARD_CHECK];
// With a coverage floor, the preset's test check is swapped for the one that writes a coverage report.
if (coverageMin !== null && presetCov) checks = checks.map((c) => (c === presetCov.replaces ? presetCov.command : c));
const delivery = {
  host,
  merge,
  checks,
  coverage: coverageMin === null ? null : { min: coverageMin, report: presetCov?.report ?? null, file: presetCov?.file ?? 'coverage.cobertura.xml' },
};
const code = (s) => '`' + s + '`';

// ─── Phases ──────────────────────────────────────────────────────────────────

const phases = [
  { key: 'setup', title: 'Setup', goal: 'Repository, board and development environment ready.' },
  { key: 'architecture', title: 'Architecture', goal: 'Main design choices recorded as ADRs and architecture notes; the supervisor approves them.' },
  { key: 'build', title: 'Build', goal: 'Requirements implemented module by module; each card closed with tests, review and the supervisor\'s approval.' },
  { key: 'release', title: 'Release', goal: 'A tagged release installed where it will be used; CHANGELOG and docs up to date.' },
];
for (const m of moduleDefs) {
  for (const p of m.phases ?? []) {
    const at = phases.findIndex((x) => x.key === p.after);
    phases.splice(at === -1 ? phases.length : at + 1, 0, { key: p.key, title: p.title, goal: p.goal });
  }
}
for (const m of moduleDefs) {
  for (const [key, card] of Object.entries(m.gates ?? {})) {
    const p = phases.find((x) => x.key === key);
    if (p) (p.gates ??= []).push(card);
  }
}
phases.forEach((p, i) => { p.n = i; });

const phasesFile = `---
title: Phases
---

The phases of [docs/plan.md](../../plan.md), with the same numbers, in execution order. Every card belongs to one phase
(\`phase: 2\`); the order inside a phase comes from dependencies, then priority. A phase **gate** is a card every card of
that phase waits for, and it opens the phase only when it is \`done\`.

${phases.map((p) => `## ${p.n} · ${p.title}\n> goal: ${p.goal}${p.gates ? ` | gate: ${p.gates.join(', ')}` : ''}\n`).join('\n')}`;

const phaseDiagram = phases.map((p) => `${p.n}. ${p.title}${p.gates ? ` [gate ${p.gates.join(', ')}]` : ''}`).join(' ─► ');
const phaseRows = phases.map((p) => `| ${p.n} | ${p.title} | ${p.goal}${p.gates ? ` **Gate:** ${p.gates.join(', ')} done.` : ''} |`).join('\n');

// ─── Replacements ────────────────────────────────────────────────────────────

const bullets = (xs) => xs.map((x) => (x.startsWith('- ') ? x : `- ${x}`)).join('\n');
const constraints = [...(presetDef?.constraints ?? []), ...moduleDefs.flatMap((m) => m.constraints ?? [])];
const values = {
  PROJECT_NAME: name,
  CODE_NAME: codeName ?? '{{CODE_NAME}}',
  PROJECT_SUMMARY: summary ?? '{{PROJECT_SUMMARY}}',
  DATE: today,
  PRESET: preset,
  MODULES: modules.length ? modules.join(', ') : 'none',
  REVIEWER: reviewer,
  COMMUNICATION: readFileSync(join(TEMPLATE, 'lang', `${lang}.md`), 'utf8').trim(),
  STACK: presetDef ? bullets(presetDef.stack) : '- Not chosen yet: card ARC-02 records it as an ADR.',
  // Without a preset the stack is the first decision: ENV-01 cannot build a skeleton before it.
  STACK_CARD: presetDef ? '' : `
## ARC-02 · Choose the stack
> status: decision | priority: P0 | layer: docs | size: S | phase: ${phases.find((p) => p.key === 'setup').n}

The supervisor chooses the language, framework, data store and test tools; each choice is an ADR and goes into \`CLAUDE.md\` → Stack, Code conventions and Commands.

- [ ] Stack chosen and recorded as an ADR
- [ ] \`CLAUDE.md\` Stack, Code conventions and Commands filled
- [ ] Build and test commands added to \`.project/config.json\` → \`delivery.checks\`, and \`docs/testing.md\` section 1 filled${coverageMin === null ? '' : `
- [ ] The test check writes a Cobertura report (\`${delivery.coverage.file}\`) and \`delivery.coverage.report\` names its folder (coverage minimum ${coverageMin}%)`}

#### Log
- ${today} [created]`,
  ENV_DEPENDS: presetDef ? '' : ' | depends: ARC-02',
  TESTING_STACK: bullets([
    ...(presetDef?.testing?.length ? presetDef.testing : ['Not chosen yet: card ARC-02 records the test tools; fill this list then.']),
    ...moduleDefs.flatMap((m) => m.testing ?? []),
  ]),
  CHECKS_LIST: checks.map((c, i) => `${i + 1}. ${code(c)}`).join('\n'),
  MERGE_RULE: {
    squash: `Squash merge: one commit on ${code('main')} per pull request, its message starting with the card IDs.`,
    merge: 'Merge commit: the branch history is kept and joined with a merge commit.',
    rebase: `Rebase: the branch commits are replayed on ${code('main')} and fast-forwarded; each commit must stand alone.`,
  }[merge],
  COVERAGE_DONE: coverageMin === null ? '' : `, coverage at least ${coverageMin}%`,
  COVERAGE_RULE: coverageMin === null
    ? 'No minimum: coverage is a hint, not a gate. Section 2 says what must be tested.'
    : `At least ${coverageMin}% line coverage, read by ${code('run-checks.mjs')} from the Cobertura report written during the run (${code('delivery.coverage')} in ${code('.project/config.json')}).${presetCov ? '' : ` Card ARC-02 sets where that report is written (${code('coverage.report')}).`}`,
  CONSTRAINTS: constraints.length ? bullets(constraints) : '- None recorded yet. Add each one as it is agreed, with its ADR.',
  CODE_CONVENTIONS: [...(presetDef?.codeConventions ?? []), ...moduleDefs.flatMap((m) => m.codeConventions ?? [])].join('\n'),
  COMMANDS: (presetDef?.commands ?? []).join('\n'),
  REVIEW_COMMAND: {
    codex: '- Review batch: `/project-starter:review` (runs `bash tools/review/run-review.sh <n…>`; Codex usage: `node tools/review/usage.mjs`)',
    opencode: '- Review batch: `/project-starter:review` (runs `bash tools/review/run-review.sh <n…>`; opencode spends API money: ask first)',
    agents: '- Review batch: `/project-starter:review` (a read-only reviewer agent inside Claude; `run-review.sh` is not used)',
    none: '',
  }[reviewer],
  TEST_COMMAND: presetDef?.testCommand ?? 'the test command in CLAUDE.md',
  RUN_STEPS: presetDef?.runSteps ?? 'To be written with ENV-01.',
  MODULE_DOCS: moduleDefs.flatMap((m) => m.docs ?? []).map(([f, what]) => `| \`${f}\` | ${what} |`).join('\n'),
  PHASE_DIAGRAM: phaseDiagram,
  PHASE_ROWS: phaseRows,
  CLIENT_ROLE: '', CLIENT_ROLE_ROW: '', CLIENT_STATUS_ROWS: '', UAT_COMMA: '', CLIENT_DONE_RULE: '',
};
for (const m of moduleDefs) Object.assign(values, m.replacements ?? {});
for (const p of phases) values[`PHASE:${p.key}`] = String(p.n);

// A line holding only a placeholder that resolves to nothing is dropped.
function fill(text) {
  return text
    .split('\n')
    .filter((line) => { const m = line.trim().match(/^\{\{([\w:-]+)\}\}$/); return !(m && values[m[1]] === ''); })
    .join('\n')
    .replace(/\{\{([\w:-]+)\}\}/g, (all, k) => (k in values ? values[k] : all));
}

// ─── File plan ───────────────────────────────────────────────────────────────

const RENAME = { 'gitignore.txt': '.gitignore', 'gitattributes.txt': '.gitattributes' };
const FILLED = new Set(['.md', '.json', '.yml', '.yaml', '.txt', '.props']);

function walk(dir, base = dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const n of readdirSync(dir)) {
    const full = join(dir, n);
    if (statSync(full).isDirectory()) walk(full, base, out);
    else out.push(relative(base, full));
  }
  return out;
}

const plan = new Map(); // dest (relative) → absolute source
const add = (root) => { for (const rel of walk(root)) plan.set(rel.replace(/\\/g, '/'), join(root, rel)); };
add(join(TEMPLATE, 'core'));
for (const m of modules) add(join(TEMPLATE, 'modules', m, 'files'));
if (presetDef) add(join(TEMPLATE, 'presets', preset, 'files'));

const created = [];
const skipped = [];
const write = (rel, content) => {
  const dest = join(target, rel);
  if (existsSync(dest)) { skipped.push(rel); return; }
  created.push(rel);
  if (dryRun) return;
  mkdirSync(dirname(dest), { recursive: true });
  // Shell scripts keep their executable bit on Linux and macOS (no effect on Windows).
  writeFileSync(dest, content, extname(rel) === '.sh' ? { mode: 0o755 } : undefined);
};

for (const [rel, src] of plan) {
  const destRel = RENAME[basename(rel)] ? join(dirname(rel), RENAME[basename(rel)]).replace(/\\/g, '/') : rel;
  const isTool = destRel.startsWith('tools/');
  if (!isTool && (FILLED.has(extname(rel)) || RENAME[basename(rel)])) {
    let text = fill(readFileSync(src, 'utf8'));
    if (basename(rel) === 'gitignore.txt' && presetDef?.gitignore?.length) text += `\n# ${preset}\n${presetDef.gitignore.join('\n')}\n`;
    write(destRel, text);
  } else {
    write(destRel, readFileSync(src));
  }
}

write('docs/board/cards/_phases.md', phasesFile);

const config = {
  name,
  replyLanguage: lang,
  preset,
  modules,
  reviewer: model ? { tool: reviewer, model } : { tool: reviewer },
  delivery,
  board: {
    layers: {
      docs: 'Documentation and design',
      ui: 'User interface',
      core: 'Business logic and data',
      infra: 'Operations and quality',
    },
  },
};
write('.project/config.json', `${JSON.stringify(config, null, 2)}\n`);

// ─── Git and report ──────────────────────────────────────────────────────────

let gitNote = '';
// A folder already inside another repository is left to that repository (no nested repo).
// Only "not a git repository" (or no git at all) allows git init; any other git error (dubious ownership,
// permissions) means we cannot tell, so nothing is created.
let parentRepo = '';
let gitUnsure = '';
if (!dryRun && !flag('no-git') && !existsSync(join(target, '.git'))) {
  try {
    parentRepo = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: target, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch (e) {
    const err = String(e.stderr ?? '');
    if (e.code !== 'ENOENT' && !/not a git repository/i.test(err)) gitUnsure = err.trim().split('\n')[0] || e.message;
  }
}
if (parentRepo) {
  gitNote = `no git repository created: the folder is already inside ${parentRepo}`;
} else if (gitUnsure) {
  gitNote = `no git repository created: git could not tell whether the folder is inside a repository (${gitUnsure})`;
} else if (!dryRun && !flag('no-git') && !existsSync(join(target, '.git'))) {
  try {
    execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: target, stdio: 'ignore' });
    gitNote = 'git repository created (branch main, nothing committed)';
  } catch {
    gitNote = 'git init failed: create the repository by hand';
  }
}

const leftovers = new Set();
if (!dryRun) {
  for (const rel of created) {
    if (rel.startsWith('tools/') || !FILLED.has(extname(rel))) continue;
    for (const m of readFileSync(join(target, rel), 'utf8').matchAll(/\{\{([\w:-]+)\}\}/g)) leftovers.add(`${m[1]} (${rel})`);
  }
}

console.log(`${dryRun ? '[dry run] ' : ''}✔ ${name} → ${target}`);
console.log(`  code name ${codeName ?? 'not guessed: fill {{CODE_NAME}}'} · language ${lang} · preset ${preset} · modules ${modules.join(', ') || 'none'} · reviewer ${reviewer}`);
console.log(`  delivery: host ${host ?? 'not chosen (ENV-02)'} · merge ${merge} · coverage ${coverageMin === null ? 'no minimum' : `${coverageMin}%`} · ${checks.length} checks`);
console.log(`  phases: ${phaseDiagram}`);
console.log(`  created ${created.length} files${skipped.length ? `, skipped ${skipped.length} that already exist:` : ''}`);
for (const s of skipped) console.log(`    - ${s}`);
if (gitNote) console.log(`  ${gitNote}`);
if (leftovers.size) {
  console.log('  placeholders left for Claude to fill:');
  for (const l of leftovers) console.log(`    - {{${l}}}`);
}

// Board and scaffold checks (Codex batch 2, KS2-01..19, and the plugin trials): scaffolds fresh projects in the temp folder,
// plants each finding's case, builds the board and checks the result.
//   node tests/board.test.mjs        exit 1 if any check fails
import { execFileSync, spawnSync } from 'node:child_process';
import { rmSync, writeFileSync, readFileSync, appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const KIT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'plugins', 'project-starter');
const SCR = join(tmpdir(), 'project-starter-tests');
mkdirSync(SCR, { recursive: true });
// The scaffold reads ~/.claude/project-starter.json: every run here gets an empty home, so this machine's defaults
// cannot change a result (KS4-08). homeWith() makes a home holding a given defaults file.
const homeWith = (name, defaults) => {
  const h = join(SCR, name);
  rmSync(h, { recursive: true, force: true });
  mkdirSync(join(h, '.claude'), { recursive: true });
  if (defaults) writeFileSync(join(h, '.claude', 'project-starter.json'), JSON.stringify(defaults));
  return { ...process.env, HOME: h, USERPROFILE: h };
};
const ENV = homeWith('home-empty');
let fails = 0;
const ok = (cond, name) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`); if (!cond) fails++; };

function scaffold(dir, extra = []) {
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  execFileSync('node', [`${KIT}/scripts/scaffold.mjs`, '--target', dir, '--name', 'T', '--summary', 'S', '--lang', 'en', '--preset', 'none', '--no-git', ...extra], { stdio: 'pipe', env: ENV });
}
const board = (dir, ...a) => spawnSync('node', [join(dir, 'tools/board/build-board.mjs'), ...a], { cwd: dir, encoding: 'utf8', input: a.includes('--hook') ? a.hookInput : undefined });
const data = (dir) => JSON.parse(readFileSync(join(dir, 'docs/board/board.html'), 'utf8').match(/<script id="board-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);

// ── clean builds first ──
for (const [name, extra] of [['b2-full', ['--modules', 'client,regulated,migration,design-first,offline-deploy']], ['b2-light', []]]) {
  const dir = join(SCR, name);
  scaffold(dir, extra);
  const r = board(dir, '--check');
  ok(r.status === 0, `${name}: clean --check (exit ${r.status}) ${r.status ? r.stdout : ''}`);
}

// ── hostile project (light: no client module) ──
const dir = join(SCR, 'b2-bad');
scaffold(dir, []);
const cards = join(dir, 'docs/board/cards');
writeFileSync(join(cards, '10-bad.md'), `---
id: BAD
title: Bad things
order: 10
---

## BAD-01 · Missing dep, links, fence, log line
> status: todo | priority: P0 | layer: core | size: S | phase: 3 | depends: ZZ-99

[go](../javascript:window.pwned=1) [js](javascript:alert(1)) [ctl](\u0001javascript:alert(2)) [pct](100%.md) [ok](https://example.com)

\`\`\`
## BAD-02 · Example inside a fence
#### Log
\`\`\`

Still the body after the fence.

#### Log
- 2026-11-13 [created]
- 2026-11-13 [constructor] odd type

## BAD-03 · Status from client module
> status: uat | priority: P1 | layer: core | size: S | phase: 3

## BAD-04 · constructor status
> status: constructor | priority: P1 | layer: constructor | size: S | phase: 3

## BAD-05 · diamond top
> status: todo | priority: P3 | layer: core | size: S | phase: 3

## BAD-06 · left
> status: todo | priority: P3 | layer: core | size: S | phase: 3 | depends: BAD-05

## BAD-07 · right
> status: todo | priority: P3 | layer: core | size: S | phase: 3 | depends: BAD-05 | depend: BAD-01

## BAD-08 · bottom
> status: todo | priority: P3 | layer: core | size: S | phase: 3 | depends: BAD-06, BAD-07
`);
writeFileSync(join(cards, '11-x.md'), `---
id: "X\\" onmouseover=\\"alert(1)"
title: injected
---
`);
// duplicate phase
appendFileSync(join(cards, '_phases.md'), `\n## 3 · Build again\n> goal: dup\n`);
// requirements: escaped pipe + duplicate
appendFileSync(join(dir, 'docs/requirements.md'), `\n## REQ · Reqs\n\n| ID | Requirement | Type | Source | Status |\n|---|---|---|---|---|\n| REQ-01 | A \\| B | feature | test | dropped |\n| REQ-01 | dup | feature | test | agreed |\n`);
// ADRs: no status, unknown status, bad Cards line
writeFileSync(join(dir, 'docs/adr/090-no-status.md'), `# ADR-090: No status\n\n- Date: 2026-11-13\n\nBody.\n`);
writeFileSync(join(dir, 'docs/adr/091-odd-status.md'), `# ADR-091: Odd\n\n- Status: maybe\n- Date: 2026-11-13\n- Cards: ZZ-98\n\nBody.\n`);

const r = board(dir);
const out = r.stdout + r.stderr;
const d = data(dir);
const T = new Map(d.tasks.map((t) => [t.id, t]));
const html = readFileSync(join(dir, 'docs/board/board.html'), 'utf8');
const body1 = T.get('BAD-01').html;

ok(!d.sections.some((s) => s.id.includes('"')) && /section id/.test(out), 'KS2-01 bad section id skipped with a warning');
ok(!/href="javascript:/i.test(body1) && !/href="\u0001/.test(body1), 'KS2-02 no javascript: href');
ok(/href="\.\/javascript:/.test(body1), 'KS2-02 ../javascript: path stays relative (./)');
ok(T.get('BAD-01').ready === false && T.get('BAD-01').waitingOn.includes('ZZ-99') && d.next !== 'BAD-01', 'KS2-03 missing dep holds the card');
ok(T.get('BAD-05').unlocks === 3 && T.get('BAD-06').unlocks === 1 && T.get('BAD-07').unlocks === 1, `KS2-04 diamond unlocks (${['BAD-05','BAD-06','BAD-07'].map((i) => T.get(i).unlocks)})`);
ok(!T.has('BAD-02') && /Still the body/.test(body1), 'KS2-05 headings inside a fence ignored');
ok(/href="cards\/100%25\.md"/.test(body1), 'KS2-07 bad %-sequence does not crash the build');
ok(/ID 3 appears more than once/.test(out), 'KS2-11 duplicate phase warned');
ok(/REQ-01 appears more than once/.test(out), 'KS2-12 duplicate requirement warned');
ok(/BAD-04: unknown status "constructor"/.test(out) && /unknown layer "constructor"/.test(out) && T.get('BAD-04').status === 'todo', 'KS2-09 constructor not a valid status/layer');
ok(/BAD-03: status "uat" needs the client module/.test(out) && T.get('BAD-03').status === 'review', 'KS2-14 uat without client module mapped to review');
ok(d.decisions.find((x) => x.id === 'ADR-090').status === 'unknown' && d.decisions.find((x) => x.id === 'ADR-091').status === 'unknown', 'KS2-17 ADR missing/odd status = unknown');
ok(/10-bad\.md:\d+ — BAD-01: unknown log type \[constructor\]/.test(out), 'KS2-19 log warning on the log line');
const logLine = readFileSync(join(cards, '10-bad.md'), 'utf8').split('\n').findIndex((l) => l.includes('[constructor]')) + 1;
ok(out.includes(`10-bad.md:${logLine} — BAD-01: unknown log type`), `KS2-19 exact log line ${logLine}`);
const statusLine = readFileSync(join(dir, 'docs/adr/091-odd-status.md'), 'utf8').split('\n').findIndex((l) => l.startsWith('- Status')) + 1;
ok(out.includes(`091-odd-status.md:${statusLine} — ADR-091: unknown status`), 'KS2-19 ADR status warning on its line');
ok(d.requirements.done <= d.requirements.total, 'KS2-18 done never above total');
ok(/BAD-07: unknown key "depend"/.test(out) && !/BAD-06: unknown key/.test(out), 'trial: unknown meta key warned');
ok(T.get('BAD-03').delivered === true && 'delivered' in T.get('BAD-05'), 'KS2-13 delivered sent to the page');

// KS2-06: escaped pipe keeps columns
writeFileSync(join(dir, 'docs/requirements.md'), readFileSync(join(dir, 'docs/requirements.md'), 'utf8').replace('| REQ-01 | dup | feature | test | agreed |\n', ''));
// KS2-13: gate written explicitly in depends, gate in review
// KS2-08: null config
const cfgPath = join(dir, '.project/config.json');
const cfg = readFileSync(cfgPath, 'utf8');
writeFileSync(cfgPath, 'null');
let r2 = board(dir, '--check');
ok(r2.status !== null && /not a JSON object/.test(r2.stdout), `KS2-08 null config: no crash, warning (exit ${r2.status})`);
writeFileSync(cfgPath, JSON.stringify({ ...JSON.parse(cfg), replyLanguage: 'constructor' }));
r2 = board(dir, '--check');
ok(/unknown replyLanguage "constructor"/.test(r2.stdout), 'KS2-09 replyLanguage constructor falls back to English');
writeFileSync(cfgPath, cfg);

// KS2-16: stop mode
const s = board(dir, '--stop');
ok(s.status === 0 && JSON.parse(s.stdout).systemMessage.includes('warning'), 'KS2-16 --stop reports warnings, exit 0');
const sc = spawnSync('node', [join(SCR, 'b2-light/tools/board/build-board.mjs'), '--stop'], { encoding: 'utf8' });
ok(sc.status === 0 && sc.stdout === '', 'KS2-16 --stop silent when clean');

// KS2-06 / 13 on a full project with client module
const full = join(SCR, 'b2-full');
const req = readFileSync(join(full, 'docs/requirements.md'), 'utf8');
writeFileSync(join(full, 'docs/requirements.md'), req + `\n## PIP · Pipes\n\n| ID | Requirement | Type | Source | Status |\n|---|---|---|---|---|\n| PIP-01 | A \\| B | feature | test | dropped |\n`);
const r3 = board(full);
const d3 = data(full);
ok(!/PIP-01/.test(r3.stdout), 'KS2-06 escaped pipe: status "dropped" read (no missing-card warning)');

// KS2-13: gate listed explicitly in depends, gate card in review → still not delivered
const des = join(full, 'docs/board/cards/03-des.md');
let desTxt = readFileSync(des, 'utf8');
desTxt = desTxt.replace(/(## DES-03[^\n]*\n> status: )\w[\w-]*/, '$1review');
writeFileSync(des, desTxt);
const buildPhase = d3.phases.find((p) => p.gate.includes('DES-03')).id;
writeFileSync(join(full, 'docs/board/cards/40-gat.md'), `---\nid: GAT\ntitle: Gate test\norder: 40\n---\n\n## GAT-01 · explicit gate\n> status: todo | priority: P0 | layer: core | size: S | phase: ${buildPhase} | depends: DES-03\n`);
board(full);
const d4 = data(full);
const g = d4.tasks.find((t) => t.id === 'GAT-01');
const des3 = d4.tasks.find((t) => t.id === 'DES-03');
ok(des3.status === 'review' && des3.delivered === false && g.gated.includes('DES-03') && !g.ready, `KS2-13 explicit gate in review still holds (gated=${g.gated}, ready=${g.ready})`);
// ── trial fixes (scaffold) ──
const arc = readFileSync(join(full, 'docs/board/cards/01-arc.md'), 'utf8');
const env = readFileSync(join(full, 'docs/board/cards/02-env.md'), 'utf8');
ok(/## ARC-02 · Choose the stack\n> status: decision/.test(arc) && /## ENV-01[^\n]*\n> [^\n]*\| depends: ARC-02\n/.test(env), 'trial: preset none adds ARC-02 and ENV-01 waits on it');
const dn = join(SCR, 'b2-dotnet');
scaffold(dn, ['--preset', 'dotnet']);
ok(!/ARC-02/.test(readFileSync(join(dn, 'docs/board/cards/01-arc.md'), 'utf8')) && !/depends/.test(readFileSync(join(dn, 'docs/board/cards/02-env.md'), 'utf8').split('## ENV-02')[0]) && board(dn, '--check').status === 0, 'trial: preset dotnet has no ARC-02, clean board');
ok(!/S101 \| \|/.test(readFileSync(join(full, 'docs/design/screens.md'), 'utf8')), 'trial: no empty example row in screens.md');
const outer = join(SCR, 'b2-outer');
if (existsSync(outer)) rmSync(outer, { recursive: true, force: true });
mkdirSync(outer, { recursive: true });
execFileSync('git', ['init', '-q'], { cwd: outer });
const nested = execFileSync('node', [`${KIT}/scripts/scaffold.mjs`, '--target', join(outer, 'app'), '--name', 'N', '--lang', 'en'], { encoding: 'utf8', env: ENV });
ok(!existsSync(join(outer, 'app', '.git')) && /already inside/.test(nested), 'trial: no nested git repository');
// KS3-01: any git error other than "not a git repository" means no git init
const badCfg = join(SCR, 'bad.gitconfig');
writeFileSync(badCfg, '[broken\n');
const unsureDir = join(SCR, 'b3-unsure');
if (existsSync(unsureDir)) rmSync(unsureDir, { recursive: true, force: true });
const unsure = execFileSync('node', [`${KIT}/scripts/scaffold.mjs`, '--target', unsureDir, '--name', 'U', '--lang', 'en'], { encoding: 'utf8', env: { ...ENV, GIT_CONFIG_GLOBAL: badCfg } });
ok(!existsSync(join(unsureDir, '.git')) && /could not tell/.test(unsure), 'KS3-01 git error other than "not a repository": no git init');

// ── delivery: PR template, testing.md, checks and coverage ──
const cfgOf = (d) => JSON.parse(readFileSync(join(d, '.project/config.json'), 'utf8'));
const light = join(SCR, 'b2-light');
const lc = cfgOf(light).delivery;
ok(lc && lc.host === null && lc.merge === 'squash' && lc.coverage === null && JSON.stringify(lc.checks) === '["node tools/board/build-board.mjs --check"]', 'delivery: defaults (host null, squash, board check only, no coverage)');
ok(existsSync(join(light, '.github/pull_request_template.md')) && existsSync(join(light, 'docs/testing.md')) && existsSync(join(light, 'tools/checks/run-checks.mjs')), 'delivery: PR template, testing.md and run-checks.mjs created');
ok(/ARC-02 records the test tools/.test(readFileSync(join(light, 'docs/testing.md'), 'utf8')) && /delivery\.checks/.test(readFileSync(join(light, 'docs/board/cards/01-arc.md'), 'utf8')), 'delivery: preset none leaves the test tools and checks to ARC-02');
const rc = (d) => spawnSync('node', [join(d, 'tools/checks/run-checks.mjs')], { cwd: d, encoding: 'utf8' });
let c1 = rc(light);
ok(c1.status === 0 && /PASS  node tools\/board/.test(c1.stdout), `delivery: run-checks passes on a clean project (exit ${c1.status})`);
const dnc = cfgOf(dn).delivery;
ok(JSON.stringify(dnc.checks) === '["dotnet build","dotnet test","node tools/board/build-board.mjs --check"]' && /xUnit/.test(readFileSync(join(dn, 'docs/testing.md'), 'utf8')), 'delivery: dotnet preset checks and testing lines');
const dc = join(SCR, 'b4-dotnet-cov');
scaffold(dc, ['--preset', 'dotnet', '--coverage', '80', '--host', 'local', '--merge', 'rebase']);
const dcc = cfgOf(dc).delivery;
ok(dcc.host === 'local' && dcc.merge === 'rebase' && dcc.coverage.min === 80 && dcc.coverage.report === 'TestResults/coverage' && dcc.checks[1].includes('XPlat Code Coverage'), 'delivery: --coverage swaps in the coverage test command');
const dcText = ['docs/testing.md', 'docs/process.md', 'CLAUDE.md', '.github/pull_request_template.md'].map((f) => readFileSync(join(dc, f), 'utf8')).join('\n');
ok(!/\{\{/.test(dcText) && /At least 80%/.test(dcText) && /Rebase:/.test(dcText), 'delivery: no placeholders left; coverage and merge rule written');
const sc4 = (args, env = ENV) => spawnSync('node', [`${KIT}/scripts/scaffold.mjs`, '--target', join(SCR, 'b4-bad'), '--name', 'B', '--no-git', ...args], { encoding: 'utf8', env });
if (existsSync(join(SCR, 'b4-bad'))) rmSync(join(SCR, 'b4-bad'), { recursive: true, force: true });
const badArg = sc4(['--coverage', '120']);
const badHost = sc4(['--host', 'svn']);
const badMerge = sc4(['--merge', 'ff']);
ok(badArg.status === 1 && /--coverage needs a whole percent/.test(badArg.stderr) && badHost.status === 1 && /Unknown host "svn"/.test(badHost.stderr)
  && badMerge.status === 1 && /Unknown merge style/.test(badMerge.stderr) && !existsSync(join(SCR, 'b4-bad')), 'delivery: bad --coverage, --host or --merge refused with its message');
// KS4-07: defaultCoverage in the defaults file
const dz = join(SCR, 'b4-defzero');
if (existsSync(dz)) rmSync(dz, { recursive: true, force: true });
spawnSync('node', [`${KIT}/scripts/scaffold.mjs`, '--target', dz, '--name', 'Z', '--no-git'], { env: homeWith('home-zero', { defaultCoverage: 0, defaultHost: 'gitea', defaultMerge: 'merge' }) });
const dzc = cfgOf(dz).delivery;
ok(dzc.coverage === null && dzc.host === 'gitea' && dzc.merge === 'merge', 'KS4-07 defaultCoverage 0 means no minimum; defaultHost and defaultMerge used');
const ds = join(SCR, 'b4-defstr');
if (existsSync(ds)) rmSync(ds, { recursive: true, force: true });
spawnSync('node', [`${KIT}/scripts/scaffold.mjs`, '--target', ds, '--name', 'S', '--no-git'], { env: homeWith('home-str', { defaultCoverage: '75' }) });
const badDef = sc4([], homeWith('home-bad', { defaultCoverage: 150 }));
ok(cfgOf(ds).delivery.coverage?.min === 75 && badDef.status === 1 && /defaultCoverage in .*project-starter\.json needs a whole percent/.test(badDef.stderr), 'KS4-07 defaultCoverage "75" read; 150 refused naming the file');
// KS4-03: coverage without a preset: ARC-02 asks for the report folder; until then the coverage check fails clearly
const nc = join(SCR, 'b4-nopreset-cov');
scaffold(nc, ['--coverage', '70']);
ok(cfgOf(nc).delivery.coverage.report === null && /delivery\.coverage\.report.*coverage minimum 70%/.test(readFileSync(join(nc, 'docs/board/cards/01-arc.md'), 'utf8')) && board(nc, '--check').status === 0, 'KS4-03 no preset + coverage: ARC-02 criterion for the report, clean board');
const ncr = spawnSync('node', [join(nc, 'tools/checks/run-checks.mjs')], { cwd: nc, encoding: 'utf8' });
ok(ncr.status === 1 && /coverage\.report is not set/.test(ncr.stdout), 'KS4-03 coverage report folder not set: check fails with the reason');
const lst = spawnSync('node', [join(dc, 'tools/checks/run-checks.mjs'), '--list'], { cwd: dc, encoding: 'utf8' });
ok(lst.status === 0 && /^1\. dotnet build/m.test(lst.stdout) && /coverage: at least 80%/.test(lst.stdout), 'delivery: --list prints the checks and the coverage floor');
// run-checks: a failing check stops the run; coverage read from fresh Cobertura reports only
const ck = join(SCR, 'b4-checks');
scaffold(ck, []);
const setDelivery = (patch) => { const c = cfgOf(ck); c.delivery = { ...c.delivery, ...patch }; writeFileSync(join(ck, '.project/config.json'), JSON.stringify(c)); };
setDelivery({ checks: ['node -e "process.exit(3)"', 'node -e "require(\'fs\').writeFileSync(\'never.txt\',\'\')"'] });
c1 = rc(ck);
ok(c1.status === 1 && /FAIL  node -e/.test(c1.stdout) && /exit 3/.test(c1.stdout) && !existsSync(join(ck, 'never.txt')), 'delivery: failing check exits 1 and stops the run');
const writeCov = (rate) => `node -e "const f=require('fs');f.mkdirSync('out/a',{recursive:true});f.writeFileSync('out/a/coverage.cobertura.xml','<?xml version=\\"1.0\\"?><coverage line-rate=\\"${rate}\\" lines-covered=\\"${rate * 100}\\" lines-valid=\\"100\\"></coverage>')"`;
setDelivery({ checks: [writeCov(0.5)], coverage: { min: 80, report: 'out', file: 'coverage.cobertura.xml' } });
c1 = rc(ck);
ok(c1.status === 1 && /FAIL  coverage 50\.0%/.test(c1.stdout), `delivery: coverage below the floor fails (${c1.stdout.trim().split('\n').pop()})`);
setDelivery({ checks: [writeCov(0.9)] });
c1 = rc(ck);
ok(c1.status === 0 && /PASS  coverage 90\.0%/.test(c1.stdout), 'delivery: coverage above the floor passes');
setDelivery({ checks: ['node -e "0"'] });
c1 = rc(ck);
ok(c1.status === 1 && /no coverage\.cobertura\.xml written/.test(c1.stdout), 'delivery: an old coverage report does not count');
// KS4-01: two reports instrumenting the same file are merged line by line (union 100%, not 50% from adding totals);
// a line listed again under <methods> counts once.
const rep2 = (covered) => `<coverage line-rate="0.5" lines-covered="2" lines-valid="4"><packages><package><classes><class name="A" filename="src/a.cs"><methods><method><lines>${covered.map((n) => `<line number="${n}" hits="1" />`).join('')}</lines></method></methods><lines>${[1, 2, 3, 4].map((n) => `<line number="${n}" hits="${covered.includes(n) ? 3 : 0}" branch="False" />`).join('')}</lines></class></classes></package></packages></coverage>`;
writeFileSync(join(ck, 'r1.xml'), rep2([1, 2]));
writeFileSync(join(ck, 'r2.xml'), rep2([3, 4]));
setDelivery({ checks: [`node -e "const f=require('fs');for(const d of ['unit','int']){f.mkdirSync('out/'+d,{recursive:true});f.copyFileSync(d==='unit'?'r1.xml':'r2.xml','out/'+d+'/coverage.cobertura.xml')}"`] });
c1 = rc(ck);
ok(c1.status === 0 && /PASS  coverage 100\.0% \(minimum 80%, 2 reports\)/.test(c1.stdout), `KS4-01 reports merged by line (${(c1.stdout.match(/coverage [\d.]+%[^\n]*/) ?? ['no coverage line'])[0]})`);
// Batch 5 (Codex on 0.3.1): two fresh reports from r1.xml and r2.xml, out/ cleared first.
const twoReports = (x1, x2) => {
  rmSync(join(ck, 'out'), { recursive: true, force: true });
  writeFileSync(join(ck, 'r1.xml'), x1);
  writeFileSync(join(ck, 'r2.xml'), x2);
  return rc(ck);
};
const totals = (c, v) => `<coverage line-rate="${c / v}" lines-covered="${c}" lines-valid="${v}"></coverage>`;
c1 = twoReports(rep2([1, 2, 3, 4]), totals(0, 99));
ok(c1.status === 1 && /has no line elements, so it cannot be merged/.test(c1.stdout), 'KS5-01 a report without lines is not dropped beside one with lines: the check fails');
const withSource = (src, covered) => rep2(covered).replace('<packages>', `<sources><source>${src}</source></sources><packages>`);
c1 = twoReports(withSource('C:\\repo\\src\\A\\', [1, 2, 3, 4]), withSource('C:\\repo\\src\\B\\', []));
ok(c1.status === 1 && /FAIL  coverage 50\.0%/.test(c1.stdout), `KS5-03 the same relative file under two <source> roots counts as two files (${(c1.stdout.match(/coverage [\d.]+%/) ?? ['none'])[0]})`);
c1 = twoReports(totals(1, 1), totals(0, 99));
ok(c1.status === 1 && /FAIL  coverage 1\.0%/.test(c1.stdout), `KS5-04 totals-only reports are added by their counts, not averaged (${(c1.stdout.match(/coverage [\d.]+%/) ?? ['none'])[0]})`);
rmSync(join(ck, 'out'), { recursive: true, force: true });
const ov = join(SCR, 'b5-none');
if (existsSync(ov)) rmSync(ov, { recursive: true, force: true });
execFileSync('node', [`${KIT}/scripts/scaffold.mjs`, '--target', ov, '--name', 'O', '--lang', 'en', '--no-git', '--host', 'none', '--coverage', 'none'], { stdio: 'pipe', env: homeWith('home-defaults5', { defaultHost: 'github', defaultCoverage: 80 }) });
ok(cfgOf(ov).delivery.host === null && cfgOf(ov).delivery.coverage === null, 'KS5-06 --host none and --coverage none override the defaults file');
const prSkill = readFileSync(join(KIT, 'skills/pr/SKILL.md'), 'utf8');
const kickoffSkill = readFileSync(join(KIT, 'skills/kickoff/SKILL.md'), 'utf8');
ok(/`merge`: `git switch main`, then `git merge --no-ff/.test(prSkill) && /git branch --show-current/.test(prSkill), 'KS5-02 local merge switches to main first and checks it');
ok(/\*\*`local`:\*\*[^\n]*tick "Remote chosen"/.test(kickoffSkill) && /--host none/.test(kickoffSkill), 'KS5-05/06 kickoff: local ticks "Remote chosen"; host and coverage always passed');
setDelivery({ checks: [] });
ok(rc(ck).status === 2, 'KS4-11 empty delivery.checks is a config error (exit 2)');
setDelivery({ checks: 'dotnet test' });
ok(rc(ck).status === 2, 'delivery: bad delivery.checks is a config error (exit 2)');

// ── trial 2 fixes (kit 0.3.2): code name, README run steps, dotnet front end, PM-01, log lines ──
const sc2 = (d, nameArg, extra = []) => {
  if (existsSync(d)) rmSync(d, { recursive: true, force: true });
  return spawnSync('node', [`${KIT}/scripts/scaffold.mjs`, '--target', d, '--name', nameArg, '--summary', 'S', '--lang', 'en', '--preset', 'dotnet', '--no-git', ...extra], { encoding: 'utf8', env: ENV });
};
const read = (d, f) => readFileSync(join(d, f), 'utf8');
const t2 = join(SCR, 't2-taskapi');
let s2 = sc2(t2, 'Task API');
const t2all = ['CLAUDE.md', 'README.md', 'docs/testing.md'].map((f) => read(t2, f)).join('\n');
ok(s2.status === 0 && !/<Name>|\{\{CODE_NAME\}\}/.test(t2all) && /src\/TaskApi\.Web/.test(read(t2, 'CLAUDE.md')) && /tests\/TaskApi\.Tests/.test(read(t2, 'docs/testing.md')) && /code name TaskApi/.test(s2.stdout), 'trial 2: code name made from the name ("Task API" → TaskApi), no <Name> left');
ok(/Node\.js 18/.test(read(t2, 'README.md')) && /run-checks\.mjs/.test(read(t2, 'README.md')) && /dotnet test/.test(read(t2, 'README.md')) && /applicationUrl/.test(read(t2, 'README.md')), 'trial 2: README run steps name Node 18+, dotnet test, run-checks and the URL');
const t2ar = join(SCR, 't2-arabic');
s2 = sc2(t2ar, 'نظام المهام');
ok(s2.status === 0 && /CODE_NAME/.test(s2.stdout.split('placeholders left')[1] ?? '') && /\{\{CODE_NAME\}\}/.test(read(t2ar, 'CLAUDE.md')), 'trial 2: a name with no Latin letters leaves {{CODE_NAME}} for Claude');
s2 = sc2(join(SCR, 't2-given'), 'Orders', ['--code-name', 'Contoso.Orders']);
ok(s2.status === 0 && /src\/Contoso\.Orders\.Web/.test(read(join(SCR, 't2-given'), 'CLAUDE.md')), 'trial 2: --code-name is used as given');
s2 = sc2(join(SCR, 't2-badname'), 'X', ['--code-name', '1-bad name']);
ok(s2.status === 1 && /--code-name/.test(s2.stderr), 'trial 2: a bad --code-name is refused');
ok(!/Blazor Server with MudBlazor for line-of-business UI, unless/.test(read(t2, 'CLAUDE.md')) && /Web API only/.test(read(t2, 'CLAUDE.md')) && /WebApplicationFactory/.test(read(t2, 'docs/testing.md')), 'trial 2: dotnet preset leaves the front end (Blazor or Web API) to an ADR');
const pm = read(t2, 'docs/board/cards/00-pm.md');
ok(!/First requirements/.test(pm.split('## PM-02')[0]) && /requirements known so far/.test(pm.split('## PM-02')[1]), 'trial 2: requirements moved from PM-01 to PM-02');
ok(!/commit or PR/.test(read(t2, 'docs/conventions.md')) && /git log --grep/.test(read(t2, 'docs/conventions.md')) && !/merged to main: <short sha>|PR #<n> opened/.test(readFileSync(join(KIT, 'skills/pr/SKILL.md'), 'utf8')), 'trial 2: no log line waits for a commit hash or PR number');
ok(board(t2, '--check').status === 0, 'trial 2: dotnet "Task API" board is clean');

// ── presets: laravel, nextjs, python (kit 0.4.0) ──
const BOARD = 'node tools/board/build-board.mjs --check';
const presetCases = {
  dotnet: { checks: ['dotnet build', 'dotnet test'], cov: 'dotnet test --collect', choices: true },
  laravel: { checks: ['php vendor/bin/pint --test', 'php artisan test'], cov: 'php vendor/bin/phpunit --coverage-cobertura', choices: true },
  nextjs: { checks: ['npm run lint', 'npm test', 'npm run build'], cov: 'npm test -- --coverage', choices: true },
  python: { checks: ['uv run ruff check .', 'uv run ruff format --check .', 'uv run mypy app', 'uv run pytest'], cov: 'uv run pytest --cov', choices: false },
};
for (const [p, want] of Object.entries(presetCases)) {
  const d = join(SCR, `p-${p}`);
  const r = sc2(d, 'Task API', ['--preset', p]);
  const texts = ['CLAUDE.md', 'README.md', 'docs/testing.md', 'docs/board/cards/02-env.md', '.project/config.json'].map((f) => read(d, f)).join('\n');
  const env1 = read(d, 'docs/board/cards/02-env.md').split('## ENV-02')[0];
  ok(r.status === 0 && !/\{\{|<Name>/.test(texts) && board(d, '--check').status === 0, `preset ${p}: scaffolds with no placeholder left, clean board`);
  ok(JSON.stringify(cfgOf(d).delivery.checks) === JSON.stringify([...want.checks, BOARD]) && existsSync(join(d, '.github/workflows/ci.yml')) && /run-checks\.mjs/.test(read(d, '.github/workflows/ci.yml')), `preset ${p}: checks in the config, CI runs run-checks`);
  ok(/^Skeleton: /m.test(env1) && /Decided before the skeleton/.test(env1) === want.choices, `preset ${p}: ENV-01 has the skeleton${want.choices ? ' and the open choices' : ', no open choices'}`);
  const dc2 = join(SCR, `p-${p}-cov`);
  sc2(dc2, 'Task API', ['--preset', p, '--coverage', '80']);
  const cv = cfgOf(dc2).delivery;
  const replaced = JSON.parse(readFileSync(join(KIT, 'template/presets', p, 'preset.json'), 'utf8')).coverage.replaces;
  ok(cv.checks.some((c) => c.startsWith(want.cov)) && !cv.checks.includes(replaced) && cv.coverage.report === 'TestResults/coverage', `preset ${p}: coverage swaps "${replaced}" for the command that writes the report`);
}
ok(!/^Skeleton: |Decided before the skeleton/m.test(read(join(SCR, 'b2-light'), 'docs/board/cards/02-env.md')), 'preset none: ENV-01 has no skeleton line and no open choices');

console.log(fails ? `\n${fails} FAILED` : '\nALL PASS');
process.exit(fails ? 1 : 0);

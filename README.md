# devflow

Formerly `project-starter` (renamed in 0.5.0; see [Moving from project-starter](#moving-from-project-starter)).

A Claude Code plugin that starts any new project with the same way of working, taken from a real project and made generic:

- requirements with stable IDs, each with a board card and acceptance criteria;
- decisions as ADRs (one file each, superseded, never rewritten);
- a board generated from Markdown cards (dependencies, phases, gates, next card), offline, in English or Arabic;
- a testing policy (`docs/testing.md`), checks run before every pull request and merge (`tools/checks/run-checks.mjs`, optional coverage floor) and a pull request template;
- independent read-only review batches (Codex by default; opencode or review agents) with a triage log;
- `NEXT.md` for session hand-off, `CHANGELOG.md` and tags for releases;
- optional modules for an outside client, regulated systems (GAMP 5 validation), data migration, design-first sign-off and offline installs;
- stack presets: `dotnet` (.NET, Blazor or Web API), `laravel` (PHP, Laravel, MySQL), `nextjs` (Next.js, React, Tailwind) and `python` (FastAPI, PostgreSQL); more can be added.

## Needs

- Claude Code, Git, and Node.js 18 or later (the scripts have no packages).
- For the default reviewer, the Codex CLI signed in; without it, choose the `agents` reviewer (a read-only reviewer inside Claude) at kickoff.
- On Windows, Git Bash (it comes with Git) for the review script.

## Install (once per machine)

In Claude Code:

```
/plugin marketplace add BiztechEG/claude-devflow
/plugin install devflow@biztech
```

Or from a terminal: `claude plugin marketplace add BiztechEG/claude-devflow` and `claude plugin install devflow@biztech`. The repository is private: your Git must be able to clone it (`git clone https://github.com/BiztechEG/claude-devflow` works). A local copy works too: `/plugin marketplace add <path to the folder>`.

Updates: `claude plugin marketplace update biztech`, then `claude plugin update devflow@biztech`, then restart Claude Code.

Without access to GitHub (an offline or closed network): clone the repository on a machine that has access (or download it as a ZIP), copy the folder over, and run `/plugin marketplace add <path to the folder>`, then `/plugin install devflow@biztech`. For an update, replace the folder and run the two update commands above. Claude Code itself still needs to reach the model; the kit's scripts (`scaffold.mjs`, the board, `run-checks.mjs`) run with Node alone, and the preset skeletons download packages (composer, npm, uv, NuGet).

### Moving from project-starter

1. `claude plugin uninstall project-starter@biztech`, then `claude plugin marketplace update biztech` and `claude plugin install devflow@biztech` (with the old repository URL, GitHub redirects to `BiztechEG/claude-devflow`; `git remote set-url origin https://github.com/BiztechEG/claude-devflow` in a clone).
2. `~/.claude/project-starter.json` is still read while `~/.claude/devflow.json` does not exist; rename it when convenient.
3. In a project made before the rename, replace `/project-starter:` with `/devflow:` and `project-starter:reviewer` with `devflow:reviewer` in `CLAUDE.md`, `NEXT.md` and `docs/` (one commit). Nothing else in the project names the kit.

Claude Code runs a **copy** of the plugin (`~/.claude/plugins/cache/biztech/devflow/<version>/`), so edits here do not reach it by themselves, and `claude plugin update` does nothing while `version` in `plugin.json` is unchanged. After editing the kit, either bump the version and run `claude plugin update devflow@biztech`, or reinstall (`claude plugin uninstall devflow@biztech`, then `install` again); then start a new session or `/reload-plugins`. To try edits without installing, start Claude Code with `claude --plugin-dir plugins/devflow` from this folder.

Optional defaults for new projects, in `~/.claude/devflow.json`:

```json
{ "defaultReplyLanguage": "ar-eg", "defaultPreset": "dotnet", "defaultReviewer": "codex", "defaultReviewerModel": "anthropic/claude-opus-5-5", "defaultModules": [], "defaultHost": "github", "defaultMerge": "squash", "defaultCoverage": 80 }
```

Every key is optional (`defaultReviewerModel` is for opencode). Without the file: reply language `en`, preset `none`, reviewer `codex`, no modules, host not chosen (card ENV-02), squash merge, no coverage minimum.

`/devflow:set-language ar-eg --global` writes the language default for you.

## Use

Short how-to for daily use: [USAGE.md](USAGE.md).

Open Claude Code in an empty folder and run `/devflow:kickoff`. Then, day to day (always use the full `/devflow:` name: a bare `/review` may run Claude Code's own review instead):

| Command | Does |
|---|---|
| `/devflow:kickoff` | Creates the project from the template and fills it from the conversation |
| `/devflow:request` | Records a requirement with an ID and its card |
| `/devflow:card` | Adds a work card, or starts or finishes a card |
| `/devflow:decision` | Records a decision as an ADR |
| `/devflow:question` | Adds a client question, or records its answer (client module) |
| `/devflow:pr` | Runs the checks, opens the pull request (or readies the branch when local only), merges after approval |
| `/devflow:review` | Sends work to the reviewer, then triages the findings |
| `/devflow:summary` | End-of-task summary in the reply language |
| `/devflow:handoff` | Rewrites `NEXT.md` at the end of a session |
| `/devflow:release` | Changelog section, version and tag |
| `/devflow:set-language` | Switches the reply language (`ar-eg` or `en`) |

Without Claude, the scaffold also runs by hand:

```
node plugins/devflow/scripts/scaffold.mjs --target <dir> --name "Name" [--code-name Name] --lang ar-eg --preset dotnet --modules client [--host github|none] [--merge squash] [--coverage 80|none]
```

## Reviewers

- **codex** (default): `codex exec -s read-only`, a real read-only sandbox.
- **opencode**: runs its `plan` agent, which is read-only only as far as your opencode permissions allow. Deny edits and shell commands for that agent in your opencode config before using it. The script warns when the working tree changed during a run.
- **agents**: the plugin's `devflow:reviewer` agent inside Claude, with read-only tools (Read, Grep, Glob); no Codex or opencode needed.

## Language

Project files, code and commits are always in English. `replyLanguage` in the project's `.project/config.json` sets the language of Claude's messages, the review reports and the board page: `ar-eg` (Egyptian Arabic with English technical terms) or `en` (all English). It is not asked at kickoff: the default comes from `~/.claude/devflow.json` and can be switched any time with `/devflow:set-language`.

## Layout

```
.claude-plugin/marketplace.json          the marketplace ("biztech")
plugins/devflow/
├─ .claude-plugin/plugin.json
├─ skills/<name>/SKILL.md                the commands above
├─ agents/reviewer.md                    read-only reviewer for the "agents" reviewer
├─ scripts/scaffold.mjs                  creates a project (never overwrites a file)
├─ scripts/set-language.mjs              switches the reply language
└─ template/
   ├─ core/                              files every project gets
   ├─ lang/en.md, lang/ar-eg.md          the Communication block of CLAUDE.md
   ├─ modules/<name>/module.json+files/  optional parts
   └─ presets/<name>/preset.json+files/  stack presets
```

Tests: `node tests/board.test.mjs` scaffolds projects in the temp folder and checks the board, the scaffold and the checks runner (exit 1 on a failure).

File formats: [template/core/docs/conventions.md](plugins/devflow/template/core/docs/conventions.md).

## Extending

- **New module:** `template/modules/<name>/module.json` (`title`, `docs`, `constraints`, `codeConventions`, `testing`, `phases`, `gates`, `replacements`) and a `files/` folder copied into the project. Card templates may use `{{PHASE:<key>}}` and `{{DATE}}`.
- **New preset:** `template/presets/<name>/preset.json` (`title`, `stack`, `openChoices`, `skeleton`, `codeConventions`, `commands`, `testCommand`, `checks`, `coverage`, `testing`, `runSteps`, `gitignore`) and `files/`. `checks` are the build and test commands (the board check is added after them); `coverage` is `{ replaces, command, report, file }`: the test check that writes a Cobertura report, used instead of `replaces` when a coverage minimum is set; `testing` lines go into `docs/testing.md` §1. `openChoices` are the decisions the preset leaves open (front end, language): they become one ENV-01 criterion, decided as ADRs before the skeleton. `skeleton` tells ENV-01 how to make the project's skeleton (a generator that needs an empty folder runs in a temporary folder and its files are moved in). `{{CODE_NAME}}` anywhere in `preset.json` becomes the project's code name. Commands in `checks` run through the shell on Windows too: call scripts through their interpreter (`php vendor/bin/pint`, not `vendor/bin/pint`).
- Update `docs/conventions.md` §7 and the kickoff skill's module list when you add a module.

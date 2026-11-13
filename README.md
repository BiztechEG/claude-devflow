# project-starter

A Claude Code plugin that starts any new project with the same way of working, taken from a real project and made generic:

- requirements with stable IDs, each with a board card and acceptance criteria;
- decisions as ADRs (one file each, superseded, never rewritten);
- a board generated from Markdown cards (dependencies, phases, gates, next card), offline, in English or Arabic;
- a testing policy (`docs/testing.md`), checks run before every pull request and merge (`tools/checks/run-checks.mjs`, optional coverage floor) and a pull request template;
- independent read-only review batches (Codex by default; opencode or review agents) with a triage log;
- `NEXT.md` for session hand-off, `CHANGELOG.md` and tags for releases;
- optional modules for an outside client, regulated systems (GAMP 5 validation), data migration, design-first sign-off and offline installs;
- a `.NET` stack preset (more presets can be added).

## Needs

- Claude Code, Git, and Node.js 18 or later (the scripts have no packages).
- For the default reviewer, the Codex CLI signed in; without it, choose the `agents` reviewer (a read-only reviewer inside Claude) at kickoff.
- On Windows, Git Bash (it comes with Git) for the review script.

## Install (once per machine)

In Claude Code:

```
/plugin marketplace add BiztechEG/claude-project-starter
/plugin install project-starter@biztech
```

Or from a terminal: `claude plugin marketplace add BiztechEG/claude-project-starter` and `claude plugin install project-starter@biztech`. The repository is private: your Git must be able to clone it (`git clone https://github.com/BiztechEG/claude-project-starter` works). A local copy works too: `/plugin marketplace add <path to the folder>`.

Updates: `claude plugin marketplace update biztech`, then `claude plugin update project-starter@biztech`, then restart Claude Code.

Claude Code runs a **copy** of the plugin (`~/.claude/plugins/cache/biztech/project-starter/<version>/`), so edits here do not reach it by themselves, and `claude plugin update` does nothing while `version` in `plugin.json` is unchanged. After editing the kit, either bump the version and run `claude plugin update project-starter@biztech`, or reinstall (`claude plugin uninstall project-starter@biztech`, then `install` again); then start a new session or `/reload-plugins`. To try edits without installing, start Claude Code with `claude --plugin-dir plugins/project-starter` from this folder.

Optional defaults for new projects, in `~/.claude/project-starter.json`:

```json
{ "defaultReplyLanguage": "ar-eg", "defaultPreset": "dotnet", "defaultReviewer": "codex", "defaultReviewerModel": "anthropic/claude-opus-5-5", "defaultModules": [], "defaultHost": "github", "defaultMerge": "squash", "defaultCoverage": 80 }
```

Every key is optional (`defaultReviewerModel` is for opencode). Without the file: reply language `en`, preset `none`, reviewer `codex`, no modules, host not chosen (card ENV-02), squash merge, no coverage minimum.

`/project-starter:set-language ar-eg --global` writes the language default for you.

## Use

Short how-to for daily use: [USAGE.md](USAGE.md).

Open Claude Code in an empty folder and run `/project-starter:kickoff`. Then, day to day (always use the full `/project-starter:` name: a bare `/review` may run Claude Code's own review instead):

| Command | Does |
|---|---|
| `/project-starter:kickoff` | Creates the project from the template and fills it from the conversation |
| `/project-starter:request` | Records a requirement with an ID and its card |
| `/project-starter:card` | Adds a work card, or starts or finishes a card |
| `/project-starter:decision` | Records a decision as an ADR |
| `/project-starter:question` | Adds a client question, or records its answer (client module) |
| `/project-starter:pr` | Runs the checks, opens the pull request (or readies the branch when local only), merges after approval |
| `/project-starter:review` | Sends work to the reviewer, then triages the findings |
| `/project-starter:summary` | End-of-task summary in the reply language |
| `/project-starter:handoff` | Rewrites `NEXT.md` at the end of a session |
| `/project-starter:release` | Changelog section, version and tag |
| `/project-starter:set-language` | Switches the reply language (`ar-eg` or `en`) |

Without Claude, the scaffold also runs by hand:

```
node plugins/project-starter/scripts/scaffold.mjs --target <dir> --name "Name" [--code-name Name] --lang ar-eg --preset dotnet --modules client [--host github|none] [--merge squash] [--coverage 80|none]
```

## Reviewers

- **codex** (default): `codex exec -s read-only`, a real read-only sandbox.
- **opencode**: runs its `plan` agent, which is read-only only as far as your opencode permissions allow. Deny edits and shell commands for that agent in your opencode config before using it. The script warns when the working tree changed during a run.
- **agents**: the plugin's `project-starter:reviewer` agent inside Claude, with read-only tools (Read, Grep, Glob); no Codex or opencode needed.

## Language

Project files, code and commits are always in English. `replyLanguage` in the project's `.project/config.json` sets the language of Claude's messages, the review reports and the board page: `ar-eg` (Egyptian Arabic with English technical terms) or `en` (all English). It is not asked at kickoff: the default comes from `~/.claude/project-starter.json` and can be switched any time with `/project-starter:set-language`.

## Layout

```
.claude-plugin/marketplace.json          the marketplace ("biztech")
plugins/project-starter/
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

File formats: [template/core/docs/conventions.md](plugins/project-starter/template/core/docs/conventions.md).

## Extending

- **New module:** `template/modules/<name>/module.json` (`title`, `docs`, `constraints`, `codeConventions`, `testing`, `phases`, `gates`, `replacements`) and a `files/` folder copied into the project. Card templates may use `{{PHASE:<key>}}` and `{{DATE}}`.
- **New preset:** `template/presets/<name>/preset.json` (`stack`, `codeConventions`, `commands`, `testCommand`, `checks`, `coverage`, `testing`, `runSteps`, `gitignore`) and `files/`. `checks` are the build and test commands (the board check is added after them); `coverage` is `{ replaces, command, report, file }`: the test check that writes a Cobertura report, used instead of `replaces` when a coverage minimum is set; `testing` lines go into `docs/testing.md` §1.
- Update `docs/conventions.md` §7 and the kickoff skill's module list when you add a module.

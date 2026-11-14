# Conventions

The file formats every project made from this kit follows. The board generator, the review scripts and the skills all read these formats, so change them here first.

## 1. Project layout

```
<project>/
├─ CLAUDE.md                 rules for Claude: roles, communication, workflow, stack, constraints
├─ README.md                 one page: what it is, how to run it, where things are
├─ CHANGELOG.md              Keep a Changelog; one section per release tag
├─ NEXT.md                   session hand-off: where we stopped, what comes next (short, overwritten)
├─ .project/config.json      kit settings (section 2)
├─ .project/kit.json         kit version and a hash of each tool file as the kit wrote it (section 2)
├─ .claude/settings.json     hooks: rebuild the board after edits
├─ .github/pull_request_template.md   sections every pull request description has
├─ docs/
│  ├─ README.md              index of docs
│  ├─ process.md             how work flows: request → card → branch → pull request → review → done
│  ├─ testing.md             what is tested, with which tools; checks before a pull request and a merge
│  ├─ requirements.md        every requirement with a stable ID (section 3)
│  ├─ plan.md                phases, gates, definition of ready and of done
│  ├─ adr/                   one file per decision (section 4)
│  ├─ architecture/          architecture notes (README.md lists them in reading order)
│  ├─ board/cards/           the board: one file per section (section 5)
│  └─ reviews/               independent review output and triage (section 6)
└─ tools/
   ├─ board/                 board generator (Node 18+, no packages)
   ├─ checks/run-checks.mjs  runs delivery.checks and the coverage floor (section 2)
   └─ review/                review batch scripts
```

Modules add files (for example `docs/questions.md` with the `client` module, `docs/validation/` with `regulated`).

## 2. `.project/config.json`

```json
{
  "name": "Project name",
  "replyLanguage": "ar-eg",
  "preset": "dotnet",
  "modules": ["client"],
  "reviewer": { "tool": "codex" },
  "delivery": {
    "host": "github",
    "merge": "squash",
    "checks": ["dotnet build", "dotnet test", "node tools/board/build-board.mjs --check"],
    "coverage": null
  },
  "board": {
    "layers": {
      "docs":  "Documentation and design",
      "ui":    "User interface",
      "core":  "Business logic and data",
      "infra": "Operations and quality"
    }
  }
}
```

| Key | Values | Meaning |
|---|---|---|
| `replyLanguage` | `en`, `ar-eg` | Language of Claude's messages to the user, of review reports and of the board page. Files, code and commits stay in English |
| `preset` | `none`, `dotnet`, `laravel`, `nextjs`, `python` | Stack preset applied at kickoff (the folders of the kit's `template/presets/`) |
| `modules` | `client`, `regulated`, `migration`, `design-first`, `offline-deploy` | Optional parts (section 7) |
| `reviewer.tool` | `codex`, `opencode`, `agents`, `none` | Independent reviewer used by `/devflow:review` |
| `reviewer.model` | string | Model for `opencode` (for example `anthropic/claude-opus-5-5`) |
| `delivery.host` | `github`, `gitea`, `azure`, `local`, `null` | Where pull requests live; `null` until card ENV-02 chooses it (work as `local` meanwhile) |
| `delivery.merge` | `squash`, `merge`, `rebase` | How `/devflow:pr merge` joins a branch to `main` |
| `delivery.checks` | list of commands | Run in order from the project root by `tools/checks/run-checks.mjs` before a pull request and before a merge; the first failure stops |
| `delivery.coverage` | `null` or `{ "min": 80, "report": "TestResults/coverage", "file": "coverage.cobertura.xml" }` | Minimum line coverage, read from the Cobertura files named `file` under the folder `report` that the checks wrote during the run. Several reports are merged line by line (a file is its path under the report's `<source>`); reports with totals only are added up by their counts; a mix of the two fails |
| `board.layers` | object | Layer keys allowed on cards, with their labels |

The global default for new projects is in `~/.claude/devflow.json`:

```json
{ "defaultReplyLanguage": "ar-eg", "defaultPreset": "dotnet", "defaultReviewer": "codex", "defaultReviewerModel": "anthropic/claude-opus-5-5", "defaultModules": [], "defaultHost": "github", "defaultMerge": "squash", "defaultCoverage": 80 }
```

Every key is optional. Without the file: reply language `en`, preset `none`, reviewer `codex`, no modules, host not chosen, squash merge, no coverage minimum. The scaffold's `--host none` and `--coverage none` override a default here.

`.project/kit.json` is written by the kit, never by hand: `{ "kit": "devflow", "version": "0.5.2", "files": { "tools/board/build-board.mjs": "<hash>", … } }`, the kit version and, for each file under `tools/board/`, `tools/checks/` and `tools/review/`, a hash of the copy the kit wrote (line endings ignored). `/devflow:update` uses it to replace the files that are only older and to keep the ones edited in the project unless the supervisor says otherwise. Edits to those tools are allowed but are kept out of later kit updates until merged by hand.

## 3. Requirements (`docs/requirements.md`)

Grouped by module. Each module heading carries its prefix; each requirement is a table row whose first cell is its ID.

```markdown
## ORD · Orders

| ID | Requirement | Type | Source | Status |
|---|---|---|---|---|
| ORD-01 | The order shows the test location | feature | Meeting 2026-11-13 | agreed |
```

- **IDs never change and are never reused.** A dropped requirement keeps its row with status `dropped`.
- `Type`: `feature`, `change`, `bug`, `data-fix`, `question`.
- `Status`: `agreed`, `pending`, `dropped`.
- A pipe inside a cell is written `\|`. An ID appears in one row only (the board warns on a second one).
- Every requirement has a card with the same ID in the board section of the same prefix.

## 4. Decisions (`docs/adr/NNN-slug.md`)

One file per decision, numbered with three digits, referenced in text as `ADR-001`.

```markdown
# ADR-007: Use SQL Server Express

- Status: accepted
- Date: 2026-11-13
- Cards: ARC-02, ORD-04

## Context
Why a decision was needed.

## Decision
What we decided.

## Consequences
What follows from it, good and bad.
```

- `Status`: `proposed`, `accepted`, `superseded by ADR-012`, `deprecated`. It is required: a missing or unknown status shows as "status unknown" on the board, never as accepted.
- Never delete or rewrite an accepted decision: a change is a new ADR that supersedes it, and the old one gets `superseded by ADR-NNN`.
- `docs/adr/README.md` is the index (one line per ADR).

## 5. Board cards (`docs/board/cards/*.md`)

One file per section. Requirement sections take the module prefix (`kind: requirements`); work sections (project management, architecture, environment, validation) take their own prefix (`kind: work`). `order` sets the column order and the file name starts with it: the kit's work sections use 0 to 9 and 90 and up; requirement sections take 10 to 89 in the order they are added (`10-ord.md`, `11-inv.md`).

```markdown
---
id: ORD
title: Orders
order: 10
kind: requirements
description: Requirements from docs/requirements.md, ORD module.
---

## ORD-01 · The order shows the test location
> status: todo | priority: P2 | layer: core, ui | size: S | phase: 2 | depends: ARC-02 | risk: medium | q: Q-03

Notes or the rule it follows (see ADR-004).

- [ ] Acceptance criterion that can be checked
- [x] Another one

#### Log
- 2026-11-13 [created]
- 2026-11-14 [start] What is being done.
- 2026-11-15 [done] What was done, files, how to test.
```

| Key | Values |
|---|---|
| `status` | `todo`, `in-progress`, `review`, `done`, `blocked`, `decision` (waits on the supervisor); with the `client` module also `clarify` (waits on a client answer, needs `q:`) and `uat` (with the client for acceptance testing). Without the module, the board warns and reads `clarify` as `decision` and `uat` as `review` |
| `priority` | `P0` critical, `P1` high, `P2` medium, `P3` low |
| `layer` | keys of `board.layers` in the config, one or more |
| `size` | `S` hours, `M` about a day, `L` several days, `XL` a week or more |
| `phase` | a phase number from `_phases.md` |
| `depends` | card IDs that must be delivered first; an ID that does not exist holds the card until it is fixed |
| `risk` | `high`, `medium`, `low`; required on requirement cards with the `regulated` module |
| `q` | question IDs (`Q-03`) with the `client` module |

- A criterion handed to another card stays ticked with its new home: `- [x] Moved to ENV-04: CI runs the tests`; one that no longer applies is ticked with its reason: `- [x] Not needed (local only, ADR-004): CI runs the checks`. Every open `- [ ]` counts as not done.
- Any other key on the meta line (a typo such as `depend:`) is ignored, and the board warns about it.
- Log types: `created`, `start`, `progress`, `done`, `issue`, `fix`, `decision`, `client`, `uat`, `approved`, `blocked`, `note`.
- A card edit goes into the commit of the work it describes, so the tree is clean after each commit. A log line never waits for a commit hash or a pull request number that exists only after it: the commits of a card are found by the ID that starts their message (`git log --grep "^ORD-01"`), its pull request by its branch.
- `_phases.md` lists the phases: `## 1 · Architecture` then `> goal: … | gate: DES-08`. A gate card holds every card of its phase until it is `done`.
- A delivered card (`review`, `uat`, `done`) no longer holds up the cards that depend on it, except a gate.
- The section `id` is 1 to 6 capital letters or digits starting with a letter (`ORD`, `PM`); a file with another `id` is skipped. Headings inside code fences are examples, never cards.
- Links in the docs are relative paths, `#` anchors, `http(s)` or `mailto`; any other scheme (`javascript:`, `data:`) shows as plain text on the board.
- `docs/board/board.html` is generated and not in Git. Hooks in `.claude/settings.json` rebuild it after every Write or Edit of a board input (silent when the build is clean; warnings go back to Claude) and when Claude stops (warnings or a failure are shown to the user).

## 6. Reviews (`docs/reviews/`)

- `batches/N.txt`: the scope of batch N in plain English (what to review, which files or commits, what to skip).
- `batch-N.md`: the reviewer's raw output, never edited.
- `triage.md`: one section per batch; each finding is **accepted and fixed**, **supervisor decision**, **client question** or **rejected** with a reason.
- Finding IDs: `RV<N>-01`, `RV<N>-02`, …

## 7. Modules

| Module | Use it when | Adds |
|---|---|---|
| `client` | An outside client answers questions and accepts the work | `docs/questions.md`, statuses `clarify` and `uat`, the rule that a requirement is done only after client acceptance |
| `regulated` | The system falls under ISO 17025, GxP or another audit | `docs/validation/` (validation plan, URS/IQ/OQ/PQ, protocols, traceability, report), `risk` required on requirement cards |
| `migration` | Data moves from an old system | `docs/migration/` (plan, mapping, rehearsal log) |
| `design-first` | The client signs off screens before the build | `docs/design/` (screen list, approvals) and a design gate in the plan |
| `offline-deploy` | Installed on a client network without internet | `docs/runbook.md`, offline rules in CLAUDE.md |

## 8. Git

- Branch per card: `<card-id>-short-slug` (`ORD-01-test-location`).
- Commit messages in English, starting with the card ID: `ORD-01: show the test location on the order`. Work on several cards names them all (`ORD-01, ORD-02: …`); board and hand-off upkeep that belongs to no card starts with `docs:` (`docs: update NEXT.md`); a kit tools update (`/devflow:update`) is `chore: update devflow tools to <version>`.
- Merge to `main` through a pull request (`/devflow:pr`; local only: the branch and its description) after review, the supervisor's approval and passing checks, the way `delivery.merge` says.
- Pull request title: `<IDs>: <card title>`; description: the sections of `.github/pull_request_template.md`.
- Tag every release handed to anyone: `v1.2.0`, `v1.3.0-rc.1`. `CHANGELOG.md` gets the section at the same time.

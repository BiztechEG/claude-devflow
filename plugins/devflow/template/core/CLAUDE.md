# CLAUDE.md: {{PROJECT_NAME}}

{{PROJECT_SUMMARY}}

## Current phase and hard rules

- The current phase, what is allowed in it and what comes next are in `NEXT.md` (session start) and `docs/plan.md` (phases and gates).
- **Commit only when the supervisor asks.** Commit messages are in English and start with the card ID (`ORD-01: …`; several cards: all their IDs; board or `NEXT.md` upkeep alone: `docs:`).
- **No work outside the board.** A new request is recorded in `docs/requirements.md` with an ID first, then gets its card (`/devflow:request`). Work found while doing a card becomes its own card (`/devflow:card`), not a hidden extra.
- **Decisions are recorded the moment they are made** as an ADR in `docs/adr/` (`/devflow:decision`). Never rewrite an accepted ADR: supersede it with a new one.
- **Independent review:** finished work goes to the reviewer set in `.project/config.json` (`/devflow:review`). The reviewer only reads; Claude triages the findings in `docs/reviews/triage.md` and applies the accepted fixes.

## Roles

- The **supervisor** (the user) directs, decides, reviews and approves; talks to the client.
- **Claude** implements everything: analysis, design, code, tests, docs and board updates. With every card: what changed, where, and how to test it.
{{CLIENT_ROLE}}

## Communication

{{COMMUNICATION}}

## Workflow

The full process is in `docs/process.md`. In short:

1. **Start of session:** read `NEXT.md`, then run `node tools/board/build-board.mjs` for the next card.
2. **Start a card:** set `status: in-progress`, add `[start]` to its log, create the branch `<card-id>-slug`.
3. **While working:** log `[issue]` or `[note]` when it happens; record decisions as ADRs at once.
4. **Finish a card:** tests as `docs/testing.md` says, `node tools/checks/run-checks.mjs` passes, docs updated, `[done]` log line (what was done, files, how to test), `status: review`, both in the card's commit, end-of-task summary (`/devflow:summary`).
5. **Pull request and review:** `/devflow:pr open <ID>`, then `/devflow:review` on its diff; triage; fix; `/devflow:pr merge <ID>` after the supervisor approves.
6. **End of session:** `/devflow:handoff` rewrites `NEXT.md`.
7. **Release:** `/devflow:release` adds the `CHANGELOG.md` section and the tag.

## Source of truth: `docs/`

| File | Purpose |
|---|---|
| `NEXT.md` | Where we stopped and what comes next. Short; rewritten each session |
| `docs/process.md` | How work flows, statuses, definition of ready and done, pull requests |
| `docs/testing.md` | What is tested, with which tools, and the checks before a pull request and a merge |
| `docs/requirements.md` | All requirements with stable IDs (`ORD-01`) |
| `docs/plan.md` | Phases, deliverables, gates |
| `docs/adr/` | One file per decision (`ADR-001`) |
| `docs/architecture/` | Architecture notes |
| `docs/board/cards/` | The board (`node tools/board/build-board.mjs`) |
| `docs/reviews/` | Review batches and their triage |
{{MODULE_DOCS}}

Format of every file: `docs/conventions.md`.

## Stack

{{STACK}}

## Non-negotiable constraints

{{CONSTRAINTS}}

## Code conventions

- Keep it simple: no extra layers, patterns or packages without a reason recorded in an ADR.
- Comment only non-obvious logic.
- Tests as `docs/testing.md` says: every rule of a requirement, with the requirement ID in the test name or attribute; every bug gets a failing test first.
- Never commit secrets or client data. Client files and backups live outside the repo or in ignored folders.
{{CODE_CONVENTIONS}}

## Commands

- Board: `node tools/board/build-board.mjs` (prints the next card; `--check` validates only)
- Checks before a pull request and a merge: `node tools/checks/run-checks.mjs` (`--list` shows them; they live in `.project/config.json` → `delivery.checks`)
{{REVIEW_COMMAND}}
{{COMMANDS}}

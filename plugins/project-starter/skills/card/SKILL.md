---
name: card
description: Add a work card (not a client requirement) to the board of a project made with the project-starter kit, or start/finish a card with the right status and log lines. Use for setup, architecture, environment, validation or other internal work, and for work discovered while doing another card.
argument-hint: "new <title> | start <ID> | done <ID>"
---

# Work cards

Arguments: `$ARGUMENTS`. Format: `docs/conventions.md` §5. Statuses and the definition of done: `docs/process.md`. What must be tested: `docs/testing.md`.

## New card

1. Pick the work section (`docs/board/cards/*.md` with `kind: work`: PM, ARC, ENV, …) or create one with its own prefix.
2. Next ID in that section; never reuse one.
3. Meta line: `status`, `priority`, `layer` (keys from `.project/config.json` → `board.layers`), `size`, `phase`, `depends`. Work found while doing another card depends on it or is depended on, and is never hidden inside it.
4. Acceptance criteria (`- [ ]`) and `#### Log` with `- <today> [created]`.

## Start a card

- Check it is ready (dependencies delivered, phase gate done, questions answered); if not, say what it waits on.
- `status: in-progress`, log `- <today> [start] <what is being done>`.
- Branch: `git switch -c <ID>-short-slug` from an up-to-date `main` (ask before switching if the tree has uncommitted work).

## Finish a card

- Tests written as `docs/testing.md` §2 says (rules with the requirement ID, a failing test first for a bug); `node tools/checks/run-checks.mjs` passes; docs updated; every criterion checked, moved to another card as `- [x] Moved to <ID>: <criterion>`, or `- [x] Not needed (<reason>): <criterion>` (an open `- [ ]` counts as not done, even struck through).
- Log `- <today> [done] <what was done>, <files>, test: <how>`. Keep it to two or three lines: details live in the commit and the PR. No commit hash: the line goes into that same commit (`docs/conventions.md` §5).
- `status: review`, in the same commit as the work when the supervisor asks to commit. Then `/project-starter:pr open <ID>` (pull request, or the branch ready for review when local only), `/project-starter:review` on its diff, and `/project-starter:summary`. The merge comes after the supervisor approves (`/project-starter:pr merge <ID>`).

## Approve a card

Only when the supervisor says so: log `- <today> [approved] <by whom, what>` and set `status: done`. With the `client` module a requirement card goes to `uat` first and becomes `done` only after the client accepts it (`[uat]`, then `[approved]`).

Valid log types only: `created`, `start`, `progress`, `done`, `issue`, `fix`, `decision`, `client`, `uat`, `approved`, `blocked`, `note`. A card the supervisor defers is `status: decision`, not a new log type. Run `node tools/board/build-board.mjs` after edits (the hook does it too) and fix warnings.

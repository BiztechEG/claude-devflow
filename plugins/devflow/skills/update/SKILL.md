---
name: update
description: Update the kit's tools (board generator, checks runner, review scripts) in a project made with the devflow kit to the installed kit version, without touching cards, docs, CLAUDE.md or the config. Use when the user asks to update, upgrade or refresh the board or the kit tools of an existing project, or to bring a project up to a newer devflow version.
---

# Update the kit's tools in this project

Only `tools/board/`, `tools/checks/` and `tools/review/` are updated, plus `.project/kit.json` (the kit version and a hash of each tool file as the kit wrote it). Cards, `docs/`, `CLAUDE.md`, `README.md`, `.project/config.json`, the CI workflow and the hooks stay as they are. Messages in the reply language (`.project/config.json` → `replyLanguage`).

1. **Where:** the project root (it has `.project/config.json`). If `git status --short tools/ .project/kit.json` shows uncommitted changes, say so before going on: the update would mix with them.
2. **Dry run:** `node "${CLAUDE_PLUGIN_ROOT}/scripts/update.mjs" --target .` It prints the project's recorded version → the kit's, and one line per file:
   - `add`, `update`: written by `--apply` (missing, or unchanged since the kit wrote it).
   - `current`: nothing to do.
   - `changed`: edited in this project since the kit wrote it.
   - `unknown`: no record (the project was made before the kit recorded hashes, 0.5.2).
   "Everything is current" → say so and stop.
3. **Files that need a decision** (`changed`, `unknown`): for each, compare the project's file with the kit's (`git diff --no-index --stat <project file> "${CLAUDE_PLUGIN_ROOT}/template/core/<same path>"`, then the lines that matter) and say in one line whether the project's copy has its own edits or is only older. Then one AskUserQuestion (reply language, recommended option first): usually "replace the files that are only older, keep the ones with own edits". A kept file keeps its own edits; tell the supervisor what the kit changed in it, so they can merge it by hand later.
4. **Apply:** `node "${CLAUDE_PLUGIN_ROOT}/scripts/update.mjs" --target . --apply` plus `--include <path,...>` for the `changed` / `unknown` files the supervisor chose to replace (or `--all` when they chose all).
5. **Check:** `node tools/board/build-board.mjs` (rebuilds the board with the new generator). When `tools/checks/` changed, also `node tools/checks/run-checks.mjs`; a failure is reported, never hidden.
6. **Report** (`/devflow:summary` format): the version from → to, the files written and kept, how to look at the result (open `docs/board/board.html`). Commit only when the supervisor asks: `chore: update devflow tools to <version>` (no card; the tools and `.project/kit.json` only).

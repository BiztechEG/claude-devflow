---
name: kickoff
description: Start a new project with the devflow way of working (CLAUDE.md, requirements with stable IDs, ADRs, board, review scripts, NEXT.md, CHANGELOG). Use when the user wants to start, set up or bootstrap a new project or repo, or apply the kit to an empty folder.
argument-hint: "[target folder] [project name]"
---

# Kickoff

Creates a project from the kit template, then fills what only a conversation can fill. Arguments: `$ARGUMENTS`.

The kit's scripts are in `${CLAUDE_PLUGIN_ROOT}/scripts/` (the plugin folder, two levels above this skill's base directory).

## 1. Gather

1. **Target folder:** the argument, else the current working directory. List it first. If it has `.project/config.json` it is already a kit project: the scaffold refuses to run, so stop and say so (a module is added by hand, see the scaffold's message). Otherwise the scaffold never overwrites a file, but if the folder already has a `CLAUDE.md` or `docs/`, tell the user what will be skipped and ask before going on.
2. **Defaults:** read `~/.claude/devflow.json` (`defaultReplyLanguage`, `defaultPreset`, `defaultReviewer`, `defaultReviewerModel`, `defaultModules`, `defaultHost`, `defaultMerge`, `defaultCoverage`; without a key: preset `none`, reviewer `codex`, no modules, host not chosen, merge `squash`, no coverage minimum). The reply language is asked **once per machine, never per project**: only when that file has no `defaultReplyLanguage`, ask for it (`ar-eg` or `en`), save it with `node "${CLAUDE_PLUGIN_ROOT}/scripts/set-language.mjs" <lang> --global`, and use it for this project too. A project switches later with `/devflow:set-language`.
3. **Ask only what you cannot infer** from the conversation, in one AskUserQuestion call, in the reply language, recommended option first:
   - project name and a one-paragraph summary (often already in the conversation: then do not ask);
   - preset: a folder of `${CLAUDE_PLUGIN_ROOT}/template/presets/` (`dotnet`: .NET with Blazor or a Web API; `laravel`: PHP and Laravel; `nextjs`: Next.js and React; `python`: FastAPI) or `none` (default from the file; infer it when the conversation names the stack). AskUserQuestion takes at most 4 options: offer the 3 presets that fit best and `none`; the user can type another in "Other";
   - modules (multiSelect): `client` (outside client answers questions and accepts the work), `regulated` (ISO/GxP audit: validation evidence, risk per requirement), `migration` (data from an old system), `design-first` (client signs off screens before the build), `offline-deploy` (installed on a network without internet). No module = the light setup;
   - reviewer only if the user hinted at something other than the default (`codex` unless the file says otherwise; also `opencode`, `agents`, `none`).
4. **How work is delivered:** a second AskUserQuestion call (same language, recommended option first), skipping what the conversation or the defaults file already settled:
   - where the repository and its pull requests live: "not decided yet" (recommended unless the user said: card ENV-02 stays a decision), `github`, `gitea` (also Forgejo), `azure`, `local` (no remote);
   - merge style: `squash` (recommended: one commit per card on `main`), `merge` (keep the branch history), `rebase` (each commit must stand alone);
   - coverage minimum: none (recommended for a start: `docs/testing.md` §2 says what must be tested), 70%, 80%. It is a gate on every pull request, so say that a project without a preset sets where the report is written in ARC-02.

## 2. Create

One line, so it runs the same in Bash and PowerShell:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/scaffold.mjs" --target "<dir>" --name "<name>" [--code-name <CodeName>] --summary "<summary>" --lang <lang> --preset <preset> --modules <a,b> --reviewer <tool> --merge <style> --host <host or none> --coverage <n or none>
```

Always pass `--host` and `--coverage`: `--host none` when it is not decided and `--coverage none` when there is no minimum, so a default in `~/.claude/devflow.json` never overrides the supervisor's answer. When the question was skipped because the defaults file settled it, pass that default. `--code-name` is the name in code (solution, projects, namespaces); without it the scaffold makes one from the name ("Task API" → `TaskApi`), so pass it only when the supervisor wants another. Read its output: the code name, created files, skipped files, the delivery line, phases, the git line (it runs `git init -b main` unless the folder is already inside a repository; nothing is committed), and placeholders left to fill.

## 3. Fill

1. If the scaffold listed "placeholders left for Claude to fill" (usually `{{PROJECT_SUMMARY}}` when no `--summary` was given, or `{{CODE_NAME}}` when the name has no Latin letters to make a code name from: ask the supervisor for one such as `TaskApi`), replace those, and only those. The `{{…}}` in `tools/review/prompt.md` are filled by `prompt.mjs` at each review run: leave them.
2. Without a preset, the stack is card ARC-02 (`decision`, waits on the supervisor) and ENV-01 waits on it; record nothing unless the conversation already settled the stack. If a preset or stack was chosen and no ADR records the stack yet, record it the way `/devflow:decision` does: the next free number after the highest `docs/adr/NNN-*.md` (never a fixed number, never over an existing file), and its row in `docs/adr/README.md`. The ADR records *why* this stack (the supervisor's choice and the alternative), points at `CLAUDE.md` → Stack for the list instead of copying it, and names what the preset leaves open (hosting, authentication, where the repository lives, and the preset's `openChoices`, such as the front end or the language). Those choices are also a criterion on ENV-01: record them in this ADR when the conversation settled them (and tick that criterion with the ADR); otherwise ENV-01 asks before building the skeleton.
3. **Delivery chosen at kickoff:** when the supervisor answered the delivery questions (host, merge style or coverage), record one ADR the same way (next free number, index row): the choices made, why, and what is left to ENV-02 (the host when it was not decided); it points at `.project/config.json` → `delivery` and `docs/testing.md` instead of copying them. Then ENV-02 (`docs/board/cards/02-env.md`):
   - **no host:** status stays `decision`; add `- <today> [note] merge <style>, coverage <n or none> (ADR-NNN); host still to choose`.
   - **`github`, `gitea`:** tick "Remote chosen" with the ADR, set `status: todo`, add `- <today> [decision] <host>, <merge> merge (ADR-NNN)`. The preset's `.github/workflows/ci.yml` runs on both.
   - **`azure`:** as above, and copy `.github/pull_request_template.md` to `.azuredevops/pull_request_template.md` (Azure DevOps does not read `.github/`). The preset's `ci.yml` is GitHub/Gitea Actions: add a note to the CI criterion that it needs an `azure-pipelines.yml` running `node tools/checks/run-checks.mjs`, which stays open for ENV-02.
   - **`local`:** delete the preset's `.github/workflows/ci.yml` if the scaffold created it (keep the PR template: it is the description format), tick "Remote chosen" with the ADR (local only is the choice), tick the CI and protection criteria as `- [x] Not needed (local only, ADR-NNN): …`, add `- <today> [done] local only, <merge> merge (ADR-NNN); CI and protection not needed, test: ENV-02 has no open criterion on the board`, and set `status: review`.
4. Requirements already given in the conversation: record them as `/devflow:request` does (section, ID, row, card with acceptance criteria).
5. Adjust `docs/plan.md` and `docs/board/cards/_phases.md` if the project needs other phases (same numbers in both).
6. Build the board: `node tools/board/build-board.mjs` from the project root. Fix every warning.
7. **PM-01** (`docs/board/cards/00-pm.md`): add `- <today> [progress] <ADRs and requirement IDs recorded>; board builds with no warnings` (only after the build in step 6 really had none). Requirements are not a PM-01 criterion: a project may start before any are known, and PM-02 collects them before the estimate.
8. **`NEXT.md`:** bring its lines up to date with what this kickoff added: the real branch from the scaffold's git line (or "no repository"), questions raised (`Waiting on others`), decisions left to the supervisor such as ENV-02 (`Waiting on the supervisor`), and the next card the board printed.

## 4. Report

End with the summary in the reply language (`/devflow:summary` format): what was created, the choices made (language, preset, modules, reviewer, host, merge style, coverage), how to open the board (`tools/board/build-board.cmd` on Windows, or open `docs/board/board.html` after a build), what waits on the supervisor (PM-01 review, ENV-02 remote choice, ARC-02 stack choice when there is no preset), and the next card. Nothing is committed until the supervisor asks.

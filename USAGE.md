# Using project-starter

A short guide for day-to-day use. What the kit is and how it is built: [README.md](README.md).

## 1. Install (once per machine)

```
claude plugin marketplace add <github-owner>/project-starter
claude plugin install project-starter@biztech
```

Then restart Claude Code. What the machine needs (Git, Node 18+, Codex or the `agents` reviewer): [README.md](README.md#needs). Always type the full command name (`/project-starter:review`, not `/review`).

## 2. Start a project

1. Open Claude Code in an empty folder.
2. Run `/project-starter:kickoff`, and tell it in the same message what the project is and any requirements you already know.
3. Answer its questions: name, preset (`dotnet` or `none`) and modules; then how work is delivered: where pull requests live (or not decided yet), the merge style, and a coverage minimum if you want one.
4. Read what it reports, then read the project's `CLAUDE.md` and `docs/process.md`. Card PM-01 waits for your approval of them.
5. Choose where the repository lives (card ENV-02). With preset `none`, also choose the stack (card ARC-02).

| Module | Choose it when |
|---|---|
| `client` | An outside client answers questions and accepts the work |
| `regulated` | The system is audited (ISO, GxP): risk per requirement, validation evidence |
| `migration` | Data comes from an old system |
| `design-first` | The client signs off screens before the build |
| `offline-deploy` | It is installed on a network without internet |

No module gives the light setup.

## 3. Every day

| You want to | Say |
|---|---|
| Know where things stand | Start the session; Claude reads `NEXT.md` and gives the next card |
| Add a feature, change or bug | `/project-starter:request <one sentence>` |
| Add internal work (setup, refactor, tooling) | `/project-starter:card new <title>` |
| Work on a card | `/project-starter:card start ENV-01`, and later `done ENV-01` |
| Open the pull request of a finished card | `/project-starter:pr open ENV-01` (runs the checks first) |
| See what waits on each branch | `/project-starter:pr status` |
| Merge an approved card | `/project-starter:pr merge ENV-01` |
| Approve a finished card | Tell Claude it is approved; the card goes to `done` |
| Record a decision | `/project-starter:decision <the decision or the question>` |
| Ask the client something | `/project-starter:question ask <question> [cards]`, then `answer Q-01 <answer>` |
| Get finished work reviewed | `/project-starter:review ENV-01`, then read the triage |
| Stop for the day | `/project-starter:handoff` |
| Hand a build to anyone | `/project-starter:release 1.2.0` |
| Switch the reply language | `/project-starter:set-language en` (or `ar-eg`; add `--global` for new projects) |

Claude never commits, merges, tags or pushes until you say so.

What must be tested and which checks must pass before a pull request and a merge: the project's `docs/testing.md`. Run the checks yourself with `node tools/checks/run-checks.mjs`. The policy (host, merge style, checks, coverage) is in `.project/config.json` → `delivery`; changing it is a decision (ADR).

## 4. The board

- Windows: double-click `tools/board/build-board.cmd` to build it and open it in the browser.
- Any system: `node tools/board/build-board.mjs`, then open `docs/board/board.html`. Add `--watch` to keep it up to date while you work.
- Claude rebuilds it after every edit. If it reports a warning (a missing card, an unknown status), the board files need a fix.

## 5. Reviews

- **codex** (default): Claude checks both Codex limits first and runs the batch only if there is room; otherwise it says when to retry.
- **agents**: a read-only reviewer agent inside Claude; no other tool needed.
- **opencode**: costs API money; Claude asks before each batch.

The reviewer only reads. Its report is kept as written in `docs/reviews/batch-N.md`; Claude checks each finding and logs the verdict in `docs/reviews/triage.md`. Decisions it cannot take come to you.

## 6. Defaults for new projects

`~/.claude/project-starter.json` (every key optional):

```json
{ "defaultReplyLanguage": "ar-eg", "defaultPreset": "dotnet", "defaultReviewer": "codex", "defaultModules": [], "defaultHost": "github", "defaultMerge": "squash", "defaultCoverage": 80 }
```

## 7. After changing the kit

Claude Code runs a cached copy of the plugin. After editing this repo, bump `version` in `plugins/project-starter/.claude-plugin/plugin.json`, run `claude plugin marketplace update biztech` and `claude plugin update project-starter@biztech`, then restart Claude Code.

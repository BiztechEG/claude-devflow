# {{PROJECT_NAME}}

{{PROJECT_SUMMARY}}

## Run it

Needs Git and Node.js 18 or later (the board and the checks run on Node).

{{RUN_STEPS}}

Before a pull request: `node tools/checks/run-checks.mjs` runs every check (`--list` shows them; `docs/testing.md` §4).

## Where things are

| Path | What |
|---|---|
| `NEXT.md` | Where work stopped and what comes next |
| `docs/` | Requirements, plan, decisions (ADR), architecture, board, reviews ([docs/README.md](docs/README.md)) |
| `tools/board/` | Board generator: `node tools/board/build-board.mjs`, then open `docs/board/board.html` |
| `tools/review/` | Independent review batches |
| `CHANGELOG.md` | What changed in each release |

## How we work

See [docs/process.md](docs/process.md).

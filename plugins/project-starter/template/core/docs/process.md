# Process

How work flows in {{PROJECT_NAME}}. File formats are in [conventions.md](conventions.md).

## 1. Roles

| Role | Does |
|---|---|
| Supervisor | Sets priorities, decides, reviews and tries every card, approves merges and releases |
| Claude | Analysis, design, code, tests, docs, board updates, triage of review findings |
| Reviewer | Independent read-only review of finished work (tool in `.project/config.json`) |
{{CLIENT_ROLE_ROW}}

## 2. The life of a request

```
request ─► docs/requirements.md (ID) ─► card on the board ─► ready? ─► in-progress
                │                                                        │
         unclear? ─► question                                            ▼
                                          branch ─► tests ─► checks ─► pull request ─► review
                                                                                       │
                                         decision on the way ─► ADR                    ▼
                                                                  supervisor approves ─► merge ─► done
```

## 3. Statuses

| `status` | Meaning | Moved by |
|---|---|---|
| `todo` | Recorded, not started. Ready once its dependencies are delivered | Claude |
| `in-progress` | Being worked on | Claude |
| `review` | Claude finished; the supervisor reviews and tries it | Supervisor |
| `decision` | Waits on a supervisor decision or action | Supervisor |
| `blocked` | Stopped for an outside reason, written in the log | — |
| `done` | Finished and approved | Supervisor |
{{CLIENT_STATUS_ROWS}}

A delivered card (`review`{{UAT_COMMA}} or `done`) no longer holds up the cards that depend on it, except a phase gate, which opens its phase only when `done`.

## 4. Definition of ready

A card can start when:

- its requirement is `agreed` in `docs/requirements.md` (requirement cards);
- it has acceptance criteria (`- [ ]`) that can be checked;
- every card in `depends` is delivered and its phase gate is `done`;
- open questions it depends on are answered.

## 5. Definition of done

A card is done when:

- every acceptance criterion is checked (`- [x]`) or explicitly moved to another card;
- tests cover its rules and criteria as [testing.md](testing.md) §2 says, and `node tools/checks/run-checks.mjs` passes (build, the whole test suite, board{{COVERAGE_DONE}});
- docs that describe it are updated (requirements, architecture, ADRs, README, runbook);
- the reviewer's findings are triaged and the accepted ones fixed;
- the `[done]` log line says what was done, the files and how to test it;
- the supervisor approved it{{CLIENT_DONE_RULE}}.

## 6. Branches, commits and review

- One branch per card: `<card-id>-short-slug`. Small cards may share a branch only when they change the same files.
- Commits start with the card ID: `ORD-01: show the test location on the order` (several cards: all their IDs; upkeep of the board or `NEXT.md` alone: `docs:`). Commit only when the supervisor asks. The card's log lines and status go into the same commit as the work (no line waits for a hash: `docs/conventions.md` §5), so the tree is clean when the pull request opens and when it merges.
- Policy in `.project/config.json` → `delivery`: where pull requests live (`host`, chosen in ENV-02), how they merge (`merge`), the checks and the coverage floor. Changing it is a supervisor decision and an ADR.
- **Pull request** (`/project-starter:pr open <ID>`): the checks pass first, then the description follows `.github/pull_request_template.md` (cards, what changed, how to test, checks, docs, review, definition of done). Local only: the branch and that description, reviewed on `git diff main...<branch>`.
- Review happens **before** merge, on the pull request's diff. One batch per card or per small group of related cards, so findings stay small and easy to triage.
- **Merge** (`/project-starter:pr merge <ID>`) only when the supervisor approved, the triage is finished, the branch is up to date with `main` and the checks pass again. {{MERGE_RULE}}

## 7. Releases

- Every build handed to anyone (supervisor test machine, client, server) is a tag: `vX.Y.Z` or `vX.Y.Z-rc.N`.
- `CHANGELOG.md` gets the section in the same commit (`/project-starter:release`).
- The tag is what is installed; never install from an untagged working tree.

## 8. Sessions

- **Start:** read `NEXT.md`, build the board, continue the card in progress or take the next card.
- **End:** `/project-starter:handoff`: `NEXT.md` is rewritten (not appended) with where we stopped, what is uncommitted, what is waiting on whom, and the next step. History lives in card logs, Git and `CHANGELOG.md`, not in `NEXT.md`.

## 9. Keeping docs small

- One fact lives in one place; other files link to it.
- `NEXT.md` stays under one screen. `README.md` stays one page.
- A file that grows past about 40 KB is split by topic.
- Card logs are short: details belong in the commit, the PR and the ADRs.

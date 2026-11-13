---
name: summary
description: Write the end-of-task summary for the supervisor in the project's reply language - what changed, where, how to test it, what waits on them. Use at the end of every task or card in a project made with the project-starter kit.
---

# End-of-task summary

Language: `.project/config.json` → `replyLanguage` (`ar-eg`: Egyptian Arabic, plain, with English technical terms; `en`: plain English). Code, paths and commands stay as they are.

Write for someone who can read code but did not write it. Keep it short; no repeat of what was already said in this turn.

1. **What changed:** per card ID, one or two lines in plain words (the behaviour, not the diff).
2. **Where:** the main files as clickable links (`[file.cs](src/file.cs#L42)`), and new ADRs.
3. **How to test:** exact commands, or the screen and the steps to click, and what you should see.
4. **Checks done:** `node tools/checks/run-checks.mjs` and its result (each check, coverage; say plainly if something failed or was skipped), the pull request or branch, review batch and its triage.
5. **Waiting on you:** decisions, approvals (cards in `review`), whether to commit, pull requests ready to merge.
6. **Next:** the next card.

Never claim a check you did not run. If a step was skipped, say so.

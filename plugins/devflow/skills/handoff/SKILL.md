---
name: handoff
description: End-of-session hand-off - rewrite NEXT.md (where we stopped, uncommitted work, what waits on whom, next step) and bring card logs up to date. Use when the user ends a session, says they are stopping, or asks to save the state, in a project made with the devflow kit.
---

# Session hand-off

`NEXT.md` is the first thing the next session reads. It is **rewritten, not appended**, and stays under one screen. History belongs in card logs, Git and `CHANGELOG.md`.

1. **Cards:** every card touched this session has its status and a log line for what happened (`[progress]`, `[done]`, `[issue]`). No card left `in-progress` without saying where it stopped.
2. **Facts:** `git status --short`, `git log --oneline -5`, current branch, card branches not merged yet (`git branch --no-merged main`) and their pull requests; running background jobs (reviews, builds) and their output files; the next card from `node tools/board/build-board.mjs`.
3. **Rewrite `NEXT.md`** with exactly these lines:
   - **Last session:** date and one line of what was done (card IDs).
   - **Branch / uncommitted:** branch name and what is not committed yet, not counting `NEXT.md` itself (or "clean").
   - **Running:** background jobs still running, with where their output lands (or "nothing").
   - **Waiting on the supervisor:** cards in `review` or `decision`, pull requests ready to merge, questions to answer.
   - **Waiting on others:** client questions (`clarify`), reviewer limits and their reset time.
   - **Next step:** the one thing to do first next session, then the next card.
   - **Watch out:** at most three gotchas found this session that the next session must know (only if any).
4. Do not commit unless the supervisor asks.
5. Tell the user in the reply language: the next step and anything waiting on them.

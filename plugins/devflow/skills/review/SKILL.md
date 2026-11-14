---
name: review
description: Send finished work to the independent read-only reviewer (Codex by default, opencode or review agents per .project/config.json), then triage the findings and apply the accepted fixes. Use after a card is finished, or when the user asks for a review, in a project made with the devflow kit.
argument-hint: "<card IDs, branch or commits> | triage <N>"
---

# Independent review

Scope: `$ARGUMENTS`. Files: `docs/reviews/` (`docs/conventions.md` §6). The reviewer only reads; Claude triages.

## 1. Scope the batch

- Prefer one batch per card or small group of related cards, on its diff: `git diff main...<branch>` or the named commits. Small batches cost less and triage faster.
- **Uncommitted work:** run `git status --short` first. A committed-range diff does not show staged, unstaged or new files, so when the work is not committed, the scope says so and lists them: "review the working tree: `git diff HEAD` plus these new files: …".
- Next batch number: highest `docs/reviews/batch-N.md` or `batches/N.txt` + 1. The script refuses a number whose report already exists (reports are never replaced).
- Write `docs/reviews/batches/N.txt` in plain English: what the work is (cards, ADRs), which commits or diff to read, which files, what to skip, "run no builds or tests". Under 15 lines.

## 2. Run it (reviewer from `.project/config.json` → `reviewer.tool`)

- **codex:** run `node tools/review/usage.mjs`. Send only if what is left of **both** limits is above the batch's estimate (small 5-15%, normal 15-25%); otherwise tell the user the reset time and wait for it (`run-review.sh --at HH:MM N`). Then `bash tools/review/run-review.sh N` in the background (`run_in_background`), and wait for the completion notice; do not poll.
- **opencode:** it spends the user's API money: ask before each batch. Then `bash tools/review/run-review.sh N` in the background (one batch at a time). Its `plan` agent is read-only only as far as the user's opencode permissions allow; the script warns if the working tree changed during the run, and then nothing from that batch is trusted until `git status` is checked.
- **agents:** save the batch diff to `tools/review/logs/batch-N.diff` (ignored by Git; for uncommitted work, `git diff HEAD` plus the new files' paths), build the prompt with `node tools/review/prompt.mjs N`, and spawn the plugin's read-only agent `devflow:reviewer` with that prompt as its brief plus one line naming the diff file (never your own conclusions). Save its reply to `docs/reviews/batch-N.md` exactly as returned: no header, summary or note added.
- **none:** skip the review and say so in the summary.

Never stop a running review unless the user asks. Do not edit the reviewed files while it runs.

## 3. Triage

1. Read `docs/reviews/batch-N.md` (never edit it).
2. Check every finding against the code or docs yourself. Verdicts: **accepted and fixed**, **supervisor decision**, **client question** (client module), **rejected** with a concrete reason.
3. Add a section to `docs/reviews/triage.md` (`## Batch N: <scope>`, one row per finding) and the row in the batches table.
4. Apply the accepted fixes; tests pass; log `[fix] RVN-03: …` on the card when the fix is worth noting.
5. Supervisor decisions: one AskUserQuestion call (reply language, recommended option first), then ADRs (`/devflow:decision`). If the supervisor cannot be asked now, the finding stays `supervisor decision` in the triage, the card log says what waits, and `NEXT.md` lists it.
6. A large fix gets a small re-review batch of only those changes.
7. Report: counts per verdict, what changed, what waits on the supervisor. The fixes, the triage section, the batch files and the card lines stay on the card's branch and go into one commit when the supervisor asks (`<IDs>: review batch N fixes`): `/devflow:pr merge` needs a clean tree.

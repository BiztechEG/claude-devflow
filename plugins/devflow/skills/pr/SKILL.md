---
name: pr
description: Open, check or merge the pull request of a finished card in a project made with the devflow kit - runs the checks from .project/config.json, writes the description from the PR template and the card, opens it on the host (or prepares the branch for review when local only), and merges it the agreed way after the supervisor approves. Use when a card is finished and its work should go to main, or when the user asks to open, check or merge a PR.
argument-hint: "open <card IDs> | status [<card IDs>] | merge <card IDs or PR number>"
---

# Pull requests

Arguments: `$ARGUMENTS`. Policy: `.project/config.json` → `delivery` (`host`, `merge`, `checks`, `coverage`; `docs/conventions.md` §2). What must be tested and checked: `docs/testing.md`. Definition of done: `docs/process.md` §5. Description format: `.github/pull_request_template.md`.

`delivery.host`: `github` (`gh`), `gitea` (`tea`), `azure` (`az repos`), `local` (no remote: the "pull request" is the branch and its description, reviewed on `git diff main...<branch>`), or `null` (not chosen yet, card ENV-02: work as `local` and say so). If the host's CLI is missing or not signed in, push and give the supervisor the compare link instead; never install a CLI or sign in for them.

## open

1. **Branch:** the card's branch `<ID>-slug` (`git branch --list "<ID>-*"`). Never open from `main`. Several cards on one branch: only when `docs/process.md` §6 allows it.
2. **Card ready to deliver:** status `in-progress` or `review`; every criterion `- [x]` (or moved or not needed, with the reason); a `[done]` log line with how to test; `status: review`. If not, finish it first (`/devflow:card done <ID>`) or stop and say what is missing. These card edits are committed with the work in step 4; no log line is written after the commit or the push, so the tree stays clean for the merge (`docs/conventions.md` §5).
3. **Checks:** `node tools/checks/run-checks.mjs`. A failure stops here: fix it (or report it) and run again. Never edit `delivery.checks` or the coverage floor to make a run pass; that is a supervisor decision and an ADR.
4. **Uncommitted work:** `git status --short`. Commit only when the supervisor asks: if work is uncommitted, ask once (AskUserQuestion, reply language) whether to commit it as `<IDs>: <what>`; without a yes, stop.
5. **Description:** fill the sections of `.github/pull_request_template.md` from the card (title, criteria, `[done]` line), `git diff --stat main...<branch>`, the checks output (PASS/FAIL lines and coverage), the docs and ADRs changed, and the review (`pending` until it runs). Tick only the definition-of-done boxes that are really true now. Save it to `tools/review/logs/pr-<branch>.md` (ignored by Git). Title: `<IDs>: <card title>`.
6. **Open it.** Pushing is outward: push only when the supervisor asked in this conversation to open the pull request (for example `/devflow:pr open <ID>`). If this skill started on its own, or they asked only for a check, ask first (AskUserQuestion) and push nothing without a yes. Run the host commands from Bash, not PowerShell (PowerShell reads `@file` as splatting and joins `$(cat …)` lines with spaces).
   - `github`: `git push -u origin <branch>`, then `gh pr create --base main --head <branch> --title "<title>" --body-file tools/review/logs/pr-<branch>.md`.
   - `gitea`: push, then `tea pr create --base main --head <branch> --title "<title>" --description "$(cat tools/review/logs/pr-<branch>.md)"`, or the compare link.
   - `azure`: push, then `az repos pr create --source-branch <branch> --target-branch main --title "<title>" --description "@tools/review/logs/pr-<branch>.md"`. Azure reads its template from `.azuredevops/pull_request_template.md`; copy it there once if it is missing.
   - `local` or `null`: no push. Show the description in the summary.
7. **Next:** `/devflow:review <IDs>` on this branch, unless a batch already covers these commits. Then the summary (`/devflow:summary`): the PR link or branch, the checks result, what waits on the supervisor.

## status

For each open card branch (or the IDs given): commits ahead of and behind `main` (`git rev-list --left-right --count main...<branch>`), uncommitted files, the last checks result in the card log, the review batch and whether its triage is finished; with a host also the PR state and its CI (`gh pr view <n> --json state,mergeable,reviewDecision,statusCheckRollup`, or the host's equivalent). End with what each one waits on.

## merge

Never without the supervisor's approval in this conversation or an `[approved]` line on every card in it. Then:

1. **Review finished:** the batch covering this branch has a triage section in `docs/reviews/triage.md` with every finding decided; no finding left as `supervisor decision` or as an unanswered `client question`, and every accepted fix is in the branch. Changes made after the batch were reviewed again, or the supervisor said they need no review.
2. **Approval on the card, before the merge:** if the approval was given in this conversation and a card has no `[approved]` line yet, record it on the branch as `/devflow:card` does (`- <today> [approved] <by whom, what>`, status `done`); with the `client` module a requirement card goes to `uat` instead (`- <today> [uat] <what the client will test once merged>`) and becomes `done` after the client accepts it. Commit it on the branch as `<IDs>: approved by the supervisor`: the supervisor's request to merge covers this commit, which holds only card files (say so in the summary). The merge then carries it, and nothing is written on `main` afterwards.
3. **Clean tree:** `git status --short` is empty (nothing staged, nothing modified). Otherwise stop and ask: a merge would carry or mix those changes.
4. **Up to date with `main`:** if `git merge-base --is-ancestor main <branch>` fails, bring `main` into the branch (`git merge main`; with `delivery.merge: rebase`, `git rebase main`). Conflicts: resolve them, then tell the supervisor what was resolved.
5. **Checks again** on the updated branch: `node tools/checks/run-checks.mjs`. With a host, the updated branch must reach the PR before its CI can run: push it only after asking (AskUserQuestion; a rebased branch needs `--force-with-lease`, say so), then wait for the PR's CI to be green. Anything red stops the merge.
6. **Merge** the way `delivery.merge` says:
   - `github`: `gh pr merge <n> --squash` (or `--merge`, `--rebase`); `--delete-branch` only if the supervisor agrees.
   - `gitea` / `azure`: the host's merge command with the same style, or ask the supervisor to press merge and wait.
   - `local` or `null`: every style ends on `main`, and `git branch --show-current` must print `main` before the merge command (a merge run on the card's branch merges it into itself and changes nothing). `squash`: `git switch main`, `git merge --squash <branch>`, check `git diff --cached --stat` holds only the branch's files, then `git commit -m "<IDs>: <card title>"`. `merge`: `git switch main`, then `git merge --no-ff <branch> -m "<IDs>: <card title>"`. `rebase`: `git rebase main <branch>`, then `git switch main` and `git merge --ff-only <branch>`. Afterwards `git merge-base --is-ancestor <branch> main` (merge, rebase) or the new commit on `main` (squash) shows it really happened.
   - Delete the branch only when the supervisor agrees. A squashed branch needs `git branch -D`, which Git cannot check: first confirm `git diff main <branch>` is empty (it is, since every card edit went into the branch), and say so.
7. **After:** no card edit on `main` (the merge is found by the card ID in its commit message). Build the board. Summary: what reached `main` and its commit (`git log -1 --format=%h`), the checks result, the next card.

Never merge with failing checks, an unfinished triage or a card the supervisor has not approved, even when asked to hurry: say what is missing instead.

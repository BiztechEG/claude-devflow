---
name: release
description: Prepare a release - choose the SemVer version, move CHANGELOG.md Unreleased entries into a dated version section with card IDs, and (after the supervisor approves) commit and tag it. Use when the user wants to cut a release, a release candidate, or hand a build to anyone, in a project made with the project-starter kit.
argument-hint: "[version, e.g. 1.2.0 or 1.3.0-rc.1]"
---

# Release

Version: `$ARGUMENTS`. Every build handed to anyone is a tag (`docs/process.md` §7).

1. **Check:** working tree clean (card and log updates are committed first, with their card IDs, so the release commit holds only `CHANGELOG.md`); tests pass (the test command in `CLAUDE.md`; if there is no test suite yet, say so in the report, never "tests pass"); `node tools/board/build-board.mjs --check` has no warnings.
2. **What is in it:** `git log <last tag>..HEAD --oneline` (or from the first commit), grouped by card ID; cards moved to `review`, `uat` or `done` since the last tag.
3. **Version:** if not given, propose one with AskUserQuestion (reply language): patch for fixes only, minor for new features, major for breaking changes, `-rc.N` for a candidate handed for testing.
4. **CHANGELOG.md:** move the `[Unreleased]` entries under `## [X.Y.Z] - <today>`, sorted into `Added`, `Changed`, `Fixed`, `Removed` (and `Known issues` for something shipped that does not work yet), each line naming its card IDs, written for the person who installs it. Leave an empty `[Unreleased]` on top.
5. **Show the supervisor** the changelog section and the commands below, and run them only after they say so. Each step runs only if the one before succeeded, and the tag must point at the commit that holds this changelog section. Run it in Bash (Git Bash on Windows: PowerShell 5.1 has no `&&`), as one line:
   ```
   git add CHANGELOG.md && git commit -m "Release vX.Y.Z" && git tag -a vX.Y.Z -m "vX.Y.Z" && git show -s --format=%H "vX.Y.Z^{commit}" && git rev-parse HEAD
   ```
   The two hashes printed at the end must be the same; if any step fails, stop and report it. Push (`git push && git push origin vX.Y.Z`) only when there is a remote, and only after the supervisor says so.
6. Log `[note] released in vX.Y.Z` on the cards it carries if that helps tracing; update `NEXT.md`.
7. Report in the reply language: version, what it carries, the tag, and how to install it (or which package to build from the tag).

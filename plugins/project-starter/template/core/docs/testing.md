# Testing

What gets tested in {{PROJECT_NAME}}, with which tools, and what must pass before a pull request is opened and before it is merged. The flow around it is in [process.md](process.md).

## 1. Test levels and tools

{{TESTING_STACK}}

## 2. What must be tested

- **Every rule of a requirement:** workflow transitions, numbering, calculations, permissions, validation. The test name or attribute carries the requirement ID (`ORD-01`).
- **Every acceptance criterion** is covered by an automated test or by a manual step in the card's "How to test". A criterion with neither is not done.
- **Every bug** gets a test that fails before the fix and passes after it, named with the bug's requirement ID.
- **Every data change** (migration, import, data fix) is tried on a copy of realistic data before it runs anywhere real.
- Not tested on purpose: framework code, generated code and plain getters. Say so in the card when a criterion is left to manual testing.

## 3. Test data

- Synthetic data only: never client data in tests, fixtures, screenshots or demos.
- Each test sets up the data it needs and does not depend on another test's order.
- Shared fixtures and builders live next to the tests, one place per kind of data.

## 4. Checks before a pull request and before merge

`node tools/checks/run-checks.mjs` runs these in order from `.project/config.json` → `delivery.checks`, stops at the first failure, and exits 1 when one fails:

{{CHECKS_LIST}}

- **Coverage:** {{COVERAGE_RULE}}
- `/project-starter:pr open` runs the checks before the pull request is opened, and `/project-starter:pr merge` runs them again on the branch brought up to date with `main`. A failing check is fixed, never skipped.
- CI, when the repository has a remote, runs the same checks on every pull request (card ENV-02).
- Adding a check (lint, format, a second test project) means adding it to `delivery.checks` and to this list.

## 5. Manual testing

- Every `[done]` log line says how to test the card by hand: the command, or the screen and the steps, and what you should see.
- The supervisor tries every card in `review` before approving it; what failed goes back to the card as an `[issue]` log line.

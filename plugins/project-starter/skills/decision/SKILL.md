---
name: decision
description: Record a decision as an ADR in docs/adr (next number, index, superseding an older ADR, linking cards). Use whenever the supervisor decides something, or when a choice has to be made, in a project made with the project-starter kit.
argument-hint: "<the decision, or the question to decide>"
---

# Record a decision

Input: `$ARGUMENTS`. Format: `docs/conventions.md` §4.

1. **Not decided yet?** Ask the supervisor with AskUserQuestion in the reply language: 2 to 4 options, the recommended one first with "(Recommended)", each with its trade-off. With the `client` module, add an option "ask the client (docs/questions.md)". Record the ADR only after the answer.
2. **Number:** the highest `docs/adr/NNN-*.md` + 1, three digits. File name: `NNN-short-slug.md`.
3. **Content:** copy `docs/adr/000-template.md`: title `# ADR-NNN: …`, `Status: accepted` (or `proposed` while it waits), today's date, `Cards:` the cards it touches (existing IDs only: a card the decision needs that does not exist yet is created first with `/project-starter:card`); Context, Decision, Consequences. Say who decided ("the supervisor, <date>") in Context.
4. **Supersedes an older ADR?** Edit only the old file's status line to `superseded by ADR-NNN`; never rewrite its text. Mention the old ADR in the new one's Context.
5. **Index:** add the row to `docs/adr/README.md` and update the old row's status.
6. **Cards:** add `- <today> [decision] ADR-NNN: <one line>` to each card it changes, and update their acceptance criteria or `docs/requirements.md` if the decision changes them.
7. **`CLAUDE.md`:** a decision on the stack, a constraint, a code convention or a command also updates that section of `CLAUDE.md`, naming the ADR.
8. Confirm to the user in one or two lines (reply language).

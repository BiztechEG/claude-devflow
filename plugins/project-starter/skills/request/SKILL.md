---
name: request
description: Record a new requirement or client request with a stable ID in docs/requirements.md and create its board card. Use when the user brings a new feature, change, bug or request in a project made with the project-starter kit (has .project/config.json).
argument-hint: "<the request in a sentence>"
---

# Record a request

Request: `$ARGUMENTS`. Formats: `docs/conventions.md` §3 and §5. No work starts on a request before it has an ID and a card.

1. **Module:** find the module it belongs to in `docs/requirements.md` (`## PREFIX · Module`). A new module gets a new section with a 2 to 4 letter prefix, and a new card file `docs/board/cards/NN-prefix.md` (`kind: requirements`, `order: NN`: the next free number from 10, see `docs/conventions.md` §5).
2. **ID:** the next number in that module (`ORD-07` after `ORD-06`, counting dropped rows too). IDs are never reused.
3. **Row:** `| ID | Requirement | Type | Source | Status |`. Source is the meeting, file or conversation with its date (add it to the Sources table if new). Status `agreed` only if the supervisor agreed; otherwise `pending`.
4. **Card** in the module's file:
   - `> status: todo | priority: P? | layer: … | size: S/M/L/XL | phase: <build phase number> | depends: …`
   - add `risk: high|medium|low` when `.project/config.json` has the `regulated` module;
   - acceptance criteria as `- [ ]` lines that can be checked (draft them; mark guesses and confirm them with the user);
   - `#### Log` with `- <today> [created]`.
5. **Unclear?** A small gap that does not change the scope or the design: write it on the card as `Assumption: …` and list it in the reply. Anything bigger: with the `client` module, add the question to `docs/questions.md` (`/project-starter:question`), set `status: clarify` and `q: Q-xx`. Without it, ask the supervisor now with AskUserQuestion (recommended option first).
6. **A rule decided on the way** becomes an ADR (`/project-starter:decision`).
7. Run `node tools/board/build-board.mjs` and fix any warning.
8. Tell the user, in the reply language: the ID, the card, what is still open, and where it sits in the queue.

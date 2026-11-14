---
name: question
description: Add a client or internal question to docs/questions.md and put the waiting card in clarify, or record the answer when it arrives. Use in projects made with the devflow kit that have the client module.
argument-hint: "ask <question> [cards] | answer <question ID> <answer>"
---

# Questions

Arguments: `$ARGUMENTS`. File: `docs/questions.md` (needs the `client` module; without it, ask the supervisor directly with AskUserQuestion).

Two kinds, each with its own IDs, used as they are everywhere (the card's `q:`, logs, ADRs):
- `Q-NN`: for the client. The waiting card goes to `clarify`.
- `IQ-NN`: internal, for the supervisor or the team. The waiting card goes to `decision` (it waits on the supervisor, not the client).

## Ask

1. Next ID of its kind; never reuse one.
2. Row: the question written so it can be answered without context (give the options and our proposal when there is one), the cards, `open`.
3. Each card that waits on it: add the ID to its `q:` list (keep the IDs already there); status `clarify` for a `Q-NN`, `decision` for an `IQ-NN`; log `[note] waits on <ID>`.
4. The supervisor sends client questions to the client; never contact the client yourself.

## Answer

1. Fill the answer with its date; status `answered` or `partial`.
2. Update `docs/requirements.md` and the acceptance criteria of the cards; log `- <today> [client] Q-NN: <answer in a line>` for a client answer, `[decision] IQ-NN: …` for an internal one.
3. For each card, remove the answered ID from `q:` only when the answer is complete. Then move the card out of `clarify` or `decision` **only if nothing else holds it**: no other open ID left in `q:`, and no other reason in its log. Otherwise it stays, and the log says what it still waits on.
4. An answer that sets a rule becomes an ADR (`/devflow:decision`).
5. Build the board and report what it unblocked and what is still waiting.

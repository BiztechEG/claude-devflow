# ADR-001: Record decisions as ADRs

- Status: accepted
- Date: {{DATE}}
- Cards: PM-01

## Context

Decisions get lost in chats and meetings, and a long table of decisions becomes hard to read and to change. We need one place where every decision is recorded with its reason, and a way to change a decision without losing the old one.

## Decision

Every decision is one file in `docs/adr/`, numbered `NNN-slug.md` and referenced as `ADR-NNN`. An accepted ADR is never rewritten; a change is a new ADR that supersedes it, and the old one gets `Status: superseded by ADR-NNN`. `docs/adr/README.md` is the index.

## Consequences

- The reason behind any rule can be found from its ADR number in code, cards and commits.
- Changing a decision is cheap and leaves a trail.
- The index must be kept up to date (`/project-starter:decision` does it).

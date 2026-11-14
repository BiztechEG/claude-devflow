# Migration plan

> Status: draft (MIG-01).

## 1. Source

The old system, its database engine and version, and where a copy comes from (who provides it, how it is stored outside the repo).

## 2. Scope

| Data | Moves? | Notes |
|---|---|---|
| | | |

## 3. Special cases

Duplicates, broken references, free-text fields that must be split, records in odd states.

## 4. Reconciliation

How we prove the move is complete and correct: counts per table, totals, sampled records compared field by field, identifiers preserved.

## 5. Rehearsals

Every rehearsal runs on a fresh copy and is logged in [rehearsal-log.md](rehearsal-log.md) with its duration and findings.

## 6. Cutover day

Freeze, final copy, run, reconcile, sign-off, switch, and the way back if it fails.

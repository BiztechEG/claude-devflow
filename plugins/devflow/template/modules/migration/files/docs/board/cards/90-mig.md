---
id: MIG
title: Data migration
order: 90
kind: work
description: Moving data from the old system (docs/migration).
---

## MIG-01 · Migration plan and field mapping
> status: todo | priority: P1 | layer: docs | size: L | phase: {{PHASE:architecture}}

- [ ] `docs/migration/plan.md` covers scope, special cases, reconciliation and cutover
- [ ] `docs/migration/mapping.md` maps every old table that moves

#### Log
- {{DATE}} [created]

## MIG-02 · Migration tool
> status: todo | priority: P1 | layer: infra | size: L | phase: {{PHASE:build}} | depends: MIG-01

- [ ] The tool moves every table in scope and preserves the existing identifiers
- [ ] It writes a reconciliation report (counts, totals, sampled records)

#### Log
- {{DATE}} [created]

## MIG-03 · Rehearsal on a copy of the client data
> status: todo | priority: P1 | layer: infra | size: M | phase: {{PHASE:release}} | depends: MIG-02

- [ ] A full run on a fresh copy, logged in `docs/migration/rehearsal-log.md`
- [ ] Reconciliation passes; findings fixed and rerun

#### Log
- {{DATE}} [created]

## MIG-04 · Cutover and reconciliation sign-off
> status: todo | priority: P0 | layer: infra | size: M | phase: {{PHASE:release}} | depends: MIG-03

- [ ] Cutover run on the release tag following the plan
- [ ] The reconciliation report is accepted by the client

#### Log
- {{DATE}} [created]

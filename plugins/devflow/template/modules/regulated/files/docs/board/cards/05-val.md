---
id: VAL
title: Validation
order: 5
kind: work
description: Validation evidence for an audited system (docs/validation).
---

## VAL-01 · Validation plan
> status: todo | priority: P1 | layer: docs | size: M | phase: {{PHASE:architecture}}

- [ ] `docs/validation/plan.md` approved by the supervisor and sent to the client's quality manager
- [ ] Every requirement card has a `risk` level

#### Log
- {{DATE}} [created]

## VAL-02 · Traceability matrix from the tests
> status: todo | priority: P1 | layer: infra | size: M | phase: {{PHASE:build}} | depends: VAL-01

- [ ] A script generates `docs/validation/traceability.md` from requirement IDs on tests and protocols
- [ ] High-risk requirements without both a test and a protocol are flagged

#### Log
- {{DATE}} [created]

## VAL-03 · Validation report and release decision
> status: todo | priority: P0 | layer: docs | size: M | phase: {{PHASE:validation}} | depends: VAL-02

- [ ] Protocols executed on the release tag, deviations closed
- [ ] `docs/validation/report.md` signed; the client declares the system fit for use

#### Log
- {{DATE}} [created]

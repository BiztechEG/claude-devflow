---
id: DEP
title: Deployment
order: 6
kind: work
description: Offline install package, runbook and install tests (docs/runbook.md).
---

## DEP-01 · Offline install package
> status: todo | priority: P1 | layer: infra | size: L | phase: {{PHASE:build}}

- [ ] One script builds the package from a tag with everything bundled (runtime, database setup, fonts)
- [ ] The package installs on a clean machine with no internet

#### Log
- {{DATE}} [created]

## DEP-02 · Runbook
> status: todo | priority: P1 | layer: docs | size: M | phase: {{PHASE:release}} | depends: DEP-01

- [ ] `docs/runbook.md` covers install, update, rollback, backup and restore, common problems
- [ ] Someone other than the author followed it on a test machine

#### Log
- {{DATE}} [created]

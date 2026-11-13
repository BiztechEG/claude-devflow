---
id: ENV
title: Environment
order: 2
kind: work
description: Development environment, solution skeleton, build, tests and CI.
---

## ENV-01 · Development environment and solution skeleton
> status: todo | priority: P0 | layer: infra | size: M | phase: {{PHASE:setup}}{{ENV_DEPENDS}}

{{ENV_SKELETON}}
{{ENV_CHOICES}}
- [ ] The project builds and its (empty) test suite runs with the commands in `CLAUDE.md`
- [ ] A new machine can be set up from `README.md` alone: tool versions, build, test and run steps, and the local URL, followed as written
- [ ] Shared build settings in one place; warnings that matter are errors

#### Log
- {{DATE}} [created]

## ENV-02 · Remote repository and CI
> status: decision | priority: P1 | layer: infra | size: S | phase: {{PHASE:setup}}

The supervisor chooses where the repository lives (GitHub private, Azure DevOps, self-hosted Gitea or Forgejo, or local only), records it as an ADR and sets `.project/config.json` → `delivery.host` (`github`, `gitea`, `azure`, `local`). Pull requests follow `docs/process.md` §6.

- [ ] Remote chosen, recorded as an ADR and set in `delivery.host`
- [ ] CI runs the same checks as `delivery.checks` on every pull request (not needed when local only)
- [ ] `main` is protected: merge only through a reviewed pull request whose checks pass (not needed when local only)

#### Log
- {{DATE}} [created]

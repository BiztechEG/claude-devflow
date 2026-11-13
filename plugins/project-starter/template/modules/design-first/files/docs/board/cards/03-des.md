---
id: DES
title: Screen design
order: 3
kind: work
description: Screen list, prototype with fake data and the client's sign-off (docs/design).
---

## DES-01 · Screen list and navigation
> status: todo | priority: P0 | layer: docs | size: M | phase: {{PHASE:design}}

- [ ] `docs/design/screens.md` lists every screen with the requirements it covers
- [ ] Every agreed requirement is covered by a screen or marked as having none

#### Log
- {{DATE}} [created]

## DES-02 · Prototype with fake data
> status: todo | priority: P0 | layer: ui | size: XL | phase: {{PHASE:design}} | depends: DES-01

- [ ] Every screen in the list can be opened and clicked through with fake data
- [ ] No business logic: the prototype calls interfaces backed by fake data

#### Log
- {{DATE}} [created]

## DES-03 · Client sign-off on the screens
> status: todo | priority: P0 | layer: docs | size: S | phase: {{PHASE:design}} | depends: DES-02

The gate of the build phase: no business logic before this card is `done`.

- [ ] Every screen in `docs/design/screens.md` has the client's approval with date and name

#### Log
- {{DATE}} [created]

# Validation plan

> Status: draft (VAL-01). Names follow GAMP 5 so an auditor finds what they expect.

## 1. Scope

What is validated (the system, its interfaces, the data migration if any) and what is not.

## 2. Deliverables and their GAMP 5 names

| Deliverable | GAMP 5 term | Where |
|---|---|---|
| Requirements with IDs | URS (user requirements specification) | `docs/requirements.md` |
| Architecture and design | FS / DS (functional and design specification) | `docs/architecture/`, `docs/adr/` |
| Installation check on the target machine | IQ (installation qualification) | `docs/validation/protocols/IQ-*.md` |
| Written test protocols with expected results | OQ (operational qualification) | `docs/validation/protocols/VP-*.md` |
| Client acceptance testing | PQ (performance qualification) / UAT | `docs/validation/acceptance-record.md` |
| Requirement → test → protocol matrix | RTM (traceability matrix) | `docs/validation/traceability.md` (generated) |
| Summary and release decision | VSR (validation summary report) | `docs/validation/report.md` |

## 3. Risk levels

| Risk | Evidence required |
|---|---|
| `high` | Automated tests including negative cases, and a written protocol |
| `medium` | Automated tests for the logic, and a protocol for the main cases |
| `low` | A checklist line in UAT |

## 4. Roles and signatures

| Role | Signs |
|---|---|
| Supervisor (supplier) | Protocols executed, validation report |
| Client quality manager | Acceptance record, release decision |

## 5. Deviations

A failed step is recorded as a deviation with its cause, fix and retest, never erased.

## 6. When to revalidate

A change to a high-risk area, a new release that touches calculations or records, or a change of the hosting platform.

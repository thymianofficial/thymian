# ADR-0011: Action naming conventions

| Status   | Date       | Supersedes | Superseded by |
| -------- | ---------- | ---------- | ------------- |
| Accepted | 2026-04-09 | —          | —             |

## Context

As the number of actions in Thymian grew during Epic 1, a consistent naming convention became necessary. Without a convention, action names were inconsistent — some used flat names, others used dot-separated names, and it was unclear from the name alone whether an action was core-owned or plugin-owned.

The action system is the primary communication mechanism between core and plugins (see [ADR-0010](0010-core-owned-infrastructure-actions.md)), so clear, predictable names directly impact developer experience and system comprehensibility.

## Decision

We will adopt the following hierarchical naming convention for all actions:

### Core-owned actions

Core-owned actions follow the pattern **`core.<domain>.<verb>`**:

| Action                  | Domain        | Verb          |
| ----------------------- | ------------- | ------------- |
| `core.ready`            | _(lifecycle)_ | ready         |
| `core.close`            | _(lifecycle)_ | close         |
| `core.format.load`      | format        | load          |
| `core.format`           | format        | _(broadcast)_ |
| `core.traffic.load`     | traffic       | load          |
| `core.lint`             | _(workflow)_  | lint          |
| `core.test`             | _(workflow)_  | test          |
| `core.analyze`          | _(workflow)_  | analyze       |
| `core.request.dispatch` | request       | dispatch      |
| `core.request.sample`   | request       | sample        |
| `core.report.flush`     | report        | flush         |

Lifecycle actions (`core.ready`, `core.close`) and top-level workflow actions (`core.lint`, `core.test`, `core.analyze`) use a two-segment form for brevity, since they are unambiguous.

### Plugin-owned actions

Plugin-owned actions follow the pattern **`<plugin-short-name>.<verb>`** or **`<plugin-short-name>.<domain>.<verb>`**:

| Action                               | Owner                  |
| ------------------------------------ | ---------------------- |
| `sampler.init`                       | plugin-sampler         |
| `sampler.path-from-transaction`      | plugin-sampler         |
| `openapi.transform`                  | plugin-openapi         |
| `http-linter.lint-static`            | plugin-http-linter     |
| `http-linter.load-rules`             | plugin-http-linter     |
| `http-linter.rules`                  | plugin-http-linter     |
| `http-analyzer.lint-analytics`       | plugin-http-analyzer   |
| `http-analyzer.lint-analytics-batch` | plugin-http-analyzer   |
| `http-testing.beforeRequest`         | plugin-sampler (hooks) |
| `http-testing.afterResponse`         | plugin-sampler (hooks) |
| `http-testing.authorize`             | plugin-sampler (hooks) |

The first segment identifies the owning plugin, making it immediately clear which package is responsible.

### Core-owned events

Events follow a similar pattern: **`core.<name>`** for core events.

| Event           | Purpose                          |
| --------------- | -------------------------------- |
| `core.register` | Plugin registration announcement |
| `core.report`   | Validation report data           |
| `core.error`    | Error propagation                |
| `core.exit`     | Shutdown signal                  |

## Consequences

**Positive:**

- Ownership is immediately clear from the action/event name — `core.*` is core-owned, everything else is plugin-owned.
- The hierarchical structure enables glob-based filtering and logging (e.g., log all `core.request.*` actions).
- Consistent naming reduces cognitive load for plugin authors.

**Negative:**

- Migrating from pre-convention names required updating all action references across the codebase.
- Some plugin action names are verbose (e.g., `http-analyzer.lint-analytics-batch`), but clarity is preferred over brevity.

## Related

- [ADR-0010](0010-core-owned-infrastructure-actions.md): Core-owned infrastructure actions
- [Chapter 8: Crosscutting Concepts](../08-crosscutting-concepts.md): Section 8.1 — Events and Actions

---

## Status History

| Date       | Status   | Notes                                         |
| ---------- | -------- | --------------------------------------------- |
| 2026-04-09 | Accepted | Retroactive documentation of Epic 1 decisions |

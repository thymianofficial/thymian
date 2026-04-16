# ADR-0010: Core-owned infrastructure actions

| Status   | Date       | Supersedes | Superseded by |
| -------- | ---------- | ---------- | ------------- |
| Accepted | 2026-04-09 | —          | —             |

## Context

In the old architecture, infrastructure capabilities like HTTP request dispatching and request sampling were owned by their respective plugins. For example, the sampler plugin defined and owned the `sampler.sample` action, and the request dispatcher plugin defined its own action for dispatching HTTP requests.

This created a coupling problem: the HTTP Tester plugin needed to know the specific action names of the Sampler and Request Dispatcher plugins to function. If either plugin changed its action contract, the Tester would break. This also meant that replacing the Sampler or Dispatcher with an alternative implementation required the replacement to match the original's action names — a leaky abstraction.

As the architecture moved toward core-owned contracts (see ADR-0007), it became clear that infrastructure actions used across multiple plugins should be owned by core, with plugins providing the implementations.

## Decision

We will promote the following infrastructure actions to core-owned contracts:

| Action                  | Purpose                                            | Strategy    | Implemented by              |
| ----------------------- | -------------------------------------------------- | ----------- | --------------------------- |
| `core.request.dispatch` | Send an HTTP request and return the response       | `'first'`   | `plugin-request-dispatcher` |
| `core.request.sample`   | Generate an HTTP request template from sample data | `'first'`   | `plugin-sampler`            |
| `core.format.load`      | Load API descriptions into ThymianFormat           | `'collect'` | `plugin-openapi`            |

These actions are declared by the `corePlugin` (in `core-plugin.ts`) with their event and response JSON schemas. Plugins register as listeners for these actions during their `plugin()` registration function.

The `'first'` strategy is used for infrastructure actions where exactly one plugin provides the capability. The `'collect'` strategy is used for loading actions where multiple plugins may contribute data.

## Consequences

**Positive:**

- Plugins depend on stable, core-defined action names rather than on each other's internal contracts.
- Replacing a plugin implementation (e.g., swapping the request dispatcher) requires no changes to consumers — only registering a different plugin that listens on the same core action.
- The core-plugin declaration serves as a single source of truth for all infrastructure contracts.
- New infrastructure capabilities follow the same pattern.

**Negative:**

- Core's API surface grows with each promoted action. Care must be taken to only promote actions that are genuinely cross-cutting.
- Plugins that previously owned these actions must migrate to listening on the core-owned names.

**Neutral:**

- Plugins may still define their own actions for plugin-specific functionality (e.g., `sampler.init`, `http-analyzer.lint-analytics`). Only cross-cutting infrastructure actions are promoted to core.

## Related

- [ADR-0007](0007-core-owns-validation-entrypoints-plugins-own-execution.md): Core owns validation entrypoints
- [ADR-0011](0011-action-naming-conventions.md): Action naming convention
- [Chapter 6: Runtime View](../06-runtime-view.md): Sequence diagrams showing action flow
- [Chapter 8: Crosscutting Concepts](../08-crosscutting-concepts.md): Section 8.1 — Events and Actions

---

## Status History

| Date       | Status   | Notes                                         |
| ---------- | -------- | --------------------------------------------- |
| 2026-04-09 | Accepted | Retroactive documentation of Epic 1 decisions |

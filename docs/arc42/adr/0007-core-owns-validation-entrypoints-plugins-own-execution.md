# ADR-0007: Core owns validation entrypoints, plugins own validation execution

| Status   | Date       | Supersedes | Superseded by |
| -------- | ---------- | ---------- | ------------- |
| Accepted | 2026-03-27 | —          | —             |

## Context

Thymian provides the three primary validation workflows `lint`, `test`, and `analyze`. During the brownfield-to-target architecture transition, an ambiguity emerged around workflow ownership:

- One interpretation is that the core should both expose and execute these workflows internally.
- Another interpretation is that the core should own the public API and contract surface, while plugins remain responsible for mode-specific execution logic.

This distinction matters because it affects package boundaries, extension design, test strategy, and review criteria.

The existing plugin-first architecture and related ADRs establish that core features are implemented through plugins where possible, and that the core should define explicit contracts for product behavior.

## Decision

Thymian adopts the following ownership model for validation workflows:

- `@thymian/core` owns the public validation entrypoints:
  - `lint`
  - `test`
  - `analyze`
- The core is responsible for:
  - exposing the stable workflow APIs to consumers
  - accepting workflow input
  - loading specifications, traffic, and rules
  - defining the contracts and result shapes used by validation workflows
  - dispatching execution through core-defined actions/events
- Plugins are responsible for:
  - implementing the mode-specific execution semantics
  - creating the runtime contexts required for their capability
  - performing validation logic and returning normalized results through the core contract

Therefore, the core owns the **invocation contract and public API surface**, while plugins own the **execution strategy** for each validation mode.

This is intentional. The core must not absorb static-linting logic, HTTP test execution logic, or analytics execution logic merely because those workflows are exposed through core APIs.

## Consequences

**Positive:**

- Consumers have a single stable API surface in `@thymian/core`
- Validation capabilities remain modular and replaceable
- The architecture remains consistent with the plugin-first design
- Mode-specific complexity stays encapsulated in dedicated plugins
- Reviews can distinguish clearly between API ownership and execution ownership

**Negative:**

- The phrase “core-owned workflow” can be misread unless documented carefully
- Some behavior is only meaningful when the corresponding plugin capability is installed
- Cross-cutting concerns may require coordination between core contracts and plugin implementations

## Guidance for Implementation

- New consumers should prefer the core workflow APIs over plugin-specific workflow actions where possible.
- Plugin-specific actions may still exist for specialized or lower-level integration cases.
- Tests should verify both:
  - that the core entrypoints remain stable and correctly dispatch
  - that plugins correctly implement their mode-specific behavior behind those entrypoints

## Related

- [ADR-0001](0001-core-features-as-plugins.md)
- [Chapter 9: Architectural Decisions](../09-architectural-decisions.md)

## Status History

| Date       | Status   | Notes                                |
| ---------- | -------- | ------------------------------------ |
| 2026-03-27 | Proposed | Clarify workflow/API ownership model |
| 2026-03-27 | Accepted | Accepted for validation architecture |

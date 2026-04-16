# ADR-0008: Package naming conventions

| Status   | Date       | Supersedes | Superseded by |
| -------- | ---------- | ---------- | ------------- |
| Accepted | 2026-04-09 | —          | —             |

## Context

Thymian's monorepo underwent a significant package restructuring. The original package names were inconsistent — some used a `cli-` prefix, some were bare nouns (`evaluation`, `openapi`, `reporter`), and the relationship between a package and its architectural role was not immediately clear from the name alone.

As the number of packages grew and the architecture crystallized around the ports-and-adapters / plugin model, a naming convention became necessary to:

- Communicate each package's architectural role at a glance.
- Prevent naming collisions as more plugins and rule sets are added.
- Establish a pattern that third-party authors can follow.

The prior package names included: `cli-common`, `core`, `core-testing`, `evaluation`, `format-validator`, `http-linter`, `http-testing`, `openapi`, `reporter`, `request-dispatcher`, `rfc-9110-rules`, `sampler`, `test-utils`, `thymian`, `websocket-proxy`.

## Decision

We will adopt the following prefix-based naming convention for all packages in the Thymian monorepo:

| Prefix         | Role                                                                                                            | Examples                                                                                                                                                                         |
| -------------- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `plugin-*`     | Plugin packages that implement a port defined by core. Each plugin responds to one or more core actions/events. | `plugin-http-linter`, `plugin-http-tester`, `plugin-http-analyzer`, `plugin-openapi`, `plugin-reporter`, `plugin-request-dispatcher`, `plugin-sampler`, `plugin-websocket-proxy` |
| `rules-*`      | Rule set packages that provide validation rules consumed by validation plugins.                                 | `rules-rfc-9110`, `rules-api-description-validation`                                                                                                                             |
| `common-*`     | Shared library packages that provide utilities used by multiple other packages but are not plugins themselves.  | `common-cli`                                                                                                                                                                     |
| _(unprefixed)_ | Core infrastructure packages with unique, well-known identities.                                                | `core`, `core-testing`, `thymian` (the CLI)                                                                                                                                      |

All packages are published under the `@thymian/` npm scope (except `thymian` itself, which is the top-level CLI package).

## Consequences

**Positive:**

- A package's architectural role is immediately obvious from its directory/package name.
- New contributors can navigate the monorepo without reading documentation.
- The convention scales naturally — new plugins, rule sets, or shared libraries follow the same pattern.
- Third-party plugin authors have a clear naming pattern to follow.

**Negative:**

- Renaming existing packages required migration of all imports, configuration, and CI references — a non-trivial effort during Epic 1.
- The `common-*` prefix is less intuitive than `plugin-*` or `rules-*` — it signals "shared utility" but not what kind.

**Neutral:**

- The `core-testing` package breaks the prefix convention slightly (it's `core-testing` rather than `common-core-testing`), but this is intentional because it is tightly coupled to `core` and not a general-purpose shared library.

## Related

- [Chapter 5: Building Block View](../05-building-block-view.md): Container-to-package mapping table
- [ADR-0001](0001-core-features-as-plugins.md): Core features are plugins
- [ADR-0007](0007-core-owns-validation-entrypoints-plugins-own-execution.md): Core owns validation entrypoints

---

## Status History

| Date       | Status   | Notes                                         |
| ---------- | -------- | --------------------------------------------- |
| 2026-04-09 | Accepted | Retroactive documentation of Epic 1 decisions |

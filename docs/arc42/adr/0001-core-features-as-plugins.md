# ADR-0001: Core features are plugins and are treated as such

| Status   | Date       | Supersedes | Superseded by |
| -------- | ---------- | ---------- | ------------- |
| Accepted | 2024-11-07 | —          | —             |

## Context

Thymian needs a flexible architecture that allows for easy extension and maintenance. The question arose whether core features like the file loader and OpenAPI parsers should be hard-coded or implemented in a more modular way.

## Decision

To improve modularity, even pre-built features like the file loader and the OpenAPI parsers will be implemented as plugins.

Plugins have their schema files packaged with them (similarly to Nx generator/executor schema files).

The configuration of the plugins happens in the Thymian config.

## Consequences

**Positive:**

- The code will be easier to maintain because there are no hard-coded implementations
- Core features can be replaced or extended by users
- Consistent API for all functionality (core and extensions)

**Negative:**

- Harder to implement the initial version because the plugin system needs to be set up first
- Slightly more complex architecture to understand for newcomers

## Related

- [Quality Requirement 10.2.3](../10-quality-requirements.md#102-quality-scenarios): Modularity — Adding new specification formats requires only a plugin
- [Quality Requirement 10.2.2](../10-quality-requirements.md#102-quality-scenarios): User engagement — Easy to add own plugins

## Status History

| Date       | Status   | Notes                             |
| ---------- | -------- | --------------------------------- |
| 2024-11-07 | Proposed | Initial proposal                  |
| 2024-11-07 | Accepted | Accepted after initial discussion |

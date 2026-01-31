# ADR-0004: Plugins should run isolated

| Status   | Date       | Supersedes | Superseded by |
| -------- | ---------- | ---------- | ------------- |
| Proposed | 2024-11-07 | —          | —             |

## Context

Simply importing plugins in the form of JS files allows for injection attacks. Should Thymian use a container or sandbox system like V8 Isolates to run plugins safely?

## Decision

[TODO]

## Consequences

[TODO]

## Related

- [Quality Requirement 10.2.3](../10-quality-requirements.md#102-quality-scenarios): Modularity — Easy to add checks and configure modules
- [Constraint](../02-constraints.md): Security considerations for plugin execution

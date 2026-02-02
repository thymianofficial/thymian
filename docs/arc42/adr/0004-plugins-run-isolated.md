# ADR-0004: Plugins should run isolated

| Status   | Date       | Supersedes | Superseded by |
| -------- | ---------- | ---------- | ------------- |
| Proposed | 2024-11-07 | —          | —             |

## Context

Simply importing plugins in the form of JS files allows for injection attacks. Should Thymian use a container or sandbox system like V8 Isolates to run plugins safely?

## Decision

Thymian will not load third-party plugins directly into the main application process via simple imports. Instead, plugins must run in an isolated execution environment (e.g. a dedicated process, worker, or sandbox/VM) with a minimal, well-defined API surface for communication. The isolation boundary must prevent plugins from accessing the host's internals, filesystem, network, or environment beyond what is explicitly allowed by the plugin API. The concrete isolation mechanism (such as V8 isolates, OS processes, or another sandbox technology) will be chosen based on feasibility and performance, but the architectural requirement for isolation is mandatory.

## Consequences

**Positive:**

- Security is improved: a compromised or malicious plugin is significantly constrained in what it can access or damage in the host application.
- Trust boundary: Users can install third-party plugins with less risk.
- Better stability: Plugin crashes are isolated and won't crash the main application.

**Negative:**

- Additional runtime and operational complexity: we must manage lifecycle, communication, and monitoring of isolated plugin runtimes.
- Performance overhead may increase due to inter-process or inter-context communication and serialization of data passed across the isolation boundary.
- Plugin authors must adhere to a stricter, documented plugin API instead of relying on direct access to application internals or runtime environment.
- Testing, debugging, and observability for plugins become more complex and must be supported with dedicated tooling and logging across isolation boundaries.

## Related

- [Quality Requirement 10.2.3](../10-quality-requirements.md#102-quality-requirements): Modularity — Easy to add checks and configure modules
- [Constraint](../02-constraints.md): Security considerations for plugin execution

## Status History

| Date       | Status   | Notes            |
| ---------- | -------- | ---------------- |
| 2024-11-07 | Proposed | Initial proposal |

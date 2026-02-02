# ADR-0002: Communication as a plugin

| Status   | Date       | Supersedes | Superseded by |
| -------- | ---------- | ---------- | ------------- |
| Proposed | 2024-11-07 | —          | —             |

## Context

The interoperability and DX quality goals lead to the question whether it should be possible to write plugins in other languages and as a result, how would the communication with other languages happen.

The initial implementation allows only for importing JS files.

## Decision

It should be possible to write plugins in other languages so developers can use "their" language. Simple import of JS files is therefore insufficient.

Communication with other plugins will itself be a wrapper plugin. That allows the use of either importing JS files (default) or other ways like TCP or Shell (stdin/stdout) plugins.

It's not implemented immediately, but the implementation should allow for extending the communication as plugin.

**Important:** Exchanged information must be serializable.

## Consequences

**Positive:**

- The whole system is more flexible
- Developers can write plugins in their preferred language
- Multiple communication channels can coexist

**Negative:**

- Harder to understand for newcomers
- Serialization requirement may limit what can be passed between plugins
- Additional complexity in plugin communication layer

## Related

- [Quality Requirement 10.2.4](../10-quality-requirements.md#102-quality-scenarios): Interoperability — Write plugins in preferred programming language
- [ADR-0001](0001-core-features-as-plugins.md): Core features as plugins (foundational decision)

## Status History

| Date       | Status   | Notes            |
| ---------- | -------- | ---------------- |
| 2024-11-07 | Proposed | Initial proposal |

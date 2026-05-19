# ADR-0013: Thymian format must not contain circular references

| Status   | Date       | Supersedes | Superseded by |
| -------- | ---------- | ---------- | ------------- |
| Proposed | 2026-05-04 | —          | —             |

## Context

The Thymian format is used as a serialized interchange artifact between core workflows, plugins, tests, and downstream tooling. Historically, `ThymianFormat.export()` tolerated circular runtime object graphs by converting them into `$thymian-ref` pointers during export and restoring them during import.

This behavior was originally useful because some schema-producing paths, especially OpenAPI-derived schemas, could leak recursive runtime object graphs into the format. With the move to self-contained schemas that preserve recursion through internal `$ref` and `$defs`, that schema-specific reason no longer applies.

At the same time, allowing circular references inside the in-memory Thymian format weakens the contract of the format itself. It makes export behavior harder to reason about, complicates consumers, encourages graph payloads that are not directly JSON-serializable, and hides the boundary where invalid format data is introduced.

We want the Thymian format to be a clean, tree-serializable data structure. If a producer wants recursion, it must model recursion explicitly in the payload format rather than through JavaScript object identity.

## Decision

We will define the Thymian format contract as **non-circular and tree-serializable**.

We will not rely on `ThymianFormat.export()` to repair or encode circular runtime object graphs. Producers of Thymian format data must ensure that node and edge attributes are already serializable before they are stored in the format.

Where recursive domain data is needed, it must be represented explicitly using a serialization-safe mechanism appropriate to that domain, such as JSON Schema `$ref` + `$defs`, rather than JavaScript object cycles.

As a result:

- the exported Thymian format is expected to be directly JSON-serializable
- circular reference repair is not part of the canonical Thymian format contract
- plugins and format producers are responsible for normalizing their own data before it enters the format

## Consequences

**Positive:**

- The Thymian format becomes a clearer and stricter interchange contract.
- Export and import behavior become easier to reason about because serialization does not depend on hidden pointer-repair logic.
- Recursive schemas can still be represented safely through `$ref` + `$defs` without leaking runtime object identity into the format.
- Downstream consumers can treat the format as ordinary JSON data.
- It ensures that the Thymian format can be sent over the wire, stored in files, and processed by any JSON tools without special handling for circular references.

**Negative:**

- Existing producers that still place circular runtime objects into the format will now fail instead of being silently repaired.
- Some tests and plugins must be updated to stop depending on circular in-memory structures.
- This decision pushes responsibility outward to producers, which may require follow-up cleanup work across packages.

**Neutral:**

- `$thymian-ref` pointer restoration may still remain temporarily for backward compatibility with older serialized payloads, but it is no longer part of the desired forward contract.

## Related

- [Quality Requirement 10.2.3](../10-quality-requirements.md#102-quality-scenarios): Modularity — plugins should be able to add behavior without weakening the core interchange contract.
- [Chapter 9](../09-architectural-decisions.md): Architectural decisions index.

---

## Status History

| Date       | Status   | Notes         |
| ---------- | -------- | ------------- |
| 2026-05-04 | Proposed | Initial draft |

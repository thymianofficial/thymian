# ADR-0012: HTTP test framework absorption into core

| Status   | Date       | Supersedes | Superseded by |
| -------- | ---------- | ---------- | ------------- |
| Accepted | 2026-04-09 | —          | —             |

## Context

Prior to the architectural rewrite, the HTTP test framework — providing the pipeline-based test DSL, request/response validators, serialization utilities, and test builders — lived in a standalone `http-testing` package. This package was consumed by the HTTP Tester plugin and by rule authors who needed to write `testRule` functions.

This arrangement created two problems:

1. **Dependency chain for rule authors:** Rule authors writing `testRule` functions needed to depend on `@thymian/http-testing` in addition to `@thymian/core` for the `TestContext` type. Since `TestContext` references types from the test framework (e.g., `HttpTestPipeline`, `HttpTestResult`), the dependency was unavoidable.
2. **Circular type pressure:** The `TestContext` interface is defined in `core` (as part of the rule system), but it references types from `http-testing`. This created either a circular dependency or required `core` to duplicate the type definitions.

As the rule system was promoted to a core concern (ADR-0009), having the test framework as an external package became increasingly awkward — `core` defined `TestContext` but couldn't provide the full type surface without depending on `http-testing`.

## Decision

We will absorb the HTTP test framework into the `@thymian/core` package, under `core/src/http-testing/`. This includes:

- The pipeline-based test builder (`test-builder/`)
- The HTTP test runner and context (`http-test/`)
- Request/response validation operators (`operators/`)
- Request serialization utilities (`serialize-request.ts`, `serialize-parameter.ts`)
- Response validation utilities (`validate/`)

The `http-testing` package is removed as a standalone package. All its exports are now available from `@thymian/core`.

## Consequences

**Positive:**

- Rule authors depend on a single package (`@thymian/core`) for all types, including the test framework.
- The circular dependency pressure between `core` and `http-testing` is eliminated.
- `TestContext` and its referenced types are co-located, making the API surface self-consistent.
- The HTTP test framework's tight coupling to core types (ThymianFormat, HttpRequest, HttpResponse) is now an internal concern rather than a cross-package contract.

**Negative:**

- The `core` package grows in size. However, the test framework is a relatively small module, and tree-shaking ensures that consumers who don't use it pay no bundle cost.
- Consumers who previously imported from `@thymian/http-testing` must update their imports to `@thymian/core`.

**Neutral:**

- The HTTP Tester plugin (`plugin-http-tester`) continues to use the test framework — it simply imports from `@thymian/core` instead of `@thymian/http-testing`.

## Related

- [ADR-0009](0009-rule-system-as-core-concern.md): Rule system as a core concern
- [Chapter 5: Building Block View](../05-building-block-view.md): Core package decomposition (Section 5.2.1)

---

## Status History

| Date       | Status   | Notes                                         |
| ---------- | -------- | --------------------------------------------- |
| 2026-04-09 | Accepted | Retroactive documentation of Epic 1 decisions |

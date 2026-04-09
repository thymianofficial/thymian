# ADR-0009: Rule system as a core concern

| Status   | Date       | Supersedes | Superseded by |
| -------- | ---------- | ---------- | ------------- |
| Accepted | 2026-04-09 | —          | —             |

## Context

In the pre-Epic 1 architecture, rule execution was embedded in a monolithic `http-linter` package that handled static linting, live testing, and traffic analysis in a single codebase. This created several problems:

- Adding a new validation mode required modifying the `http-linter` package.
- Rule types, contexts, and the runner were tightly coupled to a single package.
- Third-party rule authors had to depend on `http-linter` for types, even if they only needed the rule interfaces.
- The `format-validator` package (for API description validation rules) duplicated rule-running logic.

As the architecture evolved toward the ports-and-adapters model, a clearer separation was needed between the rule system (shared infrastructure) and mode-specific execution (plugin responsibility).

## Decision

We will extract the rule system into `@thymian/core` as a first-class concern. Specifically:

1. **Core owns the rule abstractions:** The `Rule` type, `RuleMeta`, `RuleSet`, `RuleFn`, `RuleRunnerAdapter<Context>`, severity types, the rule loader, and the shared `runRules()` function all live in `core`.
2. **Core owns the context interfaces:** `ApiContext`, `LintContext`, `TestContext`, and `AnalyzeContext` are defined in `core`.
3. **Three mode-specific plugins replace the monolith:** The former `http-linter` is split into:
   - `plugin-http-linter` — listens on `core.lint`, implements `RuleRunnerAdapter<LintContext>`
   - `plugin-http-tester` — listens on `core.test`, implements `RuleRunnerAdapter<TestContext>`
   - `plugin-http-analyzer` — listens on `core.analyze`, implements `RuleRunnerAdapter<AnalyzeContext>`
4. **Each plugin listens on exactly one core workflow action** and provides its own adapter implementation.
5. **Rule set packages** (`rules-rfc-9110`, `rules-api-description-validation`) depend only on `@thymian/core` for types — they no longer depend on any plugin package.

## Consequences

**Positive:**

- Rule authors depend only on `@thymian/core` for all type definitions.
- Adding a new validation mode requires only a new plugin with its own adapter — no changes to core or existing plugins.
- Each plugin is small, focused, and independently testable.
- The `RuleRunnerAdapter<Context>` pattern makes the shared `runRules()` function mode-agnostic.

**Negative:**

- The split increases the number of packages from 1 to 3 for validation plugins.
- Some duplication exists across plugin implementations (e.g., the `runRules` call pattern), though this is minimal and intentional.

**Neutral:**

- The `format-validator` package was renamed to `rules-api-description-validation` to reflect that it is a rule set, not an execution engine.

## Related

- [ADR-0007](0007-core-owns-validation-entrypoints-plugins-own-execution.md): Core owns validation entrypoints, plugins own execution
- [ADR-0008](0008-package-naming-conventions.md): Package naming conventions
- [Chapter 5: Building Block View](../05-building-block-view.md): Core package decomposition (Section 5.2.1)
- [Chapter 8: Crosscutting Concepts](../08-crosscutting-concepts.md): Section 8.4 — Rules and Rulesets

---

## Status History

| Date       | Status   | Notes                                         |
| ---------- | -------- | --------------------------------------------- |
| 2026-04-09 | Accepted | Retroactive documentation of Epic 1 decisions |

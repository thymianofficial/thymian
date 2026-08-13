# ADR-0017: Typed input arguments (`<type>:<location>`)

| Status   | Date       | Supersedes | Superseded by |
| -------- | ---------- | ---------- | ------------- |
| Accepted | 2026-07-30 | —          | —             |

## Context

Thymian consumes files whose handling cannot be inferred reliably from names or extensions — a `.json` file may be an OpenAPI description, a Spectral report, or captured traffic. The CLI already uses a typed input syntax on two flags: `--spec openapi:./openapi.yaml` and `--traffic har:./traffic.har`, parsed in `@thymian/common-cli` (`spec-flag.ts`, `traffic-flag.ts`) by splitting on the first colon, with both parts required.

Issue [thymian-internal#357](https://github.com/thymianofficial/thymian-internal/issues/357) adds externally generated reports as a new input kind (`spectral:path-to/report.json`) for `thymian report convert` ([ADR-0016](0016-two-stage-report-actions.md)) and raises three questions: whether the typed syntax is the universal convention for all file inputs; how a type is resolved to the code that reads it; and what happens when no plugin understands an input's type. Today such inputs are dropped silently, because each plugin simply filters the broadcast input list for the types it claims (for example, `plugin-openapi` keeps only `type === 'openapi'` inputs on `core.format.load`).

## Decision

We will use **`<type>:<location>`** as the universal syntax for every file-input flag: `--spec`, `--traffic`, the new `--report`, and all future input flags. Inputs are always passed via flags, never as positional arguments. (Whether `report convert` inputs may additionally come from the config file, as `--spec` inputs do via `thymianConfig.specifications`, is deferred to the #357 implementation.) Issue #357's positional sketch is superseded by:

```
thymian report convert --report spectral:path-to/report.json --spec openapi:path-to/api.yaml
```

**Parse rule** (unchanged from `spec-flag.ts` / `traffic-flag.ts`): split on the first colon; type and location are both required; the location may itself contain colons (`openapi:https://example.com/api.yaml`, `openapi:C:\specs\api.yaml`). There is no additional syntax constraint on the type token, no file-extension sniffing, and no bare-path fallback.

**Type resolution** stays plugin-claimed: core broadcasts typed inputs on core-owned `'collect'` actions, and each plugin filters for the types it understands. A type is supported exactly when at least one registered plugin claims it. Multiple plugins may claim the same type — standard `'collect'` semantics — in which case each claimant contributes its runs. New input types therefore ship as plugin **claims**, with no change to core parsing.

A claim lives in an existing plugin whenever that plugin's domain already covers the format; a **new plugin package** is justified only when the input domain brings its own dependency surface or conversion logic, and it requires an accepted ADR naming the package before implementation — as [ADR-0016](0016-two-stage-report-actions.md) did for `@thymian/plugin-spectral` ([ADR-0008](0008-package-naming-conventions.md) governs naming; this paragraph adds the ratification gate). The native `thymian:` report input is claimed by `@thymian/plugin-reporter`, which owns the persisted-report file boundary in both directions: its JSON formatter writes the exact `Report[]` payload the loader reads back (validated against `reportSchema`, accepting `Report[]` or a bare `Report`).

**Claim enforcement** is introduced only in the report-convert path and covers the `--report` inputs: listeners on `core.report.convert` reply one entry per claimed input, tagged with that input's identity, and core derives coverage from the union of those replies ([ADR-0016](0016-two-stage-report-actions.md)). Every `--report` input must be claimed by at least one plugin; otherwise the command fails with a usage error (exit status 2) naming the unclaimed input and listing the supported types. `--spec` inputs of the same command travel over `core.format.load` and stay under its existing behavior. Extending claim enforcement to `core.format.load` and other existing paths is explicitly deferred — revisit if silent drops of mistyped inputs cause problems there.

## Consequences

**Positive:**

- Explicit per-file routing: one command can mix input roles (external reports, specifications) without guessing from file extensions.
- Adding an input type means adding a plugin claim — in an existing plugin, or in a new package ratified by its own ADR — with no core parser changes.
- `thymian report convert` fails clearly on unsupported or mistyped `--report` inputs, satisfying #357's error-handling acceptance criterion.
- One consistent input syntax across all commands and flags.

**Negative:**

- More verbose than bare file paths.
- Existing flags (`--spec`, `--traffic` on `lint`/`test`/`analyze`) continue to drop unclaimed or mistyped inputs silently until the deferred enforcement lands.

**Neutral:**

- The command-line form in issue #357 must be updated from positional arguments to flags; this is carried into the epic breakdown.

## Related

- [Quality Requirement 10.2.1](../10-quality-requirements.md#102-quality-scenarios): one recognizable input syntax across commands
- [Quality Requirement 10.2.3](../10-quality-requirements.md#102-quality-scenarios): a new input format only requires a new claiming plugin
- [ADR-0010](0010-core-owned-infrastructure-actions.md): typed inputs travel on core-owned collect actions
- [ADR-0016](0016-two-stage-report-actions.md): `thymian report convert` consumes typed report and spec inputs
- [Chapter 8: Crosscutting Concepts](../08-crosscutting-concepts.md): Section 8.1 — Events and Actions

---

## Status History

| Date       | Status   | Notes                                                                                                                                                                                                                                   |
| ---------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-07-30 | Accepted | Decided ahead of #357 implementation (coaching session)                                                                                                                                                                                 |
| 2026-08-12 | Amended  | Claim placement clarified: claims live in existing plugins where the domain fits; new packages need a naming ADR before implementation. Native `thymian:` inputs → `@thymian/plugin-reporter` (thymian-internal#507 course correction). |

# ADR-0016: Two-stage report actions under `thymian report`

| Status   | Date       | Supersedes | Superseded by |
| -------- | ---------- | ---------- | ------------- |
| Accepted | 2026-07-30 | —          | —             |

## Context

Thymian's top-level workflow commands (`lint`, `test`, `analyze`) each produce a report from sources of truth — API specifications and captured traffic. Issue [thymian-internal#357](https://github.com/thymianofficial/thymian-internal/issues/357) introduces a different kind of operation: consuming a report that already exists (pre-generated Spectral output) and mapping it into the canonical Thymian `Report` model. Further operations on existing reports are foreseeable (for example merging, diffing, or re-rendering).

Placing each such operation at the CLI top level would blur the line between "produce a report" and "operate on a report", and grow the top-level command set without a placement rule. The CLI is built on oclif, which already uses nested topics (`rules list`, `config show`, `generate rule`), so a two-stage command family has precedent.

Behind the CLI, the action architecture must also be decided. Per [ADR-0010](0010-core-owned-infrastructure-actions.md), actions used across plugins are core-owned contracts with plugins as listeners; per [ADR-0007](0007-core-owns-validation-entrypoints-plugins-own-execution.md), core owns entrypoints while plugins own execution. A plugin-owned action (for example `spectral.convert`) would couple the CLI command to individual plugin action names — the same kind of coupling ADR-0010 eliminated between plugins.

## Decision

We will introduce a two-stage command family **`thymian report <verb>`**, implemented as an oclif topic, with `convert` as its first verb.

**Namespace rule:** the top-level workflow commands (`lint`, `test`, `analyze`) produce reports from sources of truth (API specifications, traffic); operations on already-existing reports go under `thymian report <verb>`. This is the placement test for future report operations.

Each report verb is backed by a core-owned workflow action **`core.report.<verb>`** (naming per [ADR-0011](0011-action-naming-conventions.md)) with the `'collect'` strategy. Plugins register as listeners and claim the inputs they understand by input type (see [ADR-0017](0017-typed-input-arguments.md)). For `convert`, `@thymian/plugin-spectral` claims `spectral` inputs and decides which report kind (lint, test, or analyze) each converted result represents.

As in the other workflow actions, listeners reply `ToolRun` fragments — one entry per claimed input, tagged with that input's identity — and core assembles the fragments into the single canonical `Report`: an invocation with multiple inputs yields one `Report` containing one run per converted input. Core also derives claim coverage from these per-input replies (see ADR-0017).

Report verbs run as full workflows through `Thymian.run()`. Core loads `--spec` inputs via `core.format.load` and passes the serialized format in the `core.report.<verb>` payload (mirroring `core.lint`), for example to map external findings onto endpoints and locations. Report verbs support the standard `--option`-based formatter configuration of the other workflow commands, and the exit-status semantics of [ADR-0015](0015-cli-exit-status-is-severity-independent.md) apply to the **converted report's executions**: converting a report that contains failed executions is a non-clean run (exit status 1), even though the conversion itself succeeded. The Thymian report format itself is unchanged.

We knowingly overload the name `core.report`: it remains a core **event** (validation report data, ADR-0011) while `core.report.<verb>` names **actions**. Events and actions travel on separate channels, so the overload is tolerated rather than renamed.

## Consequences

**Positive:**

- The CLI depends only on core-owned action names; a new converter plugin extends `report convert` by registering a listener, with no changes to core or CLI dispatch (ADR-0010 pattern).
- A clear placement test ("does it operate on an existing report?") prevents top-level command sprawl as report operations accumulate.
- Report sub-commands behave like the other workflow commands (`--option`-based formatter configuration, exit-status semantics per [ADR-0015](0015-cli-exit-status-is-severity-independent.md)), keeping interaction patterns recognizable.

**Negative:**

- Core's action surface grows by one action per report verb; ADR-0010's warning applies — only genuinely cross-cutting verbs may be promoted.
- The `core.report` event vs. `core.report.<verb>` action overload can confuse readers of traces and logs.

**Neutral:**

- The converting plugin chooses the resulting report kind (lint, test, or analyze); the report data model is not extended.

## Related

- [Quality Requirement 10.2.1](../10-quality-requirements.md#102-quality-scenarios): recognizable command patterns support learnability
- [Quality Requirement 10.2.3 / Modularity](../10-quality-requirements.md#101-quality-requirements-overview): extending report operations is a plugin-level change, not a core change
- [ADR-0007](0007-core-owns-validation-entrypoints-plugins-own-execution.md): core owns entrypoints, plugins own execution
- [ADR-0010](0010-core-owned-infrastructure-actions.md): core-owned infrastructure actions
- [ADR-0011](0011-action-naming-conventions.md): action naming conventions
- [ADR-0015](0015-cli-exit-status-is-severity-independent.md): CLI exit-status semantics apply to report verbs
- [ADR-0017](0017-typed-input-arguments.md): typed input arguments route inputs to claiming plugins
- [Chapter 8: Crosscutting Concepts](../08-crosscutting-concepts.md): Section 8.1 — Events and Actions
- [thymian-internal#357](https://github.com/thymianofficial/thymian-internal/issues/357): `@thymian/plugin-spectral`

---

## Status History

| Date       | Status   | Notes                                                    |
| ---------- | -------- | -------------------------------------------------------- |
| 2026-07-30 | Accepted | Decided ahead of #357 implementation (coaching session)  |

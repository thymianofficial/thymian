# ADR-0019: Report inputs for `report merge` and `report diff` come from CLI arguments only

| Status   | Date       | Supersedes | Superseded by |
| -------- | ---------- | ---------- | ------------- |
| Accepted | 2026-08-24 | —          | —             |

## Context

[ADR-0017](0017-typed-input-arguments.md) established `--report <type>:<location>` as the input syntax for report-consuming commands and deferred whether such inputs may additionally come from the configuration file. `thymian report convert` answered that for itself: it resolves `--report` flags over the config `reports` key, mirroring the `--spec`-over-`specifications` chain.

`thymian report merge` (thymian-internal#507) initially copied that resolution, and its review (PR #362) surfaced the problem: when a config file carries `reports`, a merge invocation's input set silently depends on config state — flags _replace_ the configured entries, which reads as either override or append depending on expectation, and a bare `thymian report merge` merges whatever the config happens to name. For a command whose whole meaning is "combine exactly these artifacts", that ambiguity is a correctness hazard, and it returns with `thymian report diff` (thymian-internal#502), where the _pairing_ of inputs is the semantics.

## Decision

We will resolve **report inputs from CLI arguments only** in every report-assembly command beyond `convert` — `thymian report merge` today, `thymian report diff` when it lands. The config `reports` key stays a `thymian report convert` concern; merge/diff never read it, and their empty-input usage error points at `--report`, not at the configuration file.

**Specifications are not affected.** Merge and diff keep the normal specification resolution chain: `--spec` flags override the config's `specifications` (Step C), exactly as in every other command. Only the _report_ inputs are pinned to the command line.

Rationale: `convert` describes a repeatable, project-level import ("these are the external reports of this project"), which is configuration by nature. Merge and diff describe a per-invocation selection of artifacts — typically produced moments earlier in the same pipeline — where the invocation itself must be the complete, explicit record of what went in.

Enforced structurally in `@thymian/common-cli`'s `BaseReportAssemblyCommand`: input resolution is the single abstract member (`resolveReportInputs()`) the two commands implement differently, so the divergence is visible in one place instead of drifting across copies.

## Consequences

**Positive:**

- No override-vs-append ambiguity: the flags are the input set, always.
- A merge or diff invocation is self-describing — CI logs and shell history show exactly which artifacts were combined; config state cannot silently widen, reorder, or alter it.
- Config `specifications` still serve merge/diff conversions, so projects keep one place for their API description.

**Negative:**

- No "bare `thymian report merge`" convenience: recurring merges must spell out their inputs in the pipeline definition.
- A configured `specifications` entry is loaded eagerly even for a merge of pure Thymian inputs that needs no spec — a broken configured spec then fails the merge. (Spec loading stays eager because input types are plugin-claimed; core cannot know upfront whether a claimant will need the format.)

**Neutral:**

- The `reports` key's documentation (config schema and reference) stays convert-only.
- `report diff` (#502) inherits this decision; its design does not need to re-litigate input sourcing.

## Related

- [ADR-0016](0016-two-stage-report-actions.md): the convert workflow merge/diff build on
- [ADR-0017](0017-typed-input-arguments.md): typed `--report` input syntax; deferred the config question this ADR answers
- Review decision: [thymian PR #362](https://github.com/thymianofficial/thymian/pull/362) (thymian-internal#507); forward-looking for thymian-internal#502

---

## Status History

| Date       | Status   | Notes                                                                                   |
| ---------- | -------- | --------------------------------------------------------------------------------------- |
| 2026-08-24 | Accepted | Decided in PR #362 review (thymian-internal#507); scope narrowed to report inputs only. |

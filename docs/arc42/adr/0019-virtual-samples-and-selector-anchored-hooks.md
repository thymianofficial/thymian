# ADR-0019: Virtual samples with a committed type surface and selector-anchored hooks

| Status   | Date       | Supersedes | Superseded by |
| -------- | ---------- | ---------- | ------------- |
| Accepted | 2026-08-16 | —          | —             |

## Context

`thymian sampler init` materializes a samples tree on disk: one directory per
transaction, mirroring the spec's structure, with the user's hook files
(`*.beforeEach.ts`, `*.afterEach.ts`, `*.authorize.ts`) placed at those paths.
That tree is a second source of truth, and every spec change has to be
reconciled into it by hand:

- a renamed path, a removed operation, a changed media type or status code —
  even a pure `info.title` rename, which is the top-level directory name —
  leaves the user's hooks orphaned at dead paths;
- `thymian sampler init --overwrite` regenerates in place but never deletes
  artifacts belonging to removed operations, which `thymian sampler validate`
  then reports as `unexpected-artifact`;
- `thymian sampler validate` detects staleness but offers no way to fix it.

Issue [thymian-internal#466](https://github.com/thymianofficial/thymian-internal/issues/466)
asked for assisted migration — a `thymian sampler sync` that analyzes, migrates
the unambiguous cases, and prompts on the rest. Three prototypes were built
(regenerate-and-reattach, semantic-key three-way delta, plan/apply). All three
worked, and all three carried the same irreducible cost: reconciliation needs a
rename oracle. Identity has to key on semantic transaction keys rather than
content hashes (`info.title` and operation `summary` are hash-invariant), and
the weighted-similarity scorer that guesses which operation a hook belonged to
silently cross-assigns same-method siblings. Any migration engine either guesses
or asks — and it exists only because the tree exists.

A second round redesigned the sampler instead of the migration. Its conclusion:
if nothing is materialized, nothing can go stale, and the entire
migration-engine class becomes unnecessary. The remaining problem is not "how do
we move the user's files" but "how does the user learn that their hook no longer
matches anything" — which is a type-checking problem, not a filesystem one.

## Decision

We will replace the materialized samples tree with an in-memory projection, and
anchor user intent in TypeScript hooks addressed by fully-qualified, typed
selectors. The north star: **every way a spec change can invalidate a hook is a
TypeScript error.**

- **Samples are virtual.** A sample is a deterministic in-memory projection of
  the loaded Thymian format. Nothing is written as canonical runtime state, and
  `thymian test` runs the sampler standalone.
- **The type surface is committed, the samples are not.** Under a per-sampler
  root (default `.thymian/sampler`): `generated/*.d.ts` (endpoints, spec-derived
  unions, the `@thymian/hooks` surface), a generated `tsconfig.json`, and the
  user's `hooks/`. The generated files are types only — runtime `define*` and
  `utils` resolve through a jiti alias, so hooks execute with or without them.
  Regeneration is wholesale over `generated/`; `hooks/` is never touched. The
  root tsconfig is left alone.
- **A selector is exactly one transaction** —
  `METHOD /spec/path (+reqMedia) -> STATUS (+resMedia)`, with the media parts
  present only when a body exists. No bare selectors, no fan-out, no
  collision-only aliases. Full qualification is
  enforced by construction rather than by a lint or a `--strict` flag, which is
  what makes an additive spec change (a new status, a new media type) unable to
  invalidate an existing selector. Sets of transactions are targeted
  exclusively through a typed `TransactionFilter`, whose every field is a
  spec-derived union.
- **The compiler is the drift oracle.** The committed types are the staleness
  baseline — there is no lock file. `thymian sampler validate` regenerates the
  surface in memory and runs `tsc` over the hooks: identical is silent;
  differing but compiling is a warning to run `thymian sampler sync`; differing
  and failing is breaking drift. Comparison is canonicalized (comments and JSDoc
  stripped), so description-only edits are non-events.
- **All hooks return `void` and mutate in place**, and each receives both the
  fully typed object and equivalent typed `utils.set*` setters:
  `defineSample` (generation-time, at most one per transaction),
  `beforeEach`/`afterEach`, `authorize` (global or targeted), and run-scoped
  `beforeAll`/`afterAll`. Targeting is uniformly
  `Selector | Selector[] | TransactionFilter`.
- **`init` is optional.** It is DX — committed types, the tsconfig alias, a
  scaffold — and it is what enables `validate`. The command set is `init`,
  `sync` (with `--check` as the CI staleness gate), `validate`, and `show`;
  `export` and `generate-hook` are removed.
- **The change is plugin-contained.** It lives entirely in
  `@thymian/plugin-sampler` and its type generator. No `@thymian/core` and no
  `@thymian/plugin-openapi` change is required.

The full contract — filter grammar and exclusion semantics, the type-safe path
glob, the `utils` surface, the execution pipeline and its authorization gating —
is the v2 specification recorded on
[thymian-internal#466](https://github.com/thymianofficial/thymian-internal/issues/466#issuecomment-5239980845)
(private repository).

## Consequences

**Positive:**

- thymian-internal#466 is answered by removal rather than by machinery. With
  nothing on disk there is nothing to migrate, no rename oracle to calibrate,
  and no prompt to answer; `info.title` renames and description-only edits stop
  being events at all.
- Drift surfaces in the editor. A dangling selector, a stale filter value or a
  changed body shape is a red squiggle before it is a failed run, and one
  command (`thymian sampler validate`) is the authoritative gate for CI.
- Hooks are the only user-owned artifact. They can live in any number of files
  at any nesting, and no tooling relocates or deletes them.
- The `@thymian/core` contract established by
  [ADR-0007](0007-core-owns-validation-entrypoints-plugins-own-execution.md)
  is untouched, so the redesign carries no cross-package coordination cost.

**Negative:**

- Targeting is more verbose. Every selector is fully qualified, so a change
  that applies across many transactions must be written as a
  `TransactionFilter` rather than as one short bare selector.
- The generated type surface is committed, so a spec change produces a diff in
  generated files on every PR. That is deliberate — the diff _is_ the staleness
  signal — but it is review noise that a lock file would have concentrated in
  one place.
- **Type-safe path globs are the unproven element.** Validating `*` and
  trailing `**` against the `Path` union via template-literal types is
  feasibility-argued but has no implementation in any prototype, and the
  specification makes a language-server performance benchmark on a large spec a
  precondition for locking the feature. It is the one part of this decision
  that can still fail on its own terms; a shared matcher for the type-level
  validator and the runtime filter, with parity tests, is a condition of
  shipping it.
- Two residues sit outside the type system: a filter whose values are all valid
  but intersect nothing, and an over-broad glob. Both are reported by
  `thymian sampler validate` and fail a test run fast, but neither is a compile
  error.
- Existing users of the materialized tree migrate their hooks by hand, once.
  There is no automated v1 → v2 path — that would be the very engine this
  decision declines to build.

**Neutral:**

- Examples are reflected at the type level only, from `schema.examples` values:
  primitives widen to `'A' | 'B' | (base & {})`, object bodies to
  `example1 | example2 | base`. Example _names_ are not preserved and no
  `utils.example` accessor exists.
- The per-transaction `authorize` flag defaults to spec-`security`-derived, with
  declared-`401` cases forced off, and is overridable as an ordinary field of
  the request sample. The hook supplies credentials; the flag decides whether it
  runs.
- Cross-source selector collision is a hard error. A source-discriminator
  syntax, mid-path `**`, and curated multi-sample variants are deferred.
- User-registrable generators for custom `format` values are out of scope and
  tracked separately
  ([thymian-internal#574](https://github.com/thymianofficial/thymian-internal/issues/574)).
- The bake-off prototypes are archived rather than inherited: they implement
  decisions this ADR reverses (bare-selector fan-out, `overrideSample`, the
  `*Matching` targeting split).

## Related

- [ADR-0007](0007-core-owns-validation-entrypoints-plugins-own-execution.md):
  the core/plugin boundary this redesign stays inside — sampling is plugin-owned
  execution.
- [ADR-0008](0008-package-naming-conventions.md): `@thymian/plugin-sampler`,
  the single package this change is contained in.
- [ADR-0013](0013-thymian-format-must-not-contain-circular-references.md): the
  format property the type generator relies on when walking transactions to emit
  `Endpoints`.
- [Quality Requirement 10.2.1](../10-quality-requirements.md#102-quality-scenarios):
  Learnability — hooks are ordinary typed TypeScript with autocompletion, and
  drift is reported by the compiler rather than by a bespoke staleness report.
- [Quality Requirement 10.2.3](../10-quality-requirements.md#102-quality-scenarios):
  Modularity — the feature is confined to one plugin plus its type generator,
  with no core or format-plugin change.
- [thymian-internal#466](https://github.com/thymianofficial/thymian-internal/issues/466)
  (private repository): the assisted-migration request this supersedes, and the
  home of the full v2 specification.

---

## Status History

| Date       | Status   | Notes                                                                                                                            |
| ---------- | -------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 2026-08-16 | Accepted | Virtual samples, committed type surface, selector-anchored hooks; answers thymian-internal#466 by removing the materialized tree |

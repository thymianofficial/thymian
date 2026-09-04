# ADR-0021: A per-transaction problem must not end the run

| Status   | Date       | Supersedes | Superseded by |
| -------- | ---------- | ---------- | ------------- |
| Accepted | 2026-09-04 | —          | —             |

## Context

[ADR-0019](0019-virtual-samples-and-selector-anchored-hooks.md) recorded the
sampler v2 design and stated that it needs no `@thymian/core` change.
[ADR-0020](0020-selector-is-the-transaction-label.md) amended that for one pure
renderer. A manual-testing round on the implemented branch produced a third set
of findings, and honouring them needed two more changes in core — so the
containment property is worth restating rather than leaving a reader to infer it
from three separate records.

The findings were of two kinds.

**Types that made promises the server had not made.** `utils.request(selector)`
returned the response its Selector named. A hook that seeded
`POST /launches … -> 201` and was answered `500` read `body.id` off a value with
no `id`, and there was no branch it could have written instead: the status was a
literal, so `if (res.statusCode !== 201)` narrowed to `never`. The documented
seeding idiom was uncompilable against its own types.

**A run that ended early and reported the wrong thing.** `sampler check` ran
every Transaction, but the first hook defect or unserializable request rejected
the pipeline's observable, which reached `Thymian.run`'s error subscription,
which closed the run. One broken transaction hid every transaction after it, and
the command exited as a tool error. What did get printed read as a wall of red,
because a transaction whose _precondition_ never happened rendered identically to
one whose _response_ was wrong — with its reason printed twice, once as the test
case's reason and once as the result it was derived from.

Both kinds share a shape: the sampler knew what had happened to one Transaction,
and the surfaces above it could not express it.

## Decision

We will make a problem with one Transaction an outcome of that Transaction, and
never an outcome of the run.

- **`utils.request` answers a union.** The return type is a discriminated union
  of every response the operation declares. Each member carries the four fields
  a caller reads — status code, media type, headers and body — narrowed by the
  literal `statusCode` and, where one status declares several media types, by
  `mediaType`. A Selector says which Transaction
  to _initiate_; it cannot promise the outcome, so the type does not either.
  Generated as a `Responses` map keyed by the **request half of a Selector**,
  which is the [Operation](../../../CONTEXT.md) — so the union references the
  response types already emitted rather than duplicating them, and the runtime
  checks membership by the same grouping.
- **An undeclared status throws.** `UndeclaredResponseError` carries
  `{ selector, statusCode, headers, body }`. Reacting is opt-in: catch it, or let
  it escape and have the transaction skipped with the Seed named. Its
  `instanceof` compares by **shape**, because the hooks runtime is loaded through
  jiti with `moduleCache: false` — identity would be false for the very error the
  runner threw, silently disabling the one documented way to react.
- **Every checked Transaction earns exactly one Outcome** — `passed`, `failed`,
  `skipped` or `errored`. The `skipped`/`failed` line is the load-bearing one: a
  transaction whose precondition never happened has told us nothing about the
  API, and calling that a failure is what produced the wall of red.
- **`sampler check` exits non-zero iff any Transaction is not `passed`**, set
  through `process.exitCode` rather than an early exit, so the run's teardown —
  and the user's `afterAll` cleanups — still happen. `--json` emits the whole
  result as one document and is the stable machine contract; the human rendering
  is not.
- **Two further core changes, and only these two.** Both exist to stop one
  Transaction ending the run:
  1. `serializeRequest` raises a typed `RequestSerializationError`, and
     `runRequests` turns it into a **skipped test case** instead of rejecting the
     observable. A request that cannot be built from the description is a
     Transaction that cannot be executed _as described_ — which is what the
     pipeline's `skipped` already means — and rejecting threw away every result
     the case had recorded, attribution included.
  2. A hook failure is reported at **`severity: 'warn'`**. This is not a
     judgement about how bad it is: `Thymian.run` closes the run on any
     `error`-severity event, so `warn` is the only way the action can still throw
     (telling the caller this Transaction failed) without ending the command.

So the containment property of ADR-0019 now has **three** exceptions in core, all
of them in this feature's story: the selector renderer (ADR-0020), and the two
above. `@thymian/plugin-openapi` remains untouched, and no event, action or rule
contract changes.

## Consequences

**Positive:**

- The compiler stops lying about seeding, and the documented idiom compiles.
- A `sampler check` run always reports every Transaction, so a report is a
  picture of the API rather than a picture of the first thing that broke.
- Cause attribution is structural: a Seed answered off-selector is recorded on
  the calling hook's results, which is how `--json`'s `causedBy` can name it.
- `thymian test` also stops aborting a rule's `httpTest` over one unresolvable
  path parameter — the case is skipped and the rest of the rule runs.

**Negative:**

- **This changes `thymian test`, not only the sampler.** A rule that previously
  failed loudly on an unserializable request now sees a skipped case. That is
  the better default, but it is a behaviour change outside the feature that
  motivated it.
- `severity: 'warn'` on a hook defect makes the severity field carry two jobs:
  how bad the diagnostic is, and whether it may end the run. A reader of
  `Thymian.run` will not guess that from the name. If the second job needs to
  outlive this decision, it deserves its own flag rather than a borrowed one.
- `utils.request`'s return type is a breaking change for every existing hook
  that reads a body field without narrowing first.
- The `--json` schema is now a contract, so its fields can be added to but not
  moved.

**Neutral:**

- Only an undeclared **status** throws. The media type is reported as observed,
  so a body arriving as something the description did not promise is visible
  rather than relabelled.
- `--json` deliberately omits the remediation prose the human output prints under
  a failure; `reason` carries what a consumer has to act on.
- `sampler check` has no dependency graph and no scheduler: attribution comes
  from a Transaction's own hook pipeline, never from ordering between
  Transactions.

## Related

- [ADR-0019](0019-virtual-samples-and-selector-anchored-hooks.md): the design
  this amends, and the source of the containment property.
- [ADR-0020](0020-selector-is-the-transaction-label.md): the first amendment to
  that property. Its round-trip requirement is what lets `--json`'s `selector`
  and `causedBy` be pasted back as hook targets.
- [ADR-0015](0015-cli-exit-status-is-severity-independent.md): exit status from
  execution status rather than severity. `sampler check` follows the same rule
  with its own four states.
- [ADR-0007](0007-core-owns-validation-entrypoints-plugins-own-execution.md): the
  core/plugin boundary. The two core changes here are pipeline semantics, not
  execution moving out of a plugin.
- [Chapter 8](../08-crosscutting-concepts.md): the http-testing pipeline the
  outcome model reads its verdicts from.
- [Quality Requirement 10.2.1](../10-quality-requirements.md#102-quality-scenarios):
  Learnability — a failure that names its cause, and a type that cannot promise
  what the server has not.
- [thymianofficial/thymian-internal#466](https://github.com/thymianofficial/thymian-internal/issues/466)
  (private repository): the amended v2 specification, §7 and §11, and the
  manual-testing round these decisions come from.

---

## Status History

| Date       | Status   | Notes                                                                                                                 |
| ---------- | -------- | --------------------------------------------------------------------------------------------------------------------- |
| 2026-09-04 | Accepted | The honest response union and the four-outcome check model; two further core changes, both to stop a run ending early |

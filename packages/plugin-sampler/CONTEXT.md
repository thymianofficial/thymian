# Sampler

The context for `@thymian/plugin-sampler`. It extends the `thymian` project context and does
not redefine anything in it. The terms below are the vocabulary of **authoring hooks** — what
a hook is, how it is aimed, and what a transaction earned once it ran.

The concepts a hook is written _against_ stay one level up, because they are named across
packages and by accepted ADRs: `Sample` and `Selector`
([ADR-0019](../../docs/arc42/adr/0019-virtual-samples-and-selector-anchored-hooks.md),
[ADR-0022](../../docs/arc42/adr/0022-selector-is-the-transaction-label.md)), and `Operation`.

## Language

`_Avoid_` lists words not to use for the term above it.

**Hook**:
A user-owned TypeScript function that shapes or authorizes a run — generating a sample,
running before or after a transaction, supplying credentials. Targeted by a `Selector`, a list
of them, or a `Transaction Filter`. The only artifact in sampling the user owns, and the
compiler is what reports one that no longer matches anything.

**Transaction Filter**:
A typed description of a _set_ of `Transaction`s, for a `Hook` that should apply to more than
one. Fields AND-combine, arrays within a field OR-combine, and `not` takes filter fields one
level deep. Every value is a specification-derived union except a `Path Glob`. A filter whose
values are all individually valid but which together match nothing is a `sampler validate`
error rather than a compile error — the type system can check each field, not their
intersection.
_Avoid_: query, selector set, matcher

**Path Glob**:
The one wildcard form a `Transaction Filter`'s path field accepts: `*` matches exactly one
path segment and a trailing `**` matches one or more, against the specification's path
templates. Braces are literal, matching is case-sensitive and anchored. Only the _shape_ is
compile-checked, so a wildcard-free string must be an exact `Path`; a glob that matches
nothing is a `sampler validate` error. Type-level matching against the declared paths was
measured and rejected on language-server cost.
_Avoid_: pattern, wildcard, regex

**Seed**:
A request a `Hook` makes through `utils.request` to put the system into the state its
transaction needs. Runs the target transaction's own hook pipeline by default, so seeding
behaves like the real run. Names the `Transaction` it wants to initiate, not the response it
will get: the answer is every response that operation declares.

**Outcome**:
What one `Transaction` earned in a sampler check — `passed` (executed, response as described),
`failed` (executed, response invalid), `skipped` (could not be executed as described, e.g. its
`Seed` was answered differently), or `errored` (the attempt itself broke). A check assigns
every transaction exactly one outcome, and any outcome but `passed` fails the run.
_Avoid_: status, result

Distinct from the report model's `Execution`, which is one rule at one location: an `Outcome`
belongs to a transaction, an `Execution` to a rule. Both are defined in the project context.

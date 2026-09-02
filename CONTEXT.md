# Thymian

The context for `thymian`, the core HTTP conformance and API governance tool. It extends the
Thymian workspace glossary and does not redefine anything in it. The
terms below are only what this project adds on top.

Package-internal vocabulary belongs one level further down, in the relevant
`packages/<pkg>/CONTEXT.md`: the event bus and emitter mechanics, action naming, the
rule-authoring API types, and the internals of the report model. What stays here is what a
user of the tool or a contributor across packages has to name.

## Language

Two labels appear under a term: `_Avoid_` lists words not to use, and `_In code_` records the
names the code itself uses for the same concept.

### Validation contexts

The three `Validation Context`s the workspace glossary names. Each is a CLI command, and each
carries a different name in the rule system than in the report model.

**Lint**:
The `Validation Context` that reads an `API Specification` alone and makes no HTTP request.
Drives `thymian lint`.
_In code_: `RuleType`/`mode` value `'static'`, rule function `lintRule`, rule context
`LintContext`, report `runType` `'lint'`.

**Test**:
The `Validation Context` that exercises an API's live endpoints, sending requests and checking
the responses against the `Thymian Format`. Drives `thymian test`.
_In code_: `RuleType`/`mode` value `'test'`, rule function `testRule`, rule context
`TestContext`, report `runType` `'test'`.

**Analyze**:
The `Validation Context` that evaluates recorded traffic after the fact, making no request of
its own. Drives `thymian analyze`.
_In code_: `RuleType`/`mode` value `'analytics'`, rule function `analyzeRule`, rule context
`AnalyzeContext`, report `runType` `'analyze'`.

`packages/core/src/rules/rule-execution-invariant.ts` holds the authoritative mapping, as
`ruleFnPropertyByType`. `RuleType` carries a fourth value, `'informational'`, which is not a
validation context — it is excluded from `ExecutableRuleType` and runs no rule function.

The two vocabularies are not reconciled: the report model uses this glossary's words, the rule
system does not, and the workspace glossary lists `mode` and `run type` under _Avoid_ though
both are type names in core. Renaming `RuleType` would break every rule package, so reconciling
them is an ADR, not a glossary edit. Until then, prefer `lint`/`test`/`analyze` in prose and
leave the code's own names alone.

### Extensibility

**Plugin**:
The unit of extensibility. Nearly all Thymian functionality is delivered as a plugin,
including the built-in capabilities; the framework itself only orchestrates them.
_Avoid_: extension, module, addon

**Proxy Plugin**:
A plugin that runs inside the Thymian process and forwards events and actions to plugins
outside it. Core never learns whether an event came from a local plugin or a remote one, which
is what keeps remote plugins out of the core contract. `websocket-proxy` is the built-in one.
_Avoid_: bridge, connector, adapter

**Remote Plugin**:
A plugin that runs outside the Thymian process and reaches it through a proxy plugin, letting
plugins be written in any language.

### The format

**Thymian Format**:
The protocol-agnostic intermediate representation of an `API Specification`: a graph of
request and response nodes joined by transaction edges, which every validation plugin reads
instead of the source document. Loaded by a plugin, and tree-serializable by contract.
_Avoid_: report format, report model, AST

**Transaction**:
A request paired with the response it expects — one edge in the `Thymian Format` graph, and
the unit that rules, samples, and selectors all address.
_Avoid_: interaction, exchange, call

### Rules and configuration

**Rule Set**:
A named group of rules, consumed as a unit by a plugin or a configuration, and distributable
as a package so it can be shared across projects, teams, and the wider community. May ship
`Profile`s alongside its rules.

**Rule Tag**:
A closed, two-level `category:member` classification of what a rule is _about_ —
`security`/`privacy` today — orthogonal to a `Rule Set`'s own topic organization (a directory,
a chapter). Owned by core and exhaustive at both levels: adding a member is a union widening,
not a config value. A tag on a rule is fully qualified and terminal; a _pattern_ matching
against tags may be partial (a bare category, or a future third level), which is why the two
are distinct types over the same string space.
_In code_: `RuleTag`, narrows the builder's `.tags()` (`packages/core/src/rules/rule-tags.ts`).

**Impossibility Reason**:
The closed vocabulary of _why_ a rule, or one context of an otherwise-executable rule,
asserts nothing. Two tiers: a **world-claim**, whole-rule and permanent, which is what makes
a rule `informational`; and a **per-context claim**, recorded in a coverage record, which
does not affect what the rule executes. `tool-limitation` is the only code in both tiers —
the one claim about Thymian's own implementation rather than about the world — and it must
cite a tracker issue, so a fixable gap cannot be written off forever by omission. Owned by
core with the same closure discipline as `Rule Tag`: adding a code is a union widening.
_In code_: `WorldReason` (tier 1, narrows `.type('informational', reason, note)`) and
`ContextReason` (tier 2), both in `packages/core/src/rules/rule-impossibility.ts`.

**Source**:
The external document — an RFC, a W3C specification, a working draft — a spec `Rule Set`
package derives its rules from and is measured against. Carried by the package itself (its
`url`, its `Coverage Record`'s revision), never asserted by an individual rule: a rule's own
`.url()` says where it is _explained_, not proof of where it _came from_. A self-referential
`Rule Set` — one that checks traffic against its own specification rather than an external
document — has no `Source` and carries no `Coverage Record`.
_Avoid_: spec, document, provenance (provenance is the _role_ a `Source` plays for a package,
not a synonym for the document itself)

**Source Unit**:
The smallest thing a `Rule Set`'s `Source` can be held to have covered — a normative
statement, a section, an ABNF production. Chosen per source and declared with its counting
rule, because sources differ in what they enumerate. Rules map to source units many-to-many.
_Avoid_: requirement, statement, clause

**Denominator**:
The count of source units a `Rule Set` is measured against, together with the counting rule
and source revision that produced it. A rule set may have no denominator; it may not have an
undeclared one.

**Coverage Record**:
A `Rule Set`'s account of itself — its `Denominator`, which `Source Unit`s its rules cover,
and for each rule what it can and cannot observe in each `Validation Context`, with a reason
wherever it cannot. Authored per rule, not per source unit: a rule's entry carries what it
covers, a declared-type-and-severity stamp, and a cell only for a context it does not
declare, or to mark a declared one heuristic — a declared context defaults to observable.
_In code_: `CoverageRecord`, `defineCoverage`, `packages/core/src/rules/rule-coverage.ts`.
_Avoid_: roadmap, manifest

**Convention Rule**:
A rule that asserts an obligation no `Source` imposes, over a mechanism a `Source` defines —
send HSTS at all, mark a session cookie `HttpOnly`. Lives in its source's own package, never
a package of its own. Ships `.severity('off')` with a real executable `.type()`, which is
what tells it apart from an `informational` rule; a shipped `Profile` may promote it.

**Profile**:
A named set of rule-configuration overrides that a rule set ships with its rules, so adopting
a curated configuration is one line of `Config` rather than a pasted block. An exception list
scoped to its own rule set: it names only the rules that deviate from shipped defaults, and
the user's `Config` still wins over it.
_Avoid_: preset, variant, flavour

**Config**:
The declarative file that selects the API specification, rules, and plugins for a run.
Optional; Thymian runs without one.

A rule's `Validation Context`s are not fixed by the rule that declares them: `rules.<id>.type`
in a `Config`, or in a `Profile`, replaces them outright rather than merging into them. That is
how a rule shipped for `lint` is narrowed to `analyze` and `test`, and how naming
`informational` alone retires a rule from executing while keeping it documented. A context
whose rule function the rule does not define is rejected when rules load, so the override
cannot silently register a rule that never runs.

### Sampling

**Sample**:
Test data for one `Transaction`, derived as a deterministic in-memory projection of the
`Thymian Format`. Virtual: nothing is written to disk as canonical state, so a sample cannot
drift from the specification it came from.
_Avoid_: fixture, mock, stub

**Selector**:
The address of exactly one `Transaction`, qualified by method, path, status, and the media
types the request and response nodes _declare_ — a declared media type earns its part whether
or not a body exists. Fully qualified by construction, so adding a status code or a media type
to the specification cannot silently change what an existing selector points at. Rendering is
total: a path or media type that would collide with the grammar is encoded, never rejected.
_Avoid_: pattern, matcher, glob

**Hook**:
A user-owned TypeScript function that shapes or authorizes a run — generating a sample,
running before or after a transaction, supplying credentials. Targeted by a `Selector` or by a
typed transaction filter. The only artifact in sampling the user owns, and the compiler is what
reports one that no longer matches anything.

### Reporting

**Report Format**:
The concrete shape of a Thymian report — this project's implementation of the workspace's
`Unified Report Format`, and the contract another tool's output is converted into.

**Execution**:
One rule evaluated at one location, carrying a status — `passed`, `failed` or `skipped` — and
its findings. A `Run` is a flat list of executions.
_Avoid_: result, check, test run

**Finding**:
This project's concrete `Governance Signal`: what a rule attaches to an `Execution`. Carried
whether the rule passed or not, so a pass that still has something to report is not discarded.
_Avoid_: message, note, diagnostic

**Severity**:
How loudly a failure is labelled — `error`, `warn`, `hint`, `info` — resolved per failed
`Execution` for display and for the report's summary counts. Presentational only: it does not
decide whether a run passed, and a `hint` violation fails a run exactly as an `error` does.
_Avoid_: level, priority, importance

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

**Profile**:
A named set of rule-configuration overrides that a rule set ships with its rules, so adopting
a curated configuration is one line of `Config` rather than a pasted block. An exception list
scoped to its own rule set: it names only the rules that deviate from shipped defaults, and
the user's `Config` still wins over it.
_Avoid_: preset, variant, flavour

**Config**:
The declarative file that selects the API specification, rules, and plugins for a run.
Optional; Thymian runs without one.

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

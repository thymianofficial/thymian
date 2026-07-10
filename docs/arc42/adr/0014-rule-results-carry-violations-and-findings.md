# ADR-0014: Rule results carry violations and findings via a single `RuleFnResult`

| Status   | Date       | Supersedes | Superseded by |
| -------- | ---------- | ---------- | ------------- |
| Accepted | 2026-06-18 | —          | —             |

## Context

While building the tool-run-centric Report Format v4 (issue #323, Epic 3), the
result type returned by rule validation functions (`RuleFnResult`) was reworked
several times. Two problems surfaced:

1. **Pass/violation signalling was awkward.** An interim design used a
   `violationMessage?: string` field where _any_ defined value (including the
   empty string `''`) meant "violation" and `undefined` meant "pass". This
   conflated the presence of a violation with the presence of a message and made
   the four legitimate states (pure pass, pass-with-findings,
   violation-without-message, violation-with-message) hard to express.

2. **Findings on a passing result were dropped.** Rules could attach
   `RuleFinding[]` to a result, but the analyzer/linter consumption path
   (`runRulesResultToViolations` → `executionsFromViolations`) only read
   violations. A rule that passed but produced findings (e.g. the
   `*-conforms-to-schema` rules emitting `assertion-success` findings) lost that
   information before it reached the report.

In addition, rules had a second, imperative way to report violations:
`ApiContext.reportViolation()` writing into a per-context `pendingViolations`
side-channel that each `validate*`/`httpTest` call flushed into its return value.
This duplicated the return-value path and made the data flow hard to follow.

## Decision

We will represent a single rule validation result as:

```ts
export type RuleViolation = { message?: string };

export type RuleFnResult = {
  location: RuleViolationLocation; // always present
  violation?: RuleViolation; // present => violation; absent => pass
  findings: RuleFinding[]; // may be populated on pass or violation
};
```

- **A violation is signalled by the presence of the `violation` field**, not by a
  message string. The optional `violation.message` carries the human-readable
  text; when absent the rule runner falls back to the rule's summary/description.
- **`location` is always present** so every result — pass or violation — can be
  grouped into a report `Execution`.
- **Findings are consumed centrally in core.** A new
  `executionsFromRunRulesResult(result, rules, format)` maps _both_ the
  `violation` and the `findings` of every `RuleFnResult` into report executions,
  so analyzer and linter surface findings-on-pass automatically. A result with
  neither a violation nor findings carries no information and is skipped (no
  empty execution is emitted).
- **`reportViolation()` / `pendingViolations` are removed.** All information flows
  through the returned `RuleFnResult[]`. Rules that previously reported
  imperatively now accumulate results into the array they return (the
  closure-accumulator pattern for `httpTest(...).transactions(...)` callbacks).
- **`collectTestCaseDiagnostics` (plugin-http-tester) becomes metadata-only.** It
  no longer derives violations from failed test cases; violations originate
  exclusively from the explicit `RuleFnResult[]` a rule returns. The test plugin
  matches each returned violation to its test case by transaction id.

## Consequences

**Positive:**

- The four result states are expressible and unambiguous; violation detection no
  longer depends on a sentinel empty string.
- Findings emitted by passing rules reach the report instead of being silently
  dropped.
- A single, explicit data path (the returned `RuleFnResult[]`) — no parallel
  imperative side-channel — makes rule behaviour easier to reason about and test.

**Negative:**

- Every rule that used `violationMessage` or `reportViolation()` had to be
  migrated (39 rfc-9110 rules, 6 conforms-to-schema rules, ~10 rules using
  `reportViolation`, three plugin API contexts, core types and consumers).
- Test-mode rules can no longer rely on auto-violations derived from failed
  assertions; they must collect violations explicitly into their return value.

**Neutral:**

- Guard clauses for "cannot evaluate" cases (e.g. no matching endpoint or a
  missing transaction) now return a `rule-skip` finding with an explanatory
  message instead of a bare `[]`. The central consumer emits an execution for it
  (because `findings.length > 0`), so the skip is surfaced in the report rather
  than dropped silently. Plain `return []` guards elsewhere remain inert (a pure
  pass with no findings is skipped by the consumer regardless).

## Addendum (2026-07-07): the target `Execution` shape went flat

This ADR's `RuleFnResult` decision (violation/findings signalling, centralized
consumption via `executionsFromRunRulesResult`) is unchanged and still
accurate. What changed afterwards, in Story 5 (#334), is the shape of the
report `Execution` that `RuleFnResult`s are mapped _into_:

- At the time this ADR was accepted, `Execution` was hierarchical:
  `Execution.children` (recursive) plus `nestedFindings`.
- Story 5 replaced that with a **flat, per-runType** model: `LintExecution`/
  `AnalyzeExecution` (`location` + `findings`, no children) and
  `TestCaseExecution` (`name` + `steps`, findings live on the step). There is
  no `children`/`nestedFindings` anywhere in the current model — a run is a
  flat list of leaf executions (`packages/core/src/report/report.ts`).
- The finding-kind set also shrank to `rule-violation | informational |
assertion-failure | assertion-success`, and severity moved off findings
  onto `ExecutionStatus`/rule lookup (`resolveExecutionSeverity`), consistent
  with this ADR's "findings are consumed centrally" principle but not
  something this ADR originally specified.
- One consequence worth calling out: `assertion-failure`/`assertion-success`
  findings (e.g. from the `*-conforms-to-schema` rules) surface on **`lint`
  and `analyze`** executions, not just on test steps — the same
  `executionsFromRunRulesResult` → `statusAndFindingsFromEntry` path this ADR
  describes handles both run types identically. PR #311 fixed a rendering gap
  where the markdown formatter's lint/analyze section rendered only
  `informational` findings and silently dropped `assertion-failure` detail.

No standalone ADR for the flat `Execution` model exists yet; until one is
written, `_bmad-output/implementation-artifacts/tech-spec-report-datamodel-per-runtype-executions.md`
is the source of record for that decision.

## Related

- [ADR-0007](0007-core-owns-validation-entrypoints-plugins-own-execution.md):
  Core owns validation entrypoints; this ADR refines the result type that crosses
  that boundary.
- [ADR-0009](0009-rule-system-as-core-concern.md): The rule system is a core
  concern; `RuleViolation`/`RuleFnResult` live in core and are consumed centrally.
- [ADR-0012](0012-http-test-framework-absorption-into-core.md): HTTP test
  framework in core, whose results feed `RuleFnResult.findings`.
- [ADR-0015](0015-cli-exit-status-is-severity-independent.md): What determines
  the CLI exit status, downstream of the `ExecutionStatus` this ADR's
  `RuleFnResult`s are mapped into.

---

## Status History

| Date       | Status   | Notes                                                                                                                                                                       |
| ---------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-06-18 | Accepted | Reintroduce `RuleViolation`, restore findings-on-pass, remove `reportViolation` (Story 4, #333)                                                                             |
| 2026-07-07 | Accepted | Addendum: note the flat per-runType `Execution` model (Story 5, #334) that superseded the hierarchical `children`/`nestedFindings` shape this ADR's consumer originally fed |

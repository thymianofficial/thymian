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

## Related

- [ADR-0007](0007-core-owns-validation-entrypoints-plugins-own-execution.md):
  Core owns validation entrypoints; this ADR refines the result type that crosses
  that boundary.
- [ADR-0009](0009-rule-system-as-core-concern.md): The rule system is a core
  concern; `RuleViolation`/`RuleFnResult` live in core and are consumed centrally.
- [ADR-0012](0012-http-test-framework-absorption-into-core.md): HTTP test
  framework in core, whose results feed `RuleFnResult.findings`.

---

## Status History

| Date       | Status   | Notes                                                                                           |
| ---------- | -------- | ----------------------------------------------------------------------------------------------- |
| 2026-06-18 | Accepted | Reintroduce `RuleViolation`, restore findings-on-pass, remove `reportViolation` (Story 4, #333) |

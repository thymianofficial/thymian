# ADR-0026: Rules are tested through each context's real engine

| Status   | Date       | Supersedes | Superseded by |
| -------- | ---------- | ---------- | ------------- |
| Accepted | 2026-11-13 | —          | —             |

## Context

A rule declares the validation contexts it runs in: `static`, `test` and `analytics`. A rule
author wants to show, in ordinary unit tests, that the rule does the right thing in each of
them. Three things made that harder than it should be.

**Calling the rule function directly proves little.** What a rule means in a context is
decided by that context's engine: the linter asks `appliesTo` of the specification, the
analyzer of the recorded pair, the tester of both
([ADR-0025](0025-applicability-and-violation-condition.md)). A test that hands the rule a
hand-made context tests the hand-made context.

**Counting violations is not enough.** With two transactions and "exactly one violation", a
rule that flags the wrong transaction passes too. A test has to say _which_ transaction was
flagged, and it has to show the rule's scope: what it flags, what it looks at and accepts,
and what it does not speak about at all. Rules that apply to only some endpoints are the
normal case.

**The engines cannot tell "accepted" from "ignored".** The linter and the analyzer report
what a rule returns, and a rule returns its violations
([ADR-0014](0014-rule-results-carry-violations-and-findings.md)). A transaction the rule
looked at and found in order, and one outside its applicability, both simply do not appear.

The `Fixture` of [ADR-0021](0021-http-security-rule-sets.md) answered a narrower question,
one input a rule must flag and one it must pass per declared context, and was tied to the
rule sets of this repository and their test runner. It does not give a third-party rule
author a way to test a rule, and it does not show a rule's scope.

## Decision

We will test a rule by running it through the real engine of each validation context it
declares, and return what the rule said about **every transaction** of the input.

- **One package, plain data.** `@thymian/rules-testing` exports `runRule(rule)`, which gives
  one function per context, named as in the rule's `.type(...)`. The input is a Thymian
  format built with the `@thymian/core-testing` factories; a transaction is named by the id
  that adding it returns. The output is a list of executions as plain data, with no
  dependency on a test framework.
- **The context's own engine evaluates the rule.** In `static` that is the linter's context,
  driven by core's rule runner and report builder as `thymian lint` drives it. The harness
  does not reimplement what a context does with a rule.
- **Any rule runs, as it ships.** The rule runner leaves a rule with severity `off` out, so
  the harness hands it to the engine enabled, on a copy, and reports the severity the rule
  declares. `runRule(rule, { options })` passes the rule's options through the rules
  configuration, checked against the rule's options schema first, which is the way the
  options of a config reach a rule.
- **Four statuses.** `failed`, `passed` and `skipped` as the engines know them, and
  `notApplicable` for a transaction outside the rule's `Applicability`. `notApplicable`
  exists only in what `runRule` returns; the engines and the report format keep three.
- **The harness works out `passed` and `notApplicable` itself,** because the linter and the
  analyzer report only violations. It reads the `appliesTo` the rule states in its
  rule-context calls and asks it of the format, through the context, in a call of its own. A
  transaction it accepts that the engine reported nothing on is `passed`; one it rejects is
  `notApplicable`. A rule whose applicability cannot be read from outside, because it
  decides in a plain callback, gets `passed` for every transaction it did not flag.
- **Locations are the engine's.** An execution carries the location the engine reported: a
  transaction, a node, or a free string. The one addition is the readable label: where a
  node or transaction location has none, the harness fills in the label a report prints for
  it, so a failing comparison names the transaction although ids are hashes. An execution
  also carries the findings the report builder gives it, on a pass as on a violation.
  `notApplicable` and `passed` are filled in for transactions only.
- **Rule tests replace the `Fixture`** as the way to show that a rule works in a context.
  The fixture modules of the existing rule sets, and the records that describe them, stay
  as they are until those rule sets are moved onto rule tests.

### Rejected alternative: the engines report passes

The linter and the analyzer could emit a `passed` execution for every applicable
transaction, and the harness would only add `notApplicable`. Rejected:

- It changes what every normal run produces. A lint of a real API would carry one execution
  per rule per applicable transaction, in the report, in every formatter and in every
  summary count, to serve a test harness.
- It still leaves `notApplicable` to the harness, so the harness reads the stated
  `appliesTo` either way.
- It does not help the rule that decides in a callback: such a rule returns nothing for a
  transaction it accepts, and no engine can report a pass it was never told about.

## Consequences

**Positive:**

- A rule test states an API and the executions expected, and fails when the rule flags the
  wrong transaction or reaches outside its scope.
- A third-party rule author tests a rule with one package next to `@thymian/core-testing`,
  in any test framework.
- The engines and the report format are unchanged by rule testing.

**Negative:**

- The harness evaluates `appliesTo` in a call of its own, beside the engine's evaluation of
  the rule, so the `passed`/`notApplicable` split is the harness's reading and not the
  engine's. In `static` both calls go through the linter's filter, so a fault in that filter
  moves both sides alike and a rule test does not expose it. Accepted: a rule test tests the
  rule, and the engines' filters have tests of their own.
- For a rule that decides applicability in a plain callback, `passed` cannot be told from
  `notApplicable`. Stating `appliesTo` as a filter expression is what makes a rule's scope
  testable.
- The harness observes the rule-context calls a rule makes. A new rule-context method that
  takes an applicability has to be made known to it.

**Neutral:**

- `@thymian/rules-testing` is not a rule set although it carries the `rules-` prefix of
  [ADR-0008](0008-package-naming-conventions.md), as `core-testing` is not core.
- Whether a spec rule set must still prove something per rule per declared context, the
  fixture bar of [ADR-0021](0021-http-security-rule-sets.md), and how that would be
  enforced with rule tests, is not decided here.

## Related

- [ADR-0025](0025-applicability-and-violation-condition.md): the `appliesTo` the harness
  reads, and what it means in each context
- [ADR-0014](0014-rule-results-carry-violations-and-findings.md): what a rule returns, and
  why a pass usually leaves no trace
- [ADR-0021](0021-http-security-rule-sets.md): the `Fixture` this replaces
- [ADR-0009](0009-rule-system-as-core-concern.md): the core rule runner the harness drives
- [Chapter 8](../08-crosscutting-concepts.md): rule contexts

---

## Status History

| Date       | Status   | Notes         |
| ---------- | -------- | ------------- |
| 2026-11-13 | Accepted | Initial draft |

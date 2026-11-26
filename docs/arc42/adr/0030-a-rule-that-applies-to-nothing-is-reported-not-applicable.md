# ADR-0030: A rule that applies to nothing is reported `notApplicable`

| Status   | Date       | Supersedes | Superseded by |
| -------- | ---------- | ---------- | ------------- |
| Accepted | 2026-11-23 | —          | —             |

## Context

A rule whose `Applicability` accepts no transaction leaves no trace in the report. In `Test`,
`forTransactionsWith(appliesTo)` builds no test case, and `createRuns`
(`packages/plugin-http-tester/src/index.ts`) emits zero executions for the rule. The same
happens when `skipOrigins` filters out every transaction the rule would have matched. In
`Lint` and `Analyze` it is the same, for another reason: those contexts return only
violations, so a rule that applied to nothing looks exactly like one that passed everywhere,
and both look like a rule that was never loaded. Only `ToolRun.rules` still names it.

The user cannot tell "this rule had nothing to judge here" from "this rule did not run".

Since [ADR-0025](0025-applicability-and-violation-condition.md), `Test` asks `appliesTo` a
second time, of the pair that came back. A pair it rejects is dropped before `violatedWhen`.
[ADR-0028](0028-rule-context-calls-judge-the-live-status.md) reports that pair as a
`rule-skip`, so the case reads `skipped`, with a reason that names the declared and the live
status. That keeps a 405 rule from passing on a 204 response it never judged, but it puts the
pair in the bucket for "had something to judge and could not", while the rule had nothing to
judge there.

`rules-testing` already knows the missing outcome. It reports `notApplicable` for each
transaction outside a rule's applicability, and its type documented that the engines and the
report do not know it.

Alternatives considered:

- **A `skipped` execution with a reason.** No model change, but `skipped` already means "had
  something to judge and could not" (a status-code mismatch, a `rule-skip`). The two would
  differ only in free text, which is the confusion being fixed.
- **A rule-level fact on the run** (an outcome on `RuleDescriptor`, or renderers listing the
  rules in `ToolRun.rules` that have no execution). It keeps executions as "rule at a
  location", but it cannot carry a reason, and in `Lint`/`Analyze` "no execution" also means
  "passed everywhere".
- **A warning in the log only.** The report would still be silent.

## Decision

We will add a fourth `ExecutionStatus` kind, `notApplicable`, spelled as `rules-testing`
already spells it. It means that the rule's `Applicability` accepted nothing it observed. It
is not a failure: it never changes the exit status ([ADR-0015](0015-cli-exit-status-is-severity-independent.md)).

- **Rule level.** When no rule-context call of a rule accepted any transaction, the rule gets
  one `notApplicable` execution. The rule context records what `appliesTo` accepted; the
  count of executions cannot be used, since `Lint` and `Analyze` report only violations. A
  rule that makes no rule-context call and returns nothing counts as applying to nothing.
- **Case level, `Test`.** A test case that ran and whose every transaction was rejected by
  the live re-check of `appliesTo` is `notApplicable`, not `passed` and not `skipped`. This
  amends [ADR-0028](0028-rule-context-calls-judge-the-live-status.md), which reported such a
  pair as a `rule-skip`: the rule-context call returns nothing for a rejected pair, as `Lint`
  and `Analyze` return nothing for a transaction outside `appliesTo`, and the case carries
  ADR-0028's reason, naming the declared and the live status where they differ. A grouped
  case none of whose members applies is `notApplicable` with the group's reason. The order of
  status in a case is `failed` > `skipped` > `notApplicable` > `passed`. A case that is partly
  rejected is reported on the transactions it judged. A case built by a bespoke
  `ctx.httpTest` pipeline has no `appliesTo` and is never `notApplicable`.
- **The reason says why.** A rule-level `notApplicable` names one of two causes: the input
  has no transaction the rule applies to, or `skipOrigins` excluded every one that it did.
- **Its subject, in `Test`.** A `TestCaseExecution` with `steps: []` and a name saying what
  was empty. The model is not changed for it. `Lint` and `Analyze` decide their own subject
  when they adopt this decision: a custom location, or a new location variant for the whole
  input.
- **Rendering.** A `notApplicable` with a reason gets a row with that reason: the rule-level
  one, and a case-level one, which takes the row ADR-0028's skip had. A case-level one
  without a reason is counted only, and is hidden under `rule`/`severity` grouping the way
  `passed` is. The summary counts `notApplicable` beside `failed`, `skipped` and `passed`.
  It has its own symbol and its own bucket under `severity` grouping, never `skipped`'s.
- **Schema.** The report schema's status enum gains `notApplicable`. An older Thymian rejects
  a report that contains it; Thymian is pre-1.0, and a release note says so.
- **`rules-testing`** derives its status type from `ExecutionStatus['kind']`, takes a
  case-level `notApplicable` from the tester as reported, with its reason, and leaves the
  rule-level execution out of its list, where every transaction already says
  `notApplicable`. A member of a group the live re-check rejects is `notApplicable` with its
  own pair's reason, whether or not the other members were judged.

## Consequences

**Positive:**

- A rule that had nothing to judge is visible, with the reason, so a user can tell their
  specification or their `skipOrigins` apart from a rule that never ran.
- `passed` no longer overstates coverage in `Test`.
- `Test` and `rules-testing` agree: a transaction ruled out by its live pair was `skipped`
  in `test`, and a rejected member of a judged group `passed`, where `static` and
  `analytics` say `notApplicable`.
- The status maps onto SARIF's `notApplicable` result kind.

**Negative:**

- A change to the Report Format: every renderer, formatter and summary handles a fourth kind,
  and the report schema's status enum widens. A report written by this version is rejected by
  an older Thymian reading it back for `merge` or `diff`.
- The rule context must record what `appliesTo` accepted, and for the reason, what it would
  have accepted without `skipOrigins`.
- Until the `Lint` and `Analyze` follow-ups land, the three contexts report "applied to
  nothing" differently.
- An override that states its applicability with `skipIf` reports a rejected pair `skipped`,
  where a rule-context call reports it `notApplicable`.

**Neutral:**

- The glossary's `Execution` keeps "one rule at one location"; a rule-level `notApplicable`
  in `Test` is located on the empty case.

## Related

- [ADR-0014](0014-rule-results-carry-violations-and-findings.md): the `RuleFnResult` →
  `ExecutionStatus` mapping this widens.
- [ADR-0015](0015-cli-exit-status-is-severity-independent.md): only `failed` fails a run.
- [ADR-0020](0020-report-inputs-are-cli-only-for-merge-and-diff.md): stored reports are read
  back, which is why the schema change matters.
- [ADR-0025](0025-applicability-and-violation-condition.md): the live re-check of
  `appliesTo` that makes a case `notApplicable`.
- [ADR-0028](0028-rule-context-calls-judge-the-live-status.md): amended here; a pair its live
  re-check rejects is `notApplicable`, not a `rule-skip`.

---

## Status History

| Date       | Status   | Notes                       |
| ---------- | -------- | --------------------------- |
| 2026-11-23 | Accepted | Initial draft (ticket #780) |
